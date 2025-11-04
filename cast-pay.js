// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc,
    collection,
    getDoc, // (★新規★)
    signOut // (★新規★)
} from './firebase-init.js';

// (★変更★) 参照は firebaseReady イベントで受け取る
let settingsRef, menuRef, castsCollectionRef, slipsCollectionRef;


// ===== グローバル定数・変数 =====

// (★変更★) state を分割して管理
let settings = null;
let menu = null;
let casts = [];
let slips = [];

// (★変更★) ログイン中のキャストIDと名前
let currentCastId = null; 
let currentCastName = "キャスト";

// ===== DOM要素 =====
// (★新規★) cast-pay.html に必要なDOM
let castHeaderName, pageTitle,
    payPeriodSelect,
    summaryPayTotal, summaryPayDeductions, summaryPayNet,
    dailyPayList, payListLoading,
    logoutButtonHeader; // (★新規★)


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
 * (★新規★) 指定された期間の伝票(会計済み)を取得する
 * @param {string} period 'monthly', 'prev_month'
 * @param {Date} baseDate 基準日
 * @returns {object} { paidSlips: [] }
 */
const getSlipsForPeriod = (period, baseDate) => {
    if (!slips) {
        return { paidSlips: [] };
    }

    let startDate, endDate;
    const businessDayStart = getBusinessDayStart(baseDate);

    if (period === 'monthly') {
        // 基準日の月の1日（の営業開始時刻）
        startDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth(), 1);
        startDate = getBusinessDayStart(startDate); 
        // 基準日の月の末日（の営業終了時刻）
        endDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth() + 1, 0); 
        endDate = getBusinessDayEnd(getBusinessDayStart(endDate)); 
    } 
    else if (period === 'prev_month') {
        // 基準日の「先月」の1日
        startDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth() - 1, 1);
        startDate = getBusinessDayStart(startDate); 
        // 基準日の「先月」の末日
        endDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth(), 0); 
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
// (★新規★) 報酬計算ロジック
// =================================================

/**
 * (★新規★) 1枚の伝票から、指定したキャストの報酬を計算する
 * (※ 本来は settings.performanceSettings に基づく複雑な計算が必要)
 * @param {object} slip - 伝票データ
 * @param {string} castId - 対象のキャストID
 * @returns {number} 報酬額
 */
const calculatePayForSlip = (slip, castId) => {
    if (slip.nominationCastId !== castId) {
        return 0; // 指名が違う場合は 0
    }
    
    // (★簡易ロジック★)
    // performanceSettings を使って、どの項目が成績反映かを見る
    const performanceSettings = settings.performanceSettings;
    if (!performanceSettings || !performanceSettings.menuItems) {
        return 0; // 設定がない場合は 0
    }

    let totalPay = 0;

    slip.items.forEach(item => {
        const itemSetting = performanceSettings.menuItems[item.id];
        
        if (itemSetting) {
            // 成績設定がある項目
            if (itemSetting.salesType === 'percentage') {
                totalPay += item.price * item.qty * (itemSetting.salesValue / 100);
            } else if (itemSetting.salesType === 'fixed') {
                totalPay += itemSetting.salesValue * item.qty;
            }
        }
        // else {
        //     // 成績設定がない項目は 0
        // }
    });
    
    // (※ サービス料・税・枝などの計算は、ここでは省略)

    return Math.round(totalPay);
};

/**
 * (★新規★) 期間内の伝票から日別の報酬リストを作成する
 * @param {Array} paidSlips - 期間内の会計済み伝票
 * @param {string} castId - 対象のキャストID
 * @returns {Map<string, object>} 日付(YYYY-MM-DD)をキーにした日別集計
 */
const aggregatePayByDay = (paidSlips, castId) => {
    const dailyMap = new Map();

    paidSlips.forEach(slip => {
        if (slip.nominationCastId !== castId) {
            return; // 自分の伝票でなければスキップ
        }
        
        const paidDate = new Date(slip.paidTimestamp);
        // (★重要★) 営業日基準で日付を振る
        const businessDayStart = getBusinessDayStart(paidDate);
        const dateKey = businessDayStart.toISOString().split('T')[0]; // "YYYY-MM-DD"
        
        const dayData = dailyMap.get(dateKey) || {
            date: businessDayStart,
            totalSales: 0, // 伝票の総額 (paidAmount)
            totalPay: 0,   // 計算後の報酬額
            noms: 0
        };

        dayData.totalSales += (slip.paidAmount || 0);
        dayData.totalPay += calculatePayForSlip(slip, castId);
        dayData.noms += 1;
        
        dailyMap.set(dateKey, dayData);
    });
    
    return dailyMap;
};


/**
 * (★変更★) 報酬サマリーと日別リストを描画する
 */
