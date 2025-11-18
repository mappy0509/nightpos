// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc,
    collection, // (★修正★)
    getDocs, // (★修正★)
    serverTimestamp // (★修正★)
} from './firebase-init.js';

// (★新規★) AIサービスをインポート (将来的な機能拡張のため)
// (★修正★) ai-service.js は menu.js では使われないためインポートを削除
// import * as aiService from './ai-service.js'; 

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
let inventoryItems = []; 
let currentEditingMenuId = null; 
let categorySortable = null; 
let itemSortable = null; 
let modalCategorySortable = null; // (★修正★) モーダル内のSortableインスタンス

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, inventoryItemsCollectionRef,
    currentStoreId; 


// ===== DOM要素 =====
let pageTitle, 
    menuTabsContainer, 
    menuContentContainer, 
    menuTableHeader, 
    menuTableBody, 
    menuPage,
    modalCloseBtns, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    openNewMenuModalBtn, saveMenuItemBtn, 
    
    // (★新規★) コール管理用DOMを追加
    menuIsCallTargetInput, // (★追加★)
    
    // (★新規★) カテゴリ管理モーダル
    categoryEditorModal, openCategoryModalBtn, currentCategoriesList,
    newCategoryNameInput, addCategoryBtn, categoryAddError,
    
    // (★在庫管理 追加★)
    menuInventoryItemSelect, menuConsumptionGroup, 
    menuInventoryConsumptionInput, menuConsumptionUnit,
    
    headerStoreName; 


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
 * (★変更★) メニュー管理タブを動的に描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer || !menu) return; 
    
    menuTabsContainer.innerHTML = '';
    
    // (★変更★) order プロパティでソート
    const categories = (menu.categories || []).sort((a, b) => (a.order || 0) - (b.order || 0)); 
    
    let activeCategoryId = menu.currentActiveMenuCategoryId;

    if (!activeCategoryId || !categories.some(c => c.id === activeCategoryId)) {
        activeCategoryId = categories.length > 0 ? categories[0].id : null;
        if (menu) menu.currentActiveMenuCategoryId = activeCategoryId; 
    }

    if (categories.length === 0) {
        menuTabsContainer.innerHTML = '<div class="p-4 text-slate-500">カテゴリがありません。「カテゴリ管理」から追加してください。</div>';
    }

    categories.forEach(category => {
        const isActive = (category.id === activeCategoryId);
        const activeClass = isActive ? 'active' : '';
        
        // (★変更★) data-id 属性を追加 (並び替え用)
        const tabHTML = `
            <button class="menu-tab ${activeClass}" data-category-id="${category.id}" data-id="${category.id}">
                <i class="fa-solid fa-grip-vertical text-slate-400 cursor-move category-drag-handle mr-2" style="display: none;"></i>
                <span>${category.name}</span>
                <span class="menu-tab-edit-btn" data-category-id="${category.id}">
                    <i class="fa-solid fa-pen fa-xs"></i>
                </span>
            </button>
        `;
        menuTabsContainer.innerHTML += tabHTML;
    });
    
    // (★修正★) Sortable.js が有効になっているタブハンドルを表示
    if (categorySortable) {
        menuTabsContainer.querySelectorAll('.category-drag-handle').forEach(el => {
            el.style.display = 'inline-block';
        });
    }

    // (★変更★) タブの描画が終わってから、メニューリストを描画
    renderMenuList();
};

/**
 * (★シャンパンコール 変更★) 指定されたカテゴリのメニューリストを描画する
 */
