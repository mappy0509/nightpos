// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc 
} from './firebase-init.js';
// (削除) getFirebaseServices のインポートを削除

// ===== グローバル定数・変数 =====

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (変更) state は onSnapshot で取得するため、ローカルの state オブジェクトを削除
let state = null;
let stateDocRef = null; // (変更) stateDocRef をグローバルで保持

// ===== DOM要素 =====
// (★修正★) menu.js (menu.html) に必要なDOMのみに限定
let navLinks, pages, pageTitle, 
    menuTabsContainer, // (★変更★) タブの動的コンテナ
    menuContentContainer, // (★新規★)
    menuTableHeader, // (★新規★)
    menuTableBody, // (★新規★)
    menuPage,
    orderModal, checkoutModal, receiptModal,
    slipPreviewModal, modalCloseBtns, openSlipPreviewBtn, processPaymentBtn,
    printSlipBtn, goToCheckoutBtn, reopenSlipBtn, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    openNewMenuModalBtn, saveMenuItemBtn, 
    // (★削除★) 静的なTbodyは削除
    // setMenuTbody, drinkMenuTbody, ...
    cancelSlipModal, openCancelSlipModalBtn, cancelSlipModalTitle, cancelSlipNumber,
    cancelSlipReasonInput, cancelSlipError, confirmCancelSlipBtn, slipSelectionModal,
    slipSelectionModalTitle, slipSelectionList, createNewSlipBtn, newSlipConfirmModal,
    newSlipConfirmTitle, newSlipConfirmMessage, confirmCreateSlipBtn, orderModalTitle,
    orderItemsList, menuOrderGrid, orderSubtotalEl, orderCustomerNameSelect,
    orderNominationSelect, newCustomerInputGroup, newCustomerNameInput,
    saveNewCustomerBtn, newCustomerError, checkoutModalTitle, checkoutItemsList,
    checkoutSubtotalEl, checkoutServiceChargeEl, checkoutTaxEl, checkoutPaidAmountEl,
    checkoutTotalEl, paymentCashInput, paymentCardInput, paymentCreditInput,
    checkoutPaymentTotalEl, checkoutShortageEl, checkoutChangeEl, slipSubtotalEl,
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl,
    // (新規) HTML側で追加したID
    slipStoreName, slipStoreTel, slipServiceRate, slipTaxRate,
    checkoutStoreName, checkoutStoreTel, checkoutServiceRate, checkoutTaxRate,
    receiptStoreName, receiptAddress, receiptTel,
    
    // (★新規★) カテゴリ管理モーダル
    categoryEditorModal, openCategoryModalBtn, currentCategoriesList,
    newCategoryNameInput, addCategoryBtn, categoryAddError,

    // (★新規★) 伝票作成時間
    newSlipStartTimeInput, newSlipTimeError;


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
 * (★新規★) Dateオブジェクトを 'YYYY-MM-DDTHH:MM' 形式の文字列に変換する
 * (datetime-local入力欄用)
 * @param {Date} date 
 * @returns {string}
 */
