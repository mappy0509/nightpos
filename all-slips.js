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
    currentPage: 'all-slips', // (変更) このページのデフォルト
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
            currentPage: 'all-slips' // (変更) このページのデフォルト
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
 * (変更) 伝票の合計金額（割引前）を計算する (stateの税率を使用)
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
 * ページを切り替える (all-slips.jsでは不要)
 */
// const switchPage = (targetPageId) => { ... };

/**
 * (新規) キャストIDからキャスト名を取得する
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!castId) return 'フリー';
    const cast = state.casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (ボツ伝は除外)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    return state.slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};

/**
* (共通) テーブルカードのHTMLを生成する (all-slips.jsでは不要)
*/
// const createTableCardHTML = (table) => { ... };


/**
 * (変更) テーブル管理画面を描画する (all-slips.jsでは不要)
 */
const renderTableGrid = () => {
    if (!tableGrid) return;
    // (中身は tables.js に移行)
};

/**
 * (変更) ダッシュボードに未会計「伝票」一覧を描画する (all-slips.jsでは不要)
 */
const renderDashboardSlips = () => {
    if (!dashboardSlips) return;
    // (中身は dashboard.js に移行)
};

/**
 * (変更) 「伝票一覧」ページを描画する
 */
const renderAllSlipsPage = () => {
    if (!allSlipsList) return;
    allSlipsList.innerHTML = '';

    if (state.slips.length === 0) {
        allSlipsList.innerHTML = '<p class="text-slate-500 text-sm">本日の伝票はありません。</p>';
        return;
    }

    // (変更) 伝票番号の降順でソート
    const sortedSlips = [...state.slips].sort((a, b) => b.slipNumber - a.slipNumber);

    sortedSlips.forEach(slip => {
        let statusColor, statusText, cardClass;
        switch (slip.status) {
            case 'active':
                statusColor = 'blue'; statusText = '利用中'; cardClass = ''; break;
            case 'checkout':
                statusColor = 'orange'; statusText = '会計待ち'; cardClass = ''; break;
            case 'paid':
                statusColor = 'gray'; statusText = '会計済み'; cardClass = ''; break;
            case 'cancelled': 
                statusColor = 'red'; statusText = 'ボツ伝'; cardClass = 'slip-card-cancelled'; break;
        }
        // (変更) IDからキャスト名を取得
        const nominationText = getCastNameById(slip.nominationCastId);
        const total = calculateSlipTotal(slip);
        const paidAmount = slip.paidAmount || 0;

        const card = `
            <button class="w-full text-left p-4 bg-white rounded-lg shadow-md border hover:bg-slate-50 ${cardClass}" 
                    data-slip-id="${slip.slipId}" data-status="${slip.status}">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xl font-bold">
                        <i class="fa-solid fa-table fa-fw text-slate-400 mr-1"></i>${slip.tableId} (No.${slip.slipNumber}) - ${slip.name || 'ゲスト'}
                    </span>
                    <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-sm">
                    <div>
                        <p class="text-xs text-slate-500">指名</p>
                        <p class="font-medium text-pink-600 truncate">${nominationText}</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">合計金額</p>
                        <p class="font-medium">${formatCurrency(total)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">支払い済み</p>
                        <p class="font-medium text-red-600">${formatCurrency(paidAmount)}</p>
                    </div>
                </div>
                ${slip.status === 'cancelled' ? `
                <div class="mt-2 pt-2 border-t border-slate-300">
                    <p class="text-xs text-red-700 font-medium">理由: ${slip.cancelReason || '未入力'}</p>
                </div>
                ` : ''}
            </button>
        `;
        allSlipsList.innerHTML += card;
    });

    // (変更) イベントリスナーは DOMContentLoaded 内で一括設定
    // allSlipsList.querySelectorAll('button[data-slip-id]').forEach(card => { ... });
};


