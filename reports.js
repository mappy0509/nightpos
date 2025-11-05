// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    // addDoc, (★削除★)
    // deleteDoc, (★削除★)
    doc,
    collection // (★削除★)
} from './firebase-init.js';

// (★削除★) エラーの原因となった以下の参照(Ref)のインポートを削除
/*
import {
    settingsRef,
    menuRef,
    // slipCounterRef, (★削除★)
    castsCollectionRef,
    // customersCollectionRef, (★削除★)
    slipsCollectionRef
} from './firebase-init.js';
*/

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
// let customers = []; // (★削除★)
let slips = [];
// let slipCounter = 0; // (★削除★)

// (★削除★) 伝票関連のローカル変数を削除
// let currentSlipId = null;
// let currentBillingAmount = 0; 

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, castsCollectionRef, slipsCollectionRef;


// ===== DOM要素 =====
// (★修正★) reports.js (reports.html) に必要なDOMのみに限定
let modalCloseBtns, // (★削除★) モーダルが無いため、本当は不要だが念のため残す
    reportsSummaryCards, reportTotalSales, reportTotalSlips, reportAvgSales, reportCancelledSlips,
    reportsPeriodTabs, reportsChartCanvas, reportsRankingList, exportJpgBtn,
    reportContentArea,
    // (★新規★) 日付選択
    reportDatePicker;
    
// (★削除★) 他のHTMLからコピーされたモーダル用のDOMをすべて削除
// newSlipConfirmModal, slipSelectionModal, etc...

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

// (★削除★) 伝票関連のヘルパー関数 (formatDateTimeLocal, formatElapsedTime, calculateSlipTotal, getCastNameById, getActiveSlipCount) をすべて削除


/**
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    // (★変更★) reports.html にはモーダルが無いため、この関数は実質不要だが、
    // DOMContentLoaded 内のリスナーが参照しているため残す (中身は空でも良い)
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
 * @returns {object} { paidSlips: [], cancelledSlips: [] }
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
        
        // (★変更★) ボツ伝も paidTimestamp が記録されていれば、それで判定
        if (slip.paidTimestamp) {
             const cancelledTime = new Date(slip.paidTimestamp).getTime();
             return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
        }
        // (★変更★) 記録がなければ startTime で判定 (フォールバック)
        if (slip.startTime) {
             const cancelledTime = new Date(slip.startTime).getTime();
             return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
        }
        return false;
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
    if (!reportsSummaryCards || !slips) return; 
    
    const { paidSlips, cancelledSlips } = getSlipsForPeriod(currentReportPeriod, currentReportDate);
    
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
 * (★修正★) 売れ筋商品ランキングを計算・表示する
 */
const renderReportsRanking = () => {
    if (!reportsRankingList || !slips) return; 
    
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
    if (!reportsChartCanvas || !slips) return;
    
    const period = currentReportPeriod;
    const baseDate = currentReportDate;
    const { paidSlips, range } = getSlipsForPeriod(period, baseDate);
    
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
            data[weekIndex] += (slip.paidAmount || 0); 
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
 * (★削除★) 伝票関連のモーダル共通情報更新は不要
 */
// const updateModalCommonInfo = () => { ... };

/**
 * (★新規★) 全レポートを更新する
 */
const updateAllReports = () => {
    if (!settings || !slips || !menu) return; 
    renderReportsSummary();
    renderReportsRanking();
    renderSalesChart();
};

// (★削除★) 伝票作成関連のロジック (createNewSlip, renderSlipSelectionModal, renderNewSlipConfirmModal) をすべて削除


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    return {
        // (★簡易版★ reports.js が必要なデータのみ)
        storeInfo: {
            name: "Night POS", address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000", zip: "160-0021"
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

// (★削除★) Firestore への state 保存関数
// const updateStateInFirestore = async (newState) => { ... };

// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        settingsRef: sRef, 
        menuRef: mRef,
        castsCollectionRef: cRef, 
        slipsCollectionRef: slRef
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    menuRef = mRef;
    castsCollectionRef = cRef;
    slipsCollectionRef = slRef;

    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let slipsLoaded = false;
    // (★削除★) customersLoaded, counterLoaded

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) reports.js は updateAllReports を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for reports.js");
            updateAllReports();
            // (★削除★) updateModalCommonInfo(); 
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

    // (★削除★) 3. Slip Counter
    
    // 4. Casts (売れ筋商品ランキングでは不要だが、将来的なキャスト別売上のため残す)
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));

    // (★削除★) 5. Customers
    // (★変更★) customersLoaded を true に固定
    const customersLoaded = true;
    
    // 6. Slips
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
        if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
             document.body.innerHTML = `<div class="p-8 text-center text-red-600">データベースへのアクセスに失敗しました。Firestoreのセキュリティルール（slipsコレクション）が正しく設定されているか、または必要なインデックスが作成されているか確認してください。</div>`;
        }
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
    exportJpgBtn = document.getElementById('export-jpg-btn');
    reportContentArea = document.getElementById('reports-content-area'); 
    
    // (★新規★) 日付ピッカー
    reportDatePicker = document.querySelector('input[type="date"]');
    if(reportDatePicker) {
        currentReportDate = new Date();
        reportDatePicker.value = currentReportDate.toISOString().split('T')[0];
    }
    
    // (★削除★) 伝票関連モーダルのDOM取得を削除
    
    // ===== 初期化処理 =====
    // (★削除★) 初回描画は onSnapshot に任せる
    
    // ===== イベントリスナーの設定 =====

    // (★変更★) モーダルを閉じるボタン (HTMLにはもう存在しないが、念のため残す)
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(); // (★変更★)
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
            const dateParts = e.target.value.split('-').map(Number);
            currentReportDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            updateAllReports();
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
    
    // (★削除★) 伝票関連のリスナーをすべて削除
    // (slipSelectionList, createNewSlipBtn, confirmCreateSlipBtn)

});