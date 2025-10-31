// ===== グローバル定数・変数 =====
// (変更) stateから読み込むようにするため、ダミー定数を削除
// const DUMMY_SERVICE_CHARGE_RATE = 0.20; 
// const DUMMY_TAX_RATE = 0.10;

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (変更) ===== state管理 =====

const LOCAL_STORAGE_KEY = 'nightPosState';

/**
 * (新規) デフォルトのstateを定義する関数
 * @returns {object} デフォルトのstateオブジェクト
 */
const getDefaultState = () => ({
    currentPage: 'menu', // (変更) このページのデフォルト
    currentStore: 'store1',
    slipCounter: 3,
    // (新規) 伝票タグのマスターデータ
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
    // (変更) キャストマスタ (IDと名前)
    casts: [ 
        { id: 'c1', name: 'あい' },
        { id: 'c2', name: 'みう' },
        { id: 'c3', name: 'さくら' },
        { id: 'c4', name: 'れな' },
        { id: 'c5', name: 'ひな' },
        { id: 'c6', name: '体験A' },
    ],
    // (変更) 顧客マスタ (指名キャストIDを持たせる)
    customers: [
        { id: 'cust1', name: '鈴木様', nominatedCastId: 'c1' }, // あいの指名
        { id: 'cust2', name: '田中様', nominatedCastId: null }, // フリー
        { id: 'cust3', name: '佐藤様', nominatedCastId: 'c2' }, // みうの指名
        { id: 'cust4', name: '山田様', nominatedCastId: 'c1' }, // あいの指名
        { id: 'cust5', name: '渡辺様', nominatedCastId: 'c3' }, // さくらの指名
        { id: 'cust6', name: '伊藤様', nominatedCastId: null }, // フリー
    ],
    tables: [
        { id: 'V1', status: 'occupied' },
        { id: 'V2', status: 'available' },
        { id: 'V3', status: 'occupied' },
        { id: 'V4', status: 'available' },
        { id: 'T1', status: 'available' },
        { id: 'T2', status: 'occupied' },
        { id: 'T3', status: 'available' },
        { id: 'T4', status: 'available' },
        { id: 'C1', status: 'available' },
        { id: 'C2', status: 'available' },
    ],
    slips: [
        { 
            slipId: 'slip-1', 
            slipNumber: 1,
            tableId: 'V1', 
            status: 'active',
            name: '鈴木様', 
            startTime: '20:30', 
            nominationCastId: 'c1', // (変更) 名前 -> ID
            items: [
                { id: 'm1', name: '基本セット (指名)', price: 10000, qty: 1 },
                { id: 'm7', name: 'キャストドリンク', price: 1500, qty: 2 },
                { id: 'm10', name: '鏡月 (ボトル)', price: 8000, qty: 1 },
            ],
            tags: ['指名'], // (新規)
            paidAmount: 0, 
            cancelReason: null,
            paymentDetails: { cash: 0, card: 0, credit: 0 } 
        },
        { 
            slipId: 'slip-3', 
            slipNumber: 2,
            tableId: 'V3', 
            status: 'checkout', 
            name: '田中様', 
            startTime: '21:00', 
            nominationCastId: null, // (変更) "フリー" -> null
            items: [
                { id: 'm2', name: '基本セット (フリー)', price: 8000, qty: 1 },
                { id: 'm8', name: 'ビール', price: 1000, qty: 6 },
            ],
            tags: [], // (新規)
            paidAmount: 0,
            cancelReason: null, 
            paymentDetails: { cash: 0, card: 0, credit: 0 } 
        },
        { 
            slipId: 'slip-4', 
            slipNumber: 3,
            tableId: 'T2', 
            status: 'active', 
            name: '佐藤様', 
            startTime: '22:15', 
            nominationCastId: 'c2', // (変更) 名前 -> ID
            items: [
                { id: 'm1', name: '基本セット (指名)', price: 10000, qty: 1 },
                { id: 'm12', name: 'シャンパン (ゴールド)', price: 50000, qty: 1 },
                { id: 'm7', name: 'キャストドリンク', price: 1500, qty: 8 },
            ],
            tags: ['指名'], // (新規)
            paidAmount: 0,
            cancelReason: null, 
            paymentDetails: { cash: 0, card: 0, credit: 0 } 
        },
    ],
    menu: {
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', name: '基本セット (フリー)', price: 8000, duration: 60 },
            { id: 'm3', name: '延長 (自動)', price: 5000, duration: 30 },
        ],
        drink: [
            { id: 'm7', name: 'キャストドリンク', price: 1500 },
            { id: 'm8', name: 'ビール', price: 1000 },
        ],
        bottle: [
            { id: 'm11', name: '鏡月 (ボトル)', price: 8000 },
            { id: 'm12', name: 'シャンパン (ゴールド)', price: 50000 },
        ],
        food: [
            { id: 'm4', name: '乾き物盛り合わせ', price: 2000 },
        ],
        cast: [
            { id: 'm14', name: '本指名料', price: 3000 },
        ],
        other: [
            { id: 'm6', name: 'カラオケ', price: 1000 },
        ]
    },
    // (新規) 店舗設定用の項目
    storeInfo: {
        name: "Night POS 新宿本店",
        address: "東京都新宿区歌舞伎町1-1-1",
        tel: "03-0000-0000"
    },
    // (新規) 税率用の項目 (0.xx の形式で保存)
    rates: {
        tax: 0.10, // 消費税 10%
        service: 0.20 // サービス料 20%
    },
    // (新規) 営業日付の変更時刻
    dayChangeTime: "05:00", // デフォルト AM 5:00
    // (新規) キャスト成績反映設定
    performanceSettings: {
        menuItems: {
            // 'm14': { salesType: 'percentage', salesValue: 100, countNomination: true }
        },
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

/**
 * (新規) localStorageからstateを読み込む
 * @returns {object} stateオブジェクト
 */
const loadState = () => {
    const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedState) {
        const defaultState = getDefaultState();
        const parsedState = JSON.parse(storedState);

        // (新規) performanceSettings のネストされたマージ
        const defaultPerfSettings = defaultState.performanceSettings;
        const parsedPerfSettings = parsedState.performanceSettings || {};
        const mergedPerfSettings = {
            ...defaultPerfSettings,
            ...parsedPerfSettings,
            // 各項目を個別にマージ
            menuItems: { ...defaultPerfSettings.menuItems, ...(parsedPerfSettings.menuItems || {}) },
            serviceCharge: { ...defaultPerfSettings.serviceCharge, ...(parsedPerfSettings.serviceCharge || {}) },
            tax: { ...defaultPerfSettings.tax, ...(parsedPerfSettings.tax || {}) },
            sideCustomer: { ...defaultPerfSettings.sideCustomer, ...(parsedPerfSettings.sideCustomer || {}) },
        };

        // (変更) ネストされたオブジェクトも正しくマージする
        const mergedState = {
            ...defaultState,
            ...parsedState,
            storeInfo: { ...defaultState.storeInfo, ...parsedState.storeInfo },
            rates: { ...defaultState.rates, ...parsedState.rates },
            ranking: { ...defaultState.ranking, ...parsedState.ranking },
            menu: { ...defaultState.menu, ...parsedState.menu },
            slipTagsMaster: parsedState.slipTagsMaster || defaultState.slipTagsMaster, // (新規)
             // (新規) 伝票(slips)データにtagsプロパティがない場合、空配列[]を追加する
             slips: (parsedState.slips || defaultState.slips).map(slip => ({
                ...slip,
                tags: slip.tags || [] // (新規) 古いデータにtagsを追加
            })),
            dayChangeTime: parsedState.dayChangeTime || defaultState.dayChangeTime, // (新規)
            performanceSettings: mergedPerfSettings, // (新規)
            currentPage: 'menu' // (変更) このページのデフォルト
        };
        
        // (変更) ratesが%表記(10)で保存されていたら小数(0.10)に変換する
        if (mergedState.rates.tax > 1) {
            mergedState.rates.tax = mergedState.rates.tax / 100;
        }
        if (mergedState.rates.service > 1) {
            mergedState.rates.service = mergedState.rates.service / 100;
        }

        return mergedState;
    } else {
        const defaultState = getDefaultState();
        saveState(defaultState);
        return defaultState;
    }
};

/**
 * (新規) stateをlocalStorageに保存する
 * @param {object} newState 保存するstateオブジェクト
 */
const saveState = (newState) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
};

