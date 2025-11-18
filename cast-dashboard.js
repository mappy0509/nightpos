// (変更) db, auth, onSnapshot, signOut のみ 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    signOut // (★新規★)
    // (★エラー修正★) 以下の関数は firebaseReady イベント経由で受け取る
    // setDoc, 
    // doc,
    // collection,
    // getDoc, 
} from './firebase-init.js';

// (★変更★) 参照は firebaseReady イベントで受け取る
let settingsRef, menuRef, slipCounterRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef;
    // (★削除★) attendancesCollectionRef を削除

// (★エラー修正★) firebaseReady から受け取る関数
let fbDoc, fbGetDoc, fbSetDoc, fbCollection;
// (★修正★) このファイルでは使わないが、他ファイルとの一貫性のために定義
let fbQuery, fbWhere, fbOrderBy, fbAddDoc, fbDeleteDoc, fbServerTimestamp;


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
// let attendances = []; // (★削除★)
let slipCounter = 0; // (このJSでは使わないが、他から流用)

// (★変更★) ログイン中のキャストIDと名前
let currentCastId = null; 
let currentCastName = "キャスト";

// ===== DOM要素 =====
// (★新規★) cast-dashboard.html (実績確認ページ) に必要なDOM
let castHeaderName, headerDate,
    summaryCastTodaySales, summaryCastTodayNoms,
    summaryCastMonthSales, summaryCastMonthNoms,
    // (★削除★) summaryCastPay, summaryCastWorkdays を削除
    castCustomerList,
    logoutButtonHeader; // (★新規★)

// (★削除★) 伝票操作モーダル関連のDOMをすべて削除


// --- 関数 ---

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        amount = 0;
    }
    return `¥${amount.toLocaleString()}`;
};

/**
 * (★修正★) Dateオブジェクトを 'YYYY-MM-DD' 形式の文字列に変換する
 * (getLastVisitDate で必要)
 * @param {Date} date 
 * @returns {string}
 */
const formatDateISO = (date) => {
    return date.toISOString().split('T')[0];
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
        try { // (★修正★)
            const paidTime = new Date(slip.paidTimestamp).getTime();
            if (isNaN(paidTime)) return false;
            return paidTime >= startTimestamp && paidTime <= endTimestamp;
        } catch(e) {
            return false;
        }
    });

    return { paidSlips };
};


// =================================================
// (★削除★) 報酬計算ロジック
// =================================================
// const calculatePayForSlip = (slip, castId) => { ... };


// =================================================
// (★修正★) 顧客リストロジック (cast-customers.js から移植)
// =================================================

/**
 * (★新規★) 顧客の最終来店日を計算する
 * @param {string} customerName 
 * @returns {string} 最終来店日の説明文字列
 */
const getLastVisitDate = (customerName) => {
    if (!slips || slips.length === 0 || !settings) {
        return "来店履歴なし";
    }

    const customerSlips = slips.filter(
        slip => slip.name === customerName && slip.status === 'paid' && slip.paidTimestamp
    );

    if (customerSlips.length === 0) {
        return "来店履歴なし";
    }

    try { // (★修正★)
        customerSlips.sort((a, b) => {
            try {
                return new Date(b.paidTimestamp).getTime() - new Date(a.paidTimestamp).getTime();
            } catch(e) { return 0; }
        });
        
        const lastVisitDate = new Date(customerSlips[0].paidTimestamp);
        if (isNaN(lastVisitDate.getTime())) return "来店履歴エラー"; // (★修正★)
        
        const todayBusinessStart = getBusinessDayStart(new Date());
        const lastVisitBusinessStart = getBusinessDayStart(lastVisitDate);

        // (★修正★) 営業日ベースで差を計算
        const diffTime = todayBusinessStart.getTime() - lastVisitBusinessStart.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        const dateStr = lastVisitDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

        if (diffDays === 0) {
            return `最終来店: ${dateStr} (本日)`;
        } else if (diffDays > 0 && diffDays <= 30) {
            return `最終来店: ${dateStr} (${diffDays}日前)`;
        } else {
            return `最終来店: ${dateStr}`;
        }
    } catch (e) {
        console.error("Error in getLastVisitDate: ", e);
        return "来店履歴エラー";
    }
};


// =================================================
// (★報酬削除★) キャストダッシュボード専用ロジック
// =================================================

/**
 * (★報酬削除★) キャストのサマリーを描画する
 */
