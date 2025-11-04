// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, // (★新規★)
    deleteDoc, // (★新規★)
    doc,
    collection // (★新規★)
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
let slipCounter = 0;

// (★変更★) 現在選択中の伝票ID (ローカル管理)
let currentSlipId = null;
let currentBillingAmount = 0;
let currentEditingMenuId = null; // (★変更★) ローカル管理

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
    if (!settings) return 0; // (★変更★)
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    
    slip.items.forEach(slipItem => {
        subtotal += slipItem.price * slipItem.qty;
    });
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
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
    if (!casts) return '不明'; // (★変更★)
    if (!castId) return 'フリー';
    const cast = casts.find(c => c.id === castId); // (★変更★)
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (menu.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    if (!slips) return 0; // (★変更★)
    return slips.filter( // (★変更★)
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};


/**
 * (変更) 「伝票一覧」ページを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderAllSlipsPage = () => { ... };


/**
 * (変更) 伝票モーダル（注文入力）を描画する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const renderOrderModal = () => {
    if (!settings || !menu) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    orderNominationSelect.innerHTML = '<option value="null">フリー</option>';
    casts.forEach(cast => { // (★変更★)
        orderNominationSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
    });
    orderNominationSelect.value = slipData.nominationCastId || 'null';

    renderCustomerDropdown(slipData.nominationCastId);
    
    const customerExists = customers.find(c => c.name === slipData.name); // (★変更★)
    if (customerExists) {
        orderCustomerNameSelect.value = slipData.name;
        newCustomerInputGroup.classList.add('hidden');
    } else {
        orderCustomerNameSelect.value = 'new_customer';
        newCustomerInputGroup.classList.remove('hidden');
        newCustomerNameInput.value = (slipData.name === "新規のお客様") ? "" : slipData.name;
    }
    newCustomerError.textContent = '';

    // (新規) 伝票タグを描画
    renderSlipTags(slipData);
    
    orderItemsList.innerHTML = '';
    let subtotal = 0;
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
        orderItemsList.innerHTML += `
            <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border">
                <div>
                    <p class="font-semibold">${item.name}</p>
                    <p class="text-sm text-slate-500">${formatCurrency(item.price)}</p>
                </div>
                <div class="flex items-center space-x-3">
                    <input type="number" value="${item.qty}" class="w-16 p-1 border rounded text-center order-item-qty-input" data-item-id="${item.id}">
                    <span class="font-semibold w-20 text-right">${formatCurrency(item.price * item.qty)}</span>
                    <button class="remove-order-item-btn text-red-500 hover:text-red-700" data-item-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    orderSubtotalEl.textContent = formatCurrency(subtotal);

    menuOrderGrid.innerHTML = ''; 
    
    const allMenuItems = (menu.items || []).sort((a,b) => a.name.localeCompare(b.name)); // (★変更★)
    
    if (allMenuItems.length === 0) {
        menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">メニューが登録されていません。<br>「メニュー管理」ページから追加してください。</p>';
    } else {
        allMenuItems.forEach(item => {
            menuOrderGrid.innerHTML += `
                <button class="menu-order-btn p-3 bg-white rounded-lg shadow border text-left hover:bg-slate-100" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}">
                    <p class="font-semibold text-sm">${item.name}</p>
                    <p class="text-xs text-slate-500">${formatCurrency(item.price)}</p>
                </button>
            `;
        });
    }
};

/**
 * (新規) 伝票タグを描画する
 * @param {object} slipData 
 */
const renderSlipTags = (slipData) => {
    const container = document.getElementById('order-tags-container');
    if (!container || !settings) return; // (★変更★)
    container.innerHTML = '';
    
    settings.slipTagsMaster.forEach(tag => { // (★変更★)
        const isSelected = slipData.tags.includes(tag.name);
        const tagClass = isSelected 
            ? 'bg-blue-600 text-white' 
            : 'bg-slate-200 text-slate-700 hover:bg-slate-300';
        
        container.innerHTML += `
            <button class="slip-tag-btn px-3 py-1.5 rounded-full text-sm font-medium ${tagClass}" data-tag-name="${tag.name}">
                ${tag.name}
            </button>
        `;
    });
};

/**
 * (新規) 伝票にタグを追加/削除する
 * @param {string} tagName 
 */
const toggleSlipTag = async (tagName) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    const tagIndex = slipData.tags.indexOf(tagName);
    if (tagIndex > -1) {
        slipData.tags.splice(tagIndex, 1);
    } else {
        slipData.tags.push(tagName);
    }
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { tags: slipData.tags }, { merge: true });
    } catch (e) {
        console.error("Error updating slip tags: ", e);
    }
    
    renderSlipTags(slipData);
};


