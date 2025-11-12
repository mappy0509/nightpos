// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

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

// (★削除★) エラーの原因となった以下の参照(Ref)のインポートを削除
/*
import {
    settingsRef,
    // menuRef, (★不要★)
    // slipCounterRef, (★不要★)
    castsCollectionRef,
    customersCollectionRef,
    slipsCollectionRef
} from './firebase-init.js';
*/


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
let casts = [];
let customers = [];
let slips = [];

// (★新規★) 現在編集中の顧客ID
let currentEditingCustomerId = null;

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef,
    currentStoreId; // (★動的表示 追加★)


// ===== DOM要素 =====
// (★新規★) customers.html に必要なDOM
let pageTitle,
    customerSearchInput,
    customerTableBody, customerListLoading,
    addCustomerBtn,
    
    // 新規/編集モーダル
    customerEditorModal, customerEditorModalTitle, customerEditorForm,
    customerNameInput, customerNominationSelect, customerMemoInput,
    customerEditorError, saveCustomerBtn, deleteCustomerBtn,
    
    // 詳細モーダル
    customerDetailModal, customerDetailModalTitle,
    detailCustomerName, detailNominationCast, detailLastVisit,
    detailVisitCount, detailTotalSpend, detailCustomerMemo,
    detailSlipHistory, detailSlipLoading,
    
    modalCloseBtns,
    
    headerStoreName; // (★要望4★) storeSelector から変更


// --- 関数 ---

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    return `¥${amount.toLocaleString()}`;
};

/**
 * (新規) キャストIDからキャスト名を取得する
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!casts) return '不明'; 
    if (!castId || castId === 'null') return 'フリー';
    const cast = casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * モーダルを開く
 * @param {HTMLElement} modalElement 
 */
const openModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.add('active');
    }
};

/**
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.remove('active');
    }
};

// ===================================
// (★新規★) 顧客データ集計ヘルパー
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

    // (★変更★) 顧客IDまたは顧客名で会計済み伝票をフィルタリング
    const customerSlips = slips.filter(slip => {
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        
        // (★変更★) IDと名前の両方で照合
        // (IDは addDoc で自動生成されるため、古いデータには customerId がない想定)
        if (slip.customerId === customerId) return true; 
        if (slip.name === customerName) return true;
        
        return false;
    });

    if (customerSlips.length === 0) {
        return { slips: [], lastVisit: null, visitCount: 0, totalSpend: 0 };
    }

    // (★変更★) タイムスタンプでソートして最新の日付を取得
    customerSlips.sort((a, b) => new Date(b.paidTimestamp).getTime() - new Date(a.paidTimestamp).getTime());
    
    const lastVisitDate = new Date(customerSlips[0].paidTimestamp);
    
    // (★新規★) 総利用額を計算
    const totalSpend = customerSlips.reduce((total, slip) => total + (slip.paidAmount || 0), 0);
    
    return {
        slips: customerSlips,
        lastVisit: lastVisitDate,
        visitCount: customerSlips.length,
        totalSpend: totalSpend
    };
};


// ===================================
// (★新規★) 顧客一覧 描画ロジック
// ===================================

/**
 * (★新規★) 顧客一覧テーブルを描画する
 */
