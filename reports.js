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
// (★修正★) reports.js (reports.html) に必要なDOMのみに限定
let modalCloseBtns,
    reportsSummaryCards, reportTotalSales, reportTotalSlips, reportAvgSales, reportCancelledSlips,
    reportsPeriodTabs, reportsChartCanvas, reportsRankingList, exportJpgBtn,
    reportContentArea,
    // (★新規★) 日付選択
    reportDatePicker; 

// (変更) グラフインスタンスをグローバルで保持
let salesChart = null;
// (★新規★) 現在のレポート集計期間
let currentReportPeriod = 'daily';
let currentReportDate = new Date();


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
 * (新規) キャストIDからキャスト名を取得する (reports.jsでは不要だが共通ロジックとして残す)
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
 * (変更) 未会計伝票の数を取得する (reports.jsでは不要だが共通ロジックとして残す)
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

// ===================================
// (★新規★) 売上集計ヘルパー関数
// ===================================

/**
 * (★新規★) 営業日付の開始時刻を取得する
 * @param {Date} date 対象の日付
 * @returns {Date} 営業開始日時
 */
const getBusinessDayStart = (date) => {
    if (!state || !state.dayChangeTime) {
        // state未読み込みか、設定がない場合は AM 00:00
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }
    
    const [hours, minutes] = state.dayChangeTime.split(':').map(Number);
    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);
    
    // 基準日 (date) が営業開始時刻より前の場合 (例: AM 3:00 で 変更時刻が AM 5:00)
    // 営業日は「前日」扱い
    if (date.getTime() < startDate.getTime()) {
        startDate.setDate(startDate.getDate() - 1);
    }
    
    return startDate;
};

/**
 * (★新規★) 営業日付の終了時刻を取得する
 * @param {Date} businessDayStart 営業開始日時
 * @returns {Date} 営業終了日時 (翌日の営業開始 - 1ミリ秒)
 */
const getBusinessDayEnd = (businessDayStart) => {
    const endDate = new Date(businessDayStart);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    return endDate;
};

/**
 * (★新規★) 指定された期間の伝票(会計済み・ボツ)を取得する
 * @param {string} period 'daily', 'weekly', 'monthly'
 * @param {Date} baseDate 基準日
 * @returns {object} { paidSlips: [], cancelledSlips: [] }
 */
const getSlipsForPeriod = (period, baseDate) => {
    if (!state || !state.slips) {
        return { paidSlips: [], cancelledSlips: [], range: { start: baseDate, end: baseDate } };
    }

    let startDate, endDate;
    const businessDayStart = getBusinessDayStart(baseDate);

    if (period === 'daily') {
        startDate = businessDayStart;
        endDate = getBusinessDayEnd(businessDayStart);
    } 
    else if (period === 'weekly') {
        // 基準日の週の月曜日（の営業開始時刻）
        const dayOfWeek = businessDayStart.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = businessDayStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜を週初めに
        startDate = new Date(businessDayStart.setDate(diff));
        startDate = getBusinessDayStart(startDate); // 念のため営業日補正

        // 7日後の営業終了時刻
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        endDate = getBusinessDayEnd(new Date(endDate.setDate(endDate.getDate() - 1))); // 7日後の営業開始-1ms
    } 
    else if (period === 'monthly') {
        // 基準日の月の1日（の営業開始時刻）
        startDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth(), 1);
        startDate = getBusinessDayStart(startDate); // 念のため営業日補正

        // 基準日の月の末日（の営業終了時刻）
        endDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth() + 1, 0); // 月末日
        endDate = getBusinessDayEnd(getBusinessDayStart(endDate)); // 念のため営業日補正
    }

    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const paidSlips = state.slips.filter(slip => {
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        const paidTime = new Date(slip.paidTimestamp).getTime();
        return paidTime >= startTimestamp && paidTime <= endTimestamp;
    });

    const cancelledSlips = state.slips.filter(slip => {
        // (注意) ボツ伝の日時は paidTimestamp がないため、仮で startTime を使う (要件次第)
        // 本来はボツにした日時 (cancelledTimestamp) が必要
        if (slip.status !== 'cancelled') return false; 
        
        // paidTimestamp がないため、集計期間の判定が困難。
        // ここでは「state.slips全体 (本日分)」のボツ伝をそのまま返す簡易仕様
        return true; 
    });

    return { paidSlips, cancelledSlips, range: { start: startDate, end: endDate } };
};


