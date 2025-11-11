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

// (★新規★) AIサービスから関数をインポート
import { getCustomerFollowUpAdvice } from './ai-service.js';

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

// ===================================
// (★新規★) 顧客データ集計ヘルパー (customers.js からコピー)
// ===================================

/**
 * (★新規★) 顧客に関連する伝票データを集計する
 * @param {string} customerId - 顧客ID
 * @param {string} customerName - 顧客名 (※古い伝票はIDがないため名前で照合)
 * @returns {object} { slips: [], lastVisit: Date|null, visitCount: 0, totalSpend: 0 }
 */
const getCustomerStats = (customerId, customerName) => {
    if (!slips || slips.length === 0) {
        return { slips: [], lastVisit: null, visitCount: 0, totalSpend: 0 };
    }

    const customerSlips = slips.filter(slip => {
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        
        // (★変更★) IDと名前の両方で照合
        if (slip.customerId === customerId) return true; 
        if (slip.name === customerName) return true;
        
        return false;
    });

    if (customerSlips.length === 0) {
        return { slips: [], lastVisit: null, visitCount: 0, totalSpend: 0 };
    }

    customerSlips.sort((a, b) => new Date(b.paidTimestamp).getTime() - new Date(a.paidTimestamp).getTime());
    
    const lastVisitDate = new Date(customerSlips[0].paidTimestamp);
    
    const totalSpend = customerSlips.reduce((total, slip) => total + (slip.paidAmount || 0), 0);
    
    return {
        slips: customerSlips,
        lastVisit: lastVisitDate,
        visitCount: customerSlips.length,
        totalSpend: totalSpend
    };
};


// =================================================
// (★AI対応★) 顧客一覧ページ専用ロジック
// =================================================

/**
 * (★AI対応★) 顧客の最終来店日の文字列を生成する
 * @param {Date | null} lastVisitDate 
 * @returns {string} 最終来店日の説明文字列
 */
const formatLastVisitDate = (lastVisitDate) => {
    if (!lastVisitDate || !settings) {
        return "来店履歴なし";
    }

    const todayBusinessStart = getBusinessDayStart(new Date());
    const lastVisitBusinessStart = getBusinessDayStart(lastVisitDate);

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
};


/**
 * (★AI対応★) キャストの指名顧客一覧を描画する
 * @param {string} searchTerm (オプション) 検索キーワード
 */
const renderCastCustomerList = (searchTerm = "") => {
    if (!customerListContainer || !customers || !currentCastId || !slips || !settings) return;
    
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
    
    // (★仮★) 名前ソート
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
    
    // (★AI対応★) 顧客リストのUIを変更
    myCustomers.forEach(cust => {
        // (★AI対応★) 顧客の統計情報を取得
        const stats = getCustomerStats(cust.id, cust.name);
        const lastVisit = formatLastVisitDate(stats.lastVisit);
        const memo = cust.memo || "（メモ未登録）";

        // (★AI対応★) 来店中かチェック
        const activeSlip = slips.find(s => s.name === cust.name && (s.status === 'active' || s.status === 'checkout'));
        
        // (★AI対応★) AIアドバイス用のプレースホルダーID
        const aiAdviceId = `ai-advice-${cust.id}`;

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
                <div class="mt-3 pt-3 border-t border-slate-200">
                    <p class="text-xs font-semibold text-blue-600 mb-1">
                        <i class="fa-solid fa-lightbulb-on mr-1"></i> AI Follow-up Advice
                    </p>
                    <p id="${aiAdviceId}" class="text-sm text-slate-700">
                        <i class="fa-solid fa-spinner fa-spin text-xs"></i> 分析中...
                    </p>
                </div>
            </div>
        `;
        customerListContainer.innerHTML += itemHTML;
        
        // (★AI対応★) HTML描画後に非同期でAIアドバイスを取得
        getCustomerFollowUpAdvice(cust, stats).then(advice => {
            const adviceEl = document.getElementById(aiAdviceId);
            if (adviceEl) {
                adviceEl.textContent = advice;
            }
        }).catch(err => {
            console.error("AI Advice Error: ", err);
            const adviceEl = document.getElementById(aiAdviceId);
            if (adviceEl) {
                adviceEl.textContent = "アドバイスの取得に失敗しました。";
                adviceEl.classList.add("text-red-500");
            }
        });
    });
};


/**
 * (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
 */
const getDefaultSettings = () => {
    // (★簡易版★ cast-customers.js は dayChangeTime のみ必要)
    return {
        dayChangeTime: "05:00"
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