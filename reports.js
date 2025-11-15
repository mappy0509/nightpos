// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc,
    collection, // (★コール管理 修正★) 'collection' は削除しない
    query, // (★コール管理 追加★)
    where // (★コール管理 追加★)
} from './firebase-init.js';

// (★新規★) AIサービスから関数をインポート
import { getSalesReport } from './ai-service.js';

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
let casts = []; // (★初回管理★) キャスト名を引くために必要
let slips = [];

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, castsCollectionRef, slipsCollectionRef, // (★初回管理★) castsCollectionRef を追加
    currentStoreId; 


// ===== DOM要素 =====
// (★コール管理 変更★)
let modalCloseBtns, 
    reportsSummaryCards, reportTotalSales, reportTotalSlips, reportAvgSales, reportCancelledSlips,
    reportsPeriodTabs, reportsChartCanvas, reportsRankingList, 
    
    // (★初回管理★) 写真指名・送り指名ランキングのDOM
    reportsPhotoRankingList, reportsPhotoLoading,
    reportsSendRankingList, reportsSendLoading,
    
    exportJpgBtn,
    reportContentArea,
    // (★新規★) 日付選択
    reportDatePicker,
    // (★AI対応★) AI分析
    aiAnalyzeBtn, aiReportModal, aiReportContent,
    
    headerStoreName; 
    
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

// (★初回管理★) キャストIDからキャスト名を取得する
const getCastNameById = (castId) => {
    if (!casts) return '不明'; 
    if (!castId || castId === 'none') return '（未割り当て）';
    const cast = casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
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
 * (★AI対応★) モーダルを開く
 * @param {HTMLElement} modalElement 
 */
const openModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.add('active');
    }
};

/**
 * (★AI対応★) 簡易MarkdownリストをHTMLに変換
 * @param {string} text 
 * @returns {string}
 */
const parseMarkdownReport = (text) => {
    // (★修正★) 箇条書きがネストしないように修正
    let html = text.split('\n').map(line => {
        line = line.trim();
        if (line.startsWith('## ')) {
            return `<h3>${line.substring(3).trim()}</h3>`;
        } else if (line.startsWith('##')) {
            return `<h3>${line.substring(2).trim()}</h3>`;
        } else if (line.startsWith('* ')) {
            return `<li>${line.substring(2).trim()}</li>`;
        } else if (line.startsWith('- ')) {
            return `<li>${line.substring(2).trim()}</li>`;
        } else if (line.length > 0) {
            return `<p>${line}</p>`;
        }
        return '';
    }).join('');
    
    // (★修正★) <ul>タグで正しく囲む
    html = html.replace(/<li>/g, '<ul><li>');
    html = html.replace(/<\/li>/g, '</li></ul>');
    // (★修正★) 連続する ul をまとめる
    html = html.replace(/<\/ul><ul>/g, ''); 
    
    return html;
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
    if (!settings || !settings.dayChangeTime) { 
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }
    
    const [hours, minutes] = settings.dayChangeTime.split(':').map(Number); 
    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);
    
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
 * @returns {object} { paidSlips: [], cancelledSlips: [], range: { start: Date, end: Date } }
 */
const getSlipsForPeriod = (period, baseDate) => {
    if (!slips) { 
        return { paidSlips: [], cancelledSlips: [], range: { start: baseDate, end: baseDate } };
    }

    let startDate, endDate;
    const businessDayStart = getBusinessDayStart(baseDate);

    if (period === 'daily') {
        startDate = businessDayStart;
        endDate = getBusinessDayEnd(businessDayStart);
    } 
    else if (period === 'weekly') {
        const dayOfWeek = businessDayStart.getDay(); 
        const diff = businessDayStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
        startDate = new Date(businessDayStart.setDate(diff));
        startDate = getBusinessDayStart(startDate); 

        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        endDate = getBusinessDayEnd(new Date(endDate.setDate(endDate.getDate() - 1))); 
    } 
    else if (period === 'monthly') {
        startDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth(), 1);
        startDate = getBusinessDayStart(startDate); 

        endDate = new Date(businessDayStart.getFullYear(), businessDayStart.getMonth() + 1, 0); 
        endDate = getBusinessDayEnd(getBusinessDayStart(endDate)); 
    }

    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const paidSlips = slips.filter(slip => { 
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        const paidTime = new Date(slip.paidTimestamp).getTime();
        return paidTime >= startTimestamp && paidTime <= endTimestamp;
    });

    const cancelledSlips = slips.filter(slip => {
        if (slip.status !== 'cancelled') return false; 
        
        // (★修正★) ボツ伝の日時は paidTimestamp (ボツ確定時) を使う
        if (slip.paidTimestamp) {
             const cancelledTime = new Date(slip.paidTimestamp).getTime();
             return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
        }
        // (★フォールバック★)
        if (slip.startTime) {
             const cancelledTime = new Date(slip.startTime).getTime();
             return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
        }
        return false;
    });

    return { paidSlips, cancelledSlips, range: { start: startDate, end: endDate } };
};


