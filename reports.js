// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, // (★新規★)
    deleteDoc, // (★新規★)
    doc,
    collection // (★新規★)
} from './firebase-init.js';

// (★新規★) 新しい参照をインポート
import {
    settingsRef,
    menuRef,
    slipCounterRef,
    castsCollectionRef,
    customersCollectionRef,
    slipsCollectionRef
} from './firebase-init.js';

// ===== グローバル定数・変数 =====

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (★変更★) state を分割して管理
let settings = null;
let menu = null;
let casts = [];
let customers = [];
let slips = [];
let slipCounter = 0;

// (★変更★) 現在選択中の伝票ID (ローカル管理)
let currentSlipId = null;
// let currentBillingAmount = 0; // (reports.js では不要)

// ===== DOM要素 =====
// (★修正★) reports.js (reports.html) に必要なDOMのみに限定
let modalCloseBtns,
    reportsSummaryCards, reportTotalSales, reportTotalSlips, reportAvgSales, reportCancelledSlips,
    reportsPeriodTabs, reportsChartCanvas, reportsRankingList, exportJpgBtn,
    reportContentArea,
    // (★新規★) 日付選択
    reportDatePicker,
    
    // (★新規★) 他のHTMLからコピーされたモーダル用のDOM
    newSlipConfirmModal, newSlipConfirmTitle, newSlipConfirmMessage, confirmCreateSlipBtn,
    newSlipStartTimeInput, newSlipTimeError,
    slipSelectionModal, slipSelectionModalTitle, slipSelectionList, createNewSlipBtn;

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
 * (★新規★) Dateオブジェクトを 'YYYY-MM-DDTHH:MM' 形式の文字列に変換する
 * (datetime-local入力欄用)
 * @param {Date} date 
 * @returns {string}
 */
