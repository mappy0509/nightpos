// ===== グローバル定数・変数 =====
const DUMMY_SERVICE_CHARGE_RATE = 0.20; // サービス料 20%
const DUMMY_TAX_RATE = 0.10; // 消費税 10%

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (変更) アプリケーションの状態管理
const state = {
    currentPage: 'dashboard',
    currentStore: 'store1',
    slipCounter: 3, // (新規) 伝票番号カウンター (既存の伝票数で初期化)
    casts: [ // (新規) キャストマスタ
        { id: 'c1', name: 'あい' },
        { id: 'c2', name: 'みう' },
        { id: 'c3', name: 'さくら' },
        { id: 'c4', name: 'れな' },
        { id: 'c5', name: 'ひな' },
        { id: 'c6', name: '体験A' },
    ],
    customers: [ // (新規) 顧客マスタ (既存の伝票から自動生成)
        { id: 'cust1', name: '鈴木様' },
        { id: 'cust2', name: '田中様' },
        { id: 'cust3', name: '佐藤様' },
    ],
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
            slipNumber: 1, // (新規) 伝票番号
            tableId: 'V1', 
            status: 'active', // 'active', 'checkout', 'paid', 'cancelled'
            guests: 1, // (変更) 1伝票1名のため 1 で固定
            name: '鈴木様', 
            startTime: '20:30', 
            nomination: 'あい', 
            items: [
                { id: 'm1', name: '基本セット (指名)', price: 10000, qty: 1 },
                { id: 'm7', name: 'キャストドリンク', price: 1500, qty: 2 },
                { id: 'm10', name: '鏡月 (ボトル)', price: 8000, qty: 1 },
            ],
            paidAmount: 0, // (新規) 支払い済み金額
            cancelReason: null, // (新規) ボツ伝理由
            paymentDetails: { cash: 0, card: 0, credit: 0 } // (新規) 支払い内訳
        },
        { 
            slipId: 'slip-3', 
            slipNumber: 2, // (新規) 伝票番号
            tableId: 'V3', 
            status: 'checkout', 
            guests: 1, // (変更) 1伝票1名のため 1 で固定
            name: '田中様', 
            startTime: '21:00', 
            nomination: 'フリー', 
            items: [
                { id: 'm2', name: '基本セット (フリー)', price: 8000, qty: 1 }, // (変更) qty: 3 -> 1
                { id: 'm8', name: 'ビール', price: 1000, qty: 6 },
            ],
            paidAmount: 0, // (新規) 支払い済み金額
            cancelReason: null, // (新規) ボツ伝理由
            paymentDetails: { cash: 0, card: 0, credit: 0 } // (新規) 支払い内訳
        },
        { 
            slipId: 'slip-4', 
            slipNumber: 3, // (新規) 伝票番号
            tableId: 'T2', 
            status: 'active', 
            guests: 1, // (変更) 1伝票1名のため 1 で固定
            name: '佐藤様', 
            startTime: '22:15', 
            nomination: 'みう', 
            items: [
                { id: 'm1', name: '基本セット (指名)', price: 10000, qty: 1 }, // (変更) qty: 2 -> 1
                { id: 'm12', name: 'シャンパン (ゴールド)', price: 50000, qty: 1 },
                { id: 'm7', name: 'キャストドリンク', price: 1500, qty: 8 },
            ],
            paidAmount: 0, // (新規) 支払い済み金額
            cancelReason: null, // (新規) ボツ伝理由
            paymentDetails: { cash: 0, card: 0, credit: 0 } // (新規) 支払い内訳
        },
    ],
    // (変更) メニューデータをカテゴリ別に整理し、ユニークIDを付与
    menu: {
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', name: '基本セット (フリー)', price: 8000, duration: 60 },
            { id: 'm3', name: '延長 (自動)', price: 5000, duration: 30 },
        ],
        drink: [
            { id: 'm7', name: 'キャストドリンク', price: 1500 },
            { id: 'm8', name: 'ビール', price: 1000 },
            { id: 'm9', name: 'カクテル各種', price: 1200 },
            { id: 'm10', name: 'ソフトドリンク', price: 800 },
        ],
        bottle: [
            { id: 'm11', name: '鏡月 (ボトル)', price: 8000 },
            { id: 'm12', name: 'シャンパン (ゴールド)', price: 50000 },
            { id: 'm13', name: '黒霧島 (ボトル)', price: 8000 },
        ],
        food: [
            { id: 'm4', name: '乾き物盛り合わせ', price: 2000 },
            { id: 'm5', name: 'フルーツ盛り', price: 8000 },
        ],
        cast: [
            { id: 'm14', name: '本指名料', price: 3000 },
            { id: 'm15', name: '場内指名料', price: 2000 },
            { id: 'm16', name: '同伴料', price: 5000 },
        ],
        other: [
            { id: 'm6', name: 'カラオケ', price: 1000 },
            { id: 'm17', name: 'VIPチャージ', price: 10000 },
        ]
    },
    currentSlipId: null, 
    currentEditingMenuId: null, // (新規) メニュー編集用
    currentBillingAmount: 0, // (新規) 会計モーダル用の現在請求額
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
// (変更) DOM要素の取得は DOMContentLoaded 内で行うように変更
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
 * (新規) 伝票の合計金額（割引前）を計算する
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
    const serviceCharge = subtotal * DUMMY_SERVICE_CHARGE_RATE;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * DUMMY_TAX_RATE;
    const total = subtotalWithService + tax;
    return Math.round(total);
};


