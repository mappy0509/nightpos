// ===== グローバル定数・変数 =====
const DUMMY_SERVICE_CHARGE_RATE = 0.20; // サービス料 20%
const DUMMY_TAX_RATE = 0.10; // 消費税 10%

// (変更) アプリケーションの状態管理
const state = {
    currentPage: 'dashboard',
    currentStore: 'store1',
    // (変更) テーブルは「席」の情報のみを持つ
    tables: [
        { id: 'V1', status: 'occupied' }, // 伝票があるため 'occupied'
        { id: 'V2', status: 'available' },
        { id: 'V3', status: 'occupied' }, // 伝票があるため 'occupied'
        { id: 'V4', status: 'available' },
        { id: 'T1', status: 'available' },
        { id: 'T2', status: 'occupied' }, // 伝票があるため 'occupied'
        { id: 'T3', status: 'available' },
        { id: 'T4', status: 'available' },
        { id: 'C1', status: 'available' },
        { id: 'C2', status: 'available' },
    ],
    // (新規) 伝票情報を独立して管理
    slips: [
        { 
            slipId: 'slip-1', 
            tableId: 'V1', 
            status: 'active', // 'active', 'checkout', 'paid'
            guests: 2, 
            name: '鈴木様', 
            startTime: '20:30', 
            nomination: 'あい', 
            items: [
                { id: 1, name: '基本セット (指名)', price: 10000, qty: 1 },
                { id: 2, name: 'キャストドリンク', price: 1500, qty: 2 },
                { id: 3, name: '鏡月 (ボトル)', price: 8000, qty: 1 },
            ],
            paidAmount: 0 // (新規) 支払い済み金額
        },
        // { 
        //     slipId: 'slip-2', 
        //     tableId: 'V1', 
        //     status: 'active', 
        //     guests: 1, 
        //     name: '渡辺様', 
        //     startTime: '21:00', 
        //     nomination: 'フリー', 
        //     items: [
        //         { id: 1, name: '基本セット (フリー)', price: 8000, qty: 1 },
        //     ],
        //     paidAmount: 0
        // },
        { 
            slipId: 'slip-3', 
            tableId: 'V3', 
            status: 'checkout', 
            guests: 3, 
            name: '田中様', 
            startTime: '21:00', 
            nomination: 'フリー', 
            items: [
                { id: 1, name: '基本セット (フリー)', price: 8000, qty: 3 },
                { id: 4, name: 'ビール', price: 1000, qty: 6 },
            ],
            paidAmount: 0 // (新規) 支払い済み金額
        },
        { 
            slipId: 'slip-4', 
            tableId: 'T2', 
            status: 'active', 
            guests: 4, 
            name: '佐藤様', 
            startTime: '22:15', 
            nomination: 'みう', 
            items: [
                { id: 1, name: '基本セット (指名)', price: 10000, qty: 2 },
                { id: 5, name: 'シャンパン (ゴールド)', price: 50000, qty: 1 },
                { id: 2, name: 'キャストドリンク', price: 1500, qty: 8 },
            ],
            paidAmount: 0 // (新規) 支払い済み金額
        },
    ],
    menu: {
        set: [
            { id: 1, name: '基本セット (フリー)', price: 8000 },
            { id: 1, name: '基本セット (指名)', price: 10000 },
            { id: 6, name: '延長 (30分)', price: 5000 },
        ],
        drink: [
            { id: 2, name: 'キャストドリンク', price: 1500 },
            { id: 4, name: 'ビール', price: 1000 },
            { id: 7, name: 'カクテル各種', price: 1200 },
            { id: 8, name: 'ソフトドリンク', price: 800 },
        ],
        bottle: [
            { id: 3, name: '鏡月 (ボトル)', price: 8000 },
            { id: 9, name: '黒霧島 (ボトル)', price: 8000 },
            { id: 5, name: 'シャンパン (ゴールド)', price: 50000 },
            { id: 10, name: 'シャンパン (ブラック)', price: 80000 },
        ]
    },
    // (変更) currentOrder -> currentSlipId
    currentSlipId: null, 
    ranking: {
        period: 'monthly', // 'monthly', 'weekly', 'daily'
        type: 'nominations' // 'nominations', 'sales'
    }
};