const formatDateTimeLocal = (date) => {
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const MIN = String(date.getMinutes()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}T${HH}:${MIN}`;
};

/**
 * (★新規★) 経過時間を HH:MM 形式でフォーマットする
 * @param {number} ms - ミリ秒
 * @returns {string} HH:MM 形式の文字列
 */
const formatElapsedTime = (ms) => {
    if (ms < 0) ms = 0;
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    
    return `${hh}:${mm}`;
};

/**
 * (変更) 伝票の合計金額（割引前）を計算する (stateの税率を使用)
 * @param {object} slip 伝票データ
 * @returns {number} 合計金額
 */
const calculateSlipTotal = (slip) => {
    if (!settings) return 0; // (★変更★)
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = subtotalWithService + tax;
    return Math.round(total);
};


/**
 * (新規) キャストIDからキャスト名を取得する (reports.jsでは不要だが共通ロジックとして残す)
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!casts) return '不明'; // (★変更★)
    if (!castId) return 'フリー';
    const cast = casts.find(c => c.id === castId); // (★変更★)
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (reports.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    if (!slips) return 0; // (★変更★)
    return slips.filter( // (★変更★)
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
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
    if (!settings || !settings.dayChangeTime) { // (★変更★)
        // state未読み込みか、設定がない場合は AM 00:00
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }
    
    const [hours, minutes] = settings.dayChangeTime.split(':').map(Number); // (★変更★)
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
    if (!slips) { // (★変更★)
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

    const paidSlips = slips.filter(slip => { // (★変更★)
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        const paidTime = new Date(slip.paidTimestamp).getTime();
        return paidTime >= startTimestamp && paidTime <= endTimestamp;
    });

    const cancelledSlips = slips.filter(slip => { // (★変更★)
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
    if (!reportsSummaryCards || !slips) return; // (★変更★)
    
    const { paidSlips, cancelledSlips } = getSlipsForPeriod(currentReportPeriod, currentReportDate);
    
    let totalSales = 0;
    paidSlips.forEach(slip => {
        // (★変更★) 伝票の paidAmount (割引後) を集計する
        totalSales += slip.paidAmount || 0; 
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
    if (!reportsRankingList || !slips) return; // (★変更★)
    
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
    if (!reportsChartCanvas || !slips) return; // (★変更★)
    
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
                .reduce((total, slip) => total + (slip.paidAmount || 0), 0); // (★変更★) paidAmount を集計
            
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
                .reduce((total, slip) => total + (slip.paidAmount || 0), 0); // (★変更★) paidAmount を集計
                
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
            data[weekIndex] += (slip.paidAmount || 0); // (★変更★) paidAmount を集計
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
            animation: true 
        }
    });
};

/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; // (★変更★)
    // (変更) reports.js でモーダル内のDOM要素は取得しないため、中身を空にする
    // (ただし、HTMLにはモーダルが存在するため、関数自体は残す)
};

/**
 * (★新規★) 全レポートを更新する
 */
const updateAllReports = () => {
    if (!settings || !slips || !menu) return; // (★変更★)
    renderReportsSummary();
    renderReportsRanking();
    renderSalesChart();
};

// ===================================
// (★新規★) 伝票作成ロジック (reports.js では基本使われないが、HTMLのモーダル定義と一貫性を保つため)
// ===================================

/**
 * (★新規★) 新しい伝票を作成し、伝票モーダルを開く
 * @param {string} tableId 
 * @param {string} startTimeISO (★変更★) 開始時刻のISO文字列
 */
const createNewSlip = async (tableId, startTimeISO) => {
    if (!settings) return; // (★変更★)
    const table = settings.tables.find(t => t.id === tableId); // (★変更★)
    if (!table) {
        console.error("Table not found for creation:", tableId);
        return;
    }

    const newSlipCounter = (slipCounter || 0) + 1; // (★変更★)
    const newSlipNumber = newSlipCounter;

    const newSlip = {
        // slipId は addDoc で自動生成
        slipNumber: newSlipNumber,
        tableId: tableId,
        status: 'active',
        name: "新規のお客様",
        startTime: startTimeISO,
        nominationCastId: null, 
        items: [],
        tags: [],
        paidAmount: 0,
        cancelReason: null,
        paymentDetails: { cash: 0, card: 0, credit: 0 },
        paidTimestamp: null, 
        discount: { type: 'yen', value: 0 }, 
    };
    
    // (★変更★)
    try {
        const docRef = await addDoc(slipsCollectionRef, newSlip);
        await setDoc(slipCounterRef, { count: newSlipCounter });
        currentSlipId = docRef.id; // (★変更★)

        // (★変更★) 伝票モーダルは reports.js には存在しないため、描画・表示ロジックは削除
        // renderOrderModal();
        // openModal(orderModal);

    } catch (e) {
        console.error("Error creating new slip: ", e);
    }
};

/**
 * (★新規★) 伝票選択モーダルを描画する
 * @param {string} tableId 
 */
const renderSlipSelectionModal = (tableId) => {
    if (!slips) return; // (★変更★)
    if (!slipSelectionModalTitle || !slipSelectionList) return; // DOM存在チェック

    slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    slipSelectionList.innerHTML = '';

    const activeSlips = slips.filter( // (★変更★)
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    );
    
    activeSlips.sort((a, b) => b.slipNumber - a.slipNumber);

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
            const nominationText = getCastNameById(slip.nominationCastId);

            const now = new Date();
            const startTime = new Date(slip.startTime);
            const diffMs = now.getTime() - startTime.getTime();
            const elapsedTimeStr = formatElapsedTime(diffMs);
            const startTimeStr = isNaN(startTime.getTime()) ? '??:??' : startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            slipSelectionList.innerHTML += `
                <button class="w-full text-left p-4 bg-slate-50 rounded-lg hover:bg-slate-100 border" data-slip-id="${slip.slipId}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-lg truncate">(No.${slip.slipNumber}) ${slip.name} (${nominationText})</span>
                        <span class="text-sm font-medium text-${statusColor}-600 bg-${statusColor}-100 px-2 py-1 rounded-full">${statusText}</span>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">
                        開始: ${startTimeStr}〜 
                        (<span class="font-semibold text-orange-600">${elapsedTimeStr}</span> 経過)
                    </p>
                </button>
            `;
        });
    }
    
    createNewSlipBtn.dataset.tableId = tableId;
    openModal(slipSelectionModal);
};

/**
 * (★新規★) 新規伝票の作成確認モーダルを描画・表示する
 * @param {string} tableId 
 */
const renderNewSlipConfirmModal = (tableId) => {
    if (!newSlipConfirmModal) return; // DOM存在チェック

    newSlipConfirmTitle.textContent = `伝票の新規作成 (${tableId})`;
    newSlipConfirmMessage.textContent = `テーブル ${tableId} で新しい伝票を作成しますか？`;

    if (newSlipStartTimeInput) {
        newSlipStartTimeInput.value = formatDateTimeLocal(new Date());
    }
    if (newSlipTimeError) {
        newSlipTimeError.textContent = '';
    }
    
    confirmCreateSlipBtn.dataset.tableId = tableId; 
    openModal(newSlipConfirmModal);
};


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    return {
        // currentPage: 'reports', (settings には不要)
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
            { id: 'tag3', name: '初回' }, { id: 'tag4', name: '枝' },
            { id: 'tag5', name: '切替' }, { id: 'tag6', name: '案内所' },
            { id: 'tag7', name: '20歳未満' }, { id: 'tag8', name: '同業' },
        ],
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
            { id: 'T1', status: 'available' }, { id: 'T2', status: 'available' },
            { id: 'C1', status: 'available' }, { id: 'C2', status: 'available' },
        ],
        storeInfo: {
            name: "Night POS",
            address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000",
            zip: "160-0021" // (★追加★)
        },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
        performanceSettings: {
            // (★注意★) m14 は getDefaultMenu で生成されるIDと合わせる必要あり
            menuItems: {
                'm14_default': { salesType: 'percentage', salesValue: 100, countNomination: true }
            },
            serviceCharge: { salesType: 'percentage', salesValue: 0 },
            tax: { salesType: 'percentage', salesValue: 0 },
            sideCustomer: { salesValue: 100, countNomination: true }
        },
        ranking: { period: 'monthly', type: 'nominations' }
    };
};

const getDefaultMenu = () => {
    const catSetId = getUUID();
    const catDrinkId = getUUID();
    const catBottleId = getUUID();
    const catFoodId = getUUID();
    const catCastId = getUUID(); 
    const catOtherId = getUUID();
    
    return {
        categories: [
            { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false },
            { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false },
            { id: catBottleId, name: 'ボトル', isSetCategory: false, isCastCategory: false },
            { id: catFoodId, name: 'フード', isSetCategory: false, isCastCategory: false },
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true }, 
            { id: catOtherId, name: 'その他', isSetCategory: false, isCastCategory: false },
        ],
        items: [
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', categoryId: catSetId, name: '基本セット (フリー)', price: 8000, duration: 60 },
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
            { id: 'm11', categoryId: catBottleId, name: '鏡月 (ボトル)', price: 8000, duration: null },
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null }, // (★ID変更★)
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};

// (★削除★) Firestore への state 保存関数
// const updateStateInFirestore = async (newState) => { ... };

// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 新しい参照を取得
    const { 
        settingsRef, menuRef, slipCounterRef,
        castsCollectionRef, customersCollectionRef, slipsCollectionRef
    } = e.detail;

    // (★新規★) 全データをロードできたか確認するフラグ
    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) reports.js は updateAllReports を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded) {
            console.log("All data loaded. Rendering UI for reports.js");
            updateAllReports();
            updateModalCommonInfo(); 
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.log("No settings document found. Creating default settings...");
            const defaultSettings = getDefaultSettings();
            await setDoc(settingsRef, defaultSettings);
            settings = defaultSettings;
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // 2. Menu
    onSnapshot(menuRef, async (docSnap) => {
        if (docSnap.exists()) {
            menu = docSnap.data();
        } else {
            console.log("No menu document found. Creating default menu...");
            const defaultMenu = getDefaultMenu();
            await setDoc(menuRef, defaultMenu);
            menu = defaultMenu;
        }
        menuLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to menu: ", error));

    // 3. Slip Counter
    onSnapshot(slipCounterRef, async (docSnap) => {
        if (docSnap.exists()) {
            slipCounter = docSnap.data().count;
        } else {
            console.log("No slip counter document found. Creating default counter...");
            await setDoc(slipCounterRef, { count: 0 });
            slipCounter = 0;
        }
        counterLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to slip counter: ", error));

    // 4. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));

    // 5. Customers
    onSnapshot(customersCollectionRef, (querySnapshot) => {
        customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ ...doc.data(), id: doc.id });
        });
        console.log("Customers loaded: ", customers.length);
        customersLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to customers: ", error));
    
    // 6. Slips
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id }); // (★注意★) slipId フィールド
        });
        console.log("Slips loaded: ", slips.length);
        slipsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to slips: ", error);
        if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
             document.body.innerHTML = `<div class="p-8 text-center text-red-600">データベースへのアクセスに失敗しました。Firestoreのセキュリティルール（slipsコレクション）が正しく設定されているか、または必要なインデックスが作成されているか確認してください。</div>`;
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
    
    // (★新規★) 他のHTMLからコピーされたモーダル用のDOM
    newSlipConfirmModal = document.getElementById('new-slip-confirm-modal');
    newSlipConfirmTitle = document.getElementById('new-slip-confirm-title');
    newSlipConfirmMessage = document.getElementById('new-slip-confirm-message');
    confirmCreateSlipBtn = document.getElementById('confirm-create-slip-btn');
    newSlipStartTimeInput = document.getElementById('new-slip-start-time-input');
    newSlipTimeError = document.getElementById('new-slip-time-error');
    slipSelectionModal = document.getElementById('slip-selection-modal');
    slipSelectionModalTitle = document.getElementById('slip-selection-modal-title');
    slipSelectionList = document.getElementById('slip-selection-list');
    createNewSlipBtn = document.getElementById('create-new-slip-btn');


    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // (★変更★) すべてのモーダルを閉じる (reports.htmlに存在するもののみ)
            closeModal(newSlipConfirmModal);
            closeModal(slipSelectionModal);
            // (★変更★) 他のモーダルもHTMLには存在するため、閉じるロジックは残す
            closeModal(document.getElementById('order-modal'));
            closeModal(document.getElementById('cancel-slip-modal'));
            closeModal(document.getElementById('slip-preview-modal'));
            closeModal(document.getElementById('checkout-modal'));
            closeModal(document.getElementById('receipt-modal'));
            closeModal(document.getElementById('menu-editor-modal'));
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
    
    // (★新規★) 伝票選択モーダルのイベント委任
    if (slipSelectionList) {
        slipSelectionList.addEventListener('click', (e) => {
            const slipBtn = e.target.closest('button[data-slip-id]');
            if (slipBtn) {
                // handleSlipClick(slipBtn.dataset.slipId); // (★変更★) reports.js には handleSlipClick がない
                console.warn('handleSlipClick is not implemented in reports.js');
                closeModal(slipSelectionModal);
            }
        });
    }

    // (新規) 伝票選択モーダル -> 新規伝票作成
    if (createNewSlipBtn) {
        createNewSlipBtn.addEventListener('click', () => {
            const tableId = createNewSlipBtn.dataset.tableId;
            if (tableId) {
                renderNewSlipConfirmModal(tableId); // (★変更★)
                closeModal(slipSelectionModal);
            }
        });
    }
    
    // (★変更★) 新規伝票確認モーダル -> OK
    if (confirmCreateSlipBtn) {
        confirmCreateSlipBtn.addEventListener('click', () => {
            const tableId = confirmCreateSlipBtn.dataset.tableId;
            
            // (★変更★) 時間を取得して検証
            const startTimeValue = newSlipStartTimeInput ? newSlipStartTimeInput.value : '';
            if (!startTimeValue) {
                if (newSlipTimeError) newSlipTimeError.textContent = '開始時刻を入力してください。';
                return;
            }
            if (newSlipTimeError) newSlipTimeError.textContent = '';
            
            // (★変更★) ISO文字列に変換して渡す
            const startTimeISO = new Date(startTimeValue).toISOString();
            
            if (tableId) {
                createNewSlip(tableId, startTimeISO); // (★変更★)
                closeModal(newSlipConfirmModal);
            }
        });
    }

});