// ===================================
// (★修正★) 売上集計ロジック (リファクタリング)
// ===================================

/**
 * (★初回管理 変更★) 売上分析サマリーを計算・表示する
 * @param {Array} paidSlips
 * @param {Array} cancelledSlips
 */
const renderReportsSummary = (paidSlips, cancelledSlips) => {
    if (!reportsSummaryCards) return; 
    
    let totalSales = 0;
    paidSlips.forEach(slip => {
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
 * (★初回管理 変更★) 売れ筋商品ランキングを計算・表示する
 * @param {Array} paidSlips
 */
const renderReportsRanking = (paidSlips) => {
    if (!reportsRankingList) return; 
    
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
 * (★初回管理★) 写真指名・送り指名ランキングを描画する
 * @param {'photo' | 'send'} type 
 * @param {Array} paidSlips
 */
const renderFirstVisitRankings = (type, paidSlips) => {
    let container, loadingEl, title;
    
    if (type === 'photo') {
        container = reportsPhotoRankingList;
        loadingEl = reportsPhotoLoading;
        title = "写真指名";
    } else { // 'send'
        container = reportsSendRankingList;
        loadingEl = reportsSendLoading;
        title = "送り指名";
    }

    if (!container || !casts) return;
    
    const rankingMap = new Map();

    paidSlips.forEach(slip => {
        // 伝票に firstVisitData があり、かつ該当のリストがあるか
        if (!slip.firstVisitData) return;
        
        let nominationList = [];
        if (type === 'photo' && slip.firstVisitData.photoNominations) {
            nominationList = slip.firstVisitData.photoNominations;
        } else if (type === 'send' && slip.firstVisitData.sendNominations) {
            nominationList = slip.firstVisitData.sendNominations;
        }
        
        // リスト内のキャストIDをカウント
        nominationList.forEach(cast => {
            if (cast.id) {
                const current = rankingMap.get(cast.id) || { id: cast.id, name: getCastNameById(cast.id), count: 0 };
                current.count++;
                rankingMap.set(cast.id, current);
            }
        });
    });

    const sortedData = [...rankingMap.values()].sort((a, b) => b.count - a.count);

    if (loadingEl) loadingEl.style.display = 'none';
    container.innerHTML = '';
    
    if (sortedData.length === 0) {
        container.innerHTML = '<li class="text-slate-500">データがありません</li>';
        return;
    }

    sortedData.slice(0, 5).forEach((cast, index) => {
        const rank = index + 1;
        let rankColor = 'text-slate-400';
        if (rank === 1) rankColor = 'text-yellow-500';
        if (rank === 2) rankColor = 'text-gray-400';
        if (rank === 3) rankColor = 'text-amber-700';
        
        container.innerHTML += `
            <li class="flex items-center space-x-2">
                <span class="font-bold text-lg w-6 text-center ${rankColor}">
                    ${rank}
                </span>
                <div class="flex-1 ml-2">
                    <p class="font-semibold">${cast.name}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-sm text-blue-600">${cast.count} 回</p>
                </div>
            </li>
        `;
    });
};


/**
 * (★初回管理 変更★) 売上推移グラフを描画する
 * @param {Array} paidSlips
 * @param {object} range { start: Date, end: Date }
 */
const renderSalesChart = (paidSlips, range) => {
    if (!reportsChartCanvas) return;
    
    const period = currentReportPeriod;
    const ctx = reportsChartCanvas.getContext('2d');
    
    let labels = [];
    let data = [];
    
    if (period === 'daily') {
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
                .reduce((total, slip) => total + (slip.paidAmount || 0), 0); 
            
            data.push(hourSales);
        }
    } 
    else if (period === 'weekly') {
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
                .reduce((total, slip) => total + (slip.paidAmount || 0), 0); 
                
            data.push(daySales);
        }
    }
    else if (period === 'monthly') {
        labels = ['1週目', '2週目', '3週目', '4週目', '5週目'];
        data = [0, 0, 0, 0, 0];
        
        paidSlips.forEach(slip => {
            const paidDate = new Date(slip.paidTimestamp);
            const weekIndex = Math.floor((paidDate.getDate() - 1) / 7); 
            const safeIndex = Math.min(weekIndex, 4); 
            data[safeIndex] += (slip.paidAmount || 0); 
        });
    }


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
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                borderColor: 'rgba(59, 130, 246, 1)', 
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
                    display: false 
                }
            },
            animation: true 
        }
    });
};