const renderMenuList = () => {
    if (!menu) return;
    
    const activeCategoryId = menu.currentActiveMenuCategoryId;
    const activeCategory = (menu.categories || []).find(c => c.id === activeCategoryId);
    
    if (!activeCategory) {
        if (menuTableHeader) menuTableHeader.innerHTML = ''; // (★修正★)
        if (menuTableBody) menuTableBody.innerHTML = `<tr><td class="p-3 text-slate-500 text-sm" colspan="3">カテゴリを選択してください。</td></tr>`; // (★修正★)
        return;
    }

    const isSetCategory = activeCategory.isSetCategory;
    // (★シャンパンコール 変更★) ヘッダーに「コール対象」を追加
    if (menuTableHeader) menuTableHeader.innerHTML = `
        <th class="p-3 w-8"></th> 
        <th class="p-3">項目名</th>
        ${isSetCategory ? `<th class="p-3">時間</th>` : ''}
        <th class="p-3">料金 (税抜)</th>
        <th class="p-3">コール対象</th> <th class="p-3">在庫連動</th> 
        <th class="p-3 text-right">操作</th>
    `;
    const colSpan = isSetCategory ? 7 : 6; // ★修正★ colSpanを1つ増やす

    // (★並び替え 変更★) order プロパティでソート
    const items = (menu.items || []).filter(item => item.categoryId === activeCategoryId).sort((a, b) => (a.order || 0) - (b.order || 0));

    if (menuTableBody) menuTableBody.innerHTML = ''; // (★修正★)
    if (items.length === 0) {
        if (menuTableBody) menuTableBody.innerHTML = `<tr><td class="p-3 text-slate-500 text-sm" colspan="${colSpan}">このカテゴリにはメニューが登録されていません。</td></tr>`; // (★修正★)
        return;
    }
    
    items.forEach(item => {
        // (★在庫管理 追加★) 在庫品目名を取得
        let inventoryText = '---';
        if (item.inventoryItemId && inventoryItems) {
            const linkedItem = inventoryItems.find(i => i.id === item.inventoryItemId);
            if (linkedItem) {
                inventoryText = `${linkedItem.name} (${item.inventoryConsumption || 1} ${linkedItem.unit || '個'})`; // (★修正★)
            }
        }
        
        // (★シャンパンコール 追加★) コール対象の表示
        const isCallTarget = item.isCallTarget ? 
            '<i class="fa-solid fa-check-circle text-green-500"></i>' : 
            '<i class="fa-solid fa-xmark-circle text-red-400"></i>';

        const tr = `
            <tr class="border-b" data-id="${item.id}">
                <td class="item-drag-handle cursor-move p-3 text-center">
                    <i class="fa-solid fa-grip-vertical text-slate-400"></i>
                </td>
                <td class="p-3 font-medium">${item.name}</td>
                ${isSetCategory ? `<td class="p-3">${item.duration || '-'} 分</td>` : ''}
                <td class="p-3">${formatCurrency(item.price)}</td>
                <td class="p-3 text-center">${isCallTarget}</td> <td class="p-3 text-xs text-slate-600">${inventoryText}</td> 
                <td class="p-3 text-right space-x-2">
                    <button class="edit-menu-btn text-blue-600 hover:text-blue-800" data-menu-id="${item.id}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="delete-menu-btn text-red-600 hover:text-red-800" data-menu-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        if (menuTableBody) menuTableBody.innerHTML += tr; // (★修正★)
    });
};


/**
 * (★シャンパンコール 変更★) メニュー編集モーダルを開く
 * @param {string} mode 'new' または 'edit'
 * @param {string|null} menuId 編集対象のメニューID
 */
const openMenuEditorModal = (mode = 'new', menuId = null) => {
    if (!menu || !inventoryItems || !menuEditorModal) return; // (★修正★)
    menuEditorForm.reset();
    menuEditorError.textContent = '';
    
    // カテゴリプルダウン (★並び替え 変更★) order でソート
    menuCategorySelect.innerHTML = '';
    (menu.categories || []).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(category => {
        menuCategorySelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });

    // (★在庫管理 追加★) 在庫品目プルダウン
    menuInventoryItemSelect.innerHTML = '<option value="none">--- 在庫と連動しない ---</option>';
    // (★修正★)
    [...inventoryItems].sort((a,b) => a.name.localeCompare(b.name)).forEach(item => {
        menuInventoryItemSelect.innerHTML += `<option value="${item.id}" data-unit="${item.unit || '個'}">${item.name} (単位: ${item.unit || '個'})</option>`;
    });

    currentEditingMenuId = null; 
    
    const toggleDurationField = (selectedCategoryId) => {
        const category = (menu.categories || []).find(c => c.id === selectedCategoryId);
        if (category && category.isSetCategory) {
            menuDurationGroup.classList.remove('hidden');
        } else {
            menuDurationGroup.classList.add('hidden');
            menuDurationInput.value = '';
        }
    };
    
    // (★在庫管理 追加★)
    const toggleConsumptionField = (selectedInventoryId) => {
        if (selectedInventoryId === 'none') {
            menuConsumptionGroup.classList.add('hidden');
        } else {
            const selectedOption = menuInventoryItemSelect.querySelector(`option[value="${selectedInventoryId}"]`);
            if (selectedOption) { // (★修正★)
                menuConsumptionUnit.textContent = selectedOption.dataset.unit || '個';
            }
            menuConsumptionGroup.classList.remove('hidden');
        }
    };

    if (mode === 'new') {
        menuEditorModalTitle.textContent = '新規メニュー追加';
        menuCategorySelect.value = menu.currentActiveMenuCategoryId;
        toggleDurationField(menu.currentActiveMenuCategoryId);
        
        // (★シャンパンコール 変更★) デフォルトはチェックなし
        menuIsCallTargetInput.checked = false;

        // (★在庫管理 追加★)
        menuInventoryItemSelect.value = 'none';
        toggleConsumptionField('none');
        menuInventoryConsumptionInput.value = 1;

    } else if (mode === 'edit' && menuId) {
        menuEditorModalTitle.textContent = 'メニュー編集';
        
        const itemToEdit = (menu.items || []).find(item => item.id === menuId);

        if (itemToEdit) {
            currentEditingMenuId = menuId;
            menuCategorySelect.value = itemToEdit.categoryId;
            menuNameInput.value = itemToEdit.name;
            menuPriceInput.value = itemToEdit.price;
            toggleDurationField(itemToEdit.categoryId); 
            if (itemToEdit.duration) {
                menuDurationInput.value = itemToEdit.duration;
            }
            
            // (★シャンパンコール 変更★) コール対象フラグを読み込み
            menuIsCallTargetInput.checked = !!itemToEdit.isCallTarget; 
            
            // (★在庫管理 追加★)
            const inventoryId = itemToEdit.inventoryItemId || 'none';
            menuInventoryItemSelect.value = inventoryId;
            toggleConsumptionField(inventoryId);
            menuInventoryConsumptionInput.value = itemToEdit.inventoryConsumption || 1;

        } else {
            console.error('Edit error: Menu item not found');
            return;
        }
    }
    
    openModal(menuEditorModal);
};

/**
 * (★シャンパンコール 変更★) メニューアイテムを保存（新規作成または更新）する
 */
const saveMenuItem = async () => {
    if (!menu || !menuRef) return; // (★修正★)
    
    const categoryId = menuCategorySelect.value;
    const name = menuNameInput.value.trim();
    const price = parseInt(menuPriceInput.value);
    
    if (name === "" || isNaN(price) || price <= 0 || !categoryId) {
        menuEditorError.textContent = "カテゴリ、項目名、有効な料金を入力してください。";
        return;
    }
    
    const category = (menu.categories || []).find(c => c.id === categoryId);
    const duration = (category && category.isSetCategory) ? (parseInt(menuDurationInput.value) || null) : null;

    // (★在庫管理 追加★)
    const inventoryItemId = menuInventoryItemSelect.value;
    let inventoryConsumption = null;
    if (inventoryItemId !== 'none') {
        inventoryConsumption = parseFloat(menuInventoryConsumptionInput.value);
        if (isNaN(inventoryConsumption) || inventoryConsumption <= 0) {
            menuEditorError.textContent = "消費量には0より大きい数値を入力してください。";
            return;
        }
    }
    
    // (★シャンパンコール 変更★) コール対象フラグを取得
    const isCallTarget = menuIsCallTargetInput.checked;

    const newItemData = {
        id: currentEditingMenuId || getUUID(), 
        categoryId: categoryId, 
        name: name,
        price: price,
        duration: duration,
        isCallTarget: isCallTarget, // ★追加★
        inventoryItemId: inventoryItemId !== 'none' ? inventoryItemId : null,
        inventoryConsumption: inventoryConsumption
    };
    
    // (★変更★) menu オブジェクトを直接変更
    if (currentEditingMenuId) {
        const index = (menu.items || []).findIndex(item => item.id === currentEditingMenuId);
        if (index !== -1) {
            // 既存の order を維持
            newItemData.order = menu.items[index].order || 0;
            menu.items[index] = newItemData;
        } else {
             console.error('Save error: Item to edit not found');
        }
    } else {
        // 新規作成時に order を設定 (カテゴリ内の最後尾)
        const itemsInCategory = (menu.items || []).filter(i => i.categoryId === categoryId);
        newItemData.order = itemsInCategory.length; 
        
        if (!menu.items) {
            menu.items = [];
        }
        menu.items.push(newItemData);
    }

    menuEditorError.textContent = '';
    currentEditingMenuId = null;
    
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error saving menu item: ", e);
        menuEditorError.textContent = "メニューの保存に失敗しました。";
        // (★修正★) 失敗したらローカルの変更を戻す (簡易的にリロードを促す)
        alert("保存に失敗しました。ページをリロードして再度お試しください。");
        return;
    }
    
    closeModal(menuEditorModal);
};

/**
 * (★変更★) メニューアイテムを削除する
 * @param {string} menuId 
 */
const deleteMenuItem = async (menuId) => {
    if (!menu || !menuId || !menu.items || !menuRef) { // (★修正★)
        return;
    }
    
    menu.items = menu.items.filter(item => item.id !== menuId); 
    
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error deleting menu item: ", e);
    }
};

// ===================================
// (★報酬削除★) カテゴリ管理ロジック
// ===================================

/**
 * (★新規★) カテゴリ管理モーダルを開く
 */
const openCategoryEditorModal = () => {
    if (!menu || !categoryEditorModal) return; // (★修正★)
    renderCategoryList();
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    openModal(categoryEditorModal);
};

/**
 * (★報酬削除★) カテゴリ管理リストを描画する
 */
const renderCategoryList = () => {
    if (!currentCategoriesList || !menu) return;
    
    currentCategoriesList.innerHTML = '';
    // (★並び替え 変更★) order でソート
    const categories = (menu.categories || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    if (categories.length === 0) {
        currentCategoriesList.innerHTML = '<p class="text-sm text-slate-500">カテゴリがありません。</p>';
        return;
    }
    
    categories.forEach(category => {
        // (★並び替え 変更★) data-id 属性とドラッグハンドルを追加
        // (★修正★) isCastCategory は編集不可
        const isCastCategory = category.isCastCategory === true;
        
        const itemHTML = `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border" data-id="${category.id}">
                <div class="flex-1 flex items-center space-x-3">
                    <i class="fa-solid fa-grip-vertical text-slate-400 cursor-move category-drag-handle"></i>
                    <input type="text" value="${category.name}" 
                           class="w-1/2 p-2 border border-slate-300 rounded-lg category-name-input" 
                           data-category-id="${category.id}"
                           ${isCastCategory ? 'disabled' : ''}>
                    <label class="text-sm flex items-center space-x-1">
                        <input type="checkbox" ${category.isSetCategory ? 'checked' : ''} 
                               class="rounded border-slate-400 text-blue-600 focus:ring-blue-500 category-set-toggle" 
                               data-category-id="${category.id}"
                               ${isCastCategory ? 'disabled' : ''}>
                        <span>セット料金</span>
                    </label>
                    ${isCastCategory ? '<span class="text-xs text-pink-600">(キャスト料金カテゴリは変更不可)</span>' : ''}
                    </div>
                <button type="button" 
                        class="delete-category-btn text-red-500 hover:text-red-700" 
                        data-category-id="${category.id}"
                        title="カテゴリを削除"
                        ${isCastCategory ? 'disabled' : ''}>
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        currentCategoriesList.innerHTML += itemHTML;
    });
};