/**
 * (新規) 顧客ドロップダウンを描画する (menu.jsでは不要だがモーダルが存在するため残す)
 * @param {string | null} selectedCastId 選択中のキャストID ('null' 文字列または実際のID)
 */
const renderCustomerDropdown = (selectedCastId) => {
    if (!customers) return; // (★変更★)
    const targetCastId = selectedCastId === 'null' ? null : selectedCastId;

    const filteredCustomers = customers.filter( // (★変更★)
        customer => customer.nominatedCastId === targetCastId
    );

    orderCustomerNameSelect.innerHTML = '';
    filteredCustomers.forEach(customer => {
        orderCustomerNameSelect.innerHTML += `<option value="${customer.name}">${customer.name}</option>`;
    });
    
    if (filteredCustomers.length === 0) {
        orderCustomerNameSelect.innerHTML += `<option value="" disabled>該当する顧客がいません</option>`;
    }

    orderCustomerNameSelect.innerHTML += `<option value="new_customer" class="text-blue-600 font-bold">--- 新規顧客を追加 ---</option>`;
};


/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const updateSlipInfo = async () => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const customerName = orderCustomerNameSelect.value;
    const nominationCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value; 

    let newName = slipData.name;
    if (customerName !== 'new_customer' && customerName !== "") { 
        newName = customerName;
    }
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${newName})`;

    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { 
            name: newName,
            nominationCastId: nominationCastId
        }, { merge: true });
    } catch (e) {
        console.error("Error updating slip info: ", e);
    }
};


/**
 * 注文リストにアイテムを追加する (menu.jsでは不要だがモーダルが存在するため残す)
 * @param {string} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = async (id, name, price) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
    } catch (e) {
        console.error("Error adding order item: ", e);
    }
    
    renderOrderModal();
};

/**
 * (新規) 注文リストからアイテムを削除する (menu.jsでは不要だがモーダルが存在するため残す)
 * @param {string} id 商品ID
 */
const removeOrderItem = async (id) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    slipData.items = slipData.items.filter(item => item.id !== id);
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
    } catch (e) {
        console.error("Error removing order item: ", e);
    }
    renderOrderModal();
};

/**
 * (新規) 注文アイテムの数量を変更する (menu.jsでは不要だがモーダルが存在するため残す)
 * @param {string} id 商品ID
 * @param {number} qty 数量
 */
const updateOrderItemQty = async (id, qty) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const item = slipData.items.find(item => item.id === id);
    if (item) {
        item.qty = qty;
    }
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
    } catch (e) {
        console.error("Error updating order item qty: ", e);
    }
    renderOrderModal();
};

/**
 * (★変更★) メニュー管理タブを動的に描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer || !menu) return; // (★変更★)
    
    menuTabsContainer.innerHTML = '';
    
    const categories = menu.categories || []; // (★変更★)
    
    // (★変更★)
    let activeCategoryId = menu.currentActiveMenuCategoryId;

    // (★新規★) アクティブなIDがstateにない、またはカテゴリリストに存在しない場合、最初のカテゴリをアクティブにする
    if (!activeCategoryId || !categories.some(c => c.id === activeCategoryId)) {
        activeCategoryId = categories.length > 0 ? categories[0].id : null;
        if (menu) menu.currentActiveMenuCategoryId = activeCategoryId; // (★変更★)
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
    if (!menu) return; // (★変更★)
    
    const activeCategoryId = menu.currentActiveMenuCategoryId; // (★変更★)
    const activeCategory = (menu.categories || []).find(c => c.id === activeCategoryId); // (★変更★)
    
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

    // (★変更★)
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
    if (!menu) return; // (★変更★)
    menuEditorForm.reset();
    menuEditorError.textContent = '';
    
    menuCategorySelect.innerHTML = '';
    (menu.categories || []).forEach(category => { // (★変更★)
        menuCategorySelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });

    currentEditingMenuId = null; // (★変更★)
    
    const toggleDurationField = (selectedCategoryId) => {
        const category = (menu.categories || []).find(c => c.id === selectedCategoryId); // (★変更★)
        if (category && category.isSetCategory) {
            menuDurationGroup.classList.remove('hidden');
        } else {
            menuDurationGroup.classList.add('hidden');
            menuDurationInput.value = '';
        }
    };

    if (mode === 'new') {
        menuEditorModalTitle.textContent = '新規メニュー追加';
        menuCategorySelect.value = menu.currentActiveMenuCategoryId; // (★変更★)
        toggleDurationField(menu.currentActiveMenuCategoryId); // (★変更★)

    } else if (mode === 'edit' && menuId) {
        menuEditorModalTitle.textContent = 'メニュー編集';
        
        const itemToEdit = (menu.items || []).find(item => item.id === menuId); // (★変更★)

        if (itemToEdit) {
            currentEditingMenuId = menuId; // (★変更★)
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
    if (!menu) return; // (★変更★)
    
    const categoryId = menuCategorySelect.value;
    const name = menuNameInput.value.trim();
    const price = parseInt(menuPriceInput.value);
    
    if (name === "" || isNaN(price) || price <= 0 || !categoryId) {
        menuEditorError.textContent = "カテゴリ、項目名、有効な料金を入力してください。";
        return;
    }
    
    const category = (menu.categories || []).find(c => c.id === categoryId); // (★変更★)
    const duration = (category && category.isSetCategory) ? (parseInt(menuDurationInput.value) || null) : null;

    const newItemData = {
        id: currentEditingMenuId || getUUID(), // (★変更★)
        categoryId: categoryId, 
        name: name,
        price: price,
        duration: duration 
    };
    
    // (★変更★) ローカルの menu オブジェクトを直接変更
    if (currentEditingMenuId) {
        // --- 編集モード ---
        const index = (menu.items || []).findIndex(item => item.id === currentEditingMenuId);
        if (index !== -1) {
            menu.items[index] = newItemData;
        } else {
             console.error('Save error: Item to edit not found');
        }

    } else {
        // --- 新規作成モード ---
        if (!menu.items) {
            menu.items = [];
        }
        menu.items.push(newItemData);
    }

    menuEditorError.textContent = '';
    currentEditingMenuId = null; // (★変更★)
    
    // (★変更★) menuRef に保存
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error saving menu item: ", e);
        menuEditorError.textContent = "メニューの保存に失敗しました。";
        return;
    }
    
    closeModal(menuEditorModal);
    // (変更) renderMenuTabs() は onSnapshot が自動で呼び出す
};

/**
 * (★変更★) メニューアイテムを削除する
 * @param {string} menuId 
 */
const deleteMenuItem = async (menuId) => {
    if (!menu || !menuId || !menu.items) { // (★変更★)
        return;
    }
    
    menu.items = menu.items.filter(item => item.id !== menuId); // (★変更★)
    
    // (★変更★) menuRef に保存
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error deleting menu item: ", e);
    }
    
    // (変更) renderMenuTabs() は onSnapshot が自動で呼び出す
};

// ===================================
// (★新規★) カテゴリ管理ロジック
// ===================================

/**
 * (★新規★) カテゴリ管理モーダルを開く
 */
const openCategoryEditorModal = () => {
    if (!menu) return; // (★変更★)
    renderCategoryList();
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    openModal(categoryEditorModal);
};

/**
 * (★新規★) カテゴリ管理リストを描画する
 */
const renderCategoryList = () => {
    if (!currentCategoriesList || !menu) return; // (★変更★)
    
    currentCategoriesList.innerHTML = '';
    const categories = menu.categories || []; // (★変更★)
    
    if (categories.length === 0) {
        currentCategoriesList.innerHTML = '<p class="text-sm text-slate-500">カテゴリがありません。</p>';
        return;
    }
    
    categories.forEach(category => {
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
const addCategory = async () => {
    if (!menu) return; // (★変更★)
    
    const newName = newCategoryNameInput.value.trim();
    if (newName === "") {
        categoryAddError.textContent = "カテゴリ名を入力してください。";
        return;
    }
    
    const exists = (menu.categories || []).some(c => c.name === newName); // (★変更★)
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
    
    if (!menu.categories) { // (★変更★)
        menu.categories = [];
    }
    menu.categories.push(newCategory); // (★変更★)
    
    // (★変更★)
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
         console.error("Error adding category: ", e);
         categoryAddError.textContent = "カテゴリの追加に失敗しました。";
         menu.categories.pop(); // (★変更★) 失敗したらローカルからも削除
         return;
    }
    
    newCategoryNameInput.value = '';
    categoryAddError.textContent = '';
    // (変更) onSnapshot が renderCategoryList() を呼び出す
};

/**
 * (★新規★) カテゴリ名を更新する
 * @param {string} categoryId 
 * @param {string} newName 
 */
const updateCategoryName = async (categoryId, newName) => {
    if (!menu) return; // (★変更★)
    
    const category = (menu.categories || []).find(c => c.id === categoryId); // (★変更★)
    if (category) {
        category.name = newName;
        // (★変更★)
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
    if (!menu) return; // (★変更★)
    
    const category = (menu.categories || []).find(c => c.id === categoryId); // (★変更★)
    if (category) {
        if (flagType === 'isSetCategory') {
            category.isSetCategory = isChecked;
        } else if (flagType === 'isCastCategory') {
            category.isCastCategory = isChecked;
        }
        
        // (★変更★)
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
    if (!menu) return; // (★変更★)
    
    // (★新規★) 削除対象カテゴリに商品が紐付いているか確認
    const itemsInCategory = (menu.items || []).filter(item => item.categoryId === categoryId); // (★変更★)
    
    if (itemsInCategory.length > 0) {
        if (!confirm(`このカテゴリには ${itemsInCategory.length} 件の商品が登録されています。\nカテゴリを削除すると、これらの商品もすべて削除されます。\n本当に削除しますか？`)) {
            return;
        }
        menu.items = menu.items.filter(item => item.categoryId !== categoryId); // (★変更★)
    }
    
    menu.categories = menu.categories.filter(c => c.id !== categoryId); // (★変更★)
    
    if (menu.currentActiveMenuCategoryId === categoryId) { // (★変更★)
        menu.currentActiveMenuCategoryId = null;
    }
    
    // (★変更★)
    try {
        await setDoc(menuRef, menu);
    } catch (e) {
        console.error("Error deleting category: ", e);
    }
    // (変更) onSnapshot が renderCategoryList() と renderMenuTabs() を呼び出す
};


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; // (★変更★)

    const store = settings.storeInfo; // (★変更★)
    const rates = settings.rates; // (★変更★)

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
 * (変更) 伝票プレビューモーダルを描画する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const renderSlipPreviewModal = async () => {
    if (!settings) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { status: 'checkout' }, { merge: true });
        slipData.status = 'checkout'; // (★変更★)
    } catch (e) {
        console.error("Error updating slip status: ", e);
    }

    document.getElementById('slip-preview-title').textContent = `伝票プレビュー (No.${slipData.slipNumber})`;
    
    const now = new Date();
    document.getElementById('slip-datetime').textContent = now.toLocaleString('ja-JP');

    document.getElementById('slip-slip-number').textContent = slipData.slipNumber;
    document.getElementById('slip-table-id').textContent = slipData.tableId;
    document.getElementById('slip-customer-name').textContent = slipData.name || 'ゲスト';
    document.getElementById('slip-nomination').textContent = getCastNameById(slipData.nominationCastId);

    const slipItemsList = document.getElementById('slip-items-list');
    slipItemsList.innerHTML = '';
    let subtotal = 0;
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
        slipItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(item.price * item.qty)}</span>
            </div>
        `;
    });
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount;

    slipSubtotalEl.textContent = formatCurrency(subtotal);
    slipServiceChargeEl.textContent = formatCurrency(Math.round(serviceCharge));
    slipTaxEl.textContent = formatCurrency(Math.round(tax));
    slipPaidAmountEl.parentElement.style.display = paidAmount > 0 ? 'flex' : 'none';
    slipPaidAmountEl.textContent = `-${formatCurrency(paidAmount)}`;
    slipTotalEl.textContent = formatCurrency(billingAmount);
};


