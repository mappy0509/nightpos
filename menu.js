// ===== Firebase =====
// (新規) Firebase SDK と 初期化モジュールをインポート
import { getFirebaseServices } from './firebase-init.js';
import {
    doc,
    onSnapshot,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// (新規) Firebaseサービス (db, auth, userId, appId) を保持するグローバル変数
let db, auth, userId, appId;
let stateDocRef; // (新規) Firestore の state ドキュメント参照
let unsubscribeState = null; // (新規) onSnapshot の購読解除関数

// ===== グローバル定数・変数 =====
/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (変更) ===== state管理 =====

// (削除) const LOCAL_STORAGE_KEY = 'nightPosState';

/**
 * (変更) デフォルトのstateを定義する関数 (Firestore新規作成用)
 * @returns {object} デフォルトのstateオブジェクト
 */
const getDefaultState = () => ({
    currentPage: 'menu', // (変更) このページのデフォルト
    currentStore: 'store1',
    slipCounter: 0,
    slipTagsMaster: [
        { id: 'tag1', name: '指名' },
        { id: 'tag2', name: '初指名' },
        { id: 'tag3', name: '初回' },
        { id: 'tag4', name: '枝' },
        { id: 'tag5', name: '切替' },
        { id: 'tag6', name: '案内所' },
        { id: 'tag7', name: '20歳未満' },
        { id: 'tag8', name: '同業' },
    ],
    casts: [
        { id: 'c1', name: 'あい' },
        { id: 'c2', name: 'みう' },
        { id: 'c3', name: 'さくら' },
    ],
    customers: [
        { id: 'cust1', name: '鈴木様', nominatedCastId: 'c1' },
        { id: 'cust2', name: '田中様', nominatedCastId: null },
    ],
    tables: [
        { id: 'V1', status: 'available' },
        { id: 'V2', status: 'available' },
        { id: 'T1', status: 'available' },
    ],
    slips: [],
    menu: {
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', name: '基本セット (フリー)', price: 8000, duration: 60 },
        ],
        drink: [
            { id: 'm7', name: 'キャストドリンク', price: 1500 },
            { id: 'm8', name: 'ビール', price: 1000 },
        ],
        bottle: [],
        food: [],
        cast: [
            { id: 'm14', name: '本指名料', price: 3000 },
        ],
        other: []
    },
    storeInfo: {
        name: "Night POS 新宿本店",
        address: "東京都新宿区歌舞伎町1-1-1",
        tel: "03-0000-0000"
    },
    rates: {
        tax: 0.10,
        service: 0.20
    },
    dayChangeTime: "05:00",
    performanceSettings: {
        menuItems: {},
        serviceCharge: { salesType: 'percentage', salesValue: 0 },
        tax: { salesType: 'percentage', salesValue: 0 },
        sideCustomer: { salesValue: 100, countNomination: true }
    },
    currentSlipId: null,
    currentEditingMenuId: null,
    currentBillingAmount: 0,
    ranking: {
        period: 'monthly',
        type: 'nominations'
    }
});

// (削除) loadState 関数
// (削除) saveState 関数

// (変更) グローバルな state は Firestore からのデータで上書きされる
let state = getDefaultState();

/**
 * (変更) state変更時にFirestoreに保存する
 * @param {object} newState 更新後のstateオブジェクト
 */
const updateStateInFirestore = async (newState) => {
    state = newState; // ローカルのstateを即時更新
    if (stateDocRef) {
        try {
            await setDoc(stateDocRef, state);
            console.log("State updated in Firestore");
        } catch (e) {
            console.error("Error updating state in Firestore:", e);
        }
    } else {
        console.warn("stateDocRef is not ready. State not saved to Firestore.");
    }
};

// (変更) 従来の updateState を updateStateInFirestore を呼ぶように変更
const updateState = (newState) => {
    state = newState;
    updateStateInFirestore(newState);
};