/**
 * (★新規★) カテゴリを追加する
 */
const addCategory = async () => {
    if (!menu || !menuRef) return; // (★修正★)
    
    const newName = newCategoryNameInput.value.trim();
    if (newName === "") {
        categoryAddError.textContent = "カテゴリ名を入力してください。";
        return;
    }
    
    const exists = (menu.categories || []).some(c => c.name === newName);
    if (exists) {
        categoryAddError.textContent = "そのカテゴリ名は既に使用されています。";
        return;
    }
    
    const newCategory = {
        id: getUUID(),
        name: newName,
        isSetCategory: false,
        isCastCategory: false, 
        order: (menu.categories || []).length 
    };
    
    if (!menu.categories) {
        menu.categories = [];
    }
    menu.categories.push(newCategory);
    
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
         console.error("Error adding category: ", e);
         categoryAddError.textContent = "カテゴリの追加に失敗しました。";
         menu.categories.pop(); 
         return;
    }
    
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    // (★修正★) onSnapshot で自動描画
    // renderCategoryList();
};

/**
 * (★新規★) カテゴリ名を更新する
 * @param {string} categoryId 
 * @param {string} newName 
 */
const updateCategoryName = async (categoryId, newName) => {
    if (!menu || !menuRef) return; // (★修正★)
    
    const category = (menu.categories || []).find(c => c.id === categoryId);
    if (category) {
        category.name = newName;
        try {
            await setDoc(menuRef, menu);
        } catch (e) {
            console.error("Error updating category name: ", e);
        }
    }
};