/**
 * 会計モーダルを描画する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const renderCheckoutModal = () => {
    if (!settings) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    checkoutModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name}) - お会計`;
    
    let subtotal = 0;
    checkoutItemsList.innerHTML = '';
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
        checkoutItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(item.price * item.qty)}</span>
            </div>
        `;
    });
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const preDiscountTotal = total - paidAmount; 

    // (★追加★) 割引計算
    const discountAmount = parseInt(discountAmountInput.value) || 0;
    const discountType = discountTypeSelect.value;
    
    let finalBillingAmount = preDiscountTotal;
    if (discountType === 'yen') {
        finalBillingAmount = preDiscountTotal - discountAmount;
    } else if (discountType === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discountAmount / 100));
    }
    finalBillingAmount = Math.round(finalBillingAmount); // 最終金額を丸める

    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    currentBillingAmount = finalBillingAmount; // (★変更★)

    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(Math.round(serviceCharge));
    checkoutTaxEl.textContent = formatCurrency(Math.round(tax));
    checkoutPaidAmountEl.parentElement.style.display = paidAmount > 0 ? 'flex' : 'none';
    checkoutPaidAmountEl.textContent = `-${formatCurrency(paidAmount)}`;
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount); 
    
    paymentCashInput.value = '';
    paymentCardInput.value = '';
    paymentCreditInput.value = '';

    updatePaymentStatus(); 

    document.getElementById('receipt-total').textContent = formatCurrency(finalBillingAmount);
};

/**
 * (新規) 会計モーダルの支払い状況を計算・更新する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const updatePaymentStatus = () => {
    if (!settings) return; // (★変更★)

    // (★追加★) 割引を先に再計算
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    let subtotal = 0;
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const preDiscountTotal = total - paidAmount; 

    const discountAmount = parseInt(discountAmountInput.value) || 0;
    const discountType = discountTypeSelect.value;
    
    let finalBillingAmount = preDiscountTotal;
    if (discountType === 'yen') {
        finalBillingAmount = preDiscountTotal - discountAmount;
    } else if (discountType === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discountAmount / 100));
    }
    finalBillingAmount = Math.round(finalBillingAmount);

    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    currentBillingAmount = finalBillingAmount; // (★変更★)
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount);
    document.getElementById('receipt-total').textContent = formatCurrency(finalBillingAmount);
    
    // --- ここから下は支払い計算 ---
    const billingAmount = currentBillingAmount; // (★変更★)

    const cashPayment = parseInt(paymentCashInput.value) || 0;
    const cardPayment = parseInt(paymentCardInput.value) || 0;
    const creditPayment = parseInt(paymentCreditInput.value) || 0;

    const totalPayment = cashPayment + cardPayment + creditPayment;
    
    let shortage = 0;
    let change = 0;

    if (totalPayment >= billingAmount) {
        shortage = 0;
        const cashDue = billingAmount - cardPayment - creditPayment;
        if (cashPayment > cashDue && cashDue >= 0) {
            change = cashPayment - cashDue;
        } else if (cashPayment > 0 && cashDue < 0) {
             change = cashPayment;
        }
        else {
            change = 0;
        }
    } else {
        shortage = billingAmount - totalPayment;
        change = 0;
    }

    checkoutPaymentTotalEl.textContent = formatCurrency(totalPayment);
    checkoutShortageEl.textContent = formatCurrency(shortage);
    checkoutChangeEl.textContent = formatCurrency(change);

    if (shortage > 0) {
        processPaymentBtn.disabled = true;
    } else {
        processPaymentBtn.disabled = false;
    }
};


/**
 * 領収書モーダルを描画する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const renderReceiptModal = () => {
    if (!settings) return; // (★変更★)
    const now = new Date();
    document.getElementById('receipt-date').textContent = now.toLocaleDateString('ja-JP');
    
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (slipData) {
        const receiptCustomerName = document.getElementById('receipt-customer-name');
        if (receiptCustomerName) receiptCustomerName.value = slipData.name || '';
    }
    document.getElementById('receipt-total').textContent = formatCurrency(currentBillingAmount); // (★変更★)
};

/**
 * (新規) ボツ伝理由入力モーダルを描画する (menu.jsでは不要だがモーダルが存在するため残す)
 */