/**
 * (★初回管理 変更★) 全レポートを更新する
 */
const updateAllReports = () => {
    if (!settings || !slips || !menu || !casts) return; // (★初回管理★) casts も待つ
    
    // データを取得
    const { paidSlips, cancelledSlips, range } = getSlipsForPeriod(currentReportPeriod, currentReportDate);

    // 各セクションをレンダリング
    renderReportsSummary(paidSlips, cancelledSlips);
    renderReportsRanking(paidSlips);
    renderSalesChart(paidSlips, range);
    
    // (★初回管理★) 新しいランキングを描画
    renderFirstVisitRankings('photo', paidSlips);
    renderFirstVisitRankings('send', paidSlips);
};

/**
 * (★AI対応★) AI分析モーダルを開く
 */
const handleAiReport = async () => {
    if (!aiReportModal || !aiReportContent || !slips || !menu) return;

    // モーダルを開き、ローディング表示
    openModal(aiReportModal);
    aiReportContent.innerHTML = `
        <p class="text-slate-500 text-center py-8">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i><br>
            AIがデータを分析中です... (Gemini Pro)
        </p>`;

    // データを準備 (★初回管理 変更★ リファクタリングに合わせて修正)
    const { paidSlips, range } = getSlipsForPeriod(currentReportPeriod, currentReportDate);
    
    // 期間のテキストを生成
    let periodText = "";
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    if (currentReportPeriod === 'daily') {
        periodText = `日次 (${range.start.toLocaleDateString('ja-JP', options)})`;
    } else if (currentReportPeriod === 'weekly') {
        periodText = `週次 (${range.start.toLocaleDateString('ja-JP', options)} 〜 ${range.end.toLocaleDateString('ja-JP', options)})`;
    } else {
        periodText = `月次 (${range.start.getFullYear()}年${range.start.getMonth() + 1}月)`;
    }

    try {
        const reportMarkdown = await getSalesReport(paidSlips, menu, periodText);
        
        // Markdownを簡易HTMLに変換して表示
        aiReportContent.innerHTML = parseMarkdownReport(reportMarkdown);

    } catch (error) {
        console.error("AI report error:", error);
        aiReportContent.innerHTML = `<p class="text-red-500 text-center py-8">分析に失敗しました。(${error.message})</p>`;
    }
};


/**
 * (★報酬削除★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
 */
const getDefaultSettings = () => {
    return {
        // (★簡易版★ reports.js が必要なデータのみ)
        storeInfo: {
            name: "Night POS",
            address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000",
            zip: "160-0021" 
        },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
    };
};

const getDefaultMenu = () => {
    // (★簡易版★ reports.js は menu を参照しないため空でも良い)
    return {
        categories: [],
        items: []
    };
};

// (★要望4, 5★)
/**
 * (★新規★) ヘッダーのストア名をレンダリングする
 */
const renderHeaderStoreName = () => {
    if (!headerStoreName || !settings || !currentStoreId) return;

    const currentStoreName = (settings.storeInfo && settings.storeInfo.name) ? settings.storeInfo.name : "店舗";
    
    // (★変更★) loading... を店舗名で上書き
    headerStoreName.textContent = currentStoreName;
};

/**
 * (★コール管理 変更★) --- Firestore リアルタイムリスナー ---
 */