/**
 * ページを切り替える
 * @param {string} targetPageId 表示するページのID
 */
const switchPage = (targetPageId) => {
    state.currentPage = targetPageId;

    pages.forEach(page => {
        if (page.id === targetPageId) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });

    let targetTitle = '';
    navLinks.forEach(link => {
        if (link.dataset.target === targetPageId) {
            link.classList.add('active');
            targetTitle = link.querySelector('span').textContent;
        } else {
            link.classList.remove('active');
        }
    });

    pageTitle.textContent = targetTitle;

    // (変更) ページ切り替え時にも描画関数を呼ぶ
    if (targetPageId === 'dashboard') {
        renderDashboardSlips();
    }
    if (targetPageId === 'all-slips') {
        renderAllSlipsPage();
    }
    if (targetPageId === 'menu') {
        renderMenuTabs();
    }
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
* (共通) テーブルカードのHTMLを生成する
* @param {object} table テーブルデータ
* @returns {string} HTML文字列
*/
const createTableCardHTML = (table) => {
    let statusColor, statusText;
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
    
    const activeSlips = getActiveSlipCount(table.id);

    return `
        <button class="table-card p-4 rounded-lg shadow-md border-2 transition-transform transform hover:scale-105" 
                data-table-id="${table.id}" 
                data-status="${table.status}">
            
            ${activeSlips > 0 ? `<div class="slip-count-badge">${activeSlips}</div>` : ''}

            <div class="flex justify-between items-center mb-3">
                <span class="text-2xl font-bold">${table.id}</span>
                <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
            </div>
            ${table.status !== 'available' ? `
            <div class="text-left h-16">
                <p class="text-sm text-slate-500">クリックして伝票を管理</p>
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
    tableGrid.innerHTML = ''; 

    state.tables.forEach(table => {
        tableGrid.innerHTML += createTableCardHTML(table);
    });

    tableGrid.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', () => {
            handleTableClick(card.dataset.tableId);
        });
    });
};

/**
 * (変更) ダッシュボードに未会計「伝票」一覧を描画する (ボツ伝は除外)
 */