const renderCancelSlipModal = () => {
    if (!slips) return; // (★変更★)
    const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slip) return;

    cancelSlipNumber.textContent = slip.slipNumber;
    cancelSlipReasonInput.value = '';
    cancelSlipError.textContent = '';
    openModal(cancelSlipModal);
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
 * (★新規★) 新しい伝票を作成し、伝票モーダルを開く (menu.jsでは不要だがモーダルが存在するため残す)
 * (★変更★) startTimeISO を引数に追加
 */
const createNewSlip = async (tableId, startTimeISO) => {
    if (!settings) return; // (★変更★)
    const table = settings.tables.find(t => t.id === tableId); // (★変更★)
    if (!table) return;

    const newSlipCounter = (slipCounter || 0) + 1; // (★変更★)
    const newSlipNumber = newSlipCounter;

    const newSlip = {
        // slipId は addDoc で自動生成
        slipNumber: newSlipNumber,
        tableId: tableId,
        status: 'active',
        name: "新規のお客様",
        startTime: startTimeISO,
        nominationCastId: null, 
        items: [],
        tags: [],
        paidAmount: 0,
        cancelReason: null,
        paymentDetails: { cash: 0, card: 0, credit: 0 },
        paidTimestamp: null, 
        discount: { type: 'yen', value: 0 }, 
    };
    
    // (★変更★)
    try {
        const docRef = await addDoc(slipsCollectionRef, newSlip);
        await setDoc(slipCounterRef, { count: newSlipCounter });
        currentSlipId = docRef.id;

        const discountAmountInput = document.getElementById('discount-amount');
        const discountTypeSelect = document.getElementById('discount-type');
        if (discountAmountInput) discountAmountInput.value = '';
        if (discountTypeSelect) discountTypeSelect.value = 'yen';

        renderOrderModal();
        openModal(orderModal);

    } catch (e) {
        console.error("Error creating new slip: ", e);
    }
};

