// ===== グローバル定数・変数 =====
const DUMMY_SERVICE_CHARGE_RATE = 0.20; // サービス料 20%
const DUMMY_TAX_RATE = 0.10; // 消費税 10%

// アプリケーションの状態管理
const state = {
    currentPage: 'dashboard',
    currentStore: 'store1',
    tables: [
        { id: 'V1', status: 'occupied', guests: 2, name: '鈴木様', startTime: '20:30', items: [
            { id: 1, name: '基本セット (指名)', price: 10000, qty: 1 },
            { id: 2, name: 'キャストドリンク', price: 1500, qty: 2 },
            { id: 3, name: '鏡月 (ボトル)', price: 8000, qty: 1 },
        ]},
        { id: 'V2', status: 'available' },
        { id: 'V3', status: 'checkout', guests: 3, name: '田中様', startTime: '21:00', items: [
            { id: 1, name: '基本セット (フリー)', price: 8000, qty: 3 },
            { id: 4, name: 'ビール', price: 1000, qty: 6 },
        ]},
        { id: 'V4', status: 'available' },
        { id: 'T1', status: 'available' },
        { id: 'T2', status: 'occupied', guests: 4, name: '佐藤様', startTime: '22:15', items: [
            { id: 1, name: '基本セット (指名)', price: 10000, qty: 2 },
            { id: 5, name: 'シャンパン (ゴールド)', price: 50000, qty: 1 },
            { id: 2, name: 'キャストドリンク', price: 1500, qty: 8 },
        ]},
        { id: 'T3', status: 'available' },
        { id: 'T4', status: 'available' },
        { id: 'C1', status: 'available' },
        { id: 'C2', status: 'available' },
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
    currentOrder: {
        tableId: null,
        items: []
    },
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
const menuTabs = document.querySelectorAll('.menu-tab');
const menuTabContents = document.querySelectorAll('.menu-tab-content');

// モーダル関連
const orderModal = document.getElementById('order-modal');
const checkoutModal = document.getElementById('checkout-modal');
const receiptModal = document.getElementById('receipt-modal');
const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
const openCheckoutBtn = document.getElementById('open-checkout-btn');
const processPaymentBtn = document.getElementById('process-payment-btn');

// 伝票モーダル
const orderModalTitle = document.getElementById('order-modal-title');
const orderItemsList = document.getElementById('order-items-list');
const menuOrderGrid = document.getElementById('menu-order-grid');
const orderSubtotalEl = document.getElementById('order-subtotal');

// 会計モーダル
const checkoutModalTitle = document.getElementById('checkout-modal-title');
const checkoutItemsList = document.getElementById('checkout-items-list');
const checkoutSubtotalEl = document.getElementById('checkout-subtotal');
const checkoutServiceChargeEl = document.getElementById('checkout-service-charge');
const checkoutTaxEl = document.getElementById('checkout-tax');
const checkoutTotalEl = document.getElementById('checkout-total');
const paymentMethodBtns = document.querySelectorAll('.payment-method-btn');

// (変更) Ranking関連
const castRankingList = document.getElementById('cast-ranking-list');
const rankingPeriodSelect = document.getElementById('ranking-period-select'); // (変更) ボタンからSelectに変更
const rankingTypeBtns = document.querySelectorAll('.ranking-type-btn');

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
};

/**
 * テーブル管理画面を描画する
 */
const renderTableGrid = () => {
    if (!tableGrid) return;
    tableGrid.innerHTML = ''; // 既存の表示をクリア

    state.tables.forEach(table => {
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
            case 'checkout':
                statusColor = 'orange';
                statusText = '会計待ち';
                break;
        }

        const card = `
            <button class="table-card p-4 rounded-lg shadow-md border-2 transition-transform transform hover:scale-105" 
                    data-table-id="${table.id}" 
                    data-status="${table.status}">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-2xl font-bold">${table.id}</span>
                    <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
                </div>
                ${table.status !== 'available' ? `
                <div class="text-left">
                    <p class="text-sm font-medium">${table.name || 'ゲスト'}</p>
                    <p class="text-xs text-slate-500">${table.guests || 0}名様 / ${table.startTime || '??:??'}〜</p>
                </div>
                ` : `
                <div class="text-left h-10 flex items-center">
                    <p class="text-sm text-slate-400">クリックして伝票開始</p>
                </div>
                `}
            </button>
        `;
        tableGrid.innerHTML += card;
    });

    // 各テーブルカードにクリックイベントを追加
    document.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', () => {
            handleTableClick(card.dataset.tableId);
        });
    });
};