const renderDashboardSlips = () => {
    if (!dashboardSlips) return;
    dashboardSlips.innerHTML = ''; 

    const activeSlips = state.slips.filter(
        slip => slip.status === 'active' || slip.status === 'checkout'
    );

    if (activeSlips.length === 0) {
        dashboardSlips.innerHTML = '<p class="text-slate-500 text-sm md:col-span-2">現在、未会計の伝票はありません。</p>';
        return;
    }

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
                        <i class="fa-solid fa-table fa-fw text-slate-400 mr-1"></i>${slip.tableId} (No.${slip.slipNumber})
                    </span>
                    <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
                </div>
                <div class="text-left">
                    <p class="text-sm font-medium truncate">${slip.name || 'ゲスト'}</p>
                    <p class="text-xs text-slate-500">${slip.startTime || '??:??'}〜</p>
                    <p class="text-xs text-pink-600 font-medium mt-1 truncate"><i class="fa-solid fa-star fa-fw mr-1"></i>${nominationText}</p>
                </div>
            </button>
        `;
        dashboardSlips.innerHTML += card;
    });

    dashboardSlips.querySelectorAll('button[data-slip-id]').forEach(card => {
        card.addEventListener('click', () => {
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
        const nominationText = slip.nomination || 'フリー';
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

    allSlipsList.querySelectorAll('button[data-slip-id]').forEach(card => {
        card.addEventListener('click', () => {
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
    });
};


/**
 * 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    // --- キャストドロップダウン生成 ---
    orderNominationSelect.innerHTML = '<option value="フリー">フリー</option>';
    state.casts.forEach(cast => {
        orderNominationSelect.innerHTML += `<option value="${cast.name}">${cast.name}</option>`;
    });
    orderNominationSelect.value = slipData.nomination || 'フリー';

    // --- 顧客ドロップダウン生成 ---
    orderCustomerNameSelect.innerHTML = '';
    state.customers.forEach(customer => {
        orderCustomerNameSelect.innerHTML += `<option value="${customer.name}">${customer.name}</option>`;
    });
    orderCustomerNameSelect.innerHTML += `<option value="new_customer" class="text-blue-600 font-bold">--- 新規顧客を追加 ---</option>`;
    
    if (state.customers.find(c => c.name === slipData.name)) {
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
    // 毎回クリアして、メニュー管理で変更があった場合に備える
    menuOrderGrid.innerHTML = '';
    const allMenuItems = [
        ...state.menu.set, 
        ...state.menu.drink, 
        ...state.menu.bottle,
        ...state.menu.food,
        ...state.menu.cast,
        ...state.menu.other
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
};

/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する
 */
const updateSlipInfo = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const customerName = orderCustomerNameSelect.value;
    const nominationName = orderNominationSelect.value;

    if (customerName !== 'new_customer') {
        slipData.name = customerName;
    }
    slipData.nomination = nominationName;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    renderDashboardSlips();
    renderAllSlipsPage();
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
    
    // 削除後にモーダルを再描画
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
    
    // 数量変更後にモーダルを再描画
    renderOrderModal();
};

/**
 * (新規) メニュー管理タブとリストを描画する
 */
const renderMenuTabs = () => {
    if (!menuTabsContainer) return; // (追加) 念のため
    
    const activeTab = menuTabsContainer.querySelector('.menu-tab.active');
    const activeCategory = activeTab ? activeTab.dataset.category : 'set';

    // 全てのタブコンテンツを非表示に
    menuTabContents.forEach(content => content.classList.remove('active'));
    
    // 対応するタブコンテンツを表示
    const activeContent = document.getElementById(`tab-${activeCategory}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // 各カテゴリのリストを描画
    renderMenuList('set', setMenuTbody);
    renderMenuList('drink', drinkMenuTbody);
    renderMenuList('bottle', bottleMenuTbody);
    renderMenuList('food', foodMenuTbody);
    renderMenuList('cast', castMenuTbody);
    renderMenuList('other', otherMenuTbody);
};

/**
 * (新規) 指定されたカテゴリのメニューリストを描画する
 * @param {string} category メニューカテゴリ ('set', 'drink' など)
 * @param {HTMLElement} tbodyElement 描画先の tbody 要素
 */