/**
 * (★報酬削除★) カテゴリのフラグ（isSetCategory）を更新する
 * @param {string} categoryId 
 * @param {string} flagType 'isSetCategory'
 * @param {boolean} isChecked 
 */
const updateCategoryFlag = async (categoryId, flagType, isChecked) => {
    if (!menu || !menuRef) return; // (★修正★)
    
    const category = (menu.categories || []).find(c => c.id === categoryId);
    if (category) {
        if (flagType === 'isSetCategory') {
            category.isSetCategory = isChecked;
        }
        
        try {
            await setDoc(menuRef, menu);
        } catch (e) {
            console.error("Error updating category flag: ", e);
        }
    }
};


/**
 * (★新規★) カテゴリを削除する
 * @param {string} categoryId 
 */
const deleteCategory = async (categoryId) => {
    if (!menu || !menuRef) return; // (★修正★)
    
    const itemsInCategory = (menu.items || []).filter(item => item.categoryId === categoryId);
    
    if (itemsInCategory.length > 0) {
        if (!confirm(`このカテゴリには ${itemsInCategory.length} 件の商品が登録されています。\nカテゴリを削除すると、これらの商品もすべて削除されます。\n本当に削除しますか？`)) {
            return;
        }
        menu.items = menu.items.filter(item => item.categoryId !== categoryId);
    }
    
    menu.categories = menu.categories.filter(c => c.id !== categoryId);
    
    if (menu.currentActiveMenuCategoryId === categoryId) {
        menu.currentActiveMenuCategoryId = (menu.categories.length > 0) ? menu.categories[0].id : null; // (★修正★)
    }
    
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error deleting category: ", e);
    }
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

