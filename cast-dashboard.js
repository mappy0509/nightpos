// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    doc,
    collection 
} from './firebase-init.js';

// (★新規★) 新しい参照をインポート
import {
    settingsRef,
    menuRef,
    slipCounterRef,
    castsCollectionRef,
    customersCollectionRef,
    slipsCollectionRef
} from './firebase-init.js';


// ===== グローバル定数・変数 =====

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (★変更★) state を分割して管理
let settings = null;
let menu = null;
let casts = [];
let customers = [];
let slips = [];
let slipCounter = 0; // (このJSでは使わないが、他から流用)

// (★新規★) 開発用のログインキャストID (本来は認証情報から取得)
let DEV_CAST_ID = null; 
let DEV_CAST_NAME = "キャスト";

// ===== DOM要素 =====
// (★新規★) cast-dashboard.html (実績確認ページ) に必要なDOM
let castHeaderName, headerDate,
    summaryCastTodaySales, summaryCastTodayNoms,
    summaryCastMonthSales, summaryCastMonthNoms,
    summaryCastPay, summaryCastWorkdays,
    castCustomerList;

// (★削除★) 伝票操作モーダル関連のDOMをすべて削除


// --- 関数 ---

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    return `¥${amount.toLocaleString()}`;
};

// =================================================
// (★新規★) 営業日計算ヘルパー (dashboard.js から移植)
// =================================================

/**
 * (★新規★) 営業日付の開始時刻を取得する
 * @param {Date} date 対象の日付
 * @returns {Date} 営業開始日時
 */
const getBusinessDayStart = (date) => {
    if (!settings || !settings.dayChangeTime) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }
    
    const [hours, minutes] = settings.dayChangeTime.split(':').map(Number);
    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);
    
    if (date.getTime() < startDate.getTime()) {
        startDate.setDate(startDate.getDate() - 1);
    }
    
    return startDate;
};

/**
 * (★新規★) 営業日付の終了時刻を取得する
 * @param {Date} businessDayStart 営業開始日時
 * @returns {Date} 営業終了日時 (翌日の営業開始 - 1ミリ秒)
 */
const getBusinessDayEnd = (businessDayStart) => {
    const endDate = new Date(businessDayStart);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    return endDate;
};

/**
 * (★新規★) 指定された期間の伝票(会計済み・ボツ)を取得する
 * @param {string} period 'daily', 'weekly', 'monthly'
 * @param {Date} baseDate 基準日
 * @returns {object} { paidSlips: [] }
 */
const getSlipsForPeriod = (period, baseDate) => {
    if (!slips) {
        return { paidSlips: [] };
    }

    let startDate, endDate;
    const businessDayStart = getBusinessDayStart(baseDate);

    if (period === 'daily') {
        startDate = businessDayStart;
        endDate = getBusinessDayEnd(businessDayStart);
    } 
    else if (period === 'monthly') {
        startDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth(), 1);
        startDate = getBusinessDayStart(startDate); 
        endDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth() + 1, 0); 
        endDate = getBusinessDayEnd(getBusinessDayStart(endDate)); 
    } else {
        return { paidSlips: [] };
    }

    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const paidSlips = slips.filter(slip => {
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        const paidTime = new Date(slip.paidTimestamp).getTime();
        return paidTime >= startTimestamp && paidTime <= endTimestamp;
    });

    return { paidSlips };
};


// =================================================
// (★新規★) キャストダッシュボード専用ロジック (UI改修版)
// =================================================

/**
 * (★新規★) キャストのサマリーを描画する
 */
