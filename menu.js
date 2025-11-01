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
let navLinks, pages, pageTitle, menuTabsContainer, menuTabs,
    menuTabContents, menuPage,
    orderModal, checkoutModal, receiptModal,
    slipPreviewModal, modalCloseBtns, openSlipPreviewBtn, processPaymentBtn,
    printSlipBtn, goToCheckoutBtn, reopenSlipBtn, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    openNewMenuModalBtn, saveMenuItemBtn, setMenuTbody, drinkMenuTbody,
    bottleMenuTbody, foodMenuTbody, castMenuTbody, otherMenuTbody,
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
    receiptStoreName, receiptAddress, receiptTel;


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
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
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
 * (新規) メニュー管理タブとリストを描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer || !state) return; // (変更) state がロードされるまで待つ
    
    const activeTab = menuTabsContainer.querySelector('.menu-tab.active');
    const activeCategory = activeTab ? activeTab.dataset.category : 'set';

    menuTabContents.forEach(content => content.classList.remove('active'));
    
    const activeContent = document.getElementById(`tab-${activeCategory}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    renderMenuList('set', setMenuTbody, state.menu.set || []);
    renderMenuList('drink', drinkMenuTbody, state.menu.drink || []);
    renderMenuList('bottle', bottleMenuTbody, state.menu.bottle || []);
    renderMenuList('food', foodMenuTbody, state.menu.food || []);
    renderMenuList('cast', castMenuTbody, state.menu.cast || []);
    renderMenuList('other', otherMenuTbody, state.menu.other || []);
};

/**
 * (新規) 指定されたカテゴリのメニューリストを描画する
 * @param {string} category メニューカテゴリ ('set', 'drink' など)
 * @param {HTMLElement} tbodyElement 描画先の tbody 要素
 * @param {Array} items 描画するアイテムの配列
 */
const renderMenuList = (category, tbodyElement, items) => {
    if (!tbodyElement) return;
    tbodyElement.innerHTML = '';
    
    if (items.length === 0) {
        const colSpan = (category === 'set') ? 4 : 3;
        tbodyElement.innerHTML = `<tr><td class="p-3 text-slate-500 text-sm" colspan="${colSpan}">このカテゴリにはメニューが登録されていません。</td></tr>`;
        return;
    }
    
    // (★新規★) ソートして表示
    const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));

    sortedItems.forEach(item => {
        const tr = `
            <tr class="border-b">
                <td class="p-3 font-medium">${item.name}</td>
                ${category === 'set' ? `<td class="p-3">${item.duration || '-'} 分</td>` : ''}
                <td class="p-3">${formatCurrency(item.price)}</td>
                <td class="p-3 text-right space-x-2">
                    <button class="edit-menu-btn text-blue-600 hover:text-blue-800" data-menu-id="${item.id}" data-category="${category}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="delete-menu-btn text-red-600 hover:text-red-800" data-menu-id="${item.id}" data-category="${category}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbodyElement.innerHTML += tr;
    });
};


/**
 * (新規) メニュー編集モーダルを開く
 * @param {string} mode 'new' または 'edit'
 * @param {string} category デフォルトで選択するカテゴリ
 * @param {string|null} menuId 編集対象のメニューID
 */