/**
 * (変更) 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    // --- (変更) キャストドロップダウン生成 (valueにIDを設定) ---
    orderNominationSelect.innerHTML = '<option value="null">フリー</option>'; // (変更) value="null"
    state.casts.forEach(cast => {
        // (変更) valueに cast.id を設定
        orderNominationSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
    });
    // (変更) slipData.nominationCastId を参照
    orderNominationSelect.value = slipData.nominationCastId || 'null';

    // --- (変更) 顧客ドロップダウン生成 (renderCustomerDropdown関数に分離) ---
    renderCustomerDropdown(slipData.nominationCastId);
    
    // (変更) slipData.name が 顧客リストにあればそれを選択、なければ 'new_customer'
    const customerExists = state.customers.find(c => c.name === slipData.name);
    if (customerExists) {
        orderCustomerNameSelect.value = slipData.name;
        newCustomerInputGroup.classList.add('hidden');
    } else {
        orderCustomerNameSelect.value = 'new_customer';
        newCustomerInputGroup.classList.remove('hidden');
        newCustomerNameInput.value = (slipData.name === "新規のお客様") ? "" : slipData.name;
    }
    newCustomerError.textContent = '';
    
    // 注文リストを描画
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

    // メニュー選択グリッドを描画 (変更)
    if (menuOrderGrid.innerHTML === '') { 
        const allMenuItems = [
            ...(state.menu.set || []), 
            ...(state.menu.drink || []), 
            ...(state.menu.bottle || []),
            ...(state.menu.food || []),
            ...(state.menu.cast || []),
            ...(state.menu.other || [])
        ];
        allMenuItems.forEach(item => {
            menuOrderGrid.innerHTML += `
                <button class="menu-order-btn p-3 bg-white rounded-lg shadow border text-left hover:bg-slate-100" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}">
                    <p class="font-semibold text-sm">${item.name}</p>
                    <p class="text-xs text-slate-500">${formatCurrency(item.price)}</p>
                </button>
            `;
        });
        
        document.querySelectorAll('.menu-order-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                addOrderItem(
                    btn.dataset.itemId,
                    btn.dataset.itemName,
                    parseInt(btn.dataset.itemPrice)
                );
            });
        });
    }
};

/**
 * (新規) 顧客ドロップダウンを描画する
 * @param {string | null} selectedCastId 選択中のキャストID ('null' 文字列または実際のID)
 */
const renderCustomerDropdown = (selectedCastId) => {
    // selectedCastId が 'null' 文字列の場合は null に変換
    const targetCastId = selectedCastId === 'null' ? null : selectedCastId;

    // (変更) 選択されたキャストIDに基づいて顧客をフィルタリング
    const filteredCustomers = state.customers.filter(
        customer => customer.nominatedCastId === targetCastId
    );

    orderCustomerNameSelect.innerHTML = '';
    filteredCustomers.forEach(customer => {
        orderCustomerNameSelect.innerHTML += `<option value="${customer.name}">${customer.name}</option>`;
    });
    
    // (変更) 該当顧客がいない場合の選択肢
    if (filteredCustomers.length === 0) {
        orderCustomerNameSelect.innerHTML += `<option value="" disabled>該当する顧客がいません</option>`;
    }

    orderCustomerNameSelect.innerHTML += `<option value="new_customer" class="text-blue-600 font-bold">--- 新規顧客を追加 ---</option>`;
};


/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する
 */
const updateSlipInfo = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const customerName = orderCustomerNameSelect.value;
    const nominationCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value; // (変更) IDで取得

    if (customerName !== 'new_customer' && customerName !== "") { // (変更) customerNameが空でないことも確認
        slipData.name = customerName;
    }
    slipData.nominationCastId = nominationCastId; // (変更) IDを保存
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    // (変更) stateを保存
    updateState(state);

    // renderDashboardSlips(); // all-slips.jsでは不要
    renderAllSlipsPage(); // (変更) 伝票一覧ページなので再描画
};


/**
 * 注文リストにアイテムを追加する
 * @param {string} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = (id, name, price) => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    
    // (変更) stateを保存
    updateState(state);
    renderOrderModal();
};

/**
 * (新規) 注文リストからアイテムを削除する
 * @param {string} id 商品ID
 */