const renderMenuList = (category, tbodyElement) => {
    if (!tbodyElement) return;
    tbodyElement.innerHTML = '';

    const items = state.menu[category] || [];
    
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
    state.currentEditingMenuId = null;
    
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
        // 全カテゴリから該当IDのアイテムを検索
        for (const cat of Object.keys(state.menu)) {
            const found = state.menu[cat].find(item => item.id === menuId);
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
            // 見つからなかった場合（エラー）
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

    // バリデーション
    if (name === "" || isNaN(price) || price <= 0) {
        menuEditorError.textContent = "項目名と有効な料金を入力してください。";
        return;
    }

    const newItemData = {
        id: state.currentEditingMenuId || getUUID(), // 編集時は既存ID、新規時は新ID
        name: name,
        price: price,
    };

    if (category === 'set') {
        newItemData.duration = duration;
    }

    if (state.currentEditingMenuId) {
        // --- 編集モード ---
        let found = false;
        // 元のカテゴリからアイテムを探して更新
        for (const cat of Object.keys(state.menu)) {
            const index = state.menu[cat].findIndex(item => item.id === state.currentEditingMenuId);
            if (index !== -1) {
                const originalCategory = cat;
                
                if (originalCategory === category) {
                    // カテゴリに変更なし
                    state.menu[originalCategory][index] = newItemData;
                } else {
                    // カテゴリが変更された
                    state.menu[originalCategory].splice(index, 1); // 元のカテゴリから削除
                    state.menu[category].push(newItemData); // 新しいカテゴリに追加
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

    // 後処理
    menuEditorError.textContent = '';
    state.currentEditingMenuId = null;
    closeModal(menuEditorModal);
    renderMenuTabs(); // メニューリストを再描画
    menuOrderGrid.innerHTML = ''; // 注文用グリッドをリセット（次回更新）
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
    
    state.menu[category] = state.menu[category].filter(item => item.id !== menuId);
    
    renderMenuTabs(); // メニューリストを再描画
    menuOrderGrid.innerHTML = ''; // 注文用グリッドをリセット（次回更新）
};


/**
 * (新規) 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = () => {
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    // (変更) 伝票プレビュー時にステータスを 'checkout' に変更
    slipData.status = 'checkout';
    renderDashboardSlips();
    renderTableGrid();
    renderAllSlipsPage();

    document.getElementById('slip-preview-title').textContent = `伝票プレビュー (No.${slipData.slipNumber})`;
    
    const now = new Date();
    document.getElementById('slip-datetime').textContent = now.toLocaleString('ja-JP');

    document.getElementById('slip-slip-number').textContent = slipData.slipNumber;
    document.getElementById('slip-table-id').textContent = slipData.tableId;
    document.getElementById('slip-customer-name').textContent = slipData.name || 'ゲスト';
    document.getElementById('slip-nomination').textContent = slipData.nomination || 'フリー';

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
    
    const serviceCharge = subtotal * DUMMY_SERVICE_CHARGE_RATE;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * DUMMY_TAX_RATE;
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
    
    const serviceCharge = subtotal * DUMMY_SERVICE_CHARGE_RATE;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * DUMMY_TAX_RATE;
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount; 

    // (新規) 割引ロジック（ダミー、未実装）
    // const discount = 0;
    // const finalBillingAmount = billingAmount - discount;
    const finalBillingAmount = billingAmount; // 割引未実装のため

    // (新規) 請求額をstateに保持
    state.currentBillingAmount = finalBillingAmount;

    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(serviceCharge);
    checkoutTaxEl.textContent = formatCurrency(tax);
    checkoutPaidAmountEl.textContent = formatCurrency(paidAmount);
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount); // (変更)
    
    // (新規) 支払い入力欄をリセット
    paymentCashInput.value = '';
    paymentCardInput.value = '';
    paymentCreditInput.value = '';

    // (新規) 支払いサマリーを計算・更新
    updatePaymentStatus(); 

    // 領収書モーダルの金額も更新 (領収書に載せるのは「今回支払う金額」)
    document.getElementById('receipt-total').textContent = formatCurrency(finalBillingAmount);
};

/**
 * (新規) 会計モーダルの支払い状況を計算・更新する
 */
const updatePaymentStatus = () => {
    const billingAmount = state.currentBillingAmount;

    // || 0 をつけて、入力が空 (NaN) の場合に 0 として扱う
    const cashPayment = parseInt(paymentCashInput.value) || 0;
    const cardPayment = parseInt(paymentCardInput.value) || 0;
    const creditPayment = parseInt(paymentCreditInput.value) || 0;

    const totalPayment = cashPayment + cardPayment + creditPayment;
    
    let shortage = 0;
    let change = 0;

    // 支払い合計が請求額に達しているか
    if (totalPayment >= billingAmount) {
        shortage = 0;
        // (変更) お釣りの計算ロジックを修正
        const cashDue = billingAmount - cardPayment - creditPayment;
        if (cashPayment > cashDue && cashDue >= 0) {
            // 現金支払い額が (請求額 - カード - 売掛) より多い場合
            change = cashPayment - cashDue;
        } else if (cashPayment > 0 && cashDue < 0) {
            // カード・売掛だけで請求額を超え、さらに現金も払った場合 (現金全額がお釣り)
             change = cashPayment;
        }
        else {
            change = 0;
        }
    } else {
        // 不足している場合
        shortage = billingAmount - totalPayment;
        change = 0;
    }

    // UIに反映
    checkoutPaymentTotalEl.textContent = formatCurrency(totalPayment);
    checkoutShortageEl.textContent = formatCurrency(shortage);
    checkoutChangeEl.textContent = formatCurrency(change);

    // 会計確定ボタンの制御
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
    
    // (renderCheckoutModal内で既に金額はセットされている)
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
 * (新規) 新しい伝票を作成し、伝票モーダルを開く
 * @param {string} tableId 
 */
const createNewSlip = (tableId) => {
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;

    state.slipCounter += 1;
    const newSlipNumber = state.slipCounter;

    const newSlip = {
        slipId: getUUID(),
        slipNumber: newSlipNumber,
        tableId: tableId,
        status: 'active',
        guests: 1,
        name: "新規のお客様",
        startTime: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        nomination: "フリー",
        items: [],
        paidAmount: 0,
        cancelReason: null,
        paymentDetails: { cash: 0, card: 0, credit: 0 } // (新規)
    };
    
    state.slips.push(newSlip);
    state.currentSlipId = newSlip.slipId;

    table.status = 'occupied';

    renderTableGrid();
    renderDashboardSlips();
    renderAllSlipsPage();
    
    renderOrderModal();
    openModal(orderModal);
};

/**
 * (新規) 伝票選択モーダルを描画する
 * @param {string} tableId 
 */
const renderSlipSelectionModal = (tableId) => {
    slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    slipSelectionList.innerHTML = '';

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
                        <span class="font-semibold text-lg truncate">(No.${slip.slipNumber}) ${slip.name} (${nominationText})</span>
                        <span class="text-sm font-medium text-${statusColor}-600 bg-${statusColor}-100 px-2 py-1 rounded-full">${statusText}</span>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">${slip.startTime}〜</p>
                </button>
            `;
        });
    }

    slipSelectionList.querySelectorAll('button[data-slip-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            handleSlipClick(btn.dataset.slipId);
            closeModal(slipSelectionModal);
        });
    });

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
        renderNewSlipConfirmModal(tableId);
    } else {
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

    castRankingList.innerHTML = '';
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

// (変更) DOM読み込み完了時にDOM要素の取得とイベントリスナーの設定を行う
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    navLinks = document.querySelectorAll('.nav-link');
    pages = document.querySelectorAll('[data-page]');
    pageTitle = document.getElementById('page-title');
    tableGrid = document.getElementById('table-grid');
    dashboardSlips = document.getElementById('dashboard-slips');
    menuTabsContainer = document.getElementById('menu-tabs');
    menuTabs = document.querySelectorAll('.menu-tab');
    menuTabContents = document.querySelectorAll('.menu-tab-content');
    menuPage = document.getElementById('menu');
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
    castRankingList = document.getElementById('cast-ranking-list');
    rankingPeriodSelect = document.getElementById('ranking-period-select');
    rankingTypeBtns = document.querySelectorAll('.ranking-type-btn');

    // ===== 初期化処理 =====
    switchPage('dashboard');
    renderTableGrid();
    renderCastRanking();
    renderDashboardSlips();
    renderAllSlipsPage();
    renderMenuTabs(); 
    
    // ===== イベントリスナーの設定 =====

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
            
            menuTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            renderMenuTabs();
        });
    });

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

    // 伝票モーダルの顧客情報入力イベント
    if (orderCustomerNameSelect) {
        orderCustomerNameSelect.addEventListener('change', (e) => {
            if (e.target.value === 'new_customer') {
                newCustomerInputGroup.classList.remove('hidden');
                newCustomerNameInput.value = '';
                newCustomerError.textContent = '';
                newCustomerNameInput.focus();
            } else {
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                updateSlipInfo();
            }
        });
    }

    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', updateSlipInfo);
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

            const newCustomer = { id: getUUID(), name: newName };
            state.customers.push(newCustomer);
            
            const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slipData) {
                slipData.name = newName;
            }
            
            renderOrderModal();
            
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
                
                const otherActiveSlips = getActiveSlipCount(slip.tableId);
                
                if (otherActiveSlips === 0) {
                    const table = state.tables.find(t => t.id === slip.tableId);
                    if (table) {
                        table.status = 'available';
                    }
                }
                
                renderTableGrid();
                renderDashboardSlips();
                renderAllSlipsPage();

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
            renderReceiptModal();
            closeModal(checkoutModal);
            openModal(receiptModal);
            
            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slip) {
                
                const total = calculateSlipTotal(slip);

                slip.paidAmount = total; 
                
                slip.paymentDetails = {
                    cash: parseInt(paymentCashInput.value) || 0,
                    card: parseInt(paymentCardInput.value) || 0,
                    credit: parseInt(paymentCreditInput.value) || 0
                };
                
                slip.status = 'paid';
                
                const otherActiveSlips = getActiveSlipCount(slip.tableId);
                
                if (otherActiveSlips === 0) {
                    const table = state.tables.find(t => t.id === slip.tableId);
                    if (table) {
                        table.status = 'available';
                    }
                }
                
                renderTableGrid();
                renderDashboardSlips();
                renderAllSlipsPage();
            }
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
                
                const table = state.tables.find(t => t.id === slip.tableId);
                if (table) {
                    table.status = 'occupied';
                }
                
                renderTableGrid();
                renderDashboardSlips();
                renderAllSlipsPage();
                
                closeModal(receiptModal);
                handleSlipClick(state.currentSlipId);
            }
        });
    }

    // 領収書モーダルを閉じた時
    if (receiptModal) {
        receiptModal.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(receiptModal);
            });
        });
    }

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

