// ===== Firebase =====
// (新規) Firebase SDK と 初期化モジュールをインポート
import { getFirebaseServices } from './firebase-init.js';
import {
    doc,
    onSnapshot
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
    currentPage: 'reports', // (変更) このページのデフォルト
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

// (削除) updateStateInFirestore 関数 (reports.js は読み取り専用)
// (削除) updateState 関数

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
 * (新規) キャストIDからキャスト名を取得する (reports.jsでは不要だが共通ロジックとして残す)
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
 * (変更) 未会計伝票の数を取得する (reports.jsでは不要だが共通ロジックとして残す)
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
    // (変更) state.slips が存在するかチェック
    const paidSlips = (state.slips || []).filter(slip => slip.status === 'paid');
    
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
    
    // (変更) state.slips が存在するかチェック
    const paidSlips = (state.slips || []).filter(slip => slip.status === 'paid');
    const itemMap = new Map();

    paidSlips.forEach(slip => {
        // (変更) slip.items が存在するかチェック
        (slip.items || []).forEach(item => {
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

    // (変更) ダミーデータのまま (Firebase化のスコープ外)
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

document.addEventListener('DOMContentLoaded', async () => {
    
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
                // (変更) reports.js は読み取り専用なので、ドキュメント作成は行わない
                console.log("No state document found. Using default state.");
                state = getDefaultState();
            }

            // (新規) ページが reports の場合のみUIを更新
            renderReportsSummary();
            renderReportsRanking();
            
            // (新規) チャートの期間タブの状態を読み取ってグラフを再描画
            const activePeriodTab = reportsPeriodTabs?.querySelector('button.active');
            const period = activePeriodTab ? activePeriodTab.dataset.period : 'daily';
            renderSalesChart(period);

        }, (error) => {
            console.error("Error listening to state document:", error);
        });

    } catch (e) {
        console.error("Failed to initialize Firebase or auth:", e);
        // (新規) Firebaseが失敗した場合でも、ローカルのデフォルトstateでUIを描画
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
                useCORS: true,
                scale: 2 
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'daily_report.jpg';
                link.href = canvas.toDataURL('image/jpeg', 0.9); 
                link.click();
            });
        });
    }

});