const removeOrderItem = (id) => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    slipData.items = slipData.items.filter(item => item.id !== id);
    
    // (変更) stateを保存
    updateState(state);
    renderOrderModal();
};

/**
 * (新規) 注文アイテムの数量を変更する
 * @param {string} id 商品ID
 * @param {number} qty 数量
 */
const updateOrderItemQty = (id, qty) => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const item = slipData.items.find(item => item.id === id);
    if (item) {
        item.qty = qty;
    }
    
    // (変更) stateを保存
    updateState(state);
    renderOrderModal();
};

/**
 * (新規) メニュー管理タブとリストを描画する (all-slips.jsでは不要)
 */
// const renderMenuTabs = () => { ... };


/**
 * (変更) 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    slipData.status = 'checkout';
    // (変更) stateを保存
    updateState(state);

    // renderDashboardSlips(); // all-slips.jsでは不要
    // renderTableGrid(); // all-slips.jsでは不要
    renderAllSlipsPage(); // (変更) 伝票一覧ページなので再描画

    document.getElementById('slip-preview-title').textContent = `伝票プレビュー (No.${slipData.slipNumber})`;
    
    const now = new Date();
    document.getElementById('slip-datetime').textContent = now.toLocaleString('ja-JP');

    document.getElementById('slip-slip-number').textContent = slipData.slipNumber;
    document.getElementById('slip-table-id').textContent = slipData.tableId;
    document.getElementById('slip-customer-name').textContent = slipData.name || 'ゲスト';
    // (変更) IDからキャスト名を取得
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
    
    // (変更) stateの税率を使用
    const serviceCharge = subtotal * state.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * state.rates.tax;
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount;

    slipSubtotalEl.textContent = formatCurrency(subtotal);
    slipServiceChargeEl.textContent = formatCurrency(serviceCharge);
    slipTaxEl.textContent = formatCurrency(tax);
    slipPaidAmountEl.textContent = formatCurrency(paidAmount);
    slipTotalEl.textContent = formatCurrency(billingAmount);
};


/**
 * 会計モーダルを描画する
 */
const renderCheckoutModal = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
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
    
    // (変更) stateの税率を使用
    const serviceCharge = subtotal * state.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * state.rates.tax;
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount; 

    const finalBillingAmount = billingAmount; 

    // state.currentBillingAmount = finalBillingAmount;
    // (変更) stateは updateState 経由で更新
    updateState({ ...state, currentBillingAmount: finalBillingAmount });


    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(serviceCharge);
    checkoutTaxEl.textContent = formatCurrency(tax);
    checkoutPaidAmountEl.textContent = formatCurrency(paidAmount);
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount);
    
    paymentCashInput.value = '';
    paymentCardInput.value = '';
    paymentCreditInput.value = '';

    updatePaymentStatus(); 

    document.getElementById('receipt-total').textContent = formatCurrency(finalBillingAmount);
};

/**
 * (新規) 会計モーダルの支払い状況を計算・更新する
 */
