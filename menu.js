// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    // addDoc, (★削除★)
    // deleteDoc, (★削除★)
    doc,
    collection // (★削除★)
} from './firebase-init.js';

// (★新規★) 新しい参照をインポート
import {
    settingsRef, // (★変更★) settings はカテゴリ管理で参照
    menuRef
    // (★削除★) slipCounterRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef
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
let settings = null; // (★追加★) カテゴリ管理（isCastCategoryなど）のため
let menu = null;
// (★削除★) casts, customers, slips, slipCounter は不要

// (★変更★) 現在選択中の編集ID
let currentEditingMenuId = null; 

// ===== DOM要素 =====
// (★修正★) menu.js (menu.html) に必要なDOMのみに限定
let navLinks, pageTitle, 
    menuTabsContainer, 
    menuContentContainer, 
    menuTableHeader, 
    menuTableBody, 
    menuPage,
    modalCloseBtns, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    openNewMenuModalBtn, saveMenuItemBtn, 
    
    // (★新規★) カテゴリ管理モーダル
    categoryEditorModal, openCategoryModalBtn, currentCategoriesList,
    newCategoryNameInput, addCategoryBtn, categoryAddError;

// (★削除★) 伝票・注文・会計関連のDOM変数をすべて削除


// --- 関数 ---

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    return `¥${amount.toLocaleString()}`;
};

// (★削除★) 伝票関連のヘルパー関数 (formatDateTimeLocal, formatElapsedTime, calculateSlipTotal, getCastNameById, getActiveSlipCount) をすべて削除


/**
 * (★変更★) メニュー管理タブを動的に描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer || !menu) return; 
    
    menuTabsContainer.innerHTML = '';
    
    const categories = menu.categories || []; 
    
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
        
        const tabHTML = `
            <button class="menu-tab ${activeClass}" data-category-id="${category.id}">
                <span>${category.name}</span>
                <span class="menu-tab-edit-btn" data-category-id="${category.id}">
                    <i class="fa-solid fa-pen fa-xs"></i>
                </span>
            </button>
        `;
        menuTabsContainer.innerHTML += tabHTML;
    });

    renderMenuList();
};

/**
 * (★変更★) 指定されたカテゴリのメニューリストを描画する
 */