const renderCastDashboardSummary = () => {
    if (!slips || !DEV_CAST_ID) return; // IDがセットされるまで待つ

    // 1. 本日のデータ
    const { paidSlips: todayPaidSlips } = getSlipsForPeriod('daily', new Date());
    let todaySales = 0;
    let todayNoms = 0;
    todayPaidSlips.forEach(slip => {
        if (slip.nominationCastId === DEV_CAST_ID) {
            // (★重要★) 将来的に、ここで settings.performanceSettings に基づく
            // 詳細な売上計算（バック率など）を行う
            todaySales += (slip.paidAmount || 0); // (★現在は仮★ 伝票の売上をそのまま計上)
            todayNoms += 1;
        }
    });
    
    // 2. 今月のデータ
    const { paidSlips: monthPaidSlips } = getSlipsForPeriod('monthly', new Date());
    let monthSales = 0;
    let monthNoms = 0;
    monthPaidSlips.forEach(slip => {
        if (slip.nominationCastId === DEV_CAST_ID) {
            // (★重要★) 将来的に、ここで settings.performanceSettings に基づく
            // 詳細な売上計算（バック率など）を行う
            monthSales += (slip.paidAmount || 0); // (★現在は仮★ 伝票の売上をそのまま計上)
            monthNoms += 1;
        }
    });
    
    // 3. 報酬・出勤 (★ダミー★)
    // (※ 将来的にロジックを実装)
    const monthPay = monthSales * 0.4; // (★仮★ 売上の40%を報酬とする)
    const workDays = 10; // (★仮★)
    
    // 4. DOMに反映
    if (summaryCastTodaySales) summaryCastTodaySales.textContent = formatCurrency(todaySales);
    if (summaryCastTodayNoms) summaryCastTodayNoms.innerHTML = `${todayNoms} <span class="text-base">組</span>`;
    if (summaryCastMonthSales) summaryCastMonthSales.textContent = formatCurrency(monthSales);
    if (summaryCastMonthNoms) summaryCastMonthNoms.innerHTML = `${monthNoms} <span class="text-lg">組</span>`;
    if (summaryCastPay) summaryCastPay.textContent = formatCurrency(monthPay);
    if (summaryCastWorkdays) summaryCastWorkdays.innerHTML = `${workDays} <span class="text-base">日</span>`;
    
    // 5. ヘッダーに名前を表示
    if (castHeaderName) castHeaderName.textContent = DEV_CAST_NAME;
};

/**
 * (★新規★) キャストの指名顧客一覧を描画する
 */
const renderCastCustomerList = () => {
    if (!castCustomerList || !customers || !DEV_CAST_ID) return;
    
    // (★変更★) 自分の指名顧客のみフィルタリング
    const myCustomers = customers.filter(
        cust => cust.nominatedCastId === DEV_CAST_ID
    );
    
    // (★仮★) 最終来店日をソート (※現状は顧客データに最終来店日がないため、ダミーで名前ソート)
    myCustomers.sort((a,b) => a.name.localeCompare(b.name));
    
    castCustomerList.innerHTML = '';
    
    if (myCustomers.length === 0) {
        castCustomerList.innerHTML = '<p class="text-slate-500 text-sm p-4 text-center">まだ指名顧客が登録されていません。</p>';
        return;
    }
    
    // (★変更★) 顧客リストのUI
    myCustomers.slice(0, 5).forEach(cust => { // (★仮★) 上位5件のみ表示
        // (※ 将来的に slips から最終来店日を計算するロジックが必要)
        const lastVisit = "最終来店: (ロジック未実装)"; 
        
        const itemHTML = `
            <div class="bg-white p-4 rounded-xl shadow border border-slate-200 flex justify-between items-center">
                <div>
                    <p class="font-semibold">${cust.name}</p>
                    <p class="text-xs text-slate-500">${lastVisit}</p>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-400"></i>
            </div>
        `;
        castCustomerList.innerHTML += itemHTML;
    });
};


/**
 * (★新規★) ヘッダーの日付を更新する
 */
const updateHeaderDate = () => {
    if (!headerDate) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
    const weekdayStr = now.toLocaleDateString('ja-JP', { weekday: 'short' });
    headerDate.textContent = `${dateStr} (${weekdayStr})`;
};

// (★削除★) 伝票操作関連の関数をすべて削除
// renderOrderModal, renderSlipTags, toggleSlipTag, renderCustomerDropdown,
// updateSlipInfo, addOrderItem, removeOrderItem, updateOrderItemQty,
// renderSlipPreviewModal, renderCheckoutModal, updatePaymentStatus,
// renderReceiptModal, renderCancelSlipModal, createNewSlip,
// renderSlipSelectionModal, renderNewSlipConfirmModal,
// handleSlipClick, handlePaidSlipClick

// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
// (※ データ構造の基盤となるため、このファイルにも定義を残します)
const getDefaultSettings = () => {
    return {
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
        ],
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
        ],
        storeInfo: {
            name: "Night POS", address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000", zip: "160-0021"
        },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
        performanceSettings: {
            menuItems: {
                'm14_default': { salesType: 'percentage', salesValue: 100, countNomination: true }
            },
            serviceCharge: { salesType: 'percentage', salesValue: 0 },
            tax: { salesType: 'percentage', salesValue: 0 },
            sideCustomer: { salesValue: 100, countNomination: true }
        },
        ranking: { period: 'monthly', type: 'nominations' }
    };
};