const updatePaymentStatus = () => {
    const billingAmount = state.currentBillingAmount;

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
 * 領収書モーダルを描画する
 */
const renderReceiptModal = () => {
    const now = new Date();
    document.getElementById('receipt-date').textContent = now.toLocaleDateString('ja-JP');
    
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (slipData) {
        document.querySelector('#receipt-content input[type="text"]').value = slipData.name || '';
    }
};

/**
 * (新規) ボツ伝理由入力モーダルを描画する
 */
const renderCancelSlipModal = () => {
    const slip = state.slips.find(s => s.slipId === state.currentSlipId);
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
 * (新規) 新しい伝票を作成し、伝票モーダルを開く (all-slips.jsでは不要)
 * ※all-slips.htmlには新規伝票作成ボタンがないため、この関数は呼ばれない
 */
const createNewSlip = (tableId) => {
    // const table = state.tables.find(t => t.id === tableId);
    // if (!table) return;
    // ...
    // updateState({ ... });
    // renderAllSlipsPage();
    // renderOrderModal();
    // openModal(orderModal);
    console.warn('createNewSlip is not intended to be called from all-slips.js');
};

/**
 * (新規) 伝票選択モーダルを描画する (all-slips.jsでは不要)
 * ※all-slips.htmlにはテーブルがないため、この関数は呼ばれない
 */
const renderSlipSelectionModal = (tableId) => {
    // slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    // ...
    // openModal(slipSelectionModal);
    console.warn('renderSlipSelectionModal is not intended to be called from all-slips.js');
};

/**
 * (新規) 新規伝票の作成確認モーダルを描画・表示する (all-slips.jsでは不要)
 */
const renderNewSlipConfirmModal = (tableId) => {
    // newSlipConfirmTitle.textContent = `伝票の新規作成 (${tableId})`;
    // ...
    // openModal(newSlipConfirmModal);
    console.warn('renderNewSlipConfirmModal is not intended to be called from all-slips.js');
};


/**
 * (変更) テーブルカードクリック時の処理 (all-slips.jsでは不要)
 */
// const handleTableClick = (tableId) => { ... };

/**
 * (新規) 未会計伝票カードクリック時の処理 (ダッシュボード、伝票一覧ページなど)
 * @param {string} slipId 
 */
const handleSlipClick = (slipId) => {
    const slipData = state.slips.find(s => s.slipId === slipId);
    if (!slipData) return;

    // (変更) stateで管理
    updateState({ ...state, currentSlipId: slipId });
    renderOrderModal();
    openModal(orderModal);
};

/**
 * (新規) 会計済み伝票カードクリック時の処理 (伝票一覧ページ)
 * @param {string} slipId 
 */
const handlePaidSlipClick = (slipId) => {
    // (変更) stateで管理
    updateState({ ...state, currentSlipId: slipId });
    
    renderCheckoutModal(); 
    renderReceiptModal();
    openModal(receiptModal);
};


/**
 * (新規) キャストランキングを描画する (all-slips.jsでは不要)
 */
// const renderCastRanking = () => { ... };


// --- イベントリスナー ---

document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    navLinks = document.querySelectorAll('.nav-link');
    pages = document.querySelectorAll('[data-page]');
    pageTitle = document.getElementById('page-title');
    tableGrid = document.getElementById('table-grid'); // (変更) all-slips.js では null になる
    dashboardSlips = document.getElementById('dashboard-slips'); // (変更) all-slips.js では null になる
    menuTabsContainer = document.getElementById('menu-tabs'); // (変更) all-slips.js では null になる
    menuTabs = document.querySelectorAll('.menu-tab'); // (変更) all-slips.js では null になる
    menuTabContents = document.querySelectorAll('.menu-tab-content'); // (変更) all-slips.js では null になる
    menuPage = document.getElementById('menu'); // (変更) all-slips.js では null になる
    allSlipsList = document.getElementById('all-slips-list'); 
    orderModal = document.getElementById('order-modal');
    checkoutModal = document.getElementById('checkout-modal');
    receiptModal = document.getElementById('receipt-modal');
    slipPreviewModal = document.getElementById('slip-preview-modal');
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
    openNewMenuModalBtn = document.getElementById('open-new-menu-modal-btn'); // (変更) all-slips.js では null になる
    saveMenuItemBtn = document.getElementById('save-menu-item-btn');
    setMenuTbody = document.getElementById('set-menu-tbody'); // (変更) all-slips.js では null になる
    drinkMenuTbody = document.getElementById('drink-menu-tbody'); // (変更) all-slips.js では null になる
    bottleMenuTbody = document.getElementById('bottle-menu-tbody'); // (変更) all-slips.js では null になる
    foodMenuTbody = document.getElementById('food-menu-tbody'); // (変更) all-slips.js では null になる
    castMenuTbody = document.getElementById('cast-menu-tbody'); // (変更) all-slips.js では null になる
    otherMenuTbody = document.getElementById('other-menu-tbody'); // (変更) all-slips.js では null になる
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
    castRankingList = document.getElementById('cast-ranking-list'); // (変更) all-slips.js では null になる
    rankingPeriodSelect = document.getElementById('ranking-period-select'); // (変更) all-slips.js では null になる
    rankingTypeBtns = document.querySelectorAll('.ranking-type-btn'); // (変更) all-slips.js では null になる

    // ===== 初期化処理 =====
    // renderTableGrid(); // all-slips.jsでは不要
    // renderCastRanking(); // all-slips.jsでは不要
    // renderDashboardSlips(); // all-slips.jsでは不要
    renderAllSlipsPage(); // (変更) 伝票一覧ページなのでこれを実行
    
    // ===== イベントリスナーの設定 =====

    // (新規) 伝票一覧リストのイベント委任
    if (allSlipsList) {
        allSlipsList.addEventListener('click', (e) => {
            const card = e.target.closest('button[data-slip-id]');
            if (!card) return;

            const slipId = card.dataset.slipId;
            const status = card.dataset.status;

            if (status === 'cancelled') {
                return;
            }
            if (status === 'paid') {
                handlePaidSlipClick(slipId);
            } else {
                handleSlipClick(slipId);
            }
        });
    }

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(orderModal);
            closeModal(checkoutModal);
            closeModal(receiptModal);
            closeModal(slipPreviewModal);
            closeModal(slipSelectionModal);
            closeModal(newSlipConfirmModal);
            closeModal(cancelSlipModal);
            closeModal(menuEditorModal);
        });
    });
    
    // (新規) 伝票モーダル: キャスト選択の変更イベント
    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', (e) => {
            const selectedCastId = e.target.value;
            renderCustomerDropdown(selectedCastId); // 顧客ドロップダウンを再描画
            updateSlipInfo(); // 伝票情報（指名ID）を更新
        });
    }

    // 伝票モーダルの顧客情報入力イベント
    if (orderCustomerNameSelect) {
        orderCustomerNameSelect.addEventListener('change', (e) => {
            if (e.target.value === 'new_customer') {
                newCustomerInputGroup.classList.remove('hidden');
                newCustomerNameInput.value = '';
                newCustomerError.textContent = '';
                newCustomerNameInput.focus();
                
                // (新規) 新規顧客選択時も伝票情報を更新（名前を「新規のお客様」に）
                const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
                if (slipData) {
                    slipData.name = "新規のお客様";
                    updateSlipInfo();
                }

            } else {
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                updateSlipInfo();
            }
        });
    }

    // 新規顧客保存ボタン
    if (saveNewCustomerBtn) {
        saveNewCustomerBtn.addEventListener('click', () => {
            const newName = newCustomerNameInput.value.trim();
            if (newName === "") {
                newCustomerError.textContent = "顧客名を入力してください。";
                return;
            }
            
            const existingCustomer = state.customers.find(c => c.name === newName);
            if (existingCustomer) {
                newCustomerError.textContent = "その顧客名は既に使用されています。";
                return;
            }

            // (変更) 現在選択中のキャストIDを指名キャストIDとして保存
            const currentCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value;
            const newCustomer = { id: getUUID(), name: newName, nominatedCastId: currentCastId };
            
            // (変更) stateを更新
            const newCustomers = [...state.customers, newCustomer];
            updateState({ ...state, customers: newCustomers });
            
            const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slipData) {
                slipData.name = newName;
            }
            
            // (変更) 顧客ドロップダウンを再描画し、新しい顧客を選択状態にする
            renderCustomerDropdown(currentCastId);
            orderCustomerNameSelect.value = newName;
            
            newCustomerInputGroup.classList.add('hidden');
            newCustomerError.textContent = '';
            
            updateSlipInfo();
        });
    }

    // 伝票モーダル -> 伝票プレビューモーダル
    if (openSlipPreviewBtn) {
        openSlipPreviewBtn.addEventListener('click', () => {
            updateSlipInfo();
            renderSlipPreviewModal(); 
            closeModal(orderModal);
            openModal(slipPreviewModal);
        });
    }

    // 伝票モーダル -> ボツ伝理由入力モーダル
    if (openCancelSlipModalBtn) {
        openCancelSlipModalBtn.addEventListener('click', () => {
            renderCancelSlipModal();
        });
    }

    // ボツ伝理由入力モーダル -> 確定処理
    if (confirmCancelSlipBtn) {
        confirmCancelSlipBtn.addEventListener('click', () => {
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slip) {
                slip.status = 'cancelled';
                slip.cancelReason = reason;
                
                // (変更) テーブルステータスを更新するロジック
                const otherActiveSlips = getActiveSlipCount(slip.tableId);
                
                // (変更) all-slips.js ではテーブルステータスの更新は不要
                // if (otherActiveSlips === 0) { ... }
                
                // (変更) stateを保存
                updateState(state);
                
                renderAllSlipsPage(); // (変更) 伝票一覧ページなので再描画

                closeModal(orderModal);
                closeModal(cancelSlipModal);
            }
        });
    }

    // 伝票プレビューモーダル -> 印刷
    if (printSlipBtn) {
        printSlipBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // 伝票プレビューモーダル -> 会計モーダル
    if (goToCheckoutBtn) {
        goToCheckoutBtn.addEventListener('click', () => {
            renderCheckoutModal();
            closeModal(slipPreviewModal);
            openModal(checkoutModal);
        });
    }

    // 会計モーダル: 支払い金額入力イベント
    if (paymentCashInput) {
        paymentCashInput.addEventListener('input', updatePaymentStatus);
    }
    if (paymentCardInput) {
        paymentCardInput.addEventListener('input', updatePaymentStatus);
    }
    if (paymentCreditInput) {
        paymentCreditInput.addEventListener('input', updatePaymentStatus);
    }

    // 会計モーダル -> 領収書モーダル
    if (processPaymentBtn) {
        processPaymentBtn.addEventListener('click', () => {
            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (!slip) return;

            // (変更) 支払い情報をstateに保存
            const total = calculateSlipTotal(slip);
            slip.paidAmount = total; 
            slip.paymentDetails = {
                cash: parseInt(paymentCashInput.value) || 0,
                card: parseInt(paymentCardInput.value) || 0,
                credit: parseInt(paymentCreditInput.value) || 0
            };
            slip.status = 'paid';
            
            // (変更) テーブルステータスを更新するロジック (all-slips.jsでは不要)
            // const otherActiveSlips = getActiveSlipCount(slip.tableId);
            // if (otherActiveSlips === 0) { ... }
            
            // (変更) stateを保存
            updateState(state);

            renderReceiptModal();
            closeModal(checkoutModal);
            openModal(receiptModal);
            
            renderAllSlipsPage(); // (変更) 伝票一覧ページなので再描画
        });
    }

    // 領収書モーダル -> 伝票復活
    if (reopenSlipBtn) {
        reopenSlipBtn.addEventListener('click', () => {
            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slip) {
                slip.status = 'active'; 
                slip.paidAmount = 0;
                slip.paymentDetails = { cash: 0, card: 0, credit: 0 };
                
                // (変更) テーブルステータスを更新するロジック (all-slips.jsでは不要)
                // const table = state.tables.find(t => t.id === slip.tableId);
                // if (table) { ... }
                
                // (変更) stateを保存
                updateState(state);
                
                renderAllSlipsPage(); // (変更) 伝票一覧ページなので再描画
                
                closeModal(receiptModal);
                handleSlipClick(state.currentSlipId);
            }
        });
    }


    // Ranking (all-slips.jsでは不要)
    // if (rankingPeriodSelect) { ... }
    // rankingTypeBtns.forEach(btn => { ... });

    // 注文リストのイベント委任（削除・数量変更）
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
});
