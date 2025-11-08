// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (★新規★) firebase-init.js から必要なモジュールをインポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    doc,
    collection,
    serverTimestamp // (★新規★) 最終更新日のために追加
} from './firebase-init.js';

// ===== グローバル定数・変数 =====

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// 在庫品目リスト
let inventoryItems = [];
// 現在編集中の品目ID
let currentEditingItemId = null;
// 在庫調整モーダルの調整タイプ
let currentAdjustmentType = 'add'; // 'add', 'subtract', 'set'

// (★新規★) 参照(Ref)はグローバル変数として保持
let inventoryItemsCollectionRef;


// ===== DOM要素 =====
let pageTitle,
    inventorySearchInput,
    inventoryTableBody, inventoryListLoading,
    addInventoryItemBtn,
    
    // 新規/編集モーダル
    inventoryEditorModal, inventoryEditorModalTitle, inventoryEditorForm,
    inventoryNameInput, inventoryCategoryInput, inventoryUnitInput,
    inventoryStockInput,
    inventoryEditorError, saveInventoryItemBtn, deleteInventoryItemBtn,
    
    // 在庫調整モーダル
    stockAdjustmentModal, stockAdjustmentModalTitle, stockAdjustmentForm,
    adjustmentItemId, adjustmentCurrentStock, adjustmentUnit,
    adjustmentTypeTabs,
    adjustmentAmountInput, adjustmentAmountLabel,
    adjustmentMemoInput, adjustmentError, saveAdjustmentBtn,
    
    modalCloseBtns;


// --- 関数 ---

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

/**
 * (★新規★) タイムスタンプをフォーマットする
 * @param {object} timestamp - Firestore Timestamp オブジェクト
 * @returns {string}
 */