// ランキング用ダミーデータ
const dummyRankingData = {
    monthly: {
        nominations: [
            { id: 1, name: 'あい', value: 120, unit: '組', img: 'https://placehold.co/40x40/ffe4e6/db2777?text=Ai' },
            { id: 2, name: 'みう', value: 115, unit: '組', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Miu' },
            { id: 3, name: 'さくら', value: 98, unit: '組', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Sk' },
            { id: 4, name: 'れな', value: 85, unit: '組', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Rn' },
            { id: 5, name: 'ひな', value: 82, unit: '組', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Hn' },
        ],
        sales: [
            { id: 2, name: 'みう', value: 8500000, unit: '円', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Miu' },
            { id: 1, name: 'あい', value: 7200000, unit: '円', img: 'https://placehold.co/40x40/ffe4e6/db2777?text=Ai' },
            { id: 5, name: 'ひな', value: 6800000, unit: '円', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Hn' },
            { id: 3, name: 'さくら', value: 5500000, unit: '円', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Sk' },
            { id: 4, name: 'れな', value: 5100000, unit: '円', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Rn' },
        ]
    },
    weekly: {
        nominations: [
            { id: 3, name: 'さくら', value: 35, unit: '組', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Sk' },
            { id: 1, name: 'あい', value: 32, unit: '組', img: 'https://placehold.co/40x40/ffe4e6/db2777?text=Ai' },
            { id: 2, name: 'みう', value: 30, unit: '組', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Miu' },
            { id: 5, name: 'ひな', value: 28, unit: '組', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Hn' },
            { id: 4, name: 'れな', value: 25, unit: '組', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Rn' },
        ],
        sales: [
            { id: 5, name: 'ひな', value: 2500000, unit: '円', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Hn' },
            { id: 2, name: 'みう', value: 2200000, unit: '円', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Miu' },
            { id: 1, name: 'あい', value: 1800000, unit: '円', img: 'https://placehold.co/40x40/ffe4e6/db2777?text=Ai' },
            { id: 3, name: 'さくら', value: 1600000, unit: '円', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Sk' },
            { id: 4, name: 'れな', value: 1500000, unit: '円', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Rn' },
        ]
    },
    daily: {
        nominations: [
            { id: 1, name: 'あい', value: 8, unit: '組', img: 'https://placehold.co/40x40/ffe4e6/db2777?text=Ai' },
            { id: 5, name: 'ひな', value: 6, unit: '組', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Hn' },
            { id: 3, name: 'さくら', value: 5, unit: '組', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Sk' },
            { id: 2, name: 'みう', value: 5, unit: '組', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Miu' },
            { id: 4, name: 'れな', value: 3, unit: '組', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Rn' },
        ],
        sales: [
            { id: 5, name: 'ひな', value: 800000, unit: '円', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Hn' },
            { id: 1, name: 'あい', value: 650000, unit: '円', img: 'https://placehold.co/40x40/ffe4e6/db2777?text=Ai' },
            { id: 2, name: 'みう', value: 500000, unit: '円', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Miu' },
            { id: 3, name: 'さくら', value: 400000, unit: '円', img: 'https://placehold.co/40x40/fce7f3/db2777?text=Sk' },
            { id: 4, name: 'れな', value: 300000, unit: '円', img: 'https://placehold.co/40x40/e0e7ff/4338ca?text=Rn' },
        ]
    }
};

// ===== DOM要素 =====
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('[data-page]');
const pageTitle = document.getElementById('page-title');
const tableGrid = document.getElementById('table-grid');
const dashboardSlips = document.getElementById('dashboard-slips'); // (変更) dashboard-tables -> dashboard-slips
const menuTabs = document.querySelectorAll('.menu-tab');
const menuTabContents = document.querySelectorAll('.menu-tab-content');
const allSlipsList = document.getElementById('all-slips-list'); // (新規)

// モーダル関連
const orderModal = document.getElementById('order-modal');
const checkoutModal = document.getElementById('checkout-modal');
const receiptModal = document.getElementById('receipt-modal');
const slipPreviewModal = document.getElementById('slip-preview-modal');
const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
const openSlipPreviewBtn = document.getElementById('open-slip-preview-btn');
const processPaymentBtn = document.getElementById('process-payment-btn');
const printSlipBtn = document.getElementById('print-slip-btn');
const goToCheckoutBtn = document.getElementById('go-to-checkout-btn');
const reopenSlipBtn = document.getElementById('reopen-slip-btn'); // (新規)

// (新規) 伝票選択モーダル
const slipSelectionModal = document.getElementById('slip-selection-modal');
const slipSelectionModalTitle = document.getElementById('slip-selection-modal-title');
const slipSelectionList = document.getElementById('slip-selection-list');
const createNewSlipBtn = document.getElementById('create-new-slip-btn');

// (新規) 新規伝票確認モーダル
const newSlipConfirmModal = document.getElementById('new-slip-confirm-modal');
const newSlipConfirmTitle = document.getElementById('new-slip-confirm-title');
const newSlipConfirmMessage = document.getElementById('new-slip-confirm-message');
const confirmCreateSlipBtn = document.getElementById('confirm-create-slip-btn');


// 伝票モーダル
const orderModalTitle = document.getElementById('order-modal-title');
const orderItemsList = document.getElementById('order-items-list');
const menuOrderGrid = document.getElementById('menu-order-grid');
const orderSubtotalEl = document.getElementById('order-subtotal');
const orderCustomerNameInput = document.getElementById('order-customer-name');
const orderGuestsInput = document.getElementById('order-guests');
const orderNominationInput = document.getElementById('order-nomination');


// 会計モーダル
const checkoutModalTitle = document.getElementById('checkout-modal-title');
const checkoutItemsList = document.getElementById('checkout-items-list');
const checkoutSubtotalEl = document.getElementById('checkout-subtotal');
const checkoutServiceChargeEl = document.getElementById('checkout-service-charge');
const checkoutTaxEl = document.getElementById('checkout-tax');
const checkoutPaidAmountEl = document.getElementById('checkout-paid-amount'); // (新規)
const checkoutTotalEl = document.getElementById('checkout-total');
const paymentMethodBtns = document.querySelectorAll('.payment-method-btn');

// 伝票プレビューモーダル (金額)
const slipSubtotalEl = document.getElementById('slip-subtotal');
const slipServiceChargeEl = document.getElementById('slip-service-charge');
const slipTaxEl = document.getElementById('slip-tax');
const slipPaidAmountEl = document.getElementById('slip-paid-amount'); // (新規)
const slipTotalEl = document.getElementById('slip-total'); // (変更) これは「今回ご請求額」

// Ranking関連
const castRankingList = document.getElementById('cast-ranking-list');
const rankingPeriodSelect = document.getElementById('ranking-period-select');
const rankingTypeBtns = document.querySelectorAll('.ranking-type-btn');

// --- 関数 ---

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    return `¥${amount.toLocaleString()}`;
};

/**
 * (新規) 伝票の合計金額（割引前）を計算する
 * @param {object} slip 伝票データ
 * @returns {number} 合計金額
 */
const calculateSlipTotal = (slip) => {
    let subtotal = 0;
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    const serviceCharge = subtotal * DUMMY_SERVICE_CHARGE_RATE;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * DUMMY_TAX_RATE;
    const total = subtotalWithService + tax;
    // Math.round で丸めておく
    return Math.round(total);
};


/**
 * ページを切り替える
 * @param {string} targetPageId 表示するページのID
 */
const switchPage = (targetPageId) => {
    state.currentPage = targetPageId;

    // ページの表示切り替え
    pages.forEach(page => {
        if (page.id === targetPageId) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });

    // ナビゲーションリンクのアクティブ状態切り替え
    let targetTitle = '';
    navLinks.forEach(link => {
        if (link.dataset.target === targetPageId) {
            link.classList.add('active');
            targetTitle = link.querySelector('span').textContent;
        } else {
            link.classList.remove('active');
        }
    });

    // ページタイトル更新
    pageTitle.textContent = targetTitle;

    // (変更) ページに応じた描画関数を呼び出す
    if (targetPageId === 'dashboard') {
        renderDashboardSlips();
    }
    if (targetPageId === 'all-slips') {
        renderAllSlipsPage();
    }
};

/**
 * (変更) 未会計伝票の数を取得する
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    return state.slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};

/**
* (共通) テーブルカードのHTMLを生成する
* @param {object} table テーブルデータ
* @returns {string} HTML文字列
*/
const createTableCardHTML = (table) => {
    let statusColor, statusText;
    // (変更) テーブルのステータスは 'available' 'occupied' のみ
    switch (table.status) {
        case 'available':
            statusColor = 'green';
            statusText = '空席';
            break;
        case 'occupied':
            statusColor = 'blue';
            statusText = '利用中';
            break;
    }
    
    // (新規) 未会計伝票数を取得
    const activeSlips = getActiveSlipCount(table.id);

    return `
        <button class="table-card p-4 rounded-lg shadow-md border-2 transition-transform transform hover:scale-105" 
                data-table-id="${table.id}" 
                data-status="${table.status}">
            
            <!-- (新規) 伝票数バッジ -->
            ${activeSlips > 0 ? `<div class="slip-count-badge">${activeSlips}</div>` : ''}

            <div class="flex justify-between items-center mb-3">
                <span class="text-2xl font-bold">${table.id}</span>
                <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
            </div>
            ${table.status !== 'available' ? `
            <div class="text-left h-16"> <!-- h-16 で固定 -->
                <p class="text-sm text-slate-500">クリックして伝票を管理</p>
                <!-- (変更) 顧客名や指名は伝票に紐づくため削除 -->
            </div>
            ` : `
            <div class="text-left h-16 flex items-center">
                <p class="text-sm text-slate-400">クリックして伝票開始</p>
            </div>
            `}
        </button>
    `;
};


/**
 * テーブル管理画面を描画する
 */
const renderTableGrid = () => {
    if (!tableGrid) return;
    tableGrid.innerHTML = ''; // 既存の表示をクリア

    state.tables.forEach(table => {
        tableGrid.innerHTML += createTableCardHTML(table);
    });

    // 各テーブルカードにクリックイベントを追加
    tableGrid.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', () => {
            handleTableClick(card.dataset.tableId);
        });
    });
};

/**
 * (変更) ダッシュボードに未会計「伝票」一覧を描画する
 */
const renderDashboardSlips = () => {
    if (!dashboardSlips) return;
    dashboardSlips.innerHTML = ''; // 既存の表示をクリア

    // (変更) state.slips を参照
    const activeSlips = state.slips.filter(
        slip => slip.status === 'active' || slip.status === 'checkout'
    );

    if (activeSlips.length === 0) {
        dashboardSlips.innerHTML = '<p class="text-slate-500 text-sm md:col-span-2">現在、未会計の伝票はありません。</p>';
        return;
    }

    // (変更) 伝票単位でカードを生成
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
        
        const nominationText = slip.nomination || 'フリー';

        const card = `
            <button class="w-full text-left p-4 bg-white rounded-lg shadow-md border hover:bg-slate-50" 
                    data-slip-id="${slip.slipId}" data-status="${slip.status}">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xl font-bold">
                        <i class="fa-solid fa-table fa-fw text-slate-400 mr-2"></i>${slip.tableId}
                    </span>
                    <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
                </div>
                <div class="text-left">
                    <p class="text-sm font-medium truncate">${slip.name || 'ゲスト'}</p>
                    <p class="text-xs text-slate-500">${slip.guests || 0}名様 / ${slip.startTime || '??:??'}〜</p>
                    <p class="text-xs text-pink-600 font-medium mt-1 truncate"><i class="fa-solid fa-star fa-fw mr-1"></i>${nominationText}</p>
                </div>
            </button>
        `;
        dashboardSlips.innerHTML += card;
    });

    // (変更) 各伝票カードにクリックイベントを追加
    dashboardSlips.querySelectorAll('button[data-slip-id]').forEach(card => {
        card.addEventListener('click', () => {
            // (変更) paid 以外は handleSlipClick を呼ぶ
            if (card.dataset.status !== 'paid') {
                handleSlipClick(card.dataset.slipId);
            }
        });
    });
};

/**
 * (新規) 「伝票一覧」ページを描画する
 */
const renderAllSlipsPage = () => {
    if (!allSlipsList) return;
    allSlipsList.innerHTML = '';

    if (state.slips.length === 0) {
        allSlipsList.innerHTML = '<p class="text-slate-500 text-sm">本日の伝票はありません。</p>';
        return;
    }

    // (変更) 伝票を新しい順（ダミーデータなので現状のまま）に表示
    state.slips.forEach(slip => {
        let statusColor, statusText;
        switch (slip.status) {
            case 'active':
                statusColor = 'blue'; statusText = '利用中'; break;
            case 'checkout':
                statusColor = 'orange'; statusText = '会計待ち'; break;
            case 'paid':
                statusColor = 'gray'; statusText = '会計済み'; break;
        }
        const nominationText = slip.nomination || 'フリー';
        const total = calculateSlipTotal(slip); // (新規) 合計金額を計算
        const paidAmount = slip.paidAmount || 0;

        const card = `
            <button class="w-full text-left p-4 bg-white rounded-lg shadow-md border hover:bg-slate-50" 
                    data-slip-id="${slip.slipId}" data-status="${slip.status}">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xl font-bold">
                        <i class="fa-solid fa-table fa-fw text-slate-400 mr-2"></i>${slip.tableId} - ${slip.name || 'ゲスト'}
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
            </button>
        `;
        allSlipsList.innerHTML += card;
    });

    // クリックイベント
    allSlipsList.querySelectorAll('button[data-slip-id]').forEach(card => {
        card.addEventListener('click', () => {
            const slipId = card.dataset.slipId;
            const status = card.dataset.status;
            if (status === 'paid') {
                handlePaidSlipClick(slipId); // (新規) 会計済み伝票の処理
            } else {
                handleSlipClick(slipId); // (既存) 未会計伝票の処理
            }
        });
    });
};


/**
 * 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    // (変更) currentSlipId から伝票データを取得
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;
    
    // (変更) 伝票のテーブルIDとお客様名を表示
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (${slipData.name})`;

    // (変更) 顧客情報を入力フォームに設定
    orderCustomerNameInput.value = slipData.name || '';
    orderGuestsInput.value = slipData.guests || 1;
    orderNominationInput.value = slipData.nomination || 'フリー';
    
    // 注文リストを描画
    orderItemsList.innerHTML = '';
    let subtotal = 0;
    // (変更) slipData.items を参照
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
        orderItemsList.innerHTML += `
            <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border">
                <div>
                    <p class="font-semibold">${item.name}</p>
                    <p class="text-sm text-slate-500">${formatCurrency(item.price)}</p>
                </div>
                <div class="flex items-center space-x-3">
                    <input type="number" value="${item.qty}" class="w-16 p-1 border rounded text-center">
                    <span class="font-semibold w-20 text-right">${formatCurrency(item.price * item.qty)}</span>
                    <button class="text-red-500 hover:text-red-700" data-item-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    orderSubtotalEl.textContent = formatCurrency(subtotal);

    // メニュー選択グリッドを描画 (初回のみ)
    if (menuOrderGrid.children.length === 0) {
        const allMenuItems = [
            ...state.menu.set, 
            ...state.menu.drink, 
            ...state.menu.bottle
        ];
        allMenuItems.forEach(item => {
            menuOrderGrid.innerHTML += `
                <button class="menu-order-btn p-3 bg-white rounded-lg shadow border text-left hover:bg-slate-100" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}">
                    <p class="font-semibold text-sm">${item.name}</p>
                    <p class="text-xs text-slate-500">${formatCurrency(item.price)}</p>
                </button>
            `;
        });
        
        // メニューアイテムクリックイベント
        document.querySelectorAll('.menu-order-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                addOrderItem(
                    parseInt(btn.dataset.itemId),
                    btn.dataset.itemName,
                    parseInt(btn.dataset.itemPrice)
                );
            });
        });
    }
};

/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する
 */
const updateSlipInfo = () => {
    // (変更) currentSlipId から伝票データを取得
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    slipData.name = orderCustomerNameInput.value;
    slipData.guests = parseInt(orderGuestsInput.value) || 1;
    slipData.nomination = orderNominationInput.value || 'フリー';

    // (変更) ダッシュボードの伝票一覧のみ再描画
    renderDashboardSlips();
    renderAllSlipsPage(); // (追加) 伝票一覧ページも更新
};


/**
 * 注文リストにアイテムを追加する
 * @param {number} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = (id, name, price) => {
    // (変更) currentSlipId から伝票データを取得
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    renderOrderModal(); // 注文リストを再描画
};

/**
 * (新規) 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = () => {
    // (変更) currentSlipId から伝票データを取得
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    // (変更) 伝票ステータスを 'checkout' (会計待ち) に更新
    slipData.status = 'checkout';
    renderDashboardSlips(); // ダッシュボードのステータス表示を更新
    renderTableGrid(); // テーブルのバッジ数更新（色が変わるわけではないが念のため）
    renderAllSlipsPage(); // (追加) 伝票一覧ページも更新

    // プレビューモーダルのタイトル
    document.getElementById('slip-preview-title').textContent = `伝票プレビュー (${slipData.tableId} - ${slipData.name})`;
    
    // 発行日時
    const now = new Date();
    document.getElementById('slip-datetime').textContent = now.toLocaleString('ja-JP');

    // 顧客情報
    document.getElementById('slip-table-id').textContent = slipData.tableId;
    document.getElementById('slip-customer-name').textContent = slipData.name || 'ゲスト';
    document.getElementById('slip-guests').textContent = slipData.guests || 0;
    document.getElementById('slip-nomination').textContent = slipData.nomination || 'フリー';

    // 注文明細
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
    
    // 金額計算
    const serviceCharge = subtotal * DUMMY_SERVICE_CHARGE_RATE;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * DUMMY_TAX_RATE;
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount; // (変更) 今回ご請求額

    // 金額反映
    slipSubtotalEl.textContent = formatCurrency(subtotal);
    slipServiceChargeEl.textContent = formatCurrency(serviceCharge);
    slipTaxEl.textContent = formatCurrency(tax);
    slipPaidAmountEl.textContent = formatCurrency(paidAmount); // (新規)
    slipTotalEl.textContent = formatCurrency(billingAmount); // (変更)
};


/**
 * 会計モーダルを描画する
 */
const renderCheckoutModal = () => {
    // (変更) currentSlipId から伝票データを取得
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    checkoutModalTitle.textContent = `テーブル ${slipData.tableId} (${slipData.name}) - お会計`;
    
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
    
    const serviceCharge = subtotal * DUMMY_SERVICE_CHARGE_RATE;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * DUMMY_TAX_RATE;
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount; // (変更) 今回ご請求額

    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(serviceCharge);
    checkoutTaxEl.textContent = formatCurrency(tax);
    checkoutPaidAmountEl.textContent = formatCurrency(paidAmount); // (新規)
    checkoutTotalEl.textContent = formatCurrency(billingAmount); // (変更)
    
    // 領収書モーダルの金額も更新 (領収書に載せるのは「今回支払う金額」)
    document.getElementById('receipt-total').textContent = formatCurrency(billingAmount);
};

/**
 * 領収書モーダルを描画する
 */
const renderReceiptModal = () => {
    const now = new Date();
    document.getElementById('receipt-date').textContent = now.toLocaleDateString('ja-JP');
    
    // (変更) currentSlipId から伝票データを取得
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (slipData) {
        // 領収書の宛名を伝票のお客様名で初期化
        document.querySelector('#receipt-content input[type="text"]').value = slipData.name || '';
    }
    
    // (renderCheckoutModal内で既に金額はセットされている)
};

/**
 * モーダルを開く
 * @param {HTMLElement} modalElement 
 */
const openModal = (modalElement) => {
    modalElement.classList.add('active');
};

/**
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    modalElement.classList.remove('active');
};

/**
 * (新規) 新しい伝票を作成し、伝票モーダルを開く
 * @param {string} tableId 
 */
const createNewSlip = (tableId) => {
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;

    // 新しい伝票を作成
    const newSlip = {
        slipId: getUUID(),
        tableId: tableId,
        status: 'active',
        guests: 1,
        name: "新規のお客様",
        startTime: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        nomination: "フリー",
        items: [],
        paidAmount: 0 // (新規)
    };
    
    state.slips.push(newSlip);
    state.currentSlipId = newSlip.slipId;

    // テーブルのステータスを利用中に更新
    table.status = 'occupied';

    // UIを更新
    renderTableGrid();
    renderDashboardSlips();
    renderAllSlipsPage(); // (追加)
    
    // 伝票モーダルを開く
    renderOrderModal();
    openModal(orderModal);
};

/**
 * (新規) 伝票選択モーダルを描画する
 * @param {string} tableId 
 */
const renderSlipSelectionModal = (tableId) => {
    slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    slipSelectionList.innerHTML = ''; // リストをクリア

    // 該当テーブルの未会計伝票を検索
    const activeSlips = state.slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    );

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
            const nominationText = slip.nomination || 'フリー';

            slipSelectionList.innerHTML += `
                <button class="w-full text-left p-4 bg-slate-50 rounded-lg hover:bg-slate-100 border" data-slip-id="${slip.slipId}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-lg truncate">${slip.name} (${nominationText})</span>
                        <span class="text-sm font-medium text-${statusColor}-600 bg-${statusColor}-100 px-2 py-1 rounded-full">${statusText}</span>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">${slip.guests}名様 / ${slip.startTime}〜</p>
                </button>
            `;
        });
    }

    // 伝票リストのクリックイベント
    slipSelectionList.querySelectorAll('button[data-slip-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            handleSlipClick(btn.dataset.slipId);
            closeModal(slipSelectionModal);
        });
    });

    // 「新規作成」ボタンのイベント (既存のものを使い回す)
    createNewSlipBtn.onclick = () => {
        createNewSlip(tableId);
        closeModal(slipSelectionModal);
    };

    openModal(slipSelectionModal);
};

/**
 * (新規) 新規伝票の作成確認モーダルを描画・表示する
 * @param {string} tableId 
 */
const renderNewSlipConfirmModal = (tableId) => {
    newSlipConfirmTitle.textContent = `伝票の新規作成 (${tableId})`;
    newSlipConfirmMessage.textContent = `テーブル ${tableId} で新しい伝票を作成しますか？`;

    // (重要) クリックイベントを一度クリアしてから再設定する（多重実行防止）
    confirmCreateSlipBtn.onclick = null; 
    confirmCreateSlipBtn.onclick = () => {
        createNewSlip(tableId);
        closeModal(newSlipConfirmModal);
    };

    openModal(newSlipConfirmModal);
};


/**
 * (変更) テーブルカードクリック時の処理
 * @param {string} tableId 
 */
const handleTableClick = (tableId) => {
    const tableData = state.tables.find(t => t.id === tableId);
    if (!tableData) return;

    if (tableData.status === 'available') {
        // (変更) 空席の場合は、即座に作成せず、確認モーダルを出す
        renderNewSlipConfirmModal(tableId);
    } else {
        // 利用中の場合は、伝票選択モーダルを開く
        renderSlipSelectionModal(tableId);
    }
};

/**
 * (新規) 未会計伝票カードクリック時の処理 (ダッシュボード、伝票一覧ページなど)
 * @param {string} slipId 
 */
const handleSlipClick = (slipId) => {
    const slipData = state.slips.find(s => s.slipId === slipId);
    if (!slipData) return;

    state.currentSlipId = slipId;
    renderOrderModal();
    openModal(orderModal);
};

/**
 * (新規) 会計済み伝票カードクリック時の処理 (伝票一覧ページ)
 * @param {string} slipId 
 */
const handlePaidSlipClick = (slipId) => {
    state.currentSlipId = slipId;
    
    // (重要) 領収書モーダルは「今回ご請求額」を表示してしまうため、
    // 先に会計モーダルを描画（計算）させてから、領収書モーダルを描画する
    // (この時点で billingAmount は 0 になるはず)
    renderCheckoutModal(); 
    renderReceiptModal();
    openModal(receiptModal);
};


/**
 * (新規) キャストランキングを描画する
 */
const renderCastRanking = () => {
    const { period, type } = state.ranking;
    const data = dummyRankingData[period][type];
    
    if (!castRankingList || !data) {
        castRankingList.innerHTML = '<p class="text-slate-500 text-sm">データがありません。</p>';
        return;
    }

    castRankingList.innerHTML = ''; // クリア
    data.forEach((cast, index) => {
        const rank = index + 1;
        let rankColor = 'text-slate-400';
        if (rank === 1) rankColor = 'text-yellow-500';
        if (rank === 2) rankColor = 'text-gray-400';
        if (rank === 3) rankColor = 'text-amber-700';

        const valueString = cast.unit === '円' ? formatCurrency(cast.value) : `${cast.value} ${cast.unit}`;

        castRankingList.innerHTML += `
            <li class="flex items-center space-x-2">
                <span class="font-bold text-lg w-6 text-center ${rankColor}">
                    ${rank}
                </span>
                <div class="flex-1 ml-2">
                    <p class="font-semibold">${cast.name}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-sm text-blue-600">${valueString}</p>
                </div>
            </li>
        `;
    });
};


// --- イベントリスナー ---

// DOM読み込み完了時
document.addEventListener('DOMContentLoaded', () => {
    switchPage('dashboard');
    renderTableGrid(); // テーブル管理ページ（非表示）の初期化もしておく
    renderCastRanking();
    renderDashboardSlips(); // (変更) ダッシュボードの伝票一覧を初期描画
    renderAllSlipsPage(); // (新規) 伝票一覧ページも初期化
});

// ナビゲーションリンク
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.dataset.target;
        switchPage(targetPage);
    });
});

// メニュー管理タブ
menuTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetContentId = tab.dataset.target;

        menuTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        menuTabContents.forEach(content => {
            if (content.id === targetContentId) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    });
});

// (変更) モーダルを閉じるボタン
modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // (変更) すべてのモーダルを閉じるように対象を追加
        closeModal(orderModal);
        closeModal(checkoutModal);
        closeModal(receiptModal);
        closeModal(slipPreviewModal);
        closeModal(slipSelectionModal); // (追加)
        closeModal(newSlipConfirmModal); // (追加)
    });
});