/**
 * (★報酬削除★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
 */
const getDefaultSettings = () => {
    return {
        storeInfo: { name: "店舗" }, 
    };
};

const getDefaultMenu = () => {
    const catSetId = getUUID();
    const catDrinkId = getUUID();
    const catBottleId = getUUID();
    const catFoodId = getUUID();
    const catCastId = getUUID(); 
    const catOtherId = getUUID();
    
    return {
        categories: [
            { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false, order: 0 },
            { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false, order: 1 },
            { id: catBottleId, name: 'ボトル', isSetCategory: false, isCastCategory: false, order: 2 },
            { id: catFoodId, name: 'フード', isSetCategory: false, isCastCategory: false, order: 3 },
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true, order: 4 }, // (★修正★)
            { id: catOtherId, name: 'その他', isSetCategory: false, isCastCategory: false, order: 5 },
        ],
        items: [
            // ★シャンパンコール 変更★ isCallTarget: true/false を追加
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60, inventoryItemId: null, inventoryConsumption: null, order: 0, isCallTarget: false },
            { id: 'm2', categoryId: catSetId, name: '基本セット (フリー)', price: 8000, duration: 60, inventoryItemId: null, inventoryConsumption: null, order: 1, isCallTarget: false },
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null, inventoryItemId: null, inventoryConsumption: null, order: 0, isCallTarget: false },
            { id: 'm11', categoryId: catBottleId, name: '鏡月 (ボトル)', price: 8000, duration: null, inventoryItemId: null, inventoryConsumption: null, order: 0, isCallTarget: false },
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null, inventoryItemId: null, inventoryConsumption: null, order: 0, isCallTarget: false },
            
            // ★新規★ シャンパンボトル系のデフォルトに isCallTarget: true を設定
            { id: getUUID(), categoryId: catBottleId, name: 'ドン・ペリニヨン', price: 80000, duration: null, inventoryItemId: null, inventoryConsumption: null, order: 1, isCallTarget: true },
            { id: getUUID(), categoryId: catBottleId, name: 'モエ・シャンドン', price: 30000, duration: null, inventoryItemId: null, inventoryConsumption: null, order: 2, isCallTarget: true },
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};

/**
 * (★要望4, 5★)
 * (★新規★) ヘッダーのストア名をレンダリングする
 */