const openMenuEditorModal = (mode = 'new', category = 'set', menuId = null) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    menuEditorForm.reset();
    menuEditorError.textContent = '';
    
    // (変更) state を丸ごと保存
    state.currentEditingMenuId = null;
    
    const toggleDurationField = (selectedCategory) => {
        if (selectedCategory === 'set') {
            menuDurationGroup.classList.remove('hidden');
        } else {
            menuDurationGroup.classList.add('hidden');
            menuDurationInput.value = '';
        }
    };

    if (mode === 'new') {
        menuEditorModalTitle.textContent = '新規メニュー追加';
        menuCategorySelect.value = category;
        toggleDurationField(category);
    } else if (mode === 'edit' && menuId) {
        menuEditorModalTitle.textContent = 'メニュー編集';
        
        let itemToEdit = null;
        for (const cat of Object.keys(state.menu)) {
            const items = state.menu[cat] || [];
            const found = items.find(item => item.id === menuId);
            if (found) {
                itemToEdit = found;
                category = cat;
                break;
            }
        }

        if (itemToEdit) {
            state.currentEditingMenuId = menuId;
            menuCategorySelect.value = category;
            menuNameInput.value = itemToEdit.name;
            menuPriceInput.value = itemToEdit.price;
            if (category === 'set' && itemToEdit.duration) {
                menuDurationInput.value = itemToEdit.duration;
            }
            toggleDurationField(category);
        } else {
            console.error('Edit error: Menu item not found');
            return;
        }
    }
    
    // (変更) state の保存はモーダルを開くだけなら不要
    // updateStateInFirestore(state); 
    openModal(menuEditorModal);
};

/**
 * (新規) メニューアイテムを保存（新規作成または更新）する
 */
const saveMenuItem = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const category = menuCategorySelect.value;
    const name = menuNameInput.value.trim();
    const price = parseInt(menuPriceInput.value);
    const duration = (category === 'set') ? (parseInt(menuDurationInput.value) || null) : null;

    if (name === "" || isNaN(price) || price <= 0) {
        menuEditorError.textContent = "項目名と有効な料金を入力してください。";
        return;
    }

    const newItemData = {
        id: state.currentEditingMenuId || getUUID(), 
        name: name,
        price: price,
    };

    if (category === 'set') {
        newItemData.duration = duration;
    }
    
    // (変更) state を直接変更
    if (state.currentEditingMenuId) {
        // --- 編集モード ---
        let found = false;
        for (const cat of Object.keys(state.menu)) {
            const items = state.menu[cat] || [];
            const index = items.findIndex(item => item.id === state.currentEditingMenuId);
            if (index !== -1) {
                const originalCategory = cat;
                
                if (originalCategory === category) {
                    state.menu[originalCategory][index] = newItemData;
                } else {
                    state.menu[originalCategory] = state.menu[originalCategory].filter(item => item.id !== state.currentEditingMenuId);
                    if (!state.menu[category]) {
                        state.menu[category] = [];
                    }
                    state.menu[category].push(newItemData);
                }
                found = true;
                break;
            }
        }
        if (!found) {
            console.error('Save error: Item to edit not found');
        }

    } else {
        // --- 新規作成モード ---
        if (!state.menu[category]) {
            state.menu[category] = [];
        }
        state.menu[category].push(newItemData);
    }

    menuEditorError.textContent = '';
    state.currentEditingMenuId = null;
    
    // (変更) state を丸ごと保存
    updateStateInFirestore(state);
    
    closeModal(menuEditorModal);
    // (変更) renderMenuTabs() は onSnapshot が自動で呼び出す
};

/**
 * (新規) メニューアイテムを削除する
 * @param {string} category 
 * @param {string} menuId 
 */