// ===== DOM要素 =====
// (変更) menu.js で不要なDOMを削除
let navLinks, pages, pageTitle, menuTabsContainer, menuTabs,
    menuTabContents, menuPage,
    orderModal, checkoutModal, receiptModal,
    slipPreviewModal, modalCloseBtns, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    openNewMenuModalBtn, saveMenuItemBtn, setMenuTbody, drinkMenuTbody,
    bottleMenuTbody, foodMenuTbody, castMenuTbody, otherMenuTbody,
    cancelSlipModal, slipSelectionModal, newSlipConfirmModal;


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
    if (!slip || slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    // (変更) slip.items が存在するかチェック
    (slip.items || []).forEach(item => {
        subtotal += item.price * item.qty;
    });
    
    // (変更) state.rates が存在するかチェック
    const taxRate = (state.rates && state.rates.tax) ? state.rates.tax : 0.10;
    const serviceRate = (state.rates && state.rates.service) ? state.rates.service : 0.20;

    const serviceCharge = subtotal * serviceRate;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * taxRate;
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
    if (!castId) return 'フリー';
    // (変更) state.casts が存在するかチェック
    const cast = (state.casts || []).find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (menu.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    // (変更) state.slips が存在するかチェック
    return (state.slips || []).filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};


/**
 * (変更) 「伝票一覧」ページを描画する (menu.jsでは不要)
 */
// const renderAllSlipsPage = () => { ... };


/**
 * (変更) 伝票モーダル（注文入力）を描画する (menu.jsでは不要)
 */
// const renderOrderModal = () => { ... };

/**
 * (新規) 顧客ドロップダウンを描画する (menu.jsでは不要)
 */
// const renderCustomerDropdown = (selectedCastId) => { ... };


/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する (menu.jsでは不要)
 */
// const updateSlipInfo = () => { ... };


/**
 * 注文リストにアイテムを追加する (menu.jsでは不要)
 */
// const addOrderItem = (id, name, price) => { ... };

/**
 * (新規) 注文リストからアイテムを削除する (menu.jsでは不要)
 */
// const removeOrderItem = (id) => { ... };

/**
 * (新規) 注文アイテムの数量を変更する (menu.jsでは不要)
 */
// const updateOrderItemQty = (id, qty) => { ... };

/**
 * (新規) メニュー管理タブとリストを描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer) return; 
    
    const activeTab = menuTabsContainer.querySelector('.menu-tab.active');
    const activeCategory = activeTab ? activeTab.dataset.category : 'set';

    // 全てのタブコンテンツを非表示に
    if (menuTabContents) { // (変更) nullチェック
        menuTabContents.forEach(content => content.classList.remove('active'));
    }
    
    // 対応するタブコンテンツを表示
    const activeContent = document.getElementById(`tab-${activeCategory}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // (変更) state.menu[category] が undefined の場合も考慮
    renderMenuList('set', setMenuTbody, state.menu?.set || []);
    renderMenuList('drink', drinkMenuTbody, state.menu?.drink || []);
    renderMenuList('bottle', bottleMenuTbody, state.menu?.bottle || []);
    renderMenuList('food', foodMenuTbody, state.menu?.food || []);
    renderMenuList('cast', castMenuTbody, state.menu?.cast || []);
    renderMenuList('other', otherMenuTbody, state.menu?.other || []);
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

    items.forEach(item => {
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
    menuEditorForm.reset();
    menuEditorError.textContent = '';
    // (変更) stateを更新
    updateState({ ...state, currentEditingMenuId: null });
    
    // カテゴリ選択に応じて時間フィールドの表示を切り替え
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
        // (変更) state.menu の全カテゴリを安全に検索
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
            // (変更) stateを更新
            updateState({ ...state, currentEditingMenuId: menuId });
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
    
    openModal(menuEditorModal);
};

/**
 * (新規) メニューアイテムを保存（新規作成または更新）する
 */
const saveMenuItem = () => {
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
    
    // (変更) stateのコピーを作成して変更
    const newMenuState = { ...(state.menu || {}) };

    if (state.currentEditingMenuId) {
        // --- 編集モード ---
        let found = false;
        for (const cat of Object.keys(newMenuState)) {
            const items = newMenuState[cat] || [];
            const index = items.findIndex(item => item.id === state.currentEditingMenuId);
            if (index !== -1) {
                const originalCategory = cat;
                
                if (originalCategory === category) {
                    // カテゴリに変更なし
                    newMenuState[originalCategory][index] = newItemData;
                } else {
                    // カテゴリが変更された
                    newMenuState[originalCategory] = newMenuState[originalCategory].filter(item => item.id !== state.currentEditingMenuId); // 元のカテゴリから削除
                    if (!newMenuState[category]) {
                        newMenuState[category] = [];
                    }
                    newMenuState[category].push(newItemData); // 新しいカテゴリに追加
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
        if (!newMenuState[category]) {
            newMenuState[category] = [];
        }
        newMenuState[category].push(newItemData);
    }

    // 後処理
    menuEditorError.textContent = '';
    
    // (変更) stateを更新
    updateState({ ...state, menu: newMenuState, currentEditingMenuId: null });
    
    closeModal(menuEditorModal);
    // (変更) UI更新はonSnapshotに任せる
    // renderMenuTabs(); 
};

/**
 * (新規) メニューアイテムを削除する
 * @param {string} category 
 * @param {string} menuId 
 */
const deleteMenuItem = (category, menuId) => {
    // (変更) state.menu, state.menu[category] が存在するかチェック
    if (!category || !menuId || !state.menu || !state.menu[category]) {
        return;
    }
    
    // (変更) stateを更新
    const newMenuCategory = state.menu[category].filter(item => item.id !== menuId);
    const newMenu = { ...state.menu, [category]: newMenuCategory };
    updateState({ ...state, menu: newMenu });
    
    // (変更) UI更新はonSnapshotに任せる
    // renderMenuTabs(); 
};


/**
 * (変更) 伝票プレビューモーダルを描画する (menu.jsでは不要)
 */
// const renderSlipPreviewModal = () => { ... };


/**
 * 会計モーダルを描画する (menu.jsでは不要)
 */
// const renderCheckoutModal = () => { ... };

/**
 * (新規) 会計モーダルの支払い状況を計算・更新する (menu.jsでは不要)
 */
// const updatePaymentStatus = () => { ... };


/**
 * 領収書モーダルを描画する (menu.jsでは不要)
 */
// const renderReceiptModal = () => { ... };

/**
 * (新規) ボツ伝理由入力モーダルを描画する (menu.jsでは不要)
 */
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
// const createNewSlip = (tableId) => { ... };

/**
 * (新規) 伝票選択モーダルを描画する (menu.jsでは不要)
 */
// const renderSlipSelectionModal = (tableId) => { ... };

/**
 * (新規) 新規伝票の作成確認モーダルを描画・表示する (menu.jsでは不要)
 */
// const renderNewSlipConfirmModal = (tableId) => { ... };


/**
 * (変更) テーブルカードクリック時の処理 (menu.jsでは不要)
 */
// const handleTableClick = (tableId) => { ... };

/**
 * (新規) 未会計伝票カードクリック時の処理 (menu.jsでは不要)
 */
// const handleSlipClick = (slipId) => { ... };

/**
 * (新規) 会計済み伝票カードクリック時の処理 (menu.jsでは不要)
 */
// const handlePaidSlipClick = (slipId) => { ... };


/**
 * (新規) キャストランキングを描画する (menu.jsでは不要)
 */
// const renderCastRanking = () => { ... };


// --- イベントリスナー ---

document.addEventListener('DOMContentLoaded', async () => {
    
    // ===== DOM要素の取得 =====
    navLinks = document.querySelectorAll('.nav-link');
    pages = document.querySelectorAll('[data-page]');
    pageTitle = document.getElementById('page-title');
    // (変更) menu.js に不要なDOM取得を削除
    orderModal = document.getElementById('order-modal');
    checkoutModal = document.getElementById('checkout-modal');
    receiptModal = document.getElementById('receipt-modal');
    slipPreviewModal = document.getElementById('slip-preview-modal');
    // (変更) menu.js に必要なDOM取得
    menuTabsContainer = document.getElementById('menu-tabs'); 
    menuTabs = document.querySelectorAll('.menu-tab'); 
    menuTabContents = document.querySelectorAll('.menu-tab-content'); 
    menuPage = document.getElementById('menu'); 
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    // (変更) menu.js に必要なDOM取得
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
    // (変更) menu.js に不要なDOM取得を削除
    cancelSlipModal = document.getElementById('cancel-slip-modal');
    slipSelectionModal = document.getElementById('slip-selection-modal');
    newSlipConfirmModal = document.getElementById('new-slip-confirm-modal');
    
    // ===== (新規) Firebase 初期化とデータリッスン =====
    try {
        const services = await getFirebaseServices();
        db = services.db;
        auth = services.auth;
        userId = services.userId;
        appId = services.appId;

        // (新規) ユーザーの state ドキュメントへの参照を作成
        stateDocRef = doc(db, "artifacts", appId, "users", userId, "data", "mainState");

        // (新規) Firestore の state をリアルタイムでリッスン
        if (unsubscribeState) unsubscribeState(); 
        
        unsubscribeState = onSnapshot(stateDocRef, (doc) => {
            if (doc.exists()) {
                const firestoreState = doc.data();
                const defaultState = getDefaultState();
                state = { 
                    ...defaultState, 
                    ...firestoreState,
                    storeInfo: { ...defaultState.storeInfo, ...(firestoreState.storeInfo || {}) },
                    rates: { ...defaultState.rates, ...(firestoreState.rates || {}) },
                    ranking: { ...defaultState.ranking, ...(firestoreState.ranking || {}) },
                    menu: { ...defaultState.menu, ...(firestoreState.menu || {}) },
                    performanceSettings: { 
                        ...defaultState.performanceSettings, 
                        ...(firestoreState.performanceSettings || {}),
                        menuItems: { ...defaultState.performanceSettings.menuItems, ...(firestoreState.performanceSettings?.menuItems || {}) },
                        serviceCharge: { ...defaultState.performanceSettings.serviceCharge, ...(firestoreState.performanceSettings?.serviceCharge || {}) },
                        tax: { ...defaultState.performanceSettings.tax, ...(firestoreState.performanceSettings?.tax || {}) },
                        sideCustomer: { ...defaultState.performanceSettings.sideCustomer, ...(firestoreState.performanceSettings?.sideCustomer || {}) },
                    },
                };
                console.log("Local state updated from Firestore");
            } else {
                console.log("No state document found. Creating new one...");
                state = getDefaultState();
                updateStateInFirestore(state); 
            }

            // (新規) ページが menu の場合のみUIを更新
            renderMenuTabs();
            
            // (新規) 現在開いているモーダルがあれば再描画 (menuEditorModal)
            if (menuEditorModal.classList.contains('active') && state.currentEditingMenuId) {
                // (重要) 編集中にリロードされると入力がリセットされるため、
                // 基本的にはモーダルを閉じるか、開かない。
                // ただし、他端末で削除された場合などを考慮し、
                // IDが存在しなくなったら閉じるなどの処理が本来は必要。
                // ここではシンプルに、再描画はしない。
                console.log("Menu editor is active, skipping modal refresh to preserve input.");
            }

        }, (error) => {
            console.error("Error listening to state document:", error);
        });

    } catch (e) {
        console.error("Failed to initialize Firebase or auth:", e);
        // (新規) Firebaseが失敗した場合でも、ローカルのデフォルトstateでUIを描画
        renderMenuTabs();
    }

    
    // ===== イベントリスナーの設定 =====

    // (変更) menu.js に必要なイベントリスナー
    
    // メニュー管理タブ
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
            // (変更) menu.js で開く可能性のあるモーダルのみ
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
    
    // (変更) menu.js に不要なイベントリスナーを削除

    // (変更) menu.js に必要なイベントリスナー
    
    // メニュー管理ページ イベントリスナー
    if (openNewMenuModalBtn) {
        openNewMenuModalBtn.addEventListener('click', () => {
            const activeTab = menuTabsContainer.querySelector('.menu-tab.active');
            const activeCategory = activeTab ? activeTab.dataset.category : 'set';
            openMenuEditorModal('new', activeCategory);
        });
    }

    // メニュー編集モーダル カテゴリ変更イベント
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

    // メニュー編集モーダル 保存ボタン
    if (saveMenuItemBtn) {
        saveMenuItemBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveMenuItem();
        });
    }

    // メニュー管理ページ リストのイベント委任 (編集・削除)
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
                
                // (重要) 本来は確認モーダルを実装すべき
                // (変更) 確認なしで削除
                deleteMenuItem(category, menuId);
                return;
            }
        });
    }
});