// (変更) 伝票モーダルの顧客情報入力イベント
if (orderCustomerNameInput) {
    orderCustomerNameInput.addEventListener('change', updateSlipInfo);
}
if (orderGuestsInput) {
    orderGuestsInput.addEventListener('change', updateSlipInfo);
}
if (orderNominationInput) {
    orderNominationInput.addEventListener('change', updateSlipInfo);
}


// (変更) 伝票モーダル -> 伝票プレビューモーダル
if (openSlipPreviewBtn) {
    openSlipPreviewBtn.addEventListener('click', () => {
        // (変更) 最新の伝票情報を保存
        updateSlipInfo();
        // (変更) 会計モーダルの前にプレビューモーダルを描画・表示
        renderSlipPreviewModal(); 
        closeModal(orderModal);
        openModal(slipPreviewModal);
    });
}

// (新規) 伝票プレビューモーダル -> 印刷
if (printSlipBtn) {
    printSlipBtn.addEventListener('click', () => {
        window.print(); // ブラウザの印刷ダイアログを呼び出す
    });
}

// (新規) 伝票プレビューモーダル -> 会計モーダル
if (goToCheckoutBtn) {
    goToCheckoutBtn.addEventListener('click', () => {
        renderCheckoutModal();
        closeModal(slipPreviewModal);
        openModal(checkoutModal);
    });
}