const getDefaultMenu = () => {
    const catSetId = getUUID();
    const catDrinkId = getUUID();
    const catCastId = getUUID(); 
    
    return {
        categories: [
            { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false },
            { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false },
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true }, 
        ],
        items: [
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null },
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};


// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    const { 
        settingsRef, menuRef, slipCounterRef,
        castsCollectionRef, customersCollectionRef, slipsCollectionRef
    } = e.detail;

    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) cast-dashboard.js は専用関数を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded) {
            console.log("All data loaded. Rendering UI for cast-dashboard.js");
            
            // (★新規★) 開発用キャストIDを設定
            if (casts.length > 0) {
                // (★仮★) 本来は認証ユーザーIDと紐づくキャストIDを使う
                // 開発用として、リストの先頭のキャストIDを使用する
                DEV_CAST_ID = casts[0].id; 
                DEV_CAST_NAME = casts[0].name;
                console.log(`DEV_CAST_ID set to: ${DEV_CAST_ID} (${DEV_CAST_NAME})`);
            } else {
                console.warn("No casts found. Defaulting DEV_CAST_ID to null.");
                DEV_CAST_ID = null;
                DEV_CAST_NAME = "キャスト未登録";
            }
            
            // (★変更★) 呼び出す関数を変更
            renderCastDashboardSummary();
            renderCastCustomerList();
            updateHeaderDate();
            // (★削除★) 注文モーダルは無いため updateModalCommonInfo は不要
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.log("No settings document found. Creating default settings...");
            const defaultSettings = getDefaultSettings();
            await setDoc(settingsRef, defaultSettings);
            settings = defaultSettings;
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // 2. Menu
    onSnapshot(menuRef, async (docSnap) => {
        if (docSnap.exists()) {
            menu = docSnap.data();
        } else {
            console.log("No menu document found. Creating default menu...");
            const defaultMenu = getDefaultMenu();
            await setDoc(menuRef, defaultMenu);
            menu = defaultMenu;
        }
        menuLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to menu: ", error));

    // 3. Slip Counter
    onSnapshot(slipCounterRef, async (docSnap) => {
        if (docSnap.exists()) {
            slipCounter = docSnap.data().count;
        } else {
            console.log("No slip counter document found. Creating default counter...");
            await setDoc(slipCounterRef, { count: 0 });
            slipCounter = 0;
        }
        counterLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to slip counter: ", error));

    // 4. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));

    // 5. Customers
    onSnapshot(customersCollectionRef, (querySnapshot) => {
        customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ ...doc.data(), id: doc.id });
        });
        console.log("Customers loaded: ", customers.length);
        customersLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to customers: ", error));
    
    // 6. Slips
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id }); 
        });
        console.log("Slips loaded: ", slips.length);
        slipsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to slips: ", error);
        if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
             document.body.innerHTML = `<div class="p-8 text-center text-red-600">データベースへのアクセスに失敗しました。Firestoreのセキュリティルール（slipsコレクション）が正しく設定されているか、または必要なインデックスが作成されているか確認してください。</div>`;
        }
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    castHeaderName = document.getElementById('cast-header-name');
    headerDate = document.getElementById('header-date');
    summaryCastTodaySales = document.getElementById('summary-cast-today-sales');
    summaryCastTodayNoms = document.getElementById('summary-cast-today-noms');
    summaryCastMonthSales = document.getElementById('summary-cast-month-sales');
    summaryCastMonthNoms = document.getElementById('summary-cast-month-noms');
    summaryCastPay = document.getElementById('summary-cast-pay');
    summaryCastWorkdays = document.getElementById('summary-cast-workdays');
    castCustomerList = document.getElementById('cast-customer-list');
    
    // (★削除★) 注文モーダル関連のDOM取得を削除
    // orderModal = document.getElementById('order-modal');
    // ... (以下すべて削除) ...
    modalCloseBtns = document.querySelectorAll('.modal-close-btn'); // (★削除★) モーダルが無いため不要
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★削除★) 注文モーダル関連のリスナーをすべて削除
    // (modalCloseBtns, castActiveSlips, orderNominationSelect, etc...)

});