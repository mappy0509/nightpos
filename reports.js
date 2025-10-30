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
    currentPage: 'reports', // (変更) このページのデフォルト
    currentStore: 'store1',
    slipCounter: 3,
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
        // (変更) ネストされたオブジェクトも正しくマージする
        const mergedState = {
            ...defaultState,
            ...parsedState,
            storeInfo: { ...defaultState.storeInfo, ...parsedState.storeInfo },
            rates: { ...defaultState.rates, ...parsedState.rates },
            ranking: { ...defaultState.ranking, ...parsedState.ranking },
            menu: { ...defaultState.menu, ...parsedState.menu },
            currentPage: 'reports' // (変更) このページのデフォルト
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
// (変更) reports.jsで必要なDOMのみ
let modalCloseBtns,
    reportsSummaryCards, reportTotalSales, reportTotalSlips, reportAvgSales,
    reportsPeriodTabs, reportsChartCanvas, reportsRankingList, exportJpgBtn,
    reportContentArea;

// (変更) グラフインスタンスをグローバルで保持
let salesChart = null;

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
 * (新規) キャストIDからキャスト名を取得する (reports.jsでは不要だが共通ロジックとして残す)
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!castId) return 'フリー';
    const cast = state.casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (reports.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    return state.slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};

/**
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    // (変更) reports.js ではモーダルを開かないが、HTML上にあるため閉じるロジックのみ残す
    // (DOM要素を限定的に取得するため、引数ではなくIDで直接探す)
    const modals = document.querySelectorAll('.modal-backdrop');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
};

/**
 * (新規) 売上分析サマリーを計算・表示する
 */
const renderReportsSummary = () => {
    // (変更) state.slips から集計
    const paidSlips = state.slips.filter(slip => slip.status === 'paid');
    
    let totalSales = 0;
    paidSlips.forEach(slip => {
        totalSales += calculateSlipTotal(slip); // (変更) 共通関数を使用
    });
    
    const totalSlips = paidSlips.length;
    const avgSales = totalSlips > 0 ? totalSales / totalSlips : 0;

    if (reportTotalSales) reportTotalSales.textContent = formatCurrency(totalSales);
    if (reportTotalSlips) reportTotalSlips.textContent = `${totalSlips} 組`;
    if (reportAvgSales) reportAvgSales.textContent = formatCurrency(Math.round(avgSales));
};

/**
 * (新規) 売れ筋商品ランキングを計算・表示する
 */
const renderReportsRanking = () => {
    if (!reportsRankingList) return;
    
    // (変更) state.slips から集計
    const paidSlips = state.slips.filter(slip => slip.status === 'paid');
    const itemMap = new Map();

    paidSlips.forEach(slip => {
        slip.items.forEach(item => {
            const currentQty = itemMap.get(item.name) || 0;
            itemMap.set(item.name, currentQty + item.qty);
        });
    });

    const sortedItems = [...itemMap.entries()].sort((a, b) => b[1] - a[1]);
    
    reportsRankingList.innerHTML = '';
    if (sortedItems.length === 0) {
        reportsRankingList.innerHTML = '<li class="text-slate-500">データがありません</li>';
        return;
    }

    sortedItems.slice(0, 10).forEach(([name, qty], index) => {
        reportsRankingList.innerHTML += `
            <li class="flex justify-between items-center py-2 border-b">
                <span class="font-medium">${index + 1}. ${name}</span>
                <span class="font-bold text-blue-600">${qty} 点</span>
            </li>
        `;
    });
};

/**
 * (新規) 売上推移グラフを描画する
 * @param {string} period 'daily', 'weekly', 'monthly'
 */
const renderSalesChart = (period = 'daily') => {
    if (!reportsChartCanvas) return;
    const ctx = reportsChartCanvas.getContext('2d');

    // ダミーデータ
    let labels, data;
    switch (period) {
        case 'weekly':
            labels = ['10/13(月)', '10/14(火)', '10/15(水)', '10/16(木)', '10/17(金)', '10/18(土)', '10/19(日)'];
            data = [120000, 150000, 130000, 180000, 250000, 300000, 100000];
            break;
        case 'monthly':
            labels = ['1週目', '2週目', '3週目', '4週目'];
            data = [800000, 1000000, 950000, 1200000];
            break;
        case 'daily':
        default:
            labels = ['18時', '19時', '20時', '21時', '22時', '23時', '24時', '25時'];
            data = [0, 50000, 120000, 180000, 250000, 220000, 150000, 80000];
            break;
    }

    // 既存のグラフがあれば破棄
    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '売上 (円)',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.1)', // bg-blue-500/10
                borderColor: 'rgba(59, 130, 246, 1)', // border-blue-500
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                legend: {
                    display: false // ラベルを非表示
                }
            },
            // (変更) html2canvas のためにアニメーションを無効化
            animation: false 
        }
    });
};


// --- イベントリスナー ---

document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    // (変更) reports.js で必要なDOMのみ取得
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    reportsSummaryCards = document.getElementById('reports-summary');
    if (reportsSummaryCards) {
        reportTotalSales = reportsSummaryCards.querySelector('[data-value="total-sales"]');
        reportTotalSlips = reportsSummaryCards.querySelector('[data-value="total-slips"]');
        reportAvgSales = reportsSummaryCards.querySelector('[data-value="avg-sales"]');
    }
    reportsPeriodTabs = document.getElementById('reports-period-tabs');
    reportsChartCanvas = document.getElementById('reports-chart');
    reportsRankingList = document.getElementById('reports-ranking-list');
    exportJpgBtn = document.getElementById('export-jpg-btn');
    reportContentArea = document.getElementById('reports-content-area'); // (変更) キャプチャ対象

    
    // ===== 初期化処理 =====
    if (reportsSummaryCards) { // (変更) reportsページ以外では実行しない
        renderReportsSummary();
        renderReportsRanking();
        renderSalesChart('daily'); // 初期表示は 'daily'
    }
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // (変更) reports.js ではモーダルを開かないが、HTML上にあるため閉じるロジックのみ残す
            closeModal();
        });
    });

    // (新規) 期間選択タブ
    if (reportsPeriodTabs) {
        reportsPeriodTabs.querySelectorAll('button').forEach(tab => {
            tab.addEventListener('click', () => {
                reportsPeriodTabs.querySelectorAll('button').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const period = tab.dataset.period;
                renderSalesChart(period);
            });
        });
    }

    // (新規) JPEGエクスポートボタン
    if (exportJpgBtn && reportContentArea) {
        exportJpgBtn.addEventListener('click', () => {
            // html2canvas がグラフを正しく描画するために、グラフのアニメーションを無効にする
            if (salesChart) {
                salesChart.options.animation = false;
                salesChart.update();
            }

            html2canvas(reportContentArea, {
                useCORS: true, // (変更) 外部ライブラリ(Chart.js)を使用しているため
                scale: 2 // (変更) 高解像度でキャプチャ
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'daily_report.jpg';
                link.href = canvas.toDataURL('image/jpeg', 0.9); // (変更) JPEG形式、品質90%
                link.click();
            });
        });
    }

});

