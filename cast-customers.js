// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    // addDoc, (★削除★)
    // deleteDoc, (★削除★)
    doc,
    collection,
    getDoc, // (★新規★)
    signOut // (★新規★)
} from './firebase-init.js';

// (★変更★) 参照は firebaseReady イベントで受け取る
let settingsRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef;


// ===== グローバル定数・変数 =====

// (★変更★) state を分割して管理
let settings = null;
// let menu = null; (★不要★)
let casts = [];
let customers = [];
let slips = [];

// (★変更★) ログイン中のキャストIDと名前
let currentCastId = null; 
let currentCastName = "キャスト";

// ===== DOM要素 =====
// (★新規★) cast-customers.html に必要なDOM
let castHeaderName, pageTitle,
    customerSearchInput,
    customerListContainer,
    customerListLoading,
    logoutButtonHeader; // (★新規★)


// --- 関数 ---

// (★削除★) 伝P... 関連のヘルパー関数は不要

// =================================================
// (★新規★) 営業日計算ヘルパー (cast-dashboard.js からコピー)
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

// =================================================
// (★新規★) 顧客一覧ページ専用ロジック
// =================================================

/**
 * (★新規★) 顧客の最終来店日を計算する (簡易版)
 * @param {string} customerName 
 * @returns {string} 最終来店日の説明文字列
 */
const getLastVisitDate = (customerName) => {
    if (!slips || slips.length === 0 || !settings) { // (★変更★) settings が必要
        return "来店履歴なし";
    }

    // (★変更★) 顧客名で伝票をフィルタリング (会計済みのみ)
    const customerSlips = slips.filter(
        slip => slip.name === customerName && slip.status === 'paid' && slip.paidTimestamp
    );

    if (customerSlips.length === 0) {
        return "来店履歴なし";
    }

    // (★変更★) タイムスタンプでソートして最新の日付を取得
    customerSlips.sort((a, b) => new Date(b.paidTimestamp).getTime() - new Date(a.paidTimestamp).getTime());
    
    const lastVisitDate = new Date(customerSlips[0].paidTimestamp);
    
    // (★新規★) 何日前か計算
    // (★変更★) 営業日基準で「今日」を判定
    const todayBusinessStart = getBusinessDayStart(new Date());
    const lastVisitBusinessStart = getBusinessDayStart(lastVisitDate);

    const diffTime = Math.abs(todayBusinessStart.getTime() - lastVisitBusinessStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const dateStr = lastVisitDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

    if (diffDays === 0) {
        return `最終来店: ${dateStr} (本日)`;
    } else if (diffDays <= 30) {
        return `最終来店: ${dateStr} (${diffDays}日前)`;
    } else {
        return `最終来店: ${dateStr}`;
    }
};

/**
 * (★変更★) キャストの指名顧客一覧を描画する
 * @param {string} searchTerm (オプション) 検索キーワード
 */
const renderCastCustomerList = (searchTerm = "") => {
    if (!customerListContainer || !customers || !currentCastId) return;
    
    const lowerSearchTerm = searchTerm.toLowerCase();

    // (★変更★) 自分の指名顧客のみフィルタリング
    let myCustomers = customers.filter(
        cust => cust.nominatedCastId === currentCastId
    );
    
    // (★新規★) 検索キーワードでフィルタリング
    if (lowerSearchTerm !== "") {
        myCustomers = myCustomers.filter(
            cust => cust.name.toLowerCase().includes(lowerSearchTerm)
        );
    }
    
    // (★仮★) 最終来店日ソート (ロジックが重いため、一旦名前ソート)
    myCustomers.sort((a,b) => a.name.localeCompare(b.name));
    
    // (★変更★) ローディング表示を削除
    if(customerListLoading) customerListLoading.style.display = 'none';
    customerListContainer.innerHTML = '';
    
    if (myCustomers.length === 0) {
        if (searchTerm !== "") {
            customerListContainer.innerHTML = `<p class="text-slate-500 text-center p-4">「${searchTerm}」に一致する顧客は見つかりませんでした。</p>`;
        } else {
            customerListContainer.innerHTML = '<p class="text-slate-500 text-center p-4">まだ指名顧客が登録されていません。</p>';
        }
        return;
    }
    
    // (★変更★) 顧客リストのUI
    myCustomers.forEach(cust => {
        // (★新規★) 最終来店日を計算
        const lastVisit = getLastVisitDate(cust.name); 
        
        // (★新規★) 顧客メモ (ダミー)
        const memo = cust.memo || "（メモ未登録）"; // ※現状 customer オブジェクトに memo は無い

        // (★新規★) 来店中かチェック
        const activeSlip = slips.find(s => s.name === cust.name && (s.status === 'active' || s.status === 'checkout'));
        
        const itemHTML = `
            <div class="bg-white p-4 rounded-xl shadow border border-slate-200">
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-lg">${cust.name}</p>
                    ${activeSlip ? `<span class="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">来店中 (T${activeSlip.tableId})</span>` : ''}
                </div>
                <div class="mt-2 text-sm text-slate-600 space-y-1">
                    <p><i class="fa-solid fa-clock fa-fw w-5"></i> ${lastVisit}</p>
                    <p><i class="fa-solid fa-note-sticky fa-fw w-5"></i> ${memo}</p>
                </div>
            </div>
        `;
        customerListContainer.innerHTML += itemHTML;
    });
};


/**
 * (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
 */
const getDefaultSettings = () => {
    // (★簡易版★ cast-customers.js は settings を参照しないため空でも良い)
    return {
        dayChangeTime: "05:00" // (★変更★) 最終来店日計算のために dayChangeTime は必要
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
    
    // (★変更★) 認証情報と参照を取得
    const { 
        currentCastId: cId,
        settingsRef: sRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef
    } = e.detail;
    
    // (★変更★) グローバル変数にセット
    currentCastId = cId;
    settingsRef = sRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    
    // (★新規★) まずキャスト情報を読み込む
    await loadCastInfo();

    let settingsLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) cast-customers.js は顧客一覧を描画
        if (settingsLoaded && castsLoaded && customersLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for cast-customers.js");
            
            // (★削除★) 開発用キャストIDの設定ロジックを削除
            
            if (castHeaderName) castHeaderName.textContent = currentCastName;
            
            renderCastCustomerList();
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

    // (★削除★) 2. Menu

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
        slipsLoaded = true; 
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    castHeaderName = document.getElementById('cast-header-name');
    pageTitle = document.getElementById('page-title');
    customerSearchInput = document.getElementById('customer-search-input');
    customerListContainer = document.getElementById('customer-list-container');
    customerListLoading = document.getElementById('customer-list-loading');
    
    logoutButtonHeader = document.querySelector('header #cast-header-name + button'); // (★新規★)
    
    // (★削除★) モーダル関連のDOM取得を削除
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) 検索入力イベント
    if (customerSearchInput) {
        customerSearchInput.addEventListener('input', (e) => {
            renderCastCustomerList(e.target.value);
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