// ===================================
// (★修正★) 売上集計ロジック (ダミーデータ -> 実データ)
// ===================================

/**
 * (★修正★) 売上分析サマリーを計算・表示する
 */
const renderReportsSummary = () => {
    if (!reportsSummaryCards || !state) return; 
    
    const { paidSlips, cancelledSlips } = getSlipsForPeriod(currentReportPeriod, currentReportDate);
    
    let totalSales = 0;
    paidSlips.forEach(slip => {
        totalSales += calculateSlipTotal(slip); 
    });
    
    const totalSlips = paidSlips.length;
    const avgSales = totalSlips > 0 ? totalSales / totalSlips : 0;
    const totalCancelled = cancelledSlips.length; 

    if (reportTotalSales) reportTotalSales.textContent = formatCurrency(totalSales);
    if (reportTotalSlips) reportTotalSlips.textContent = `${totalSlips} 組`;
    if (reportAvgSales) reportAvgSales.textContent = formatCurrency(Math.round(avgSales));
    if (reportCancelledSlips) reportCancelledSlips.textContent = `${totalCancelled} 件`;
};

/**
 * (★修正★) 売れ筋商品ランキングを計算・表示する
 */
const renderReportsRanking = () => {
    if (!reportsRankingList || !state) return; 
    
    const { paidSlips } = getSlipsForPeriod(currentReportPeriod, currentReportDate);
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
 * (★修正★) 売上推移グラフを描画する
 */
const renderSalesChart = () => {
    if (!reportsChartCanvas || !state) return;
    
    const period = currentReportPeriod;
    const baseDate = currentReportDate;
    const { paidSlips, range } = getSlipsForPeriod(period, baseDate);
    
    const ctx = reportsChartCanvas.getContext('2d');
    
    let labels = [];
    let data = [];
    
    // (★修正★) 実データからグラフデータを生成
    if (period === 'daily') {
        // 日次: 1時間ごとの集計 (営業開始時刻から24時間)
        labels = [];
        data = [];
        const startHour = range.start.getHours();
        
        for (let i = 0; i < 24; i++) {
            const currentHour = (startHour + i) % 24;
            labels.push(`${currentHour}時`);
            
            const hourStart = new Date(range.start);
            hourStart.setHours(hourStart.getHours() + i);
            
            const hourEnd = new Date(hourStart);
            hourEnd.setHours(hourEnd.getHours() + 1);
            
            const hourSales = paidSlips
                .filter(slip => {
                    const paidTime = new Date(slip.paidTimestamp).getTime();
                    return paidTime >= hourStart.getTime() && paidTime < hourEnd.getTime();
                })
                .reduce((total, slip) => total + calculateSlipTotal(slip), 0);
            
            data.push(hourSales);
        }
    } 
    else if (period === 'weekly') {
        // 週次: 7日間の日別集計
        labels = [];
        data = [];
        for (let i = 0; i < 7; i++) {
            const dayStart = new Date(range.start);
            dayStart.setDate(dayStart.getDate() + i);
            const dayEnd = getBusinessDayEnd(dayStart);
            
            labels.push(`${dayStart.getMonth() + 1}/${dayStart.getDate()}(${['日','月','火','水','木','金','土'][dayStart.getDay()]})`);
            
            const daySales = paidSlips
                .filter(slip => {
                    const paidTime = new Date(slip.paidTimestamp).getTime();
                    return paidTime >= dayStart.getTime() && paidTime <= dayEnd.getTime();
                })
                .reduce((total, slip) => total + calculateSlipTotal(slip), 0);
                
            data.push(daySales);
        }
    }
    else if (period === 'monthly') {
        // 月次: 週別集計 (簡易的に4週 + 残り)
        labels = ['1週目', '2週目', '3週目', '4週目', '5週目'];
        data = [0, 0, 0, 0, 0];
        
        paidSlips.forEach(slip => {
            const paidDate = new Date(slip.paidTimestamp);
            const weekIndex = Math.floor((paidDate.getDate() - 1) / 7); // 0-3 (1-7日 -> 0), 4 (29-31日)
            data[weekIndex] += calculateSlipTotal(slip);
        });
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
            animation: true // (★修正★) アニメーションを有効化
        }
    });
};