const renderCustomerList = () => {
    if (!customerTableBody || !customers || !casts || !slips) {
        return;
    }
    
    const searchTerm = customerSearchInput ? customerSearchInput.value.toLowerCase() : '';
    
    // (★新規★) 検索キーワードでフィルタリング
    const filteredCustomers = customers.filter(cust => {
        if (searchTerm === "") return true;
        const castName = getCastNameById(cust.nominatedCastId).toLowerCase();
        return cust.name.toLowerCase().includes(searchTerm) || castName.includes(searchTerm);
    });
    
    // (★仮★) 名前でソート
    filteredCustomers.sort((a,b) => a.name.localeCompare(b.name));
    
    // (★変更★) ローディング表示を削除
    if(customerListLoading) customerListLoading.style.display = 'none';
    customerTableBody.innerHTML = '';
    
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">
            ${searchTerm ? `「${customerSearchInput.value}」に一致する顧客は見つかりませんでした。` : 'まだ顧客が登録されていません。'}
        </td></tr>`;
        return;
    }
    
    filteredCustomers.forEach(cust => {
        const stats = getCustomerStats(cust.id, cust.name);
        
        const lastVisitStr = stats.lastVisit 
            ? stats.lastVisit.toLocaleDateString('ja-JP') 
            : '来店履歴なし';
            
        const itemHTML = `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-4 font-semibold">${cust.name}</td>
                <td class="p-4 text-pink-600 font-medium">${getCastNameById(cust.nominatedCastId)}</td>
                <td class="p-4">${lastVisitStr}</td>
                <td class="p-4">${stats.visitCount} 回</td>
                <td class="p-4 font-semibold text-green-700">${formatCurrency(stats.totalSpend)}</td>
                <td class="p-4 text-right space-x-2">
                    <button class="customer-detail-btn text-blue-600 hover:text-blue-800" data-customer-id="${cust.id}" title="詳細">
                        <i class="fa-solid fa-file-invoice"></i>
                    </button>
                    <button class="customer-edit-btn text-slate-600 hover:text-slate-800" data-customer-id="${cust.id}" title="編集">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </td>
            </tr>
        `;
        customerTableBody.innerHTML += itemHTML;
    });
};

// ===================================
// (★新規★) 顧客 新規/編集 モーダル
// ===================================

/**
 * (★新規★) 顧客編集モーダルを開く
 * @param {string|null} customerId - 編集時はID、新規作成時は null
 */
const openCustomerEditorModal = (customerId = null) => {
    if (!customerEditorModal || !casts) return;
    
    customerEditorForm.reset();
    customerEditorError.textContent = '';
    currentEditingCustomerId = customerId;
    
    // キャスト一覧をプルダウンに設定
    customerNominationSelect.innerHTML = '<option value="null">フリー (指名なし)</option>';
    casts.sort((a,b) => a.name.localeCompare(b.name)).forEach(cast => {
        customerNominationSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
    });

    if (customerId) {
        // --- 編集モード ---
        customerEditorModalTitle.textContent = '顧客情報の編集';
        const customer = customers.find(c => c.id === customerId);
        if (!customer) {
            console.error("Customer not found for editing:", customerId);
            return;
        }
        
        customerNameInput.value = customer.name;
        customerNominationSelect.value = customer.nominatedCastId || 'null';
        customerMemoInput.value = customer.memo || '';
        
        deleteCustomerBtn.classList.remove('hidden');
        
    } else {
        // --- 新規作成モード ---
        customerEditorModalTitle.textContent = '新規顧客登録';
        deleteCustomerBtn.classList.add('hidden');
    }
    
    openModal(customerEditorModal);
};

/**
 * (★新規★) 顧客情報を保存 (新規作成または更新)
 */
const saveCustomer = async () => {
    const name = customerNameInput.value.trim();
    const nominatedCastId = customerNominationSelect.value === 'null' ? null : customerNominationSelect.value;
    const memo = customerMemoInput.value.trim();
    
    if (name === "") {
        customerEditorError.textContent = "顧客名を入力してください。";
        return;
    }
    
    // (★変更★) 顧客名重複チェック (自分自身を除く)
    const nameExists = customers.some(c => 
        c.name === name && c.id !== currentEditingCustomerId
    );
    if (nameExists) {
        customerEditorError.textContent = "その顧客名は既に使用されています。";
        return;
    }
    
    const customerData = {
        name: name,
        nominatedCastId: nominatedCastId,
        memo: memo
    };

    try {
        if (currentEditingCustomerId) {
            // --- 更新 ---
            const customerRef = doc(customersCollectionRef, currentEditingCustomerId);
            await setDoc(customerRef, customerData, { merge: true });
        } else {
            // --- 新規作成 ---
            await addDoc(customersCollectionRef, customerData);
        }
        
        closeModal(customerEditorModal);

    } catch (e) {
        console.error("Error saving customer: ", e);
        customerEditorError.textContent = "顧客情報の保存に失敗しました。";
    }
};

/**
 * (★新規★) 顧客情報を削除
 */
const deleteCustomer = async () => {
    if (!currentEditingCustomerId) return;
    
    // (★重要★) 伝票で使われているかチェック
    const customer = customers.find(c => c.id === currentEditingCustomerId);
    if (!customer) return;
    
    const stats = getCustomerStats(customer.id, customer.name);
    if (stats.visitCount > 0) {
        customerEditorError.textContent = `この顧客は ${stats.visitCount} 件の伝票履歴があるため削除できません。`;
        return;
    }
    
    if (!confirm(`顧客「${customer.name}」を削除しますか？\nこの操作は取り消せません。`)) {
        return;
    }

    try {
        const customerRef = doc(customersCollectionRef, currentEditingCustomerId);
        await deleteDoc(customerRef);
        closeModal(customerEditorModal);
    } catch (e) {
        console.error("Error deleting customer: ", e);
        customerEditorError.textContent = "顧客の削除に失敗しました。";
    }
};


// ===================================
// (★新規★) 顧客詳細 モーダル
// ===================================

/**
 * (★新規★) 顧客詳細モーダルを開く
 * @param {string} customerId 
 */
const openCustomerDetailModal = (customerId) => {
    if (!customerDetailModal) return;
    
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    customerDetailModalTitle.textContent = `顧客詳細: ${customer.name}`;
    
    // サマリー情報を表示
    const stats = getCustomerStats(customer.id, customer.name);
    
    detailCustomerName.textContent = customer.name;
    detailNominationCast.textContent = getCastNameById(customer.nominatedCastId);
    detailLastVisit.textContent = stats.lastVisit ? stats.lastVisit.toLocaleDateString('ja-JP') : '来店履歴なし';
    detailVisitCount.textContent = `${stats.visitCount} 回`;
    detailTotalSpend.textContent = formatCurrency(stats.totalSpend);
    detailCustomerMemo.textContent = customer.memo || '（メモ未登録）';

    // 来店履歴（伝票一覧）を表示
    if (detailSlipLoading) detailSlipLoading.style.display = 'none';
    detailSlipHistory.innerHTML = '';
    
    if (stats.slips.length === 0) {
        detailSlipHistory.innerHTML = '<p class="text-slate-500 text-center p-4">会計済みの来店履歴はありません。</p>';
    } else {
        // stats.slips は既に降順ソート済み
        stats.slips.forEach(slip => {
            const slipDate = new Date(slip.paidTimestamp);
            const dateStr = slipDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
            
            const itemHTML = `
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-base">${dateStr} (No.${slip.slipNumber})</span>
                        <span class="font-bold text-blue-600 text-lg">${formatCurrency(slip.paidAmount || 0)}</span>
                    </div>
                    <p class="text-sm text-slate-600 mt-1">
                        テーブル: ${slip.tableId} / 指名: ${getCastNameById(slip.nominationCastId)}
                    </p>
                </div>
            `;
            detailSlipHistory.innerHTML += itemHTML;
        });
    }
    
    openModal(customerDetailModal);
};

// (★要望4, 5★)
/**
 * (★新規★) ヘッダーのストア名をレンダリングする
 */
const renderHeaderStoreName = () => {
    if (!headerStoreName || !settings || !currentStoreId) return;

    const currentStoreName = settings.storeInfo.name || "店舗";
    
    // (★変更★) loading... を店舗名で上書き
    headerStoreName.textContent = currentStoreName;
};


// (★変更★) --- Firestore リアルタイムリスナー ---
// (★変更★) firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        settingsRef: sRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef,
        currentStoreId: csId // (★動的表示 追加★)
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    currentStoreId = csId; // (★動的表示 追加★)


    let settingsLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) customers.js は renderCustomerList を呼ぶ
        if (settingsLoaded && castsLoaded && customersLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for customers.js");
            renderCustomerList();
            renderHeaderStoreName(); // (★要望4★)
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found. Using fallback.");
            settings = { rates: { tax: 0.1, service: 0.2 }, dayChangeTime: "05:00" };
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // 2. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));

    // 3. Customers
    onSnapshot(customersCollectionRef, (querySnapshot) => {
        customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ ...doc.data(), id: doc.id });
        });
        console.log("Customers loaded: ", customers.length);
        customersLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to customers: ", error));
    
    // 4. Slips
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id }); 
        });
        console.log("Slips loaded (for customer stats): ", slips.length);
        slipsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to slips: ", error);
        slipsLoaded = true; // (★変更★) エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'customers.html');

    // ===== DOM要素の取得 =====
    pageTitle = document.getElementById('page-title');
    customerSearchInput = document.getElementById('customer-search-input');
    customerTableBody = document.getElementById('customer-table-body');
    customerListLoading = document.getElementById('customer-list-loading');
    addCustomerBtn = document.getElementById('add-customer-btn');
    
    customerEditorModal = document.getElementById('customer-editor-modal');
    customerEditorModalTitle = document.getElementById('customer-editor-modal-title');
    customerEditorForm = document.getElementById('customer-editor-form');
    customerNameInput = document.getElementById('customer-name-input');
    customerNominationSelect = document.getElementById('customer-nomination-select');
    customerMemoInput = document.getElementById('customer-memo-input');
    customerEditorError = document.getElementById('customer-editor-error');
    saveCustomerBtn = document.getElementById('save-customer-btn');
    deleteCustomerBtn = document.getElementById('delete-customer-btn');
    
    customerDetailModal = document.getElementById('customer-detail-modal');
    customerDetailModalTitle = document.getElementById('customer-detail-modal-title');
    detailCustomerName = document.getElementById('detail-customer-name');
    detailNominationCast = document.getElementById('detail-nomination-cast');
    detailLastVisit = document.getElementById('detail-last-visit');
    detailVisitCount = document.getElementById('detail-visit-count');
    detailTotalSpend = document.getElementById('detail-total-spend');
    detailCustomerMemo = document.getElementById('detail-customer-memo');
    detailSlipHistory = document.getElementById('detail-slip-history');
    detailSlipLoading = document.getElementById('detail-slip-loading');
    
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    
    headerStoreName = document.getElementById('header-store-name'); // (★要望4★)

    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) 検索入力
    if (customerSearchInput) {
        customerSearchInput.addEventListener('input', () => {
            renderCustomerList();
        });
    }

    // (★新規★) 新規顧客追加ボタン
    if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => {
            openCustomerEditorModal(null);
        });
    }

    // (★新規★) 顧客テーブルのイベント委任 (詳細 / 編集)
    if (customerTableBody) {
        customerTableBody.addEventListener('click', (e) => {
            const detailBtn = e.target.closest('.customer-detail-btn');
            const editBtn = e.target.closest('.customer-edit-btn');
            
            if (detailBtn) {
                openCustomerDetailModal(detailBtn.dataset.customerId);
                return;
            }
            if (editBtn) {
                openCustomerEditorModal(editBtn.dataset.customerId);
                return;
            }
        });
    }

    // (★新規★) 顧客 編集/新規 モーダル保存
    if (customerEditorForm) {
        customerEditorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCustomer();
        });
    }
    
    // (★新規★) 顧客 削除ボタン
    if (deleteCustomerBtn) {
        deleteCustomerBtn.addEventListener('click', () => {
            deleteCustomer();
        });
    }

    // (★新規★) モーダルを閉じるボタン (共通)
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-backdrop');
                if (modal) {
                    closeModal(modal);
                }
            });
        });
    }

});