const renderHeaderStoreName = () => {
    if (!headerStoreName || !settings || !currentStoreId) return;

    const currentStoreName = (settings.storeInfo && settings.storeInfo.name) ? settings.storeInfo.name : "店舗";
    
    // (★変更★) loading... を店舗名で上書き
    headerStoreName.textContent = currentStoreName;
};

// (★新規★) 並び替え機能を初期化する
const initSortable = () => {
    if (typeof Sortable === 'undefined') {
        console.warn("Sortable.js is not loaded. Skipping sortable features."); // (★修正★)
        return;
    }

    // 1. カテゴリタブの並び替え
    if (menuTabsContainer && !categorySortable) { // (★修正★)
        categorySortable = new Sortable(menuTabsContainer, {
            animation: 150,
            handle: '.menu-tab', 
            onEnd: async (evt) => {
                if (!menu || !menu.categories || !menuRef) return; // (★修正★)
                
                // DOMから新しいIDの順序を取得
                const newOrderIds = Array.from(evt.target.children).map(child => child.dataset.id);
                
                // menu.categories 配列を並び替え
                menu.categories.forEach(cat => {
                    const newIndex = newOrderIds.indexOf(cat.id);
                    cat.order = newIndex !== -1 ? newIndex : 0;
                });

                // Firestoreに保存
                try {
                    await setDoc(menuRef, menu);
                } catch (e) {
                    console.error("Error saving category order: ", e);
                }
            }
        });
        // (★修正★) Sortableが初期化されたらハンドルを表示
        menuTabsContainer.querySelectorAll('.category-drag-handle').forEach(el => {
            el.style.display = 'inline-block';
        });
    }

    // 2. メニュー項目の並び替え
    if (menuTableBody && !itemSortable) { // (★修正★)
        itemSortable = new Sortable(menuTableBody, {
            animation: 150,
            handle: '.item-drag-handle', 
            onEnd: async (evt) => {
                if (!menu || !menu.items || !menu.currentActiveMenuCategoryId || !menuRef) return; // (★修正★)

                // DOMから新しいIDの順序を取得
                const newOrderIds = Array.from(evt.target.children).map(child => child.dataset.id);
                
                // 現在表示中のカテゴリのアイテムのみを対象に order を更新
                let orderCounter = 0;
                newOrderIds.forEach(id => {
                    const item = menu.items.find(i => i.id === id);
                    if (item && item.categoryId === menu.currentActiveMenuCategoryId) {
                        item.order = orderCounter++;
                    }
                });

                // Firestoreに保存
                try {
                    await setDoc(menuRef, menu);
                } catch (e) {
                    console.error("Error saving menu item order: ", e);
                }
            }
        });
    }
    
    // 3. カテゴリ管理モーダルの並び替え
    if (currentCategoriesList && !modalCategorySortable) { // (★修正★)
        modalCategorySortable = new Sortable(currentCategoriesList, {
            animation: 150,
            handle: '.category-drag-handle', 
            onEnd: async (evt) => {
                if (!menu || !menu.categories || !menuRef) return; // (★修正★)

                // DOMから新しいIDの順序を取得
                const newOrderIds = Array.from(evt.target.children).map(child => child.dataset.id);
                
                // menu.categories 配列を並び替え
                menu.categories.forEach(cat => {
                    const newIndex = newOrderIds.indexOf(cat.id);
                    cat.order = newIndex !== -1 ? newIndex : 0;
                });

                // Firestoreに保存
                try {
                    await setDoc(menuRef, menu);
                } catch (e) {
                    console.error("Error saving category order in modal: ", e);
                }
            }
        });
    }
};


/**
 * (★報酬削除★) --- Firestore リアルタイムリスナー ---
 */