/**
 * 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    const tableId = state.currentOrder.tableId;
    const tableData = state.tables.find(t => t.id === tableId);
    
    orderModalTitle.textContent = `テーブル ${tableId}`;
    
    // 注文リストを描画
    orderItemsList.innerHTML = '';
    let subtotal = 0;
    state.currentOrder.items.forEach(item => {
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
 * 注文リストにアイテムを追加する
 * @param {number} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = (id, name, price) => {
    const existingItem = state.currentOrder.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        state.currentOrder.items.push({ id, name, price, qty: 1 });
    }
    renderOrderModal(); // 注文リストを再描画
};

/**
 * 会計モーダルを描画する
 */
const renderCheckoutModal = () => {
    const tableId = state.currentOrder.tableId;
    checkoutModalTitle.textContent = `テーブル ${tableId} - お会計`;
    
    let subtotal = 0;
    checkoutItemsList.innerHTML = '';
    state.currentOrder.items.forEach(item => {
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
    const total = subtotalWithService + tax;

    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(serviceCharge);
    checkoutTaxEl.textContent = formatCurrency(tax);
    checkoutTotalEl.textContent = formatCurrency(total);
    
    // 領収書モーダルの金額も更新
    document.getElementById('receipt-total').textContent = formatCurrency(total);
};

/**
 * 領収書モーダルを描画する
 */
const renderReceiptModal = () => {
    const now = new Date();
    document.getElementById('receipt-date').textContent = now.toLocaleDateString('ja-JP');
    
    // TODO: 宛名や合計金額は会計モーダルから引き継ぐ
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
 * テーブルカードクリック時の処理
 * @param {string} tableId 
 */
const handleTableClick = (tableId) => {
    const tableData = state.tables.find(t => t.id === tableId);
    if (!tableData) return;

    // 伝票データをstateにセット
    state.currentOrder.tableId = tableId;
    state.currentOrder.items = tableData.items ? [...tableData.items] : []; // 簡易ディープコピー

    // ステータスに応じて処理分岐
    if (tableData.status === 'available') {
        // 新規伝票作成
        // TODO: 本来はここで「お客様情報入力」モーダルなどを出す
        tableData.status = 'occupied';
        tableData.startTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        tableData.name = "新規のお客様";
        tableData.guests = 1;
        tableData.items = [];
        state.currentOrder.items = [];
        renderTableGrid(); // テーブル一覧を更新
    }
    
    // 伝票モーダルを開く
    renderOrderModal();
    openModal(orderModal);
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

        // (変更) imgタグを削除し、レイアウトを調整
        castRankingList.innerHTML += `
            <li class="flex items-center space-x-2"> <!-- space-x-3 から space-x-2 に変更 -->
                <span class="font-bold text-lg w-6 text-center ${rankColor}">
                    ${rank}
                </span>
                <!-- <img src="${cast.img}" alt="${cast.name}" class="w-10 h-10 rounded-full"> --> <!-- 顔写真削除 -->
                <div class="flex-1 ml-2"> <!-- ml-2 を追加してスペース調整 -->
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
    renderTableGrid();
    renderCastRanking();
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

        // タブのアクティブ状態切り替え
        menuTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // コンテンツの表示切り替え
        menuTabContents.forEach(content => {
            if (content.id === targetContentId) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    });
});

// モーダルを閉じるボタン
modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(orderModal);
        closeModal(checkoutModal);
        closeModal(receiptModal);
    });
});

// 伝票モーダル -> 会計モーダル
if (openCheckoutBtn) {
    openCheckoutBtn.addEventListener('click', () => {
        renderCheckoutModal();
        closeModal(orderModal);
        openModal(checkoutModal);
    });
}

// 会計モーダル -> 領収書モーダル
if (processPaymentBtn) {
    processPaymentBtn.addEventListener('click', () => {
        renderReceiptModal();
        closeModal(checkoutModal);
        openModal(receiptModal);
        
        // テーブルのステータスを空席に戻す
        const table = state.tables.find(t => t.id === state.currentOrder.tableId);
        if (table) {
            table.status = 'available';
            table.guests = undefined;
            table.name = undefined;
            table.startTime = undefined;
            table.items = undefined;
            renderTableGrid();
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

// (変更) Ranking 期間切り替え (Selectに変更)
if (rankingPeriodSelect) {
    rankingPeriodSelect.addEventListener('change', (e) => {
        // (変更) selectの値を直接stateにセット
        state.ranking.period = e.target.value;
        renderCastRanking();
    });
}


// (変更) Ranking 集計対象切り替え
rankingTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // ボタンのアクティブ状態を切り替え
        rankingTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // stateを更新
        state.ranking.type = btn.dataset.type;
        
        // ランキングを再描画
        renderCastRanking();
    });
});