document.addEventListener('firebaseReady', (e) => {
    
    // (★初回管理 変更★) castsCollectionRef を追加
    const { 
        settingsRef: sRef, 
        menuRef: mRef,
        castsCollectionRef: cRef, // (★初回管理★) 追加
        slipsCollectionRef: slRef,
        currentStoreId: csId
    } = e.detail;

    // (★初回管理 変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    menuRef = mRef;
    castsCollectionRef = cRef; // (★初回管理★) 追加
    slipsCollectionRef = slRef;
    currentStoreId = csId;

    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false; // (★初回管理★) 追加
    let slipsLoaded = false;

    // (★コール管理 変更★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★初回管理 変更★) castsLoaded を追加
        if (settingsLoaded && menuLoaded && castsLoaded && slipsLoaded) { 
            console.log("All data loaded. Rendering UI for reports.js");
            updateAllReports();
            renderHeaderStoreName(); // (★要望4★)
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

    // 3. (★初回管理★) Casts (名前参照用)
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));


    // 4. Slips
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id }); 
        });
        console.log("Slips loaded: ", slips.length);
        slipsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to slips: ", error);
        slipsLoaded = true; // (★修正★) エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'reports.html');

    // ===== DOM要素の取得 =====
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    reportsSummaryCards = document.getElementById('reports-summary');
    if (reportsSummaryCards) {
        reportTotalSales = document.getElementById('summary-total-sales');
        reportTotalSlips = document.getElementById('summary-total-slips');
        reportAvgSales = document.getElementById('summary-avg-sales');
        reportCancelledSlips = document.getElementById('summary-cancelled-slips');
    }
    reportsPeriodTabs = document.getElementById('reports-period-tabs');
    reportsChartCanvas = document.getElementById('reports-chart');
    reportsRankingList = document.getElementById('reports-ranking-list');
    
    // (★初回管理★) ランキングDOM取得
    reportsPhotoRankingList = document.getElementById('reports-photo-ranking-list');
    reportsPhotoLoading = document.getElementById('reports-photo-loading');
    reportsSendRankingList = document.getElementById('reports-send-ranking-list');
    reportsSendLoading = document.getElementById('reports-send-loading');
    
    exportJpgBtn = document.getElementById('export-jpg-btn');
    reportContentArea = document.getElementById('reports-content-area'); 
    
    // (★新規★) 日付ピッカー
    reportDatePicker = document.getElementById('report-date-picker'); 
    if(reportDatePicker) {
        currentReportDate = new Date();
        reportDatePicker.value = currentReportDate.toISOString().split('T')[0];
    }
    
    // (★AI対応★)
    aiAnalyzeBtn = document.getElementById('ai-analyze-btn');
    aiReportModal = document.getElementById('ai-report-modal');
    aiReportContent = document.getElementById('ai-report-content');
    
    headerStoreName = document.getElementById('header-store-name'); 
    
    // ===== イベントリスナーの設定 =====

    // (★変更★) モーダルを閉じるボタン
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => { 
                const modal = e.target.closest('.modal-backdrop'); 
                if (modal) {
                    closeModal(modal);
                }
            });
        });
    }


    if (reportsPeriodTabs) {
        reportsPeriodTabs.querySelectorAll('button').forEach(tab => {
            tab.addEventListener('click', () => {
                reportsPeriodTabs.querySelectorAll('button').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                currentReportPeriod = tab.dataset.period;
                updateAllReports();
            });
        });
    }

    if(reportDatePicker) {
        reportDatePicker.addEventListener('change', (e) => {
            // (★修正★) タイムゾーンを考慮して Date オブジェクトを生成
            const dateParts = e.target.value.split('-').map(Number);
            currentReportDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            updateAllReports();
        });
    }

    // (★AI対応★) AI分析ボタン
    if (aiAnalyzeBtn) {
        aiAnalyzeBtn.addEventListener('click', () => {
            handleAiReport();
        });
    }

    if (exportJpgBtn && reportContentArea) {
        exportJpgBtn.addEventListener('click', () => {
            
            if (salesChart) {
                salesChart.options.animation = false; 
                salesChart.update(0); 
            }

            html2canvas(reportContentArea, {
                useCORS: true, 
                scale: 2 
            }).then(canvas => {
                const link = document.createElement('a');
                const dateStr = currentReportDate.toISOString().split('T')[0];
                link.download = `report-${currentReportPeriod}-${dateStr}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9); 
                link.click();
                
                if (salesChart) {
                    salesChart.options.animation = true; 
                }
            });
        });
    }
    
});