const renderPayPage = () => {
    if (!slips || !settings || !menu || !currentCastId) { // (★変更★)
        if(payListLoading) payListLoading.textContent = "データが不足しています。";
        return; 
    }
    
    const period = payPeriodSelect.value; // 'monthly' or 'prev_month'
    
    // 1. 期間内の伝票を取得
    const { paidSlips } = getSlipsForPeriod(period, new Date());
    
    // 2. 日別に集計 (★変更★)
    const dailyMap = aggregatePayByDay(paidSlips, currentCastId);
    
    // 3. 期間合計を計算
    let periodTotalPay = 0;
    dailyMap.forEach(dayData => {
        periodTotalPay += dayData.totalPay;
    });
    
    // 4. (★仮★) 控除と手取りを計算
    const deductions = 0; // (※ 将来的に settings から取得)
    const netPay = periodTotalPay - deductions;
    
    // 5. サマリーUIに反映
    if (summaryPayTotal) summaryPayTotal.textContent = formatCurrency(periodTotalPay);
    if (summaryPayDeductions) summaryPayDeductions.textContent = `- ${formatCurrency(deductions)}`;
    if (summaryPayNet) summaryPayNet.textContent = formatCurrency(netPay);
    
    // 6. 日別リストUIに反映
    if(payListLoading) payListLoading.style.display = 'none';
    dailyPayList.innerHTML = '';
    
    if (dailyMap.size === 0) {
        dailyPayList.innerHTML = '<p class="text-slate-500 text-center p-4">この期間の報酬データはありません。</p>';
        return;
    }
    
    // 日付の降順でソート
    const sortedDays = [...dailyMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());

    sortedDays.forEach(dayData => {
        const dateStr = dayData.date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
        const weekdayStr = dayData.date.toLocaleDateString('ja-JP', { weekday: 'short' });

        const itemHTML = `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div class="flex justify-between items-center">
                    <span class="font-semibold">${dateStr} (${weekdayStr})</span>
                    <span class="font-bold text-green-600 text-lg">+ ${formatCurrency(dayData.totalPay)}</span>
                </div>
                <div class="text-xs text-slate-500 mt-1">
                    <span>伝票売上: ${formatCurrency(dayData.totalSales)}</span> / 
                    <span>指名: ${dayData.noms}組</span>
                </div>
            </div>
        `;
        dailyPayList.innerHTML += itemHTML;
    });
};

/**
 * (★新規★) 期間選択プルダウンを初期化
 */
const setupPeriodSelect = () => {
    if (!payPeriodSelect) return;
    
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthStr = currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    const prevMonthStr = prevMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

    payPeriodSelect.innerHTML = `
        <option value="monthly">今月 (${currentMonthStr})</option>
        <option value="prev_month">先月 (${prevMonthStr})</option>
    `;
};


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    return {
        // (★簡易版★)
        storeInfo: { name: "Night POS", address: "", tel: "", zip: "" },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
        performanceSettings: {
            menuItems: {},
            serviceCharge: { salesType: 'percentage', salesValue: 0 },
            tax: { salesType: 'percentage', salesValue: 0 },
            sideCustomer: { salesValue: 100, countNomination: true }
        }
    };
};

const getDefaultMenu = () => {
    // (★簡易版★)
    return {
        categories: [],
        items: []
    };
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
        const castRef = doc(castsCollectionRef, currentCastId);
        const castSnap = await getDoc(castRef);

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


// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', async (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        currentCastId: cId,
        settingsRef: sRef, 
        menuRef: mRef,
        castsCollectionRef: cRef, 
        slipsCollectionRef: slRef
    } = e.detail;
    
    // (★変更★) グローバル変数にセット
    currentCastId = cId;
    settingsRef = sRef;
    menuRef = mRef;
    castsCollectionRef = cRef;
    slipsCollectionRef = slRef;

    // (★新規★) まずキャスト情報を読み込む
    await loadCastInfo();

    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let slipsLoaded = false;
    // (★削除★) customersLoaded, counterLoaded

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) cast-pay.js は専用関数を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for cast-pay.js");
            
            // (★削除★) 開発用キャストIDの設定ロジックを削除
            
            if (castHeaderName) castHeaderName.textContent = currentCastName;
            
            setupPeriodSelect(); // (★新規★)
            renderPayPage();
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

    // (★削除★) 3. Slip Counter

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

    // (★削除★) 5. Customers
    
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
        slipsLoaded = true; 
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    castHeaderName = document.getElementById('cast-header-name');
    pageTitle = document.getElementById('page-title');
    payPeriodSelect = document.getElementById('pay-period-select');
    summaryPayTotal = document.getElementById('summary-pay-total');
    summaryPayDeductions = document.getElementById('summary-pay-deductions');
    summaryPayNet = document.getElementById('summary-pay-net');
    dailyPayList = document.getElementById('daily-pay-list');
    payListLoading = document.getElementById('pay-list-loading');
    
    logoutButtonHeader = document.querySelector('header #cast-header-name + button'); // (★新規★)
    
    // (★削除★) モーダル関連のDOM取得を削除
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) 期間変更イベント
    if (payPeriodSelect) {
        payPeriodSelect.addEventListener('change', () => {
            renderPayPage();
        });
    }

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

    // (★削除★) モーダル関連のリスナーをすべて削除

});