const deleteMenuItem = (category, menuId) => {
    if (!state || !category || !menuId || !state.menu[category]) { // (変更) state チェック
        return;
    }
    
    // (変更) state を直接変更
    state.menu[category] = state.menu[category].filter(item => item.id !== menuId);
    
    // (変更) state を丸ごと保存
    updateStateInFirestore(state);
    
    // (変更) renderMenuTabs() は onSnapshot が自動で呼び出す
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
 * (新規) 新しい伝票を作成し、伝票モーダルを開く (menu.jsでは不要)
 */
// (★削除★)
// const createNewSlip = (tableId) => { ... };

/**
 * (新規) 伝票選択モーダルを描画する (menu.jsでは不要)
 */
// (★削除★)
// const renderSlipSelectionModal = (tableId) => { ... };

/**
 * (新規) 新規伝票の作成確認モーダルを描画・表示する (menu.jsでは不要)
 */
// (★削除★)
// const renderNewSlipConfirmModal = (tableId) => { ... };


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

// (新規) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultState = () => ({
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
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', name: '基本セット (フリー)', price: 8000, duration: 60 },
        ],
        drink: [{ id: 'm7', name: 'キャストドリンク', price: 1500 }],
        bottle: [{ id: 'm11', name: '鏡月 (ボトル)', price: 8000 }],
        food: [],
        cast: [{ id: 'm14', name: '本指名料', price: 3000 }],
        other: [],
    },
    storeInfo: {
        name: "Night POS",
        address: "東京都新宿区歌舞伎町1-1-1",
        tel: "03-0000-0000"
    },
    rates: { tax: 0.10, service: 0.20 },
    dayChangeTime: "05:00",
    performanceSettings: {
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
});

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
    menuTabsContainer = document.getElementById('menu-tabs'); 
    menuTabs = document.querySelectorAll('.menu-tab'); 
    menuTabContents = document.querySelectorAll('.menu-tab-content'); 
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
    setMenuTbody = document.getElementById('set-menu-tbody'); 
    drinkMenuTbody = document.getElementById('drink-menu-tbody'); 
    bottleMenuTbody = document.getElementById('bottle-menu-tbody'); 
    foodMenuTbody = document.getElementById('food-menu-tbody'); 
    castMenuTbody = document.getElementById('cast-menu-tbody'); 
    otherMenuTbody = document.getElementById('other-menu-tbody'); 
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

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    // renderMenuTabs(); 
    
    // ===== イベントリスナーの設定 =====
    
    if (menuTabsContainer) { 
        menuTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                
                menuTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                renderMenuTabs();
            });
        });
    }

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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
    
    if (openNewMenuModalBtn) {
        openNewMenuModalBtn.addEventListener('click', () => {
            const activeTab = menuTabsContainer.querySelector('.menu-tab.active');
            const activeCategory = activeTab ? activeTab.dataset.category : 'set';
            openMenuEditorModal('new', activeCategory);
        });
    }

    if (menuCategorySelect) {
        menuCategorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'set') {
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

    if (menuPage) {
        menuPage.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-menu-btn');
            if (editBtn) {
                const menuId = editBtn.dataset.menuId;
                const category = editBtn.dataset.category;
                openMenuEditorModal('edit', category, menuId);
                return;
            }

            const deleteBtn = e.target.closest('.delete-menu-btn');
            if (deleteBtn) {
                const menuId = deleteBtn.dataset.menuId;
                const category = deleteBtn.dataset.category;
                
                // (重要) 確認モーダルを実装すべき
                // (変更) 確認モーダルを挟む
                if (confirm(`「${deleteBtn.closest('tr').querySelector('td').textContent}」を削除しますか？\nこの操作は取り消せません。`)) {
                    deleteMenuItem(category, menuId);
                }
                return;
            }
        });
    }
    
    // (★削除★) menu.html には伝票関連のボタンは存在しないため、関連リスナーを削除
    // (削除) if (orderNominationSelect) { ... }
    // (削除) if (orderCustomerNameSelect) { ... }
    // (削除) if (saveNewCustomerBtn) { ... }
    // (削除) if (openSlipPreviewBtn) { ... }
    // (削除) if (openCancelSlipModalBtn) { ... }
    // (削除) if (confirmCancelSlipBtn) { ... }
    // (削除) if (printSlipBtn) { ... }
    // (削除) if (goToCheckoutBtn) { ... }
    // (削除) if (paymentCashInput) { ... }
    // (削除) if (processPaymentBtn) { ... }
    // (削除) if (reopenSlipBtn) { ... }
    // (削除) if (orderItemsList) { ... }
    // (削除) const tagsContainer = ...
    // (削除) if (menuOrderGrid) { ... }
    // (削除) if (slipSelectionList) { ... }
    // (削除) if (createNewSlipBtn) { ... }
    // (削除) if (confirmCreateSlipBtn) { ... }
});