const formatDateTimeLocal = (date) => {
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const MIN = String(date.getMinutes()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}T${HH}:${MIN}`;
};

/**
 * (★新規★) 経過時間を HH:MM 形式でフォーマットする
 * @param {number} ms - ミリ秒
 * @returns {string} HH:MM 形式の文字列
 */
const formatElapsedTime = (ms) => {
    if (ms < 0) ms = 0;
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    
    return `${hh}:${mm}`;
};

/**
 * (変更) 伝票の合計金額（割引前）を計算する (menu.jsでは不要だが共通ロジックとして残す)
 * @param {object} slip 伝票データ
 * @returns {number} 合計金額
 */
const calculateSlipTotal = (slip) => {
    if (!state) return 0; // (変更) state がロードされるまで待つ
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    // (★変更★) state.menu.items から商品情報を参照
    if (!state.menu || !state.menu.items) return 0;
    
    slip.items.forEach(slipItem => {
        // (★変更★) 伝票保存時の価格を使う (state.menu.items[N].price は変わる可能性があるため)
        subtotal += slipItem.price * slipItem.qty;
    });
    
    const serviceCharge = subtotal * state.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * state.rates.tax;
    const total = subtotalWithService + tax;
    return Math.round(total);
};


/**
 * ページを切り替える (menu.jsでは不要)
 */
// const switchPage = (targetPageId) => { ... };

/**
 * (新規) キャストIDからキャスト名を取得する (menu.jsでは不要だが共通ロジックとして残す)
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!state) return '不明'; // (変更) state がロードされるまで待つ
    if (!castId) return 'フリー';
    const cast = state.casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (menu.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    if (!state) return 0; // (変更) state がロードされるまで待つ
    return state.slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};


/**
 * (変更) 「伝票一覧」ページを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderAllSlipsPage = () => { ... };


/**
 * (変更) 伝票モーダル（注文入力）を描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderOrderModal = () => { ... };

/**
 * (新規) 顧客ドロップダウンを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderCustomerDropdown = (selectedCastId) => { ... };


/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する (menu.jsでは不要)
 */
// (★削除★)
// const updateSlipInfo = () => { ... };


/**
 * 注文リストにアイテムを追加する (menu.jsでは不要)
 */
// (★削除★)
// const addOrderItem = (id, name, price) => { ... };

/**
 * (新規) 注文リストからアイテムを削除する (menu.jsでは不要)
 */
// (★削除★)
// const removeOrderItem = (id) => { ... };

/**
 * (新規) 注文アイテムの数量を変更する (menu.jsでは不要)
 */
// (★削除★)
// const updateOrderItemQty = (id, qty) => { ... };

/**
 * (★変更★) メニュー管理タブを動的に描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer || !state || !state.menu) return; 
    
    menuTabsContainer.innerHTML = '';
    
    // (★変更★) state.menu.categories からタブを生成
    const categories = state.menu.categories || [];
    
    // (★新規★) アクティブなカテゴリIDをstateから取得
    let activeCategoryId = state.currentActiveMenuCategoryId;

    // (★新規★) アクティブなIDがstateにない、またはカテゴリリストに存在しない場合、最初のカテゴリをアクティブにする
    if (!activeCategoryId || !categories.some(c => c.id === activeCategoryId)) {
        activeCategoryId = categories.length > 0 ? categories[0].id : null;
        if (state) state.currentActiveMenuCategoryId = activeCategoryId; // stateを更新 (DB保存は不要)
    }

    if (categories.length === 0) {
        menuTabsContainer.innerHTML = '<div class="p-4 text-slate-500">カテゴリがありません。「カテゴリ管理」から追加してください。</div>';
    }

    categories.forEach(category => {
        const isActive = (category.id === activeCategoryId);
        const activeClass = isActive ? 'active' : '';
        
        // (★新規★) タブに編集ボタンを追加
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

    // (★新規★) 対応するメニューリストを描画
    renderMenuList();
};

/**
 * (★変更★) 指定されたカテゴリのメニューリストを描画する
 */
const renderMenuList = () => {
    if (!state || !state.menu) return;
    
    const activeCategoryId = state.currentActiveMenuCategoryId;
    const activeCategory = (state.menu.categories || []).find(c => c.id === activeCategoryId);
    
    if (!activeCategory) {
        // カテゴリが選択されていない（カテゴリが0件など）
        menuTableHeader.innerHTML = '';
        menuTableBody.innerHTML = `<tr><td class="p-3 text-slate-500 text-sm" colspan="3">カテゴリを選択してください。</td></tr>`;
        return;
    }

    // (★変更★) ヘッダーを動的に設定
    const isSetCategory = activeCategory.isSetCategory;
    menuTableHeader.innerHTML = `
        <th class="p-3">項目名</th>
        ${isSetCategory ? `<th class="p-3">時間</th>` : ''}
        <th class="p-3">料金 (税抜)</th>
        <th class="p-3 text-right">操作</th>
    `;
    const colSpan = isSetCategory ? 4 : 3;

    // (★変更★) アイテムを state.menu.items からフィルタリング
    const items = (state.menu.items || [])
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
    if (!state || !state.menu) return; 
    menuEditorForm.reset();
    menuEditorError.textContent = '';
    
    // (★変更★) カテゴリドロップダウンを動的に生成
    menuCategorySelect.innerHTML = '';
    (state.menu.categories || []).forEach(category => {
        menuCategorySelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });

    // (変更) state を丸ごと保存
    state.currentEditingMenuId = null;
    
    const toggleDurationField = (selectedCategoryId) => {
        const category = (state.menu.categories || []).find(c => c.id === selectedCategoryId);
        if (category && category.isSetCategory) {
            menuDurationGroup.classList.remove('hidden');
        } else {
            menuDurationGroup.classList.add('hidden');
            menuDurationInput.value = '';
        }
    };

    if (mode === 'new') {
        menuEditorModalTitle.textContent = '新規メニュー追加';
        // (★変更★) アクティブなカテゴリをデフォルト選択
        menuCategorySelect.value = state.currentActiveMenuCategoryId;
        toggleDurationField(state.currentActiveMenuCategoryId);

    } else if (mode === 'edit' && menuId) {
        menuEditorModalTitle.textContent = 'メニュー編集';
        
        // (★変更★) state.menu.items から探す
        const itemToEdit = (state.menu.items || []).find(item => item.id === menuId);

        if (itemToEdit) {
            state.currentEditingMenuId = menuId;
            menuCategorySelect.value = itemToEdit.categoryId;
            menuNameInput.value = itemToEdit.name;
            menuPriceInput.value = itemToEdit.price;
            toggleDurationField(itemToEdit.categoryId); // (★変更★) 
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
const saveMenuItem = () => {
    if (!state || !state.menu) return; 
    
    const categoryId = menuCategorySelect.value;
    const name = menuNameInput.value.trim();
    const price = parseInt(menuPriceInput.value);
    
    if (name === "" || isNaN(price) || price <= 0 || !categoryId) {
        menuEditorError.textContent = "カテゴリ、項目名、有効な料金を入力してください。";
        return;
    }
    
    // (★変更★) カテゴリの属性(isSetCategory)を確認
    const category = (state.menu.categories || []).find(c => c.id === categoryId);
    const duration = (category && category.isSetCategory) ? (parseInt(menuDurationInput.value) || null) : null;

    const newItemData = {
        id: state.currentEditingMenuId || getUUID(), 
        categoryId: categoryId, // (★変更★)
        name: name,
        price: price,
        duration: duration // (★変更★)
    };
    
    // (変更) state を直接変更
    if (state.currentEditingMenuId) {
        // --- 編集モード ---
        // (★変更★) state.menu.items を検索
        const index = (state.menu.items || []).findIndex(item => item.id === state.currentEditingMenuId);
        if (index !== -1) {
            state.menu.items[index] = newItemData;
        } else {
             console.error('Save error: Item to edit not found');
        }

    } else {
        // --- 新規作成モード ---
        if (!state.menu.items) {
            state.menu.items = [];
        }
        state.menu.items.push(newItemData);
    }

    menuEditorError.textContent = '';
    state.currentEditingMenuId = null;
    
    // (変更) state を丸ごと保存
    updateStateInFirestore(state);
    
    closeModal(menuEditorModal);
    // (変更) renderMenuTabs() は onSnapshot が自動で呼び出す
};

/**
 * (★変更★) メニューアイテムを削除する
 * @param {string} menuId 
 */
const deleteMenuItem = (menuId) => {
    if (!state || !menuId || !state.menu || !state.menu.items) { 
        return;
    }
    
    // (変更) state を直接変更
    state.menu.items = state.menu.items.filter(item => item.id !== menuId);
    
    // (変更) state を丸ごと保存
    updateStateInFirestore(state);
    
    // (変更) renderMenuTabs() は onSnapshot が自動で呼び出す
};

// ===================================
// (★新規★) カテゴリ管理ロジック
// ===================================

/**
 * (★新規★) カテゴリ管理モーダルを開く
 */
const openCategoryEditorModal = () => {
    if (!state || !state.menu) return;
    renderCategoryList();
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    openModal(categoryEditorModal);
};

/**
 * (★新規★) カテゴリ管理リストを描画する
 */
const renderCategoryList = () => {
    if (!currentCategoriesList || !state || !state.menu) return;
    
    currentCategoriesList.innerHTML = '';
    const categories = state.menu.categories || [];
    
    if (categories.length === 0) {
        currentCategoriesList.innerHTML = '<p class="text-sm text-slate-500">カテゴリがありません。</p>';
        return;
    }
    
    categories.forEach(category => {
        // (★新規★) 削除不可フラグ (キャスト料金/セット料金は 1 つは必須など)
        // (★簡易実装★) ここでは「キャスト料金」フラグを持つカテゴリは削除不可とする
        const isProtected = category.isCastCategory; 
        
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
                               ${isProtected ? 'disabled' : ''}>
                        <span>キャスト料金 (成績反映)</span>
                    </label>
                </div>
                <button type="button" 
                        class="delete-category-btn text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" 
                        data-category-id="${category.id}"
                        ${isProtected ? 'disabled' : ''}
                        title="${isProtected ? 'このカテゴリは削除できません' : 'カテゴリを削除'}">
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
const addCategory = () => {
    if (!state || !state.menu) return;
    
    const newName = newCategoryNameInput.value.trim();
    if (newName === "") {
        categoryAddError.textContent = "カテゴリ名を入力してください。";
        return;
    }
    
    const exists = (state.menu.categories || []).some(c => c.name === newName);
    if (exists) {
        categoryAddError.textContent = "そのカテゴリ名は既に使用されています。";
        return;
    }
    
    const newCategory = {
        id: getUUID(),
        name: newName,
        isSetCategory: false,
        isCastCategory: false // (★新規★)
    };
    
    if (!state.menu.categories) {
        state.menu.categories = [];
    }
    state.menu.categories.push(newCategory);
    
    updateStateInFirestore(state);
    
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    // (変更) onSnapshot が renderCategoryList() を呼び出す
};

/**
 * (★新規★) カテゴリ名を更新する
 * @param {string} categoryId 
 * @param {string} newName 
 */
const updateCategoryName = (categoryId, newName) => {
    if (!state || !state.menu) return;
    
    const category = (state.menu.categories || []).find(c => c.id === categoryId);
    if (category) {
        category.name = newName;
        updateStateInFirestore(state);
    }
};

/**
 * (★新規★) カテゴリのフラグ（isSetCategory, isCastCategory）を更新する
 * @param {string} categoryId 
 * @param {string} flagType 'isSetCategory' または 'isCastCategory'
 * @param {boolean} isChecked 
 */
const updateCategoryFlag = (categoryId, flagType, isChecked) => {
    if (!state || !state.menu) return;
    
    const category = (state.menu.categories || []).find(c => c.id === categoryId);
    if (category) {
        if (flagType === 'isSetCategory') {
            category.isSetCategory = isChecked;
        } else if (flagType === 'isCastCategory') {
            category.isCastCategory = isChecked;
        }
        updateStateInFirestore(state);
    }
};


/**
 * (★新規★) カテゴリを削除する
 * @param {string} categoryId 
 */
const deleteCategory = (categoryId) => {
    if (!state || !state.menu) return;
    
    // (★新規★) 削除対象カテゴリに商品が紐付いているか確認
    const itemsInCategory = (state.menu.items || []).filter(item => item.categoryId === categoryId);
    
    if (itemsInCategory.length > 0) {
        if (!confirm(`このカテゴリには ${itemsInCategory.length} 件の商品が登録されています。\nカテゴリを削除すると、これらの商品もすべて削除されます。\n本当に削除しますか？`)) {
            return;
        }
        // (★新規★) 紐付いた商品も削除
        state.menu.items = state.menu.items.filter(item => item.categoryId !== categoryId);
    }
    
    // (★新規★) カテゴリ自体を削除
    state.menu.categories = state.menu.categories.filter(c => c.id !== categoryId);
    
    // (★新規★) もしアクティブなカテゴリを削除したら、アクティブIDをリセット
    if (state.currentActiveMenuCategoryId === categoryId) {
        state.currentActiveMenuCategoryId = null;
    }
    
    updateStateInFirestore(state);
    // (変更) onSnapshot が renderCategoryList() と renderMenuTabs() を呼び出す
};


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!state) return;

    const store = state.storeInfo;
    const rates = state.rates;

    // 伝票プレビュー
    if (slipStoreName) slipStoreName.textContent = store.name;
    if (slipStoreTel) slipStoreTel.textContent = `TEL: ${store.tel}`;
    if (slipServiceRate) slipServiceRate.textContent = `サービス料 (${rates.service * 100}%)`;
    if (slipTaxRate) slipTaxRate.textContent = `消費税 (${rates.tax * 100}%)`;

    // 会計
    if (checkoutStoreName) checkoutStoreName.textContent = store.name;
    if (checkoutStoreTel) checkoutStoreTel.textContent = `TEL: ${store.tel}`;
    if (checkoutServiceRate) checkoutServiceRate.textContent = `サービス料 (${rates.service * 100}%)`;
    if (checkoutTaxRate) checkoutTaxRate.textContent = `消費税 (${rates.tax * 100}%)`;

    // 領収書
    if (receiptStoreName) receiptStoreName.textContent = store.name;
    if (receiptAddress) receiptAddress.innerHTML = `〒${store.zip || ''}<br>${store.address || ''}`;
    if (receiptTel) receiptTel.textContent = `TEL: ${store.tel}`;
};


/**
 * (変更) 伝票プレビューモーダルを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderSlipPreviewModal = () => { ... };


/**
 * 会計モーダルを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderCheckoutModal = () => { ... };

/**
 * (新規) 会計モーダルの支払い状況を計算・更新する (menu.jsでは不要)
 */
// (★削除★)
// const updatePaymentStatus = () => { ... };


/**
 * 領収書モーダルを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderReceiptModal = () => { ... };

/**
 * (新規) ボツ伝理由入力モーダルを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderCancelSlipModal = () => { ... };


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
 * (★新規★) 新しい伝票を作成し、伝票モーダルを開く (menu.jsでは不要)
 * (★変更★) startTimeISO を引数に追加
 */
const createNewSlip = (tableId, startTimeISO) => {
    if (!state) return; 
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;

    const newSlipCounter = (state.slipCounter || 0) + 1;
    const newSlipNumber = newSlipCounter;

    const newSlip = {
        slipId: getUUID(),
        slipNumber: newSlipNumber,
        tableId: tableId,
        status: 'active',
        name: "新規のお客様",
        startTime: startTimeISO, // (★変更★)
        nominationCastId: null, 
        items: [],
        tags: [],
        paidAmount: 0,
        cancelReason: null,
        paymentDetails: { cash: 0, card: 0, credit: 0 },
        paidTimestamp: null, 
        discount: { type: 'yen', value: 0 }, 
    };
    
    state.slips.push(newSlip);
    state.slipCounter = newSlipCounter;
    state.currentSlipId = newSlip.slipId;
    
    updateStateInFirestore(state);
    
    // (★追加★) 割引フォームをリセット (存在すれば)
    const discountAmountInput = document.getElementById('discount-amount');
    const discountTypeSelect = document.getElementById('discount-type');
    if (discountAmountInput) discountAmountInput.value = '';
    if (discountTypeSelect) discountTypeSelect.value = 'yen';

    // (★変更★) 伝票モーダルは menu.js には存在しないため、描画・表示ロジックは削除
    // renderOrderModal();
    // openModal(orderModal);
};

/**
 * (★新規★) 伝票選択モーダルを描画する (menu.jsでは不要)
 * (★変更★) 経過時間表示ロジック追加
 */
const renderSlipSelectionModal = (tableId) => {
    if (!state) return; 
    slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    slipSelectionList.innerHTML = '';

    const activeSlips = state.slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    );
    
    activeSlips.sort((a, b) => b.slipNumber - a.slipNumber);

    if (activeSlips.length === 0) {
        slipSelectionList.innerHTML = '<p class="text-slate-500 text-sm">現在アクティブな伝票はありません。</p>';
    } else {
        activeSlips.forEach(slip => {
            let statusColor, statusText;
            switch (slip.status) {
                case 'active':
                    statusColor = 'blue';
                    statusText = '利用中';
                    break;
                case 'checkout':
                    statusColor = 'orange';
                    statusText = '会計待ち';
                    break;
            }
            const nominationText = getCastNameById(slip.nominationCastId);

            // (★変更★) 経過時間表示用のロジックを追加
            const now = new Date();
            const startTime = new Date(slip.startTime);
            const diffMs = now.getTime() - startTime.getTime();
            const elapsedTimeStr = formatElapsedTime(diffMs);
            const startTimeStr = isNaN(startTime.getTime()) ? '??:??' : startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            slipSelectionList.innerHTML += `
                <button class="w-full text-left p-4 bg-slate-50 rounded-lg hover:bg-slate-100 border" data-slip-id="${slip.slipId}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-lg truncate">(No.${slip.slipNumber}) ${slip.name} (${nominationText})</span>
                        <span class="text-sm font-medium text-${statusColor}-600 bg-${statusColor}-100 px-2 py-1 rounded-full">${statusText}</span>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">
                        開始: ${startTimeStr}〜 
                        (<span class="font-semibold text-orange-600">${elapsedTimeStr}</span> 経過)
                    </p>
                </button>
            `;
        });
    }
    
    createNewSlipBtn.dataset.tableId = tableId;
    openModal(slipSelectionModal);
};

/**
 * (★新規★) 新規伝票の作成確認モーダルを描画・表示する
 * (★変更★) 時刻入力欄の制御を追加
 * @param {string} tableId 
 */
const renderNewSlipConfirmModal = (tableId) => {
    // (★変更★) HTMLファイル側でDOMを取得する必要がある
    const modalStartTimeInput = document.getElementById('new-slip-start-time-input');
    const modalTimeError = document.getElementById('new-slip-time-error');

    newSlipConfirmTitle.textContent = `伝票の新規作成 (${tableId})`;
    newSlipConfirmMessage.textContent = `テーブル ${tableId} で新しい伝票を作成しますか？`;

    // (★新規★) 現在時刻をセット
    if (modalStartTimeInput) {
        modalStartTimeInput.value = formatDateTimeLocal(new Date());
    }
    if (modalTimeError) {
        modalTimeError.textContent = '';
    }
    
    confirmCreateSlipBtn.dataset.tableId = tableId; 
    openModal(newSlipConfirmModal);
};


/**
 * (変更) テーブルカードクリック時の処理 (menu.jsでは不要)
 */
// (★削除★)
// const handleTableClick = (tableId) => { ... };

/**
 * (新規) 未会計伝票カードクリック時の処理 (menu.jsでは不要)
 */
// (★削除★)
// const handleSlipClick = (slipId) => { ... };

/**
 * (新規) 会計済み伝票カードクリック時の処理 (menu.jsでは不要)
 */
// (★削除★)
// const handlePaidSlipClick = (slipId) => { ... };


/**
 * (新規) キャストランキングを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderCastRanking = () => { ... };

// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultState = () => {
    // (★変更★) 新しいデータ構造
    const catSetId = getUUID();
    const catDrinkId = getUUID();
    const catBottleId = getUUID();
    const catFoodId = getUUID();
    const catCastId = getUUID(); // (★重要★) キャスト料金
    const catOtherId = getUUID();

    return {
        currentPage: 'menu', // (★修正★)
        currentStore: 'store1',
        slipCounter: 0,
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
            { id: 'tag3', name: '初回' }, { id: 'tag4', name: '枝' },
            { id: 'tag5', name: '切替' }, { id: 'tag6', name: '案内所' },
            { id: 'tag7', name: '20歳未満' }, { id: 'tag8', name: '同業' },
        ],
        casts: [ 
            { id: 'c1', name: 'あい' }, { id: 'c2', name: 'みう' },
            { id: 'c3', name: 'さくら' }, { id: 'c4', name: 'れな' },
            { id: 'c5', name: 'ひな' }, { id: 'c6', name: '体験A' },
        ],
        customers: [
            { id: 'cust1', name: '鈴木様', nominatedCastId: 'c1' },
            { id: 'cust2', name: '田中様', nominatedCastId: null },
            { id: 'cust3', name: '佐藤様', nominatedCastId: 'c2' },
        ],
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
            { id: 'T1', status: 'available' }, { id: 'T2', status: 'available' },
            { id: 'C1', status: 'available' }, { id: 'C2', status: 'available' },
        ],
        slips: [],
        menu: {
            // (★変更★) カテゴリを定義
            categories: [
                { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false },
                { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false },
                { id: catBottleId, name: 'ボトル', isSetCategory: false, isCastCategory: false },
                { id: catFoodId, name: 'フード', isSetCategory: false, isCastCategory: false },
                { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true }, // (★重要★)
                { id: catOtherId, name: 'その他', isSetCategory: false, isCastCategory: false },
            ],
            // (★変更★) アイテムを定義 (categoryId で紐付け)
            items: [
                { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60 },
                { id: 'm2', categoryId: catSetId, name: '基本セット (フリー)', price: 8000, duration: 60 },
                { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
                { id: 'm11', categoryId: catBottleId, name: '鏡月 (ボトル)', price: 8000, duration: null },
                { id: 'm14', categoryId: catCastId, name: '本指名料', price: 3000, duration: null },
            ]
        },
        currentActiveMenuCategoryId: catSetId, // (★新規★)
        storeInfo: {
            name: "Night POS",
            address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000"
        },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
        performanceSettings: {
            // (★変更★) 'm14' (本指名料) のIDは getDefaultState 内で固定
            menuItems: {
                'm14': { salesType: 'percentage', salesValue: 100, countNomination: true }
            },
            serviceCharge: { salesType: 'percentage', salesValue: 0 },
            tax: { salesType: 'percentage', salesValue: 0 },
            sideCustomer: { salesValue: 100, countNomination: true }
        },
        currentSlipId: null, 
        currentEditingMenuId: null,
        currentBillingAmount: 0, 
        ranking: { period: 'monthly', type: 'nominations' }
    };
};

// (新規) Firestore への state 保存関数（エラーハンドリング付き）
const updateStateInFirestore = async (newState) => {
    if (!stateDocRef) {
        console.error("stateDocRef is not ready. State not saved to Firestore.");
        return;
    }
    try {
        await setDoc(stateDocRef, newState); 
    } catch (error) {
        console.error("Error saving state to Firestore:", error);
    }
};

// (変更) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    const { db, auth, userId, stateRef: ref } = e.detail;
    
    if (!ref) {
        console.error("Firestore reference (stateRef) is not available.");
        return;
    }
    
    stateDocRef = ref;

    onSnapshot(stateDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            console.log("Firestore data loaded.");
            state = docSnap.data();
            
            // (★新規★) 古いデータ構造 (menu.set) だった場合、新しい構造に移行する (簡易)
            if (state.menu && state.menu.set) {
                console.warn("Old menu structure detected. Migrating...");
                const defaultMenu = getDefaultState().menu;
                state.menu = defaultMenu;
                state.currentActiveMenuCategoryId = defaultMenu.categories[0].id;
                // (注意) 実際は旧データを移行すべきだが、ここではデフォルトで上書き
                await updateStateInFirestore(state); // 移行を保存
            }
            
            // (重要) state がロードされたら、UIを初回描画
            renderMenuTabs();
            updateModalCommonInfo(); // (新規) モーダル内の共通情報を更新
            
        } else {
            console.log("No state document found. Creating default state...");
            const defaultState = getDefaultState();
            state = defaultState;
            
            try {
                await setDoc(stateDocRef, defaultState);
                console.log("Default state saved to Firestore.");
                // (重要) state がロードされたら、UIを初回描画
                renderMenuTabs();
                updateModalCommonInfo(); // (新規) モーダル内の共通情報を更新
                
            } catch (error) {
                console.error("Error saving default state to Firestore:", error);
            }
        }
    }, (error) => {
        console.error("Error listening to Firestore snapshot:", error);
        if (error.code === 'permission-denied') {
            document.body.innerHTML = `<div class="p-8 text-center text-red-600">データベースへのアクセスが拒否されました。Firestoreのセキュリティルール（state/{userId}）が正しく設定されているか確認してください。</div>`;
        }
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    // (★修正★) menu.html に存在するDOMのみ取得
    navLinks = document.querySelectorAll('.nav-link');
    pageTitle = document.getElementById('page-title');
    orderModal = document.getElementById('order-modal');
    checkoutModal = document.getElementById('checkout-modal');
    receiptModal = document.getElementById('receipt-modal');
    slipPreviewModal = document.getElementById('slip-preview-modal');
    menuTabsContainer = document.getElementById('menu-tabs-container'); 
    // (★変更★)
    menuContentContainer = document.getElementById('menu-content-container');
    menuTableHeader = document.getElementById('menu-table-header');
    menuTableBody = document.getElementById('menu-table-body');
    
    menuPage = document.getElementById('menu'); 
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    openSlipPreviewBtn = document.getElementById('open-slip-preview-btn');
    processPaymentBtn = document.getElementById('process-payment-btn');
    printSlipBtn = document.getElementById('print-slip-btn');
    goToCheckoutBtn = document.getElementById('go-to-checkout-btn');
    reopenSlipBtn = document.getElementById('reopen-slip-btn');
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
    
    // (★削除★)
    
    cancelSlipModal = document.getElementById('cancel-slip-modal');
    openCancelSlipModalBtn = document.getElementById('open-cancel-slip-modal-btn');
    cancelSlipModalTitle = document.getElementById('cancel-slip-modal-title');
    cancelSlipNumber = document.getElementById('cancel-slip-number');
    cancelSlipReasonInput = document.getElementById('cancel-slip-reason-input');
    cancelSlipError = document.getElementById('cancel-slip-error');
    confirmCancelSlipBtn = document.getElementById('confirm-cancel-slip-btn');
    slipSelectionModal = document.getElementById('slip-selection-modal');
    slipSelectionModalTitle = document.getElementById('slip-selection-modal-title');
    slipSelectionList = document.getElementById('slip-selection-list');
    createNewSlipBtn = document.getElementById('create-new-slip-btn');
    newSlipConfirmModal = document.getElementById('new-slip-confirm-modal');
    newSlipConfirmTitle = document.getElementById('new-slip-confirm-title');
    newSlipConfirmMessage = document.getElementById('new-slip-confirm-message');
    confirmCreateSlipBtn = document.getElementById('confirm-create-slip-btn');
    
    // (★新規★) 伝票作成時間
    newSlipStartTimeInput = document.getElementById('new-slip-start-time-input');
    newSlipTimeError = document.getElementById('new-slip-time-error');
    
    orderModalTitle = document.getElementById('order-modal-title');
    orderItemsList = document.getElementById('order-items-list');
    menuOrderGrid = document.getElementById('menu-order-grid');
    orderSubtotalEl = document.getElementById('order-subtotal');
    orderCustomerNameSelect = document.getElementById('order-customer-name-select');
    orderNominationSelect = document.getElementById('order-nomination-select');
    newCustomerInputGroup = document.getElementById('new-customer-input-group');
    newCustomerNameInput = document.getElementById('new-customer-name-input');
    saveNewCustomerBtn = document.getElementById('save-new-customer-btn');
    newCustomerError = document.getElementById('new-customer-error');
    checkoutModalTitle = document.getElementById('checkout-modal-title');
    checkoutItemsList = document.getElementById('checkout-items-list');
    checkoutSubtotalEl = document.getElementById('checkout-subtotal');
    checkoutServiceChargeEl = document.getElementById('checkout-service-charge');
    checkoutTaxEl = document.getElementById('checkout-tax');
    checkoutPaidAmountEl = document.getElementById('checkout-paid-amount');
    checkoutTotalEl = document.getElementById('checkout-total');
    paymentCashInput = document.getElementById('payment-cash');
    paymentCardInput = document.getElementById('payment-card');
    paymentCreditInput = document.getElementById('payment-credit');
    checkoutPaymentTotalEl = document.getElementById('checkout-payment-total');
    checkoutShortageEl = document.getElementById('checkout-shortage');
    checkoutChangeEl = document.getElementById('checkout-change');
    slipSubtotalEl = document.getElementById('slip-subtotal');
    slipServiceChargeEl = document.getElementById('slip-service-charge');
    slipTaxEl = document.getElementById('slip-tax');
    slipPaidAmountEl = document.getElementById('slip-paid-amount');
    slipTotalEl = document.getElementById('slip-total');

    // (新規) モーダル共通情報のDOM
    slipStoreName = document.getElementById('slip-store-name');
    slipStoreTel = document.getElementById('slip-store-tel');
    slipServiceRate = document.getElementById('slip-service-rate');
    slipTaxRate = document.getElementById('slip-tax-rate');
    checkoutStoreName = document.getElementById('checkout-store-name');
    checkoutStoreTel = document.getElementById('checkout-store-tel');
    checkoutServiceRate = document.getElementById('checkout-service-rate');
    checkoutTaxRate = document.getElementById('checkout-tax-rate');
    receiptStoreName = document.getElementById('receipt-store-name');
    receiptAddress = document.getElementById('receipt-address');
    receiptTel = document.getElementById('receipt-tel');
    
    // (★新規★) カテゴリ管理モーダル
    categoryEditorModal = document.getElementById('category-editor-modal');
    openCategoryModalBtn = document.getElementById('open-category-modal-btn');
    currentCategoriesList = document.getElementById('current-categories-list');
    newCategoryNameInput = document.getElementById('new-category-name-input');
    addCategoryBtn = document.getElementById('add-category-btn');
    categoryAddError = document.getElementById('category-add-error');

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    // renderMenuTabs(); 
    
    // ===== イベントリスナーの設定 =====
    
    // (★変更★) タブのイベント委任
    if (menuTabsContainer) { 
        menuTabsContainer.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.menu-tab');
            const editButton = e.target.closest('.menu-tab-edit-btn');
            
            if (editButton) {
                // 編集ボタンが押された
                e.stopPropagation(); // タブ切り替えを防ぐ
                openCategoryEditorModal();
                return;
            }
            
            if (tabButton) {
                // タブ本体が押された
                e.preventDefault();
                const categoryId = tabButton.dataset.categoryId;
                if (state) state.currentActiveMenuCategoryId = categoryId;
                
                // (★変更★) onSnapshot が renderMenuTabs を呼ぶので、DB保存は不要
                // (★変更★) 即時反映のため、ローカルで描画
                renderMenuTabs(); 
            }
        });
    }

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // (★変更★) カテゴリモーダルも閉じる
            closeModal(categoryEditorModal);
            closeModal(menuEditorModal);
            // (変更) 他のモーダルもHTMLには存在するため、閉じるロジックは残す
            closeModal(orderModal);
            closeModal(checkoutModal);
            closeModal(receiptModal);
            closeModal(slipPreviewModal);
            closeModal(slipSelectionModal);
            closeModal(newSlipConfirmModal);
            closeModal(cancelSlipModal);
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

    // (★新規★) カテゴリリストのイベント委任 (編集・削除)
    if (currentCategoriesList) {
        // 削除
        currentCategoriesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-category-btn');
            if (deleteBtn && !deleteBtn.disabled) {
                const categoryId = deleteBtn.dataset.categoryId;
                const category = (state.menu.categories || []).find(c => c.id === categoryId);
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
                const category = (state.menu.categories || []).find(c => c.id === categoryId);
                
                if (newName === "") {
                    // (変更) onSnapshot が再描画するので、入力値を戻す必要はない
                    // e.target.value = category.name; 
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
            else if (e.target.classList.contains('category-cast-toggle')) {
                updateCategoryFlag(categoryId, 'isCastCategory', e.target.checked);
            }
        });
    }


    // (★変更★) 新規メニュー追加ボタン
    if (openNewMenuModalBtn) {
        openNewMenuModalBtn.addEventListener('click', () => {
            // (★変更★) 引数なしで呼び出し (アクティブカテゴリは 'openMenuEditorModal' が内部で参照)
            openMenuEditorModal('new');
        });
    }

    // (★変更★) メニュー編集モーダル > カテゴリ変更
    if (menuCategorySelect) {
        menuCategorySelect.addEventListener('change', (e) => {
            // (★変更★) 選択されたカテゴリIDの 'isSetCategory' を見て判断
            const selectedCategoryId = e.target.value;
            const category = (state.menu.categories || []).find(c => c.id === selectedCategoryId);
            
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
            saveMenuItem();
        });
    }

    // (★変更★) メニューリストのイベント委任 (tbody)
    if (menuTableBody) {
        menuTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-menu-btn');
            if (editBtn) {
                const menuId = editBtn.dataset.menuId;
                // (★変更★) カテゴリIDは不要
                openMenuEditorModal('edit', menuId);
                return;
            }

            const deleteBtn = e.target.closest('.delete-menu-btn');
            if (deleteBtn) {
                const menuId = deleteBtn.dataset.menuId;
                
                if (confirm(`「${deleteBtn.closest('tr').querySelector('td').textContent}」を削除しますか？\nこの操作は取り消せません。`)) {
                    // (★変更★) カテゴリIDは不要
                    deleteMenuItem(menuId);
                }
                return;
            }
        });
    }
    
    // (★削除★) menu.html には伝票関連のボタンは存在しないため、関連リスナーを削除
    // (★変更★) ただし、モーダル自体はHTMLに存在するため、モーダルを開くロジックだけ残す
    
    // (★新規★) 伝票選択モーダルのイベント委任
    if (slipSelectionList) {
        slipSelectionList.addEventListener('click', (e) => {
            const slipBtn = e.target.closest('button[data-slip-id]');
            if (slipBtn) {
                // handleSlipClick(slipBtn.dataset.slipId); // (★変更★) menu.js には handleSlipClick がない
                console.warn('handleSlipClick is not implemented in menu.js');
                closeModal(slipSelectionModal);
            }
        });
    }

    // (新規) 伝票選択モーダル -> 新規伝票作成
    if (createNewSlipBtn) {
        createNewSlipBtn.addEventListener('click', () => {
            const tableId = createNewSlipBtn.dataset.tableId;
            if (tableId) {
                renderNewSlipConfirmModal(tableId); // (★変更★)
                closeModal(slipSelectionModal);
            }
        });
    }
    
    // (★変更★) 新規伝票確認モーダル -> OK
    if (confirmCreateSlipBtn) {
        confirmCreateSlipBtn.addEventListener('click', () => {
            const tableId = confirmCreateSlipBtn.dataset.tableId;

            // (★変更★) 時間を取得して検証
            const startTimeValue = newSlipStartTimeInput ? newSlipStartTimeInput.value : '';
            if (!startTimeValue) {
                if (newSlipTimeError) newSlipTimeError.textContent = '開始時刻を入力してください。';
                return;
            }
            if (newSlipTimeError) newSlipTimeError.textContent = '';
            
            // (★変更★) ISO文字列に変換して渡す
            const startTimeISO = new Date(startTimeValue).toISOString();
            
            if (tableId) {
                createNewSlip(tableId, startTimeISO); // (★変更★)
                closeModal(newSlipConfirmModal);
            }
        });
    }
});