/**
 * (★新規★) 伝票選択モーダルを描画する (menu.jsでは不要だがモーダルが存在するため残す)
 * (★変更★) 経過時間表示ロジック追加
 */
const renderSlipSelectionModal = (tableId) => {
    if (!slips) return; // (★変更★)
    slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    slipSelectionList.innerHTML = '';

    const activeSlips = slips.filter( // (★変更★)
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
    const modalStartTimeInput = document.getElementById('new-slip-start-time-input');
    const modalTimeError = document.getElementById('new-slip-time-error');

    newSlipConfirmTitle.textContent = `伝票の新規作成 (${tableId})`;
    newSlipConfirmMessage.textContent = `テーブル ${tableId} で新しい伝票を作成しますか？`;

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
 * (新規) 未会計伝票カードクリック時の処理 (menu.jsでは不要だがモーダルが存在するため残す)
 */
const handleSlipClick = (slipId) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === slipId); // (★変更★)
    if (!slipData) return;

    currentSlipId = slipId; // (★変更★)

    // (★追加★) 割引情報をフォームに読み込む
    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;
    
    renderOrderModal();
    openModal(orderModal);
};

/**
 * (新規) 会計済み伝票カードクリック時の処理 (menu.jsでは不要だがモーダルが存在するため残す)
 */
const handlePaidSlipClick = (slipId) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === slipId); // (★変更★)
    if (!slipData) return;

    currentSlipId = slipId; // (★変更★)
    
    // (★追加★) 割引情報をフォームに読み込む
    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;

    renderCheckoutModal(); 
    renderReceiptModal();
    openModal(receiptModal);
};


/**
 * (新規) キャストランキングを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderCastRanking = () => { ... };

// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    return {
        // currentPage: 'menu', (settings には不要)
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
            { id: 'tag3', name: '初回' }, { id: 'tag4', name: '枝' },
            { id: 'tag5', name: '切替' }, { id: 'tag6', name: '案内所' },
            { id: 'tag7', name: '20歳未満' }, { id: 'tag8', name: '同業' },
        ],
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
            { id: 'T1', status: 'available' }, { id: 'T2', status: 'available' },
            { id: 'C1', status: 'available' }, { id: 'C2', status: 'available' },
        ],
        storeInfo: {
            name: "Night POS",
            address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000",
            zip: "160-0021" // (★追加★)
        },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
        performanceSettings: {
            // (★注意★) m14 は getDefaultMenu で生成されるIDと合わせる必要あり
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

// (★削除★) Firestore への state 保存関数
// const updateStateInFirestore = async (newState) => { ... };

// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 新しい参照を取得
    const { 
        settingsRef, menuRef, slipCounterRef,
        castsCollectionRef, customersCollectionRef, slipsCollectionRef
    } = e.detail;

    // (★新規★) 全データをロードできたか確認するフラグ
    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) menu.js は renderMenuTabs を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded) {
            console.log("All data loaded. Rendering UI for menu.js");
            renderMenuTabs();
            updateModalCommonInfo(); 
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
            slips.push({ ...doc.data(), slipId: doc.id }); // (★注意★) slipId フィールド
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
    
    // (★新規★) 割引
    discountAmountInput = document.getElementById('discount-amount');
    discountTypeSelect = document.getElementById('discount-type');

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====
    
    // (★変更★) タブのイベント委任
    if (menuTabsContainer) { 
        menuTabsContainer.addEventListener('click', async (e) => { // (★変更★) async
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
                if (menu) { // (★変更★)
                    menu.currentActiveMenuCategoryId = categoryId;
                    
                    // (★変更★) DBに保存
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
            
            // (★追加★) 割引をリセット
            if(discountAmountInput) discountAmountInput.value = '';
            if(discountTypeSelect) discountTypeSelect.value = 'yen';
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
                    // (変更) onSnapshot が再描画するので、入力値を戻す必要はない
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
    
    // (★削除★) menu.html には伝票関連のボタンは存在しないため、関連リスナーを削除
    // (★変更★) ただし、モーダル自体はHTMLに存在するため、モーダルを開くロジックだけ残す
    
    // (★新規★) 伝票選択モーダルのイベント委任
    if (slipSelectionList) {
        slipSelectionList.addEventListener('click', (e) => {
            const slipBtn = e.target.closest('button[data-slip-id]');
            if (slipBtn) {
                handleSlipClick(slipBtn.dataset.slipId); // (★変更★)
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

            const startTimeValue = newSlipStartTimeInput ? newSlipStartTimeInput.value : '';
            if (!startTimeValue) {
                if (newSlipTimeError) newSlipTimeError.textContent = '開始時刻を入力してください。';
                return;
            }
            if (newSlipTimeError) newSlipTimeError.textContent = '';
            
            const startTimeISO = new Date(startTimeValue).toISOString();
            
            if (tableId) {
                createNewSlip(tableId, startTimeISO); // (★変更★)
                closeModal(newSlipConfirmModal);
            }
        });
    }
    
    // (★変更★) 伝票関連のリスナー (menu.htmlのモーダル群に含まれるため)
    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', (e) => {
            updateSlipInfo(); 
            const selectedCastId = e.target.value;
            renderCustomerDropdown(selectedCastId);
        });
    }

    if (orderCustomerNameSelect) {
        orderCustomerNameSelect.addEventListener('change', (e) => {
            if (e.target.value === 'new_customer') {
                newCustomerInputGroup.classList.remove('hidden');
                newCustomerNameInput.value = '';
                newCustomerError.textContent = '';
                newCustomerNameInput.focus();
                
                if (slips) {
                    const slipData = slips.find(s => s.slipId === currentSlipId);
                    if (slipData) {
                        slipData.name = "新規のお客様";
                        updateSlipInfo();
                    }
                }

            } else {
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                updateSlipInfo();
            }
        });
    }

    if (saveNewCustomerBtn) {
        saveNewCustomerBtn.addEventListener('click', async () => {
            if (!customers) return;
            const newName = newCustomerNameInput.value.trim();
            if (newName === "") {
                newCustomerError.textContent = "顧客名を入力してください。";
                return;
            }
            
            const existingCustomer = customers.find(c => c.name === newName);
            if (existingCustomer) {
                newCustomerError.textContent = "その顧客名は既に使用されています。";
                return;
            }

            const currentCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value;
            const newCustomer = { id: getUUID(), name: newName, nominatedCastId: currentCastId };
            
            try {
                await addDoc(customersCollectionRef, newCustomer);
                
                const slipData = slips.find(s => s.slipId === currentSlipId);
                if (slipData) {
                    slipData.name = newName;
                    updateSlipInfo();
                }
                
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                
            } catch (e) {
                 console.error("Error adding new customer: ", e);
                 newCustomerError.textContent = "顧客の保存に失敗しました。";
            }
        });
    }

    if (openSlipPreviewBtn) {
        openSlipPreviewBtn.addEventListener('click', async () => {
            await updateSlipInfo();
            await renderSlipPreviewModal(); 
            closeModal(orderModal);
            openModal(slipPreviewModal);
        });
    }

    if (openCancelSlipModalBtn) {
        openCancelSlipModalBtn.addEventListener('click', () => {
            renderCancelSlipModal();
        });
    }

    if (confirmCancelSlipBtn) {
        confirmCancelSlipBtn.addEventListener('click', async () => {
            if (!slips) return;
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = slips.find(s => s.slipId === currentSlipId);
            if (slip) {
                try {
                    const slipRef = doc(slipsCollectionRef, currentSlipId);
                    await setDoc(slipRef, { 
                        status: 'cancelled',
                        cancelReason: reason
                    }, { merge: true });
                    
                    closeModal(orderModal);
                    closeModal(cancelSlipModal);
                } catch (e) {
                     console.error("Error cancelling slip: ", e);
                    cancelSlipError.textContent = "伝票のキャンセルに失敗しました。";
                }
            }
        });
    }

    if (printSlipBtn) {
        printSlipBtn.addEventListener('click', () => {
            window.print();
        });
    }

    if (goToCheckoutBtn) {
        goToCheckoutBtn.addEventListener('click', () => {
            renderCheckoutModal();
            closeModal(slipPreviewModal);
            openModal(checkoutModal);
        });
    }

    if (discountAmountInput) {
        discountAmountInput.addEventListener('input', updatePaymentStatus);
    }
    if (discountTypeSelect) {
        discountTypeSelect.addEventListener('change', updatePaymentStatus);
    }

    if (paymentCashInput) {
        paymentCashInput.addEventListener('input', updatePaymentStatus);
    }
    if (paymentCardInput) {
        paymentCardInput.addEventListener('input', updatePaymentStatus);
    }
    if (paymentCreditInput) {
        paymentCreditInput.addEventListener('input', updatePaymentStatus);
    }

    if (processPaymentBtn) {
        processPaymentBtn.addEventListener('click', async () => {
            if (!slips) return;
            const slip = slips.find(s => s.slipId === currentSlipId);
            if (!slip) return;

            const updatedSlipData = {
                paidAmount: currentBillingAmount,
                paymentDetails: {
                    cash: parseInt(paymentCashInput.value) || 0,
                    card: parseInt(paymentCardInput.value) || 0,
                    credit: parseInt(paymentCreditInput.value) || 0
                },
                discount: {
                    type: discountTypeSelect.value,
                    value: parseInt(discountAmountInput.value) || 0
                },
                status: 'paid',
                paidTimestamp: new Date().toISOString()
            };
            
            try {
                const slipRef = doc(slipsCollectionRef, currentSlipId);
                await setDoc(slipRef, updatedSlipData, { merge: true });

                renderReceiptModal();
                closeModal(checkoutModal);
                openModal(receiptModal);
            } catch (e) {
                 console.error("Error processing payment: ", e);
            }
        });
    }

    if (reopenSlipBtn) {
        reopenSlipBtn.addEventListener('click', async () => {
            if (!slips) return;
            const slip = slips.find(s => s.slipId === currentSlipId);
            if (slip) {
                const updatedSlipData = {
                    status: 'active',
                    paidAmount: 0,
                    paymentDetails: { cash: 0, card: 0, credit: 0 },
                    paidTimestamp: null,
                    discount: { type: 'yen', value: 0 }
                };

                try {
                    const slipRef = doc(slipsCollectionRef, currentSlipId);
                    await setDoc(slipRef, updatedSlipData, { merge: true });
                    
                    closeModal(receiptModal);
                    handleSlipClick(currentSlipId);
                } catch (e) {
                    console.error("Error reopening slip: ", e);
                }
            }
        });
    }

    if (orderItemsList) {
        orderItemsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-order-item-btn');
            if (removeBtn) {
                const itemId = removeBtn.dataset.itemId;
                if (itemId) {
                    removeOrderItem(itemId);
                }
            }
        });
        
        orderItemsList.addEventListener('change', (e) => {
            if (e.target.classList.contains('order-item-qty-input')) {
                const itemId = e.target.dataset.itemId;
                const newQty = parseInt(e.target.value);
                
                if (itemId && !isNaN(newQty) && newQty > 0) {
                    updateOrderItemQty(itemId, newQty);
                } else if (itemId && (!isNaN(newQty) && newQty <= 0)) {
                    removeOrderItem(itemId);
                }
            }
        });
    }
    
    if (tagsContainer) {
        tagsContainer.addEventListener('click', (e) => {
            const tagBtn = e.target.closest('.slip-tag-btn');
            if (tagBtn) {
                toggleSlipTag(tagBtn.dataset.tagName);
            }
        });
    }
    
    if (menuOrderGrid) {
        menuOrderGrid.addEventListener('click', (e) => {
            const menuBtn = e.target.closest('.menu-order-btn');
            if (menuBtn) {
                addOrderItem(
                    menuBtn.dataset.itemId,
                    menuBtn.dataset.itemName,
                    parseInt(menuBtn.dataset.itemPrice)
                );
            }
        });
    }
});