document.addEventListener('firebaseReady', (e) => {
    
    // (★在庫管理 変更★)
    const { 
        settingsRef: sRef, 
        menuRef: mRef,
        inventoryItemsCollectionRef: iRef, 
        currentStoreId: csId,
        collection: fbCollection, // (★修正★)
        query: fbQuery, // (★修正★)
        orderBy: fbOrderBy // (★修正★)
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    menuRef = mRef;
    // (★修正★) inventoryItemsCollectionRef は collection() を使って正しく参照する
    inventoryItemsCollectionRef = collection(db, "stores", csId, "inventoryItems");
    currentStoreId = csId; 

    let settingsLoaded = false;
    let menuLoaded = false;
    let inventoryLoaded = false; 

    const checkAndRenderAll = () => {
        // (★在庫管理 変更★) 在庫リストも待つ
        if (settingsLoaded && menuLoaded && inventoryLoaded) {
            console.log("Menu, Settings, Inventory data loaded. Rendering UI for menu.js");
            renderMenuTabs();
            renderHeaderStoreName(); 
            initSortable(); 
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
            await setDoc(menuRef, defaultMenu);
            menu = defaultMenu;
        }
        menuLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to menu: ", error);
        menuLoaded = true;
        checkAndRenderAll();
    });

    // 3. (★在庫管理 追加★) Inventory Items (プルダウン用)
    onSnapshot(inventoryItemsCollectionRef, (querySnapshot) => {
        inventoryItems = [];
        querySnapshot.forEach((doc) => {
            inventoryItems.push({ ...doc.data(), id: doc.id });
        });
        console.log("Inventory items loaded (for menu modal): ", inventoryItems.length);
        inventoryLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to inventory items: ", error);
        inventoryLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });

});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'menu.html');

    // ===== DOM要素の取得 =====
    pageTitle = document.getElementById('page-title');
    menuTabsContainer = document.getElementById('menu-tabs-container'); 
    menuContentContainer = document.getElementById('menu-content-container');
    menuTableHeader = document.getElementById('menu-table-header');
    menuTableBody = document.getElementById('menu-table-body');
    
    menuPage = document.getElementById('menu'); 
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    menuEditorModal = document.getElementById('menu-editor-modal');
    menuEditorModalTitle = document.getElementById('menu-editor-modal-title');
    menuEditorForm = document.getElementById('menu-editor-form');
    menuCategorySelect = document.getElementById('menu-category');
    menuNameInput = document.getElementById('menu-name');
    menuDurationGroup = document.getElementById('menu-duration-group');
    menuDurationInput = document.getElementById('menu-duration');
    menuPriceInput = document.getElementById('menu-price');
    menuEditorError = document.getElementById('menu-editor-error');
    openNewMenuModalBtn = document.getElementById('open-new-menu-modal-btn'); 
    saveMenuItemBtn = document.getElementById('save-menu-item-btn');
    
    // (★新規★) コール管理用DOMを追加
    menuIsCallTargetInput = document.getElementById('menu-is-call-target'); // ★DOM取得★
    
    // (★新規★) カテゴリ管理モーダル
    categoryEditorModal = document.getElementById('category-editor-modal');
    openCategoryModalBtn = document.getElementById('open-category-modal-btn');
    currentCategoriesList = document.getElementById('current-categories-list');
    newCategoryNameInput = document.getElementById('new-category-name-input');
    addCategoryBtn = document.getElementById('add-category-btn');
    categoryAddError = document.getElementById('category-add-error');
    
    // (★在庫管理 追加★)
    menuInventoryItemSelect = document.getElementById('menu-inventory-item');
    menuConsumptionGroup = document.getElementById('menu-consumption-group');
    menuInventoryConsumptionInput = document.getElementById('menu-inventory-consumption');
    menuConsumptionUnit = document.getElementById('menu-consumption-unit');
    
    headerStoreName = document.getElementById('header-store-name'); 
    
    // ===== イベントリスナーの設定 =====
    
    // (★変更★) タブのイベント委任
    if (menuTabsContainer) { 
        menuTabsContainer.addEventListener('click', async (e) => { 
            const tabButton = e.target.closest('.menu-tab');
            const editButton = e.target.closest('.menu-tab-edit-btn');
            
            if (editButton) {
                e.stopPropagation(); 
                openCategoryEditorModal();
                return;
            }
            
            if (tabButton) {
                e.preventDefault();
                const categoryId = tabButton.dataset.categoryId;
                if (menu && menuRef) { // (★修正★)
                    menu.currentActiveMenuCategoryId = categoryId;
                    
                    try {
                        // (★修正★) タブ切り替えはローカルの state 変更 + UI再描画のみ
                        // (★修正★) Firestore への保存は不要 (保存すると他ユーザーの画面も切り替わってしまう)
                        // await setDoc(menuRef, menu);
                        renderMenuTabs(); // (★修正★)
                    } catch (e) {
                        console.error("Error updating active category: ", e);
                    }
                }
            }
        });
    }

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => { 
            const modal = e.target.closest('.modal-backdrop'); 
            if (modal) {
                closeModal(modal);
            }
        });
    });
    
    // (★新規★) カテゴリ管理モーダルを開く
    if (openCategoryModalBtn) {
        openCategoryModalBtn.addEventListener('click', () => {
            openCategoryEditorModal();
        });
    }
    
    // (★新規★) カテゴリ追加ボタン
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            addCategory(); 
        });
    }
    // (★新規★) カテゴリ名入力でEnter
    if (newCategoryNameInput) {
        newCategoryNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCategory(); 
            }
        });
    }

    /**
     * (★報酬削除★) カテゴリリストのイベント委任 (編集・削除)
     */
    if (currentCategoriesList) {
        // 削除
        currentCategoriesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-category-btn');
            if (deleteBtn && !deleteBtn.disabled) {
                const categoryId = deleteBtn.dataset.categoryId;
                if (!menu || !menu.categories) return; // (★修正★)
                const category = (menu.categories || []).find(c => c.id === categoryId); 
                const categoryName = category ? category.name : 'このカテゴリ';
                
                if (confirm(`「${categoryName}」を削除しますか？\n(カテゴリに紐付いた商品も全て削除されます)`)) {
                    deleteCategory(categoryId); 
                }
            }
        });
        
        // 名前変更 (focusout)
        currentCategoriesList.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('category-name-input')) {
                const categoryId = e.target.dataset.categoryId;
                const newName = e.target.value.trim();
                if (!menu || !menu.categories) return; // (★修正★)
                const category = (menu.categories || []).find(c => c.id === categoryId); 
                
                if (newName === "") {
                    if(category) e.target.value = category.name; 
                } else if (category && category.name !== newName) {
                    updateCategoryName(categoryId, newName); 
                }
            }
        });
        
        // フラグ変更 (change)
        currentCategoriesList.addEventListener('change', (e) => {
            const categoryId = e.target.dataset.categoryId;
            if (e.target.classList.contains('category-set-toggle')) {
                updateCategoryFlag(categoryId, 'isSetCategory', e.target.checked); 
            }
        });
    }


    // (★変更★) 新規メニュー追加ボタン
    if (openNewMenuModalBtn) {
        openNewMenuModalBtn.addEventListener('click', () => {
            openMenuEditorModal('new');
        });
    }

    // (★変更★) メニュー編集モーダル > カテゴリ変更
    if (menuCategorySelect) {
        menuCategorySelect.addEventListener('change', (e) => {
            const selectedCategoryId = e.target.value;
            if (!menu || !menu.categories) return; // (★修正★)
            const category = (menu.categories || []).find(c => c.id === selectedCategoryId); 
            
            if (category && category.isSetCategory) {
                menuDurationGroup.classList.remove('hidden');
            } else {
                menuDurationGroup.classList.add('hidden');
                menuDurationInput.value = '';
            }
        });
    }

    // (★在庫管理 追加★) メニュー編集モーダル > 在庫品目変更
    if (menuInventoryItemSelect) {
        menuInventoryItemSelect.addEventListener('change', (e) => {
            const selectedInventoryId = e.target.value;
            if (selectedInventoryId === 'none') {
                menuConsumptionGroup.classList.add('hidden');
            } else {
                const selectedOption = e.target.querySelector(`option[value="${selectedInventoryId}"]`);
                if (selectedOption) { // (★修正★)
                    menuConsumptionUnit.textContent = selectedOption.dataset.unit || '個';
                }
                menuConsumptionGroup.classList.remove('hidden');
            }
        });
    }

    // (★変更★) メニュー編集モーダル > 保存
    if (menuEditorForm) { 
        menuEditorForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            saveMenuItem(); 
        });
    }

    // (★変更★) メニューリストのイベント委任 (tbody)
    if (menuTableBody) {
        menuTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-menu-btn');
            if (editBtn) {
                const menuId = editBtn.dataset.menuId;
                openMenuEditorModal('edit', menuId);
                return;
            }

            const deleteBtn = e.target.closest('.delete-menu-btn');
            if (deleteBtn) {
                const menuId = deleteBtn.dataset.menuId;
                
                // (★修正★)
                const itemName = deleteBtn.closest('tr') ? (deleteBtn.closest('tr').querySelector('td:nth-child(2)')?.textContent || 'この商品') : 'この商品';
                
                if (confirm(`「${itemName}」を削除しますか？\nこの操作は取り消せません。`)) { 
                    deleteMenuItem(menuId); 
                }
                return;
            }
        });
    }

});