/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!state) return;
    // (変更) reports.js でモーダル内のDOM要素は取得しないため、中身を空にする
    // (ただし、HTMLにはモーダルが存在するため、関数自体は残す)
};

/**
 * (★新規★) 全レポートを更新する
 */
const updateAllReports = () => {
    if (!state) return;
    renderReportsSummary();
    renderReportsRanking();
    renderSalesChart();
};


// (新規) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultState = () => ({
    currentPage: 'reports',
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

// (新規) Firestore への state 保存関数（reports.js では原則使わない）
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
            // (★修正★) 全レポートを更新
            updateAllReports();
            updateModalCommonInfo(); 
            
        } else {
            console.log("No state document found. Creating default state...");
            const defaultState = getDefaultState();
            state = defaultState;
            
            try {
                await setDoc(stateDocRef, defaultState);
                console.log("Default state saved to Firestore.");
                // (重要) state がロードされたら、UIを初回描画
                updateAllReports();
                updateModalCommonInfo(); 
                
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
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    reportsSummaryCards = document.getElementById('reports-summary');
    if (reportsSummaryCards) {
        // (変更) IDで取得
        reportTotalSales = document.getElementById('summary-total-sales');
        reportTotalSlips = document.getElementById('summary-total-slips');
        reportAvgSales = document.getElementById('summary-avg-sales');
        reportCancelledSlips = document.getElementById('summary-cancelled-slips');
    }
    reportsPeriodTabs = document.getElementById('reports-period-tabs');
    reportsChartCanvas = document.getElementById('reports-chart');
    reportsRankingList = document.getElementById('reports-ranking-list');
    exportJpgBtn = document.getElementById('export-jpg-btn');
    reportContentArea = document.getElementById('reports-content-area'); 
    
    // (★新規★) 日付ピッカー
    reportDatePicker = document.querySelector('input[type="date"]');
    if(reportDatePicker) {
        // (★新規★) input[type=date] は YYYY-MM-DD 形式
        currentReportDate = new Date();
        reportDatePicker.value = currentReportDate.toISOString().split('T')[0];
    }

    
    // ===== 初期化処理 =====
    if (reportsSummaryCards) { 
        // (★修正★) 初回描画は onSnapshot に任せる
        // renderSalesChart('daily');
        // renderReportsSummary();
        // renderReportsRanking();
    }
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });

    if (reportsPeriodTabs) {
        reportsPeriodTabs.querySelectorAll('button').forEach(tab => {
            tab.addEventListener('click', () => {
                reportsPeriodTabs.querySelectorAll('button').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                currentReportPeriod = tab.dataset.period;
                // (★修正★) グラフだけでなく全レポートを更新
                updateAllReports();
            });
        });
    }

    // (★新規★) 日付ピッカーの変更
    if(reportDatePicker) {
        reportDatePicker.addEventListener('change', (e) => {
            // (★注意★) e.target.value は "YYYY-MM-DD" (UTC)
            // タイムゾーンの問題を避けるため、YYYY, MM, DD を個別に取得して Date を生成
            const dateParts = e.target.value.split('-').map(Number);
            currentReportDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            updateAllReports();
        });
    }

    if (exportJpgBtn && reportContentArea) {
        exportJpgBtn.addEventListener('click', () => {
            
            // (★修正★) グラフのアニメーションを一時的に無効にして再描画
            if (salesChart) {
                salesChart.options.animation = false; 
                salesChart.update(0); // 0msで即時更新
            }

            html2canvas(reportContentArea, {
                useCORS: true, 
                scale: 2 
            }).then(canvas => {
                const link = document.createElement('a');
                // (★修正★) ファイル名を動的に
                const dateStr = currentReportDate.toISOString().split('T')[0];
                link.download = `report-${currentReportPeriod}-${dateStr}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9); 
                link.click();
                
                // (★修正★) アニメーションを元に戻す
                if (salesChart) {
                    salesChart.options.animation = true; 
                }
            });
        });
    }

});