const renderCastDashboardSummary = () => {
    if (!slips || !currentCastId || !settings) return; // (★修正★) settings も待つ

    // 1. 本日のデータ
    const { paidSlips: todayPaidSlips } = getSlipsForPeriod('daily', new Date());
    let todaySales = 0;
    let todayNoms = 0;
    todayPaidSlips.forEach(slip => {
        if (slip.nominationCastId === currentCastId) {
            // (★修正★) 「売上」は伝票の総額 (paidAmount) を計上
            todaySales += (slip.paidAmount || 0);
            todayNoms += 1;
        }
    });
    
    // 2. 今月のデータ
    const { paidSlips: monthPaidSlips } = getSlipsForPeriod('monthly', new Date());
    let monthSales = 0;
    let monthNoms = 0;
    // (★削除★) let monthPay = 0;
    
    monthPaidSlips.forEach(slip => {
        if (slip.nominationCastId === currentCastId) {
            // (★修正★) 「売上」は伝票の総額 (paidAmount) を計上
            monthSales += (slip.paidAmount || 0);
            monthNoms += 1;
            
            // (★削除★) 報酬計算を削除
            // monthPay += calculatePayForSlip(slip, castId);
        }
    });
    
    // 3. (★削除★) 出勤日数の計算を削除
    
    
    // 4. DOMに反映
    if (summaryCastTodaySales) summaryCastTodaySales.textContent = formatCurrency(todaySales);
    if (summaryCastTodayNoms) summaryCastTodayNoms.innerHTML = `${todayNoms} <span class="text-base">組</span>`;
    if (summaryCastMonthSales) summaryCastMonthSales.textContent = formatCurrency(monthSales);
    if (summaryCastMonthNoms) summaryCastMonthNoms.innerHTML = `${monthNoms} <span class="text-lg">組</span>`;
    
    // (★削除★) 報酬と出勤日数のDOM反映を削除
    // if (summaryCastPay) summaryCastPay.textContent = formatCurrency(monthPay);
    // if (summaryCastWorkdays) summaryCastWorkdays.innerHTML = `${workDays} <span class="text-base">日</span>`;
    
    // 5. ヘッダーに名前を表示
    if (castHeaderName) castHeaderName.textContent = currentCastName;
};

/**
 * (★変更★) キャストの指名顧客一覧を描画する
 */
const renderCastCustomerList = () => {
    if (!castCustomerList || !customers || !currentCastId || !slips || !settings) return; // (★修正★) slips, settings も待つ
    
    // (★変更★) 自分の指名顧客のみフィルタリング
    const myCustomers = customers.filter(
        cust => cust.nominatedCastId === currentCastId
    );
    
    // (★仮★) 最終来店日をソート (※ロジックが重いため、一旦名前ソート)
    myCustomers.sort((a,b) => (a.name || "").localeCompare(b.name || "")); // (★修正★)
    
    castCustomerList.innerHTML = '';
    
    if (myCustomers.length === 0) {
        castCustomerList.innerHTML = '<p class="text-slate-500 text-sm p-4 text-center">まだ指名顧客が登録されていません。</p>';
        return;
    }
    
    // (★変更★) 顧客リストのUI
    myCustomers.slice(0, 5).forEach(cust => { // (★仮★) 上位5件のみ表示
        // (★修正★) 最終来店日を計算
        const lastVisit = getLastVisitDate(cust.name); 
        
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


/**
 * (★新規★) ログインキャストの情報を取得してグローバル変数にセット
 */
const loadCastInfo = async () => {
    if (!currentCastId || !castsCollectionRef) {
        console.warn("Cast ID or collection ref not ready.");
        return;
    }
    
    try {
        const castRef = fbDoc(castsCollectionRef, currentCastId); // (★エラー修正★)
        const castSnap = await fbGetDoc(castRef); // (★エラー修正★)

        if (castSnap.exists()) {
            currentCastName = castSnap.data().name || "キャスト";
        } else {
            console.warn("Cast document not found in Firestore.");
        }
    } catch (error) {
        console.error("Error fetching cast data: ", error);
    }
    
    // UI（ヘッダー名）に反映
    if (castHeaderName) castHeaderName.textContent = currentCastName;
};


/**
 * (★報酬削除★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
 */
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
        // (★削除★) performanceSettings を削除
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
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: false }, // (★報酬削除★)
        ],
        items: [
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null },
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};


/**
 * (★報酬削除★) --- Firestore リアルタイムリスナー ---
 */