// (新規) 起動時にstateをロード
let state = loadState();

/**
 * (新規) state変更時に保存するラッパー関数
 * @param {object} newState 更新後のstateオブジェクト
 */
const updateState = (newState) => {
    state = newState;
    saveState(state);
};


// ===== DOM要素 =====
let navLinks, pages, pageTitle, tableGrid, dashboardSlips, menuTabsContainer, menuTabs,
    menuTabContents, menuPage, allSlipsList, orderModal, checkoutModal, receiptModal,
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
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl, castRankingList,
    rankingPeriodSelect, rankingTypeBtns;

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
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    // (変更) stateから税率を読み込む
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
    return state.slips.filter(
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
    menuTabContents.forEach(content => content.classList.remove('active'));
    
    // 対応するタブコンテンツを表示
    const activeContent = document.getElementById(`tab-${activeCategory}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // (変更) state.menu[category] が undefined の場合も考慮
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
    // state.currentEditingMenuId = null;
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
            // state.currentEditingMenuId = menuId;
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
    const newMenuState = { ...state.menu };

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
    // state.currentEditingMenuId = null;
    // (変更) stateを更新
    updateState({ ...state, menu: newMenuState, currentEditingMenuId: null });
    
    closeModal(menuEditorModal);
    renderMenuTabs(); 
};

/**
 * (新規) メニューアイテムを削除する
 * @param {string} category 
 * @param {string} menuId 
 */
const deleteMenuItem = (category, menuId) => {
    if (!category || !menuId || !state.menu[category]) {
        return;
    }
    
    // (変更) stateを更新
    const newMenuCategory = state.menu[category].filter(item => item.id !== menuId);
    const newMenu = { ...state.menu, [category]: newMenuCategory };
    updateState({ ...state, menu: newMenu });
    
    renderMenuTabs(); 
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

document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    navLinks = document.querySelectorAll('.nav-link');
    pages = document.querySelectorAll('[data-page]');
    pageTitle = document.getElementById('page-title');
    // (変更) menu.js に不要なDOM取得を削除
    // tableGrid = document.getElementById('table-grid'); 
    // dashboardSlips = document.getElementById('dashboard-slips'); 
    allSlipsList = document.getElementById('all-slips-list'); 
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
    // (変更) menu.js に不要なDOM取得を削除
    // openSlipPreviewBtn = document.getElementById('open-slip-preview-btn');
    // processPaymentBtn = document.getElementById('process-payment-btn');
    // printSlipBtn = document.getElementById('print-slip-btn');
    // goToCheckoutBtn = document.getElementById('go-to-checkout-btn');
    // reopenSlipBtn = document.getElementById('reopen-slip-btn');
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
    // cancelSlipModal = document.getElementById('cancel-slip-modal');
    // openCancelSlipModalBtn = document.getElementById('open-cancel-slip-modal-btn');
    // cancelSlipModalTitle = document.getElementById('cancel-slip-modal-title');
    // cancelSlipNumber = document.getElementById('cancel-slip-number');
    // cancelSlipReasonInput = document.getElementById('cancel-slip-reason-input');
    // cancelSlipError = document.getElementById('cancel-slip-error');
    // confirmCancelSlipBtn = document.getElementById('confirm-cancel-slip-btn');
    // slipSelectionModal = document.getElementById('slip-selection-modal');
    // slipSelectionModalTitle = document.getElementById('slip-selection-modal-title');
    // slipSelectionList = document.getElementById('slip-selection-list');
    // createNewSlipBtn = document.getElementById('create-new-slip-btn');
    // newSlipConfirmModal = document.getElementById('new-slip-confirm-modal');
    // newSlipConfirmTitle = document.getElementById('new-slip-confirm-title');
    // newSlipConfirmMessage = document.getElementById('new-slip-confirm-message');
    // confirmCreateSlipBtn = document.getElementById('confirm-create-slip-btn');
    // orderModalTitle = document.getElementById('order-modal-title');
    // orderItemsList = document.getElementById('order-items-list');
    // menuOrderGrid = document.getElementById('menu-order-grid');
    // orderSubtotalEl = document.getElementById('order-subtotal');
    // orderCustomerNameSelect = document.getElementById('order-customer-name-select');
    // orderNominationSelect = document.getElementById('order-nomination-select');
    // newCustomerInputGroup = document.getElementById('new-customer-input-group');
    // newCustomerNameInput = document.getElementById('new-customer-name-input');
    // saveNewCustomerBtn = document.getElementById('save-new-customer-btn');
    // newCustomerError = document.getElementById('new-customer-error');
    // checkoutModalTitle = document.getElementById('checkout-modal-title');
    // checkoutItemsList = document.getElementById('checkout-items-list');
    // checkoutSubtotalEl = document.getElementById('checkout-subtotal');
    // checkoutServiceChargeEl = document.getElementById('checkout-service-charge');
    // checkoutTaxEl = document.getElementById('checkout-tax');
    // checkoutPaidAmountEl = document.getElementById('checkout-paid-amount');
    // checkoutTotalEl = document.getElementById('checkout-total');
    // paymentCashInput = document.getElementById('payment-cash');
    // paymentCardInput = document.getElementById('payment-card');
    // paymentCreditInput = document.getElementById('payment-credit');
    // checkoutPaymentTotalEl = document.getElementById('checkout-payment-total');
    // checkoutShortageEl = document.getElementById('checkout-shortage');
    // checkoutChangeEl = document.getElementById('checkout-change');
    // slipSubtotalEl = document.getElementById('slip-subtotal');
    // slipServiceChargeEl = document.getElementById('slip-service-charge');
    // slipTaxEl = document.getElementById('slip-tax');
    // slipPaidAmountEl = document.getElementById('slip-paid-amount');
    // slipTotalEl = document.getElementById('slip-total');
    // castRankingList = document.getElementById('cast-ranking-list'); 
    // rankingPeriodSelect = document.getElementById('ranking-period-select'); 
    // rankingTypeBtns = document.querySelectorAll('.ranking-type-btn'); 

    // ===== 初期化処理 =====
    renderMenuTabs(); // (変更) メニュー管理ページなのでこれを実行
    
    // ===== イベントリスナーの設定 =====

    // (変更) menu.js に必要なイベントリスナー
    
    // メニュー管理タブ
    if (menuTabsContainer) { // (変更) nullチェック
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
    // (orderNominationSelect, orderCustomerNameSelect, saveNewCustomerBtn, ...)
    // (... openSlipPreviewBtn, openCancelSlipModalBtn, confirmCancelSlipBtn, ...)
    // (... printSlipBtn, goToCheckoutBtn, payment inputs, processPaymentBtn, reopenSlipBtn, ...)
    // (... ranking inputs, orderItemsList, ...)

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
                deleteMenuItem(category, menuId);
                return;
            }
        });
    }
});