const renderMenuList = () => {
    if (!menu) return;
    
    const activeCategoryId = menu.currentActiveMenuCategoryId;
    const activeCategory = (menu.categories || []).find(c => c.id === activeCategoryId);
    
    if (!activeCategory) {
        menuTableHeader.innerHTML = '';
        menuTableBody.innerHTML = `<tr><td class="p-3 text-slate-500 text-sm" colspan="3">カテゴリを選択してください。</td></tr>`;
        return;
    }

    const isSetCategory = activeCategory.isSetCategory;
    menuTableHeader.innerHTML = `
        <th class="p-3">項目名</th>
        ${isSetCategory ? `<th class="p-3">時間</th>` : ''}
        <th class="p-3">料金 (税抜)</th>
        <th class="p-3 text-right">操作</th>
    `;
    const colSpan = isSetCategory ? 4 : 3;

    const items = (menu.items || [])
        .filter(item => item.categoryId === activeCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name));

    menuTableBody.innerHTML = '';
    if (items.length === 0) {
        menuTableBody.innerHTML = `<tr><td class="p-3 text-slate-500 text-sm" colspan="${colSpan}">このカテゴリにはメニューが登録されていません。</td></tr>`;
        return;
    }
    
    items.forEach(item => {
        const tr = `
            <tr class="border-b">
                <td class="p-3 font-medium">${item.name}</td>
                ${isSetCategory ? `<td class="p-3">${item.duration || '-'} 分</td>` : ''}
                <td class="p-3">${formatCurrency(item.price)}</td>
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
        menuTableBody.innerHTML += tr;
    });
};


/**
 * (★変更★) メニュー編集モーダルを開く
 * @param {string} mode 'new' または 'edit'
 * @param {string|null} menuId 編集対象のメニューID
 */
const openMenuEditorModal = (mode = 'new', menuId = null) => {
    if (!menu) return; 
    menuEditorForm.reset();
    menuEditorError.textContent = '';
    
    menuCategorySelect.innerHTML = '';
    (menu.categories || []).forEach(category => {
        menuCategorySelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
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

    if (mode === 'new') {
        menuEditorModalTitle.textContent = '新規メニュー追加';
        menuCategorySelect.value = menu.currentActiveMenuCategoryId;
        toggleDurationField(menu.currentActiveMenuCategoryId);

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
        } else {
            console.error('Edit error: Menu item not found');
            return;
        }
    }
    
    openModal(menuEditorModal);
};

/**
 * (★変更★) メニューアイテムを保存（新規作成または更新）する
 */
const saveMenuItem = async () => {
    if (!menu) return; 
    
    const categoryId = menuCategorySelect.value;
    const name = menuNameInput.value.trim();
    const price = parseInt(menuPriceInput.value);
    
    if (name === "" || isNaN(price) || price <= 0 || !categoryId) {
        menuEditorError.textContent = "カテゴリ、項目名、有効な料金を入力してください。";
        return;
    }
    
    const category = (menu.categories || []).find(c => c.id === categoryId);
    const duration = (category && category.isSetCategory) ? (parseInt(menuDurationInput.value) || null) : null;

    const newItemData = {
        id: currentEditingMenuId || getUUID(), 
        categoryId: categoryId, 
        name: name,
        price: price,
        duration: duration 
    };
    
    // (★変更★) menu オブジェクトを直接変更
    if (currentEditingMenuId) {
        const index = (menu.items || []).findIndex(item => item.id === currentEditingMenuId);
        if (index !== -1) {
            menu.items[index] = newItemData;
        } else {
             console.error('Save error: Item to edit not found');
        }
    } else {
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
        // (★注意★) エラー時はローカルの変更を戻す処理が本当は必要だが、
        // onSnapshotによる再取得に任せる
        return;
    }
    
    closeModal(menuEditorModal);
    // (変更) onSnapshot が自動で再描画
};

/**
 * (★変更★) メニューアイテムを削除する
 * @param {string} menuId 
 */
const deleteMenuItem = async (menuId) => {
    if (!menu || !menuId || !menu.items) { 
        return;
    }
    
    menu.items = menu.items.filter(item => item.id !== menuId); 
    
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error deleting menu item: ", e);
        // (★注意★) エラー時はローカルの変更を戻す処理が本当は必要だが、
        // onSnapshotによる再取得に任せる
    }
    // (変更) onSnapshot が自動で再描画
};

// ===================================
// (★新規★) カテゴリ管理ロジック
// ===================================

/**
 * (★新規★) カテゴリ管理モーダルを開く
 */
const openCategoryEditorModal = () => {
    if (!menu) return;
    renderCategoryList();
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    openModal(categoryEditorModal);
};

/**
 * (★新規★) カテゴリ管理リストを描画する
 */
const renderCategoryList = () => {
    if (!currentCategoriesList || !menu) return;
    
    currentCategoriesList.innerHTML = '';
    const categories = menu.categories || [];
    
    if (categories.length === 0) {
        currentCategoriesList.innerHTML = '<p class="text-sm text-slate-500">カテゴリがありません。</p>';
        return;
    }
    
    categories.forEach(category => {
        // (★変更★) settings からキャスト料金カテゴリIDを取得して比較
        const castPriceCategoryId = settings?.performanceSettings?.castPriceCategoryId;
        const isProtected = (category.id === castPriceCategoryId); 
        
        const itemHTML = `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <div class="flex-1 flex items-center space-x-3">
                    <input type-="text" value="${category.name}" 
                           class="w-1/3 p-2 border border-slate-300 rounded-lg category-name-input" 
                           data-category-id="${category.id}">
                    <label class="text-sm flex items-center space-x-1">
                        <input type="checkbox" ${category.isSetCategory ? 'checked' : ''} 
                               class="rounded border-slate-400 text-blue-600 focus:ring-blue-500 category-set-toggle" 
                               data-category-id="${category.id}">
                        <span>セット料金</span>
                    </label>
                    <label class="text-sm flex items-center space-x-1 ${isProtected ? 'opacity-50' : ''}">
                        <input type="checkbox" ${category.isCastCategory ? 'checked' : ''} 
                               class="rounded border-slate-400 text-pink-600 focus:ring-pink-500 category-cast-toggle" 
                               data-category-id="${category.id}"
                               ${isProtected ? 'disabled' : ''}
                               title="${isProtected ? 'このカテゴリは「店舗設定」の成績反映対象です' : ''}">
                        <span>キャスト料金 (成績反映)</span>
                    </label>
                </div>
                <button type="button" 
                        class="delete-category-btn text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" 
                        data-category-id="${category.id}"
                        ${isProtected ? 'disabled' : ''}
                        title="${isProtected ? '「成績反映」に設定されているカテゴリは削除できません' : 'カテゴリを削除'}">
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
    if (!menu) return;
    
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
        isCastCategory: false
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
};

/**
 * (★新規★) カテゴリ名を更新する
 * @param {string} categoryId 
 * @param {string} newName 
 */
const updateCategoryName = async (categoryId, newName) => {
    if (!menu) return;
    
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
 * (★新規★) カテゴリのフラグ（isSetCategory, isCastCategory）を更新する
 * @param {string} categoryId 
 * @param {string} flagType 'isSetCategory' または 'isCastCategory'
 * @param {boolean} isChecked 
 */
const updateCategoryFlag = async (categoryId, flagType, isChecked) => {
    if (!menu) return;
    
    const category = (menu.categories || []).find(c => c.id === categoryId);
    if (category) {
        if (flagType === 'isSetCategory') {
            category.isSetCategory = isChecked;
        } else if (flagType === 'isCastCategory') {
            // (★重要★) isCastCategoryは1つしか設定できないようにする
            // (※ settings.js 側で「どれを成績対象にするか」を選ぶ方が堅牢だが、
            //    現在のUIに合わせてここで制御する)
            
            // 一旦すべてを false にする
            menu.categories.forEach(c => c.isCastCategory = false);
            // 選択されたものだけ true にする
            category.isCastCategory = isChecked; 
            
            // (★重要★) settings.js 側が参照するIDも更新する
            if (settings) {
                settings.performanceSettings.castPriceCategoryId = isChecked ? categoryId : null;
                try {
                    await setDoc(settingsRef, settings);
                } catch (e) {
                    console.error("Error updating settings.performanceSettings.castPriceCategoryId: ", e);
                    // エラーが出ても menu の更新は試みる
                }
            }
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
    if (!menu) return;
    
    const itemsInCategory = (menu.items || []).filter(item => item.categoryId === categoryId);
    
    if (itemsInCategory.length > 0) {
        if (!confirm(`このカテゴリには ${itemsInCategory.length} 件の商品が登録されています。\nカテゴリを削除すると、これらの商品もすべて削除されます。\n本当に削除しますか？`)) {
            return;
        }
        menu.items = menu.items.filter(item => item.categoryId !== categoryId);
    }
    
    menu.categories = menu.categories.filter(c => c.id !== categoryId);
    
    if (menu.currentActiveMenuCategoryId === categoryId) {
        menu.currentActiveMenuCategoryId = null;
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

// (★削除★) 伝票・注文関連の関数をすべて削除
// updateModalCommonInfo, renderSlipPreviewModal, renderCheckoutModal, 
// updatePaymentStatus, renderReceiptModal, renderCancelSlipModal, 
// createNewSlip, renderSlipSelectionModal, renderNewSlipConfirmModal,
// handleSlipClick, handlePaidSlipClick


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    return {
        // (★簡易版★ menu.js は settings を参照するだけなので)
        performanceSettings: {
            castPriceCategoryId: null
        }
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
            { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false },
            { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false },
            { id: catBottleId, name: 'ボトル', isSetCategory: false, isCastCategory: false },
            { id: catFoodId, name: 'フード', isSetCategory: false, isCastCategory: false },
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true }, 
            { id: catOtherId, name: 'その他', isSetCategory: false, isCastCategory: false },
        ],
        items: [
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', categoryId: catSetId, name: '基本セット (フリー)', price: 8000, duration: 60 },
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
            { id: 'm11', categoryId: catBottleId, name: '鏡月 (ボトル)', price: 8000, duration: null },
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null }, // (★ID変更★)
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};


// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) menuRef と settingsRef のみリッスン
    const { 
        settingsRef, menuRef
    } = e.detail;

    let settingsLoaded = false;
    let menuLoaded = false;

    const checkAndRenderAll = () => {
        // (★変更★) menu.js は renderMenuTabs を呼ぶ
        if (settingsLoaded && menuLoaded) {
            console.log("Menu and Settings data loaded. Rendering UI for menu.js");
            renderMenuTabs();
            // (★削除★) 伝票モーダルがないため updateModalCommonInfo は不要
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

    // (★削除★) slipCounter, casts, customers, slips のリスナーを削除
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    // (★修正★) menu.html に存在するDOMのみ取得
    navLinks = document.querySelectorAll('.nav-link');
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
    
    // (★新規★) カテゴリ管理モーダル
    categoryEditorModal = document.getElementById('category-editor-modal');
    openCategoryModalBtn = document.getElementById('open-category-modal-btn');
    currentCategoriesList = document.getElementById('current-categories-list');
    newCategoryNameInput = document.getElementById('new-category-name-input');
    addCategoryBtn = document.getElementById('add-category-btn');
    categoryAddError = document.getElementById('category-add-error');
    
    // (★削除★) 伝票関連のDOM取得をすべて削除

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====
    
    // (★変更★) タブのイベント委任
    if (menuTabsContainer) { 
        menuTabsContainer.addEventListener('click', async (e) => { // (★変更★) async
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
                if (menu) { 
                    menu.currentActiveMenuCategoryId = categoryId;
                    
                    try {
                        await setDoc(menuRef, menu);
                    } catch (e) {
                        console.error("Error updating active category: ", e);
                    }
                    // (★変更★) onSnapshotが renderMenuTabs を呼ぶ
                }
            }
        });
    }

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // (★変更★) menu.html に存在するモーダルのみ閉じる
            closeModal(categoryEditorModal);
            closeModal(menuEditorModal);
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
            addCategory(); // (★変更★)
        });
    }
    // (★新規★) カテゴリ名入力でEnter
    if (newCategoryNameInput) {
        newCategoryNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCategory(); // (★変更★)
            }
        });
    }

    // (★新規★) カテゴリリストのイベント委任 (編集・削除)
    if (currentCategoriesList) {
        // 削除
        currentCategoriesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-category-btn');
            if (deleteBtn && !deleteBtn.disabled) {
                const categoryId = deleteBtn.dataset.categoryId;
                const category = (menu.categories || []).find(c => c.id === categoryId); // (★変更★)
                const categoryName = category ? category.name : 'このカテゴリ';
                
                if (confirm(`「${categoryName}」を削除しますか？\n(カテゴリに紐付いた商品も全て削除されます)`)) {
                    deleteCategory(categoryId); // (★変更★)
                }
            }
        });
        
        // 名前変更 (focusout)
        currentCategoriesList.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('category-name-input')) {
                const categoryId = e.target.dataset.categoryId;
                const newName = e.target.value.trim();
                const category = (menu.categories || []).find(c => c.id === categoryId); // (★変更★)
                
                if (newName === "") {
                    // (変更) onSnapshot が再描画
                } else if (category && category.name !== newName) {
                    updateCategoryName(categoryId, newName); // (★変更★)
                }
            }
        });
        
        // フラグ変更 (change)
        currentCategoriesList.addEventListener('change', (e) => {
            const categoryId = e.target.dataset.categoryId;
            if (e.target.classList.contains('category-set-toggle')) {
                updateCategoryFlag(categoryId, 'isSetCategory', e.target.checked); // (★変更★)
            }
            else if (e.target.classList.contains('category-cast-toggle')) {
                updateCategoryFlag(categoryId, 'isCastCategory', e.target.checked); // (★変更★)
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
            const category = (menu.categories || []).find(c => c.id === selectedCategoryId); // (★変更★)
            
            if (category && category.isSetCategory) {
                menuDurationGroup.classList.remove('hidden');
            } else {
                menuDurationGroup.classList.add('hidden');
                menuDurationInput.value = '';
            }
        });
    }

    if (saveMenuItemBtn) {
        saveMenuItemBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveMenuItem(); // (★変更★)
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
                
                if (confirm(`「${deleteBtn.closest('tr').querySelector('td').textContent}」を削除しますか？\nこの操作は取り消せません。`)) {
                    deleteMenuItem(menuId); // (★変更★)
                }
                return;
            }
        });
    }
    
    // (★削除★) 伝票関連のリスナーをすべて削除
    // (slipSelectionList, createNewSlipBtn, confirmCreateSlipBtn, etc...)

});