document.addEventListener('firebaseReady', async (e) => {
    
    // (★変更★) 認証情報と参照を取得
    const { 
        currentCastId: cId,
        settingsRef: sRef, 
        menuRef: mRef, 
        slipCounterRef: scRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef,
        // (★削除★) attendancesCollectionRef を削除
        query, where, orderBy, collection, doc, // (★エラー修正★)
        setDoc, addDoc, deleteDoc, getDoc, serverTimestamp // (★エラー修正★)
    } = e.detail;

    // (★変更★) グローバル変数にセット
    currentCastId = cId;
    settingsRef = sRef;
    menuRef = mRef;
    slipCounterRef = scRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    // (★削除★) attendancesCollectionRef = aRef;
    
    // (★エラー修正★) 関数をグローバル変数に割り当て
    fbQuery = query;
    fbWhere = where;
    fbOrderBy = orderBy;
    fbCollection = collection;
    fbDoc = doc;
    fbSetDoc = setDoc;
    fbAddDoc = addDoc;
    fbDeleteDoc = deleteDoc;
    fbGetDoc = getDoc;
    fbServerTimestamp = serverTimestamp;
    
    // (★新規★) まずキャスト情報を読み込む
    if (currentCastId) { // (★修正★)
        await loadCastInfo();
    }

    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;
    // (★削除★) let attendancesLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★報酬削除★) attendancesLoaded を条件から削除
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded) { 
            console.log("All data loaded. Rendering UI for cast-dashboard.js");
            
            // (★変更★) 呼び出す関数を変更
            renderCastDashboardSummary();
            renderCastCustomerList();
            updateHeaderDate();
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.log("No settings document found. Creating default settings...");
            const defaultSettings = getDefaultSettings();
            await fbSetDoc(settingsRef, defaultSettings); // (★エラー修正★)
            settings = defaultSettings;
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to settings: ", error);
        settingsLoaded = true;
        checkAndRenderAll();
    });

    // 2. Menu
    onSnapshot(menuRef, async (docSnap) => {
        if (docSnap.exists()) {
            menu = docSnap.data();
        } else {
            console.log("No menu document found. Creating default menu...");
            const defaultMenu = getDefaultMenu();
            await fbSetDoc(menuRef, defaultMenu); // (★エラー修正★)
            menu = defaultMenu;
        }
        menuLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to menu: ", error);
        menuLoaded = true;
        checkAndRenderAll();
    });

    // 3. Slip Counter
    onSnapshot(slipCounterRef, async (docSnap) => {
        if (docSnap.exists()) {
            slipCounter = docSnap.data().count;
        } else {
            console.log("No slip counter document found. Creating default counter...");
            await fbSetDoc(slipCounterRef, { count: 0 }); // (★エラー修正★)
            slipCounter = 0;
        }
        counterLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to slip counter: ", error);
        counterLoaded = true;
        checkAndRenderAll();
    });

    // 4. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to casts: ", error);
        castsLoaded = true;
        checkAndRenderAll();
    });

    // 5. Customers
    onSnapshot(customersCollectionRef, (querySnapshot) => {
        customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ ...doc.data(), id: doc.id });
        });
        console.log("Customers loaded: ", customers.length);
        customersLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to customers: ", error);
        customersLoaded = true;
        checkAndRenderAll();
    });
    
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
        slipsLoaded = true; // (★修正★) エラーでも続行
        checkAndRenderAll();
    });
    
    // 7. (★削除★) Attendances
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
    // (★削除★) summaryCastPay = document.getElementById('summary-cast-pay');
    // (★削除★) summaryCastWorkdays = document.getElementById('summary-cast-workdays');
    castCustomerList = document.getElementById('cast-customer-list');
    
    // (★修正★) ID `logout-button-header` を使用
    logoutButtonHeader = document.getElementById('logout-button-header'); 
    
    // (★削除★) 注文モーダル関連のDOM取得を削除
    // ...
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) ログアウトボタン
    if (logoutButtonHeader) {
        logoutButtonHeader.addEventListener('click', async () => {
            if (confirm("ログアウトしますか？")) {
                try {
                    await signOut(auth);
                    // ログアウト成功時、firebase-init.js が login.html へリダイレクト
                } catch (error) {
                    console.error("Sign out error: ", error);
                }
            }
        });
    }

    // (★削除★) 注文モーダル関連のリスナーをすべて削除
    // ...

});