const formatTimestamp = (timestamp) => {
    if (!timestamp) return '---';
    // Firestore Timestamp を Date オブジェクトに変換
    const date = timestamp.toDate();
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// ===================================
// (★新規★) 在庫一覧 描画ロジック
// ===================================

/**
 * (★新規★) 在庫一覧テーブルを描画する
 */
const renderInventoryList = () => {
    if (!inventoryTableBody || !inventoryItems) {
        return;
    }
    
    const searchTerm = inventorySearchInput ? inventorySearchInput.value.toLowerCase() : '';
    
    // 検索キーワードでフィルタリング
    const filteredItems = inventoryItems.filter(item => {
        if (searchTerm === "") return true;
        return item.name.toLowerCase().includes(searchTerm) || 
               (item.category && item.category.toLowerCase().includes(searchTerm));
    });
    
    // 名前でソート
    filteredItems.sort((a,b) => a.name.localeCompare(b.name));
    
    if(inventoryListLoading) inventoryListLoading.style.display = 'none';
    inventoryTableBody.innerHTML = '';
    
    if (filteredItems.length === 0) {
        inventoryTableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">
            ${searchTerm ? `「${inventorySearchInput.value}」に一致する品目はありません。` : 'まだ在庫品目が登録されていません。'}
        </td></tr>`;
        return;
    }
    
    filteredItems.forEach(item => {
        const stock = item.currentStock || 0;
        const unit = item.unit || '個';
        
        // 在庫僅少・切れのスタイル (任意)
        let stockClass = 'text-slate-800';
        if (stock <= 0) {
            stockClass = 'text-red-600 font-bold';
        } else if (stock <= 10) { // (★仮の閾値)
            stockClass = 'text-yellow-600 font-semibold';
        }
        
        const itemHTML = `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-4 font-semibold">${item.name}</td>
                <td class="p-4">${item.category || '---'}</td>
                <td class="p-4 font-mono ${stockClass}">${stock}</td>
                <td class="p-4">${unit}</td>
                <td class="p-4 text-xs">${formatTimestamp(item.updatedAt)}</td>
                <td class="p-4 text-right space-x-2">
                    <button class="stock-adjust-btn px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-semibold hover:bg-green-200 text-xs" data-item-id="${item.id}" title="在庫調整">
                        <i class="fa-solid fa-right-left mr-1"></i> 調整
                    </button>
                    <button class="inventory-edit-btn text-slate-600 hover:text-slate-800" data-item-id="${item.id}" title="品目編集">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </td>
            </tr>
        `;
        inventoryTableBody.innerHTML += itemHTML;
    });
};

// ===================================
// (★新規★) 在庫品目 編集/新規 モーダル
// ===================================

/**
 * (★新規★) 在庫品目編集モーダルを開く
 * @param {string|null} itemId - 編集時はID、新規作成時は null
 */
const openInventoryEditorModal = (itemId = null) => {
    if (!inventoryEditorModal) return;
    
    inventoryEditorForm.reset();
    inventoryEditorError.textContent = '';
    currentEditingItemId = itemId;
    
    const stockInputDiv = inventoryStockInput.parentElement;

    if (itemId) {
        // --- 編集モード ---
        inventoryEditorModalTitle.textContent = '在庫品目の編集';
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) return;
        
        inventoryNameInput.value = item.name;
        inventoryCategoryInput.value = item.category || '';
        inventoryUnitInput.value = item.unit || '個';
        
        // 編集時は「現在の在庫数」は表示・変更不可（在庫調整モーダルで行う）
        stockInputDiv.classList.add('hidden');
        deleteInventoryItemBtn.classList.remove('hidden');
        
    } else {
        // --- 新規作成モード ---
        inventoryEditorModalTitle.textContent = '新規在庫品目登録';
        stockInputDiv.classList.remove('hidden');
        inventoryStockInput.value = 0;
        deleteInventoryItemBtn.classList.add('hidden');
    }
    
    openModal(inventoryEditorModal);
};

/**
 * (★新規★) 在庫品目を保存 (新規作成または更新)
 */
const saveInventoryItem = async () => {
    const name = inventoryNameInput.value.trim();
    const category = inventoryCategoryInput.value.trim() || null;
    const unit = inventoryUnitInput.value.trim();
    
    if (name === "" || unit === "") {
        inventoryEditorError.textContent = "品目名と単位は必須です。";
        return;
    }
    
    // 品目名の重複チェック (自分自身を除く)
    const nameExists = inventoryItems.some(i => 
        i.name === name && i.id !== currentEditingItemId
    );
    if (nameExists) {
        inventoryEditorError.textContent = "その品目名は既に使用されています。";
        return;
    }
    
    const itemData = {
        name: name,
        category: category,
        unit: unit,
        updatedAt: serverTimestamp() // (★新規★) サーバー時刻で更新
    };

    try {
        if (currentEditingItemId) {
            // --- 更新 ---
            const itemRef = doc(inventoryItemsCollectionRef, currentEditingItemId);
            await setDoc(itemRef, itemData, { merge: true }); // (★変更★) merge:true
        } else {
            // --- 新規作成 ---
            itemData.currentStock = parseInt(inventoryStockInput.value) || 0;
            itemData.createdAt = serverTimestamp();
            await addDoc(inventoryItemsCollectionRef, itemData);
        }
        
        closeModal(inventoryEditorModal);

    } catch (e) {
        console.error("Error saving inventory item: ", e);
        inventoryEditorError.textContent = "品目の保存に失敗しました。";
    }
};

/**
 * (★新規★) 在庫品目を削除
 */
const deleteInventoryItem = async () => {
    if (!currentEditingItemId) return;
    
    // (★重要★) 
    // 将来的に menu.js が更新され、メニューアイテムが
    // inventoryItemId を持つようになったら、ここでチェック処理を追加する。
    // 例: const isUsed = menu.items.some(item => item.inventoryItemId === currentEditingItemId);
    //     if (isUsed) { ... 削除不可エラー ... }
    
    const item = inventoryItems.find(i => i.id === currentEditingItemId);
    if (!confirm(`品目「${item.name}」を削除しますか？\n(※ メニューに紐付いている場合、在庫連動が解除されます)`)) {
        return;
    }

    try {
        const itemRef = doc(inventoryItemsCollectionRef, currentEditingItemId);
        await deleteDoc(itemRef);
        closeModal(inventoryEditorModal);
    } catch (e) {
        console.error("Error deleting inventory item: ", e);
        inventoryEditorError.textContent = "品目の削除に失敗しました。";
    }
};


// ===================================
// (★新規★) 在庫調整 モーダル
// ===================================

/**
 * (★新規★) 在庫調整モーダルを開く
 * @param {string} itemId 
 */
const openStockAdjustmentModal = (itemId) => {
    if (!stockAdjustmentModal) return;
    
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    stockAdjustmentForm.reset();
    adjustmentError.textContent = '';
    adjustmentItemId.value = itemId;
    
    stockAdjustmentModalTitle.textContent = `在庫調整: ${item.name}`;
    adjustmentCurrentStock.textContent = item.currentStock || 0;
    adjustmentUnit.textContent = item.unit || '個';
    
    // デフォルトは「入荷」タブ
    switchAdjustmentType('add');
    
    openModal(stockAdjustmentModal);
};

/**
 * (★新規★) 在庫調整モーダルのタブ切り替え
 * @param {'add'|'subtract'|'set'} type 
 */
const switchAdjustmentType = (type) => {
    currentAdjustmentType = type;
    
    // タブのアクティブ化
    adjustmentTypeTabs.querySelectorAll('button').forEach(btn => {
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // ラベルの変更
    if (type === 'add') {
        adjustmentAmountLabel.textContent = "入荷数";
        adjustmentAmountInput.placeholder = "例: 10";
    } else if (type === 'subtract') {
        adjustmentAmountLabel.textContent = "減少数 (廃棄・ロスなど)";
        adjustmentAmountInput.placeholder = "例: 1";
    } else if (type === 'set') {
        adjustmentAmountLabel.textContent = "棚卸後の新しい在庫数";
        adjustmentAmountInput.placeholder = "例: 50";
    }
};

/**
 * (★新規★) 在庫調整を保存
 */
const saveStockAdjustment = async () => {
    const itemId = adjustmentItemId.value;
    const amount = parseInt(adjustmentAmountInput.value);
    const memo = adjustmentMemoInput.value.trim() || null;
    
    if (!itemId || isNaN(amount)) {
        adjustmentError.textContent = "有効な数値を入力してください。";
        return;
    }
    
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) {
        adjustmentError.textContent = "対象の品目が見つかりません。";
        return;
    }
    
    let newStock = item.currentStock || 0;
    
    if (currentAdjustmentType === 'add') {
        if (amount <= 0) {
            adjustmentError.textContent = "0より大きい数値を入力してください。";
            return;
        }
        newStock += amount;
    } else if (currentAdjustmentType === 'subtract') {
        if (amount <= 0) {
            adjustmentError.textContent = "0より大きい数値を入力してください。";
            return;
        }
        newStock -= amount;
        if (newStock < 0) {
            if (!confirm(`在庫数がマイナス (${newStock}) になりますが、よろしいですか？`)) {
                return;
            }
        }
    } else if (currentAdjustmentType === 'set') {
        if (amount < 0) {
            adjustmentError.textContent = "0以上の数値を入力してください。";
            return;
        }
        newStock = amount;
    }
    
    // (★重要★) 
    // 将来的には、この調整履歴を別コレクション (inventoryLogs) に
    // 保存するロジックを追加する。
    // await addDoc(collection(db, "stores", currentStoreId, "inventoryLogs"), { ... });

    // 在庫品目ドキュメントを更新
    try {
        const itemRef = doc(inventoryItemsCollectionRef, itemId);
        await setDoc(itemRef, {
            currentStock: newStock,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        closeModal(stockAdjustmentModal);

    } catch (e) {
        console.error("Error saving stock adjustment: ", e);
        adjustmentError.textContent = "在庫の更新に失敗しました。";
    }
};


// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 在庫コレクションの参照を取得
    const { 
        inventoryItemsCollectionRef: iRef
    } = e.detail;

    inventoryItemsCollectionRef = iRef;

    // (★新規★) 在庫品目リストのリッスン
    onSnapshot(inventoryItemsCollectionRef, (querySnapshot) => {
        inventoryItems = [];
        querySnapshot.forEach((doc) => {
            inventoryItems.push({ ...doc.data(), id: doc.id });
        });
        console.log("Inventory items loaded: ", inventoryItems.length);
        
        // UIを描画
        renderInventoryList();
        
    }, (error) => {
        console.error("Error listening to inventory items: ", error);
        if (inventoryListLoading) {
            inventoryListLoading.parentElement.textContent = "在庫データの読み込みに失敗しました。";
        }
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'inventory.html');

    // ===== DOM要素の取得 =====
    pageTitle = document.getElementById('page-title');
    inventorySearchInput = document.getElementById('inventory-search-input');
    inventoryTableBody = document.getElementById('inventory-table-body');
    inventoryListLoading = document.getElementById('inventory-list-loading');
    addInventoryItemBtn = document.getElementById('add-inventory-item-btn');
    
    inventoryEditorModal = document.getElementById('inventory-editor-modal');
    inventoryEditorModalTitle = document.getElementById('inventory-editor-modal-title');
    inventoryEditorForm = document.getElementById('inventory-editor-form');
    inventoryNameInput = document.getElementById('inventory-name-input');
    inventoryCategoryInput = document.getElementById('inventory-category-input');
    inventoryUnitInput = document.getElementById('inventory-unit-input');
    inventoryStockInput = document.getElementById('inventory-stock-input');
    inventoryEditorError = document.getElementById('inventory-editor-error');
    saveInventoryItemBtn = document.getElementById('save-inventory-item-btn');
    deleteInventoryItemBtn = document.getElementById('delete-inventory-item-btn');
    
    stockAdjustmentModal = document.getElementById('stock-adjustment-modal');
    stockAdjustmentModalTitle = document.getElementById('stock-adjustment-modal-title');
    stockAdjustmentForm = document.getElementById('stock-adjustment-form');
    adjustmentItemId = document.getElementById('adjustment-item-id');
    adjustmentCurrentStock = document.getElementById('adjustment-current-stock');
    adjustmentUnit = document.getElementById('adjustment-unit');
    adjustmentTypeTabs = document.getElementById('adjustment-type-tabs');
    adjustmentAmountInput = document.getElementById('adjustment-amount-input');
    adjustmentAmountLabel = document.getElementById('adjustment-amount-label');
    adjustmentMemoInput = document.getElementById('adjustment-memo-input');
    adjustmentError = document.getElementById('adjustment-error');
    saveAdjustmentBtn = document.getElementById('save-adjustment-btn');
    
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');

    // ===== イベントリスナーの設定 =====

    // (★新規★) 検索入力
    if (inventorySearchInput) {
        inventorySearchInput.addEventListener('input', () => {
            renderInventoryList();
        });
    }

    // (★新規★) 新規品目追加ボタン
    if (addInventoryItemBtn) {
        addInventoryItemBtn.addEventListener('click', () => {
            openInventoryEditorModal(null);
        });
    }

    // (★新規★) 品目テーブルのイベント委任 (調整 / 編集)
    if (inventoryTableBody) {
        inventoryTableBody.addEventListener('click', (e) => {
            const adjustBtn = e.target.closest('.stock-adjust-btn');
            const editBtn = e.target.closest('.inventory-edit-btn');
            
            if (adjustBtn) {
                openStockAdjustmentModal(adjustBtn.dataset.itemId);
                return;
            }
            if (editBtn) {
                openInventoryEditorModal(editBtn.dataset.itemId);
                return;
            }
        });
    }

    // (★新規★) 品目 編集/新規 モーダル保存
    if (inventoryEditorForm) {
        inventoryEditorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveInventoryItem();
        });
    }
    
    // (★新規★) 品目 削除ボタン
    if (deleteInventoryItemBtn) {
        deleteInventoryItemBtn.addEventListener('click', () => {
            deleteInventoryItem();
        });
    }
    
    // (★新規★) 在庫調整モーダル タブ切り替え
    if (adjustmentTypeTabs) {
        adjustmentTypeTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.ranking-type-btn');
            if (tab && tab.dataset.type) {
                switchAdjustmentType(tab.dataset.type);
            }
        });
    }
    
    // (★新規★) 在庫調整モーダル 保存
    if (stockAdjustmentForm) {
        stockAdjustmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveStockAdjustment();
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