// (変更) 会計モーダル -> 領収書モーダル
if (processPaymentBtn) {
    processPaymentBtn.addEventListener('click', () => {
        // (変更) 領収書モーダルを描画
        renderReceiptModal();
        closeModal(checkoutModal);
        openModal(receiptModal);
        
        // (変更) 伝票のステータスと支払い済み金額を更新
        const slip = state.slips.find(s => s.slipId === state.currentSlipId);
        if (slip) {
            
            // (変更) paidAmount を更新するために合計金額を再計算
            const total = calculateSlipTotal(slip);

            // (変更) 支払い済み金額を、その時点での総合計金額で更新する
            slip.paidAmount = total; 
            
            // (変更) ステータスを 'paid' に変更
            slip.status = 'paid';
            
            // (変更) このテーブルに他の未会計伝票が残っているか確認
            const otherActiveSlips = getActiveSlipCount(slip.tableId);
            
            if (otherActiveSlips === 0) {
                // 他に伝票がなければテーブルを「空席」にする
                const table = state.tables.find(t => t.id === slip.tableId);
                if (table) {
                    table.status = 'available';
                }
            }
            
            // UIをすべて更新
            renderTableGrid();
            renderDashboardSlips();
            renderAllSlipsPage();
        }
    });
}

// (新規) 領収書モーダル -> 伝票復活
if (reopenSlipBtn) {
    reopenSlipBtn.addEventListener('click', () => {
        const slip = state.slips.find(s => s.slipId === state.currentSlipId);
        if (slip) {
            slip.status = 'active'; // ステータスを 'active' に戻す
            
            const table = state.tables.find(t => t.id === slip.tableId);
            if (table) {
                table.status = 'occupied'; // テーブルも 'occupied' に戻す
            }
            
            // UIをすべて更新
            renderTableGrid();
            renderDashboardSlips();
            renderAllSlipsPage();
            
            // 全モーダルを閉じてから、注文モーダルを開き直す
            closeModal(receiptModal);
            handleSlipClick(state.currentSlipId); // 注文モーダルを開く
        }
    });
}


// 領収書モーダルを閉じた時 (伝票モーダルにも会計モーダルにも戻らない)
if (receiptModal) {
    receiptModal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(receiptModal);
        });
    });
}

// 会計モーダル: 支払い方法選択
paymentMethodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        paymentMethodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Ranking 期間切り替え
if (rankingPeriodSelect) {
    rankingPeriodSelect.addEventListener('change', (e) => {
        state.ranking.period = e.target.value;
        renderCastRanking();
    });
}


// Ranking 集計対象切り替え
rankingTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        rankingTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.ranking.type = btn.dataset.type;
        renderCastRanking();
    });
});

