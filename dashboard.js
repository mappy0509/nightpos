// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot のみ 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot
    // (★エラー修正★) 以下の関数は firebaseReady イベント経由で受け取る
    // setDoc, 
    // addDoc, 
    // deleteDoc, 
    // doc,
    // collection,
    // getDoc, 
    // serverTimestamp,
    // query,
    // where
} from './firebase-init.js';

// (★一括会計 修正★) ai-service.js の不要なインポートを削除

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
let attendances = []; // (★勤怠機能追加★)
let inventoryItems = []; // (★在庫管理 追加★)
let champagneCalls = []; // (★コール管理 追加★)
let slipCounter = 0;

// (★変更★) 現在選択中の伝票ID (ローカル管理)
let currentSlipId = null;
let currentBillingAmount = 0;
let currentOrderModalCategoryId = null; // (★新規★) オーダーモーダルで選択中のカテゴリID

// (★新規★) 経過時間更新用のタイマーID
let elapsedTimeTimer = null;

// (★変更★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, slipCounterRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef,
    attendancesCollectionRef, // (★勤怠機能追加★)
    inventoryItemsCollectionRef, // (★在庫管理 追加★)
    champagneCallsCollectionRef, // (★コール管理 追加★)
    currentStoreId; // (★動的表示 追加★)

// (★エラー修正★) firebaseReady から受け取る関数
let fbQuery, fbWhere, fbOrderBy, fbCollection, fbDoc;
let fbSetDoc, fbAddDoc, fbDeleteDoc, fbGetDoc, fbServerTimestamp;


// ===== DOM要素 =====
// (★修正★) dashboard.js (index.html) に必要なDOMのみに限定
let /* navLinks, (★削除★) */ pageTitle, dashboardSlips,
    orderModal, checkoutModal, receiptModal,
    slipPreviewModal, modalCloseBtns, openSlipPreviewBtn, processPaymentBtn,
    printSlipBtn, goToCheckoutBtn, reopenSlipBtn, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    saveMenuItemBtn, 
    cancelSlipModal, openCancelSlipModalBtn, cancelSlipModalTitle, cancelSlipNumber,
    cancelSlipReasonInput, cancelSlipError, confirmCancelSlipBtn, slipSelectionModal,
    slipSelectionModalTitle, slipSelectionList, createNewSlipBtn, newSlipConfirmModal,
    newSlipConfirmTitle, newSlipConfirmMessage, confirmCreateSlipBtn, orderModalTitle,
    orderItemsList, 
    orderCategoryTabsContainer, // (★新規★) オーダーモーダル・カテゴリタブ
    menuOrderGrid, orderSubtotalEl, orderCustomerNameSelect,
    orderNominationSelect, newCustomerInputGroup, newCustomerNameInput,
    saveNewCustomerBtn, newCustomerError, checkoutModalTitle, checkoutItemsList,
    checkoutSubtotalEl, checkoutServiceChargeEl, checkoutTaxEl, checkoutPaidAmountEl,
    checkoutTotalEl, paymentCashInput, paymentCardInput, paymentCreditInput,
    checkoutPaymentTotalEl, checkoutShortageEl, checkoutChangeEl, slipSubtotalEl,
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl, castRankingList,
    rankingPeriodSelect, rankingTypeBtns,
    
    // (★修正★) マイクランキング用のDOMを追加
    micRankingList, micRankingLoading,

    // (★要望1, 4, 5★) HTML側で変更したID
    summaryTotalSales, summarySalesComparison,
    summaryTableRate, summaryTableDetail,
    summaryAvgSpend, summaryAvgSpendComparison,
    summaryCastNum, summaryCastTrial,

    slipStoreName, slipStoreTel, slipServiceRate, slipTaxRate,
    checkoutStoreName, checkoutStoreTel, checkoutServiceRate, checkoutTaxRate,
    receiptStoreName, receiptAddress, receiptTel,
    
    // (★新規★) 割引機能
    discountAmountInput, discountTypeSelect,
    // (★新規★) 伝票作成時間
    newSlipStartTimeInput, newSlipTimeError,
    
    headerStoreName, // (★要望4★) storeSelector から変更

    // (★新規★) 転卓モーダル
    tableTransferModal, openTransferModalBtn, transferSlipNumber, 
    transferTableGrid, transferError,
    
    // (★要望5★) 領収書モーダルの新UI
    receiptForm, receiptCustomerNameInput, receiptDescriptionInput,
    receiptOptionDate, receiptOptionAmount,
    receiptPreviewArea, receiptDateDisplay, receiptCustomerNameDisplay,
    receiptTotalDisplay, receiptDescriptionDisplay, printReceiptBtn,
    
    // (★一括会計★) 一括会計モーダル
    bulkCheckoutBtn, bulkCheckoutModal, bulkCheckoutTitle, 
    bulkCheckoutCount, bulkCheckoutList, bulkCheckoutError,
    confirmBulkCheckoutBtn, bulkCheckoutBtnText;


// --- 関数 ---

/**
 * (★勤怠機能追加★) Dateオブジェクトを 'YYYY-MM-DD' 形式の文字列に変換する
 * @param {Date} date 
 * @returns {string}
 */
const formatDateISO = (date) => {
    return date.toISOString().split('T')[0];
};

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        amount = 0;
    }
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
 * (変更) 伝票の合計金額（割引前）を計算する (stateの税率を使用)
 * @param {object} slip 伝票データ
 * @returns {number} 合計金額
 */
const calculateSlipTotal = (slip) => {
    // (★変更★) settings を参照
    if (!settings || !settings.rates) return 0; // (★修正★) settings.rates もチェック
    
    // (★新規★) 端数処理
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    // (★修正★) slip.items が存在しない場合を考慮
    (slip.items || []).forEach(item => {
        subtotal += (item.price || 0) * (item.qty || 0);
    });
    
    // (★新規★) サービス料・税金計算前に小計を端数処理 (例: 10円単位に切り上げ)
    if (rounding.type === 'round_up_subtotal') {
        subtotal = Math.ceil(subtotal / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_subtotal') {
        subtotal = Math.floor(subtotal / rounding.unit) * rounding.unit;
    }

    const serviceCharge = subtotal * (settings.rates.service || 0); // (★修正★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * (settings.rates.tax || 0); // (★修正★)
    let total = subtotalWithService + tax;
    
    // (★新規★) 最終合計金額の端数処理
    if (rounding.type === 'round_up_total') {
        total = Math.ceil(total / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_total') {
        total = Math.floor(total / rounding.unit) * rounding.unit;
    } else {
        total = Math.round(total);
    }
    
    return total;
};

/**
 * (★一括会計★) 伝票の *最終請求額* (割引・端数処理後) を計算する
 * @param {object} slip 
 * @returns {number} 最終請求額
 */
const calculateFinalBillingAmount = (slip) => {
    if (!settings) return 0;
    
    const total = calculateSlipTotal(slip); // 割引前合計
    const paidAmount = slip.paidAmount || 0; // 既払い金
    const preDiscountTotal = total - paidAmount; 

    const discount = slip.discount || { type: 'yen', value: 0 };
    const discountAmount = discount.value || 0;
    const discountType = discount.type || 'yen';
    
    let finalBillingAmount = preDiscountTotal;
    if (discountType === 'yen') {
        finalBillingAmount = preDiscountTotal - discountAmount;
    } else if (discountType === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discountAmount / 100));
    }
    
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (rounding.type === 'round_up_total') {
        finalBillingAmount = Math.ceil(finalBillingAmount / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_total') {
        finalBillingAmount = Math.floor(finalBillingAmount / rounding.unit) * rounding.unit;
    } else {
        finalBillingAmount = Math.round(finalBillingAmount); 
    }

    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }
    return finalBillingAmount;
};


/**
 * (★修正★) キャストIDからキャスト名を取得する (reports.js から移植)
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!casts) return '不明'; 
    if (!castId || castId === 'none' || castId === 'null') return '（未割り当て）'; // (★reports.jsから修正★) (★修正★) 'null' も
    const cast = casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (ボツ伝は除外)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    // (★変更★) slips を参照
    if (!slips) return 0; 
    return slips.filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
};


// =================================================
// (★新規★) reports.js から集計ヘルパー関数を移植
// =================================================

/**
 * (★新規★) 営業日付の開始時刻を取得する
 * @param {Date} date 対象の日付
 * @returns {Date} 営業開始日時
 */
const getBusinessDayStart = (date) => {
    // (★変更★) settings を参照
    if (!settings || !settings.dayChangeTime) {
        // state未読み込みか、設定がない場合は AM 00:00
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }
    
    const [hours, minutes] = settings.dayChangeTime.split(':').map(Number);
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
    // (★変更★) slips を参照
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
        // 基準日の週の月曜日（の営業開始時刻）
        const dayOfWeek = businessDayStart.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = businessDayStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜を週初めに
        startDate = new Date(businessDayStart); // (★修正★) 元の日付を変更しないようコピー
        startDate.setDate(diff); // (★修正★) コピーに対して setDate
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

    const paidSlips = slips.filter(slip => {
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        try { // (★修正★)
            const paidTime = new Date(slip.paidTimestamp).getTime();
            if (isNaN(paidTime)) return false;
            return paidTime >= startTimestamp && paidTime <= endTimestamp;
        } catch(e) {
            return false;
        }
    });

    const cancelledSlips = slips.filter(slip => {
        if (slip.status !== 'cancelled') return false; 
        
        // (★勤怠機能修正★) 営業日ベースで判定
        // (★reports.jsからコピー★)
        try { // (★修正★)
            if (slip.paidTimestamp) { // (★修正★) ボツ伝の日時を paidTimestamp (ボツ確定時) で見る
                 const cancelledTime = new Date(slip.paidTimestamp).getTime();
                 if (isNaN(cancelledTime)) return false;
                 return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
            }
            if (slip.startTime) { // (★フォールバック★)
                 const cancelledTime = new Date(slip.startTime).getTime();
                 if (isNaN(cancelledTime)) return false;
                 return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
            }
        } catch (e) {
            return false;
        }
        return false;
    });

    return { paidSlips, cancelledSlips, range: { start: startDate, end: endDate } };
};


// =================================================
// /END (★新規★) reports.js から集計ヘルパー関数を移植
// =================================================


/**
 * (★要望1★ 変更) ダッシュボードサマリーを更新する
 */
const renderDashboardSummary = () => {
    // (★変更★) settings, attendances, slips が必要
    if (!settings || !attendances || !slips || !settings.tables) return; // (★修正★) settings.tables もチェック
    
    // --- (★要望1★) 総売上 & 平均客単価 (注文ベース) ---
    const todayBusinessStart = getBusinessDayStart(new Date());
    const todayBusinessEnd = getBusinessDayEnd(todayBusinessStart);
    
    // 1. 本日の「未会計」伝票 (active, checkout) を取得
    const activeSlipsToday = slips.filter(slip => {
        if (slip.status !== 'active' && slip.status !== 'checkout') return false;
        if (!slip.startTime) return false;
        try {
            const startTimeMs = new Date(slip.startTime).getTime();
            return startTimeMs >= todayBusinessStart.getTime() && startTimeMs <= todayBusinessEnd.getTime();
        } catch (e) {
            return false;
        }
    });
    
    // 2. 総売上 (注文ベース)
    let totalSales = 0;
    activeSlipsToday.forEach(slip => {
        totalSales += calculateSlipTotal(slip); // (割引前の合計)
    });
    if (summaryTotalSales) summaryTotalSales.textContent = formatCurrency(totalSales);
    if (summarySalesComparison) summarySalesComparison.textContent = "（現在の注文ベース）";

    // 3. 平均客単価 (注文ベース)
    const activeSlipCount = activeSlipsToday.length;
    const avgSales = activeSlipCount > 0 ? totalSales / activeSlipCount : 0;
    if (summaryAvgSpend) summaryAvgSpend.textContent = formatCurrency(Math.round(avgSales));
    if (summaryAvgSpendComparison) summaryAvgSpendComparison.textContent = "（現在の注文ベース）";


    // --- (★要望1★) テーブル稼働率 ---
    // (★修正★) getActiveSlipCount は全期間の未会計伝票を見るため、これで正しい
    const activeTables = settings.tables.filter(t => getActiveSlipCount(t.id) > 0).length;
    const totalTables = settings.tables.length;
    const usageRate = totalTables > 0 ? (activeTables / totalTables) * 100 : 0;
    
    if (summaryTableRate) summaryTableRate.textContent = `${Math.round(usageRate)}%`;
    if (summaryTableDetail) summaryTableDetail.textContent = `${activeTables} / ${totalTables} 卓`;
    

    // --- (★要望1★) 出勤キャスト ---
    // (★勤怠機能修正★) attendances から本日の出勤者数をカウント
    const businessDayStr = formatDateISO(todayBusinessStart); // (★修正★) 上で計算済みのものを再利用
    
    const checkedInCasts = attendances.filter(a => 
        a.date === businessDayStr && 
        (a.status === 'clocked_in' || a.status === 'late')
    ).length;
    
    if (summaryCastNum) summaryCastNum.innerHTML = `${checkedInCasts} <span class="text-lg font-medium">名</span>`;
    // (★仮★) 体験入店は 0 名
    if (summaryCastTrial) summaryCastTrial.textContent = "0名 体験入店"; 
};


/**
 * (★変更★) 経過時間を HH:MM 形式でフォーマットする
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
 * (★修正★) ダッシュボードの全伝票の経過時間を更新する
 */
const updateElapsedTimes = () => {
    if (!dashboardSlips) return;
    
    const now = new Date();
    const slipCards = dashboardSlips.querySelectorAll('.elapsed-time[data-start-time]');
    
    slipCards.forEach(el => {
        try {
            const startTimeStr = el.dataset.startTime;
            if (!startTimeStr) { // (★追加★) 空文字列チェック
                el.textContent = '??:??';
                return;
            }
            const startTime = new Date(startTimeStr);
            
            // (★修正★) NaNチェック (古い形式 "HH:MM" は Invalid Date になる)
            if (isNaN(startTime.getTime())) {
                el.textContent = '??:??';
                return;
            }

            const diffMs = now.getTime() - startTime.getTime();
            el.textContent = formatElapsedTime(diffMs);

        } catch (e) {
            console.error("Error parsing start time:", el.dataset.startTime, e);
            el.textContent = 'Error';
        }
    });
};


/**
 * (★変更★) ダッシュボードに未会計「伝票」一覧を描画する (ボツ伝は除外)
 */
const renderDashboardSlips = () => {
    if (!dashboardSlips || !slips) return; // (★変更★)
    dashboardSlips.innerHTML = ''; 

    const activeSlips = slips.filter(
        slip => slip.status === 'active' || slip.status === 'checkout'
    );
    
    activeSlips.sort((a, b) => (b.slipNumber || 0) - (a.slipNumber || 0)); // (★修正★) slipNumber がない場合

    if (activeSlips.length === 0) {
        dashboardSlips.innerHTML = '<p class="text-slate-500 text-sm md:col-span-2">現在、未会計の伝票はありません。</p>';
        // (★新規★) 伝票が0件になったらタイマーを止める
        if (elapsedTimeTimer) {
            clearInterval(elapsedTimeTimer);
            elapsedTimeTimer = null;
        }
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
            default: // (★追加★)
                statusColor = 'gray';
                statusText = '不明';
                break;
        }
        
        const nominationText = getCastNameById(slip.nominationCastId);
        
        // (★変更★) 経過時間表示用の要素を追加
        const card = `
            <button class="w-full text-left p-4 bg-white rounded-lg shadow-md border hover:bg-slate-50" 
                    data-slip-id="${slip.slipId}" data-status="${slip.status}">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xl font-bold">
                        <i class="fa-solid fa-table fa-fw text-slate-400 mr-1"></i>${slip.tableId || '?'} (No.${slip.slipNumber || '?'})
                    </span>
                    <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
                </div>
                <div class="text-left">
                    <p class="text-sm font-medium truncate">${slip.name || 'ゲスト'}</p>
                    <p class="text-sm font-semibold text-orange-600 elapsed-time" data-start-time="${slip.startTime || ''}">--:--</p>
                    <p class="text-xs text-pink-600 font-medium mt-1 truncate"><i class="fa-solid fa-star fa-fw mr-1"></i>${nominationText}</p>
                </div>
            </button>
        `;
        dashboardSlips.innerHTML += card;
    });

    // (★新規★) 描画が完了したら、経過時間を即時更新
    updateElapsedTimes();
    
    // (★新規★) タイマーが動いていなければ、10秒ごとに開始
    if (!elapsedTimeTimer) {
        elapsedTimeTimer = setInterval(updateElapsedTimes, 10000); // 10秒ごとに更新
    }
};


/**
 * (★変更★) 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    // (★変更★) menu と settings を参照
    if (!settings || !menu || !slips || !casts || !customers) return; // (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    orderNominationSelect.innerHTML = '<option value="null">フリー</option>';
    casts.forEach(cast => { // (★変更★)
        orderNominationSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
    });
    orderNominationSelect.value = slipData.nominationCastId || 'null';

    renderCustomerDropdown(slipData.nominationCastId);
    
    const customerExists = customers.find(c => c.name === slipData.name); // (★変更★)
    if (customerExists) {
        orderCustomerNameSelect.value = slipData.name;
        newCustomerInputGroup.classList.add('hidden');
    } else {
        orderCustomerNameSelect.value = 'new_customer';
        newCustomerInputGroup.classList.remove('hidden');
        newCustomerNameInput.value = (slipData.name === "新規のお客様") ? "" : slipData.name;
    }
    newCustomerError.textContent = '';

    // (新規) 伝票タグを描画
    renderSlipTags(slipData);
    
    orderItemsList.innerHTML = '';
    let subtotal = 0;
    // (★修正★) slip.items が存在しない場合を考慮
    (slipData.items || []).forEach(item => {
        const itemTotal = (item.price || 0) * (item.qty || 0); // (★修正★)
        subtotal += itemTotal;
        orderItemsList.innerHTML += `
            <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border">
                <div>
                    <p class="font-semibold">${item.name || '不明な商品'}</p>
                    <p class="text-sm text-slate-500">${formatCurrency(item.price || 0)}</p>
                </div>
                <div class="flex items-center space-x-3">
                    <input type="number" value="${item.qty || 1}" class="w-16 p-1 border rounded text-center order-item-qty-input" data-item-id="${item.id}">
                    <span class="font-semibold w-20 text-right">${formatCurrency(itemTotal)}</span>
                    <button class="remove-order-item-btn text-red-500 hover:text-red-700" data-item-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    orderSubtotalEl.textContent = formatCurrency(subtotal);
    
    // (★新規★) オーダーモーダルのカテゴリタブを描画
    if (!menu.categories || menu.categories.length === 0) {
        if(orderCategoryTabsContainer) orderCategoryTabsContainer.innerHTML = '';
        if(menuOrderGrid) menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">メニューカテゴリが登録されていません。</p>';
        return;
    }
    
    // (★新規★) 選択中のカテゴリIDがなければ、先頭のカテゴリを選択
    if (!currentOrderModalCategoryId || !menu.categories.some(c => c.id === currentOrderModalCategoryId)) {
        currentOrderModalCategoryId = menu.categories.length > 0 ? menu.categories[0].id : null; // (★修正★)
    }
    
    renderOrderCategoryTabs();
    
    // (★変更★) 選択中カテゴリの商品のみ描画
    renderOrderMenuGrid();
};

/**
 * (★新規★) オーダーモーダルのカテゴリタブを描画する
 */
const renderOrderCategoryTabs = () => {
    if (!orderCategoryTabsContainer || !menu || !menu.categories) return;
    
    orderCategoryTabsContainer.innerHTML = '';
    // (★修正★) order でソート
    const sortedCategories = [...menu.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    sortedCategories.forEach(category => {
        const tabHTML = `
            <button class="order-category-tab ${category.id === currentOrderModalCategoryId ? 'active' : ''}" 
                    data-category-id="${category.id}">
                ${category.name}
            </button>
        `;
        orderCategoryTabsContainer.innerHTML += tabHTML;
    });
};

/**
 * (★新規★) オーダーモーダルのメニューグリッド部分のみを描画する
 */
const renderOrderMenuGrid = () => {
    if (!menuOrderGrid || !menu || !menu.items || !currentOrderModalCategoryId) {
        if (menuOrderGrid) menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">カテゴリを選択してください。</p>'; // (★修正★)
        return;
    }

    menuOrderGrid.innerHTML = ''; 
    
    const filteredItems = (menu.items || [])
        .filter(item => item.categoryId === currentOrderModalCategoryId)
        .sort((a,b) => (a.order || 0) - (b.order || 0)); // (★修正★) order でソート
    
    if (filteredItems.length === 0) {
        menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">このカテゴリにはメニューが登録されていません。</p>';
    } else {
        filteredItems.forEach(item => {
            menuOrderGrid.innerHTML += `
                <button class="menu-order-btn p-3 bg-white rounded-lg shadow border text-left hover:bg-slate-100" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}">
                    <p class="font-semibold text-sm">${item.name}</p>
                    <p class="text-xs text-slate-500">${formatCurrency(item.price)}</p>
                </button>
            `;
        });
    }
};

/**
 * (★新規★) オーダーモーダルのカテゴリを切り替える
 * @param {string} categoryId 
 */
const switchOrderCategory = (categoryId) => {
    currentOrderModalCategoryId = categoryId;
    renderOrderCategoryTabs(); // タブの active 状態を更新
    renderOrderMenuGrid(); // メニューグリッドを再描画
};


/**
 * (新規) 伝票タグを描画する
 * @param {object} slipData 
 */
const renderSlipTags = (slipData) => {
    const container = document.getElementById('order-tags-container');
    if (!container || !settings || !settings.slipTagsMaster) return; // (★変更★) (★修正★)
    container.innerHTML = '';
    
    // (★変更★) settings.slipTagsMaster を参照
    settings.slipTagsMaster.forEach(tag => {
        const isSelected = (slipData.tags || []).includes(tag.name); // (★修正★) slipData.tags
        const tagClass = isSelected 
            ? 'bg-blue-600 text-white' 
            : 'bg-slate-200 text-slate-700 hover:bg-slate-300';
        
        container.innerHTML += `
            <button class="slip-tag-btn px-3 py-1.5 rounded-full text-sm font-medium ${tagClass}" data-tag-name="${tag.name}">
                ${tag.name}
            </button>
        `;
    });
};

/**
 * (新規) 伝票にタグを追加/削除する
 * @param {string} tagName 
 */
const toggleSlipTag = async (tagName) => {
    if (!slips || !slipsCollectionRef) return; // (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId);
    if (!slipData) return;
    
    if (!slipData.tags) slipData.tags = []; // (★修正★)
    
    const tagIndex = slipData.tags.indexOf(tagName);
    if (tagIndex > -1) {
        slipData.tags.splice(tagIndex, 1);
    } else {
        slipData.tags.push(tagName);
    }
    
    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
        await fbSetDoc(slipRef, { tags: slipData.tags }, { merge: true }); // (★エラー修正★)
    } catch (e) {
        console.error("Error updating slip tags: ", e);
    }
    
    // (★変更★) onSnapshotが自動でUIを更新するが、即時反映のためにローカルで呼ぶ
    renderSlipTags(slipData);
};


/**
 * (新規) 顧客ドロップダウンを描画する
 * @param {string | null} selectedCastId 選択中のキャストID ('null' 文字列または実際のID)
 */
const renderCustomerDropdown = (selectedCastId) => {
    if (!customers) return; // (★変更★)
    const targetCastId = selectedCastId === 'null' ? null : selectedCastId;

    const filteredCustomers = customers.filter( // (★変更★)
        customer => customer.nominatedCastId === targetCastId
    );

    orderCustomerNameSelect.innerHTML = '';
    filteredCustomers.forEach(customer => {
        orderCustomerNameSelect.innerHTML += `<option value="${customer.name}">${customer.name}</option>`;
    });
    
    if (filteredCustomers.length === 0) {
        orderCustomerNameSelect.innerHTML += `<option value="" disabled>該当する顧客がいません</option>`;
    }

    orderCustomerNameSelect.innerHTML += `<option value="new_customer" class="text-blue-600 font-bold">--- 新規顧客を追加 ---</option>`;
};


/**
 * (変更) 伝票モーダルの顧客情報フォームの変更をstate.slipsに反映する
 */
const updateSlipInfo = async () => {
    if (!slips || !slipsCollectionRef) return; // (★変更★) (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const customerName = orderCustomerNameSelect.value;
    const nominationCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value; 

    let newName = slipData.name;
    if (customerName !== 'new_customer' && customerName !== "") { 
        newName = customerName;
    }
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${newName})`;

    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
        await fbSetDoc(slipRef, { // (★エラー修正★)
            name: newName,
            nominationCastId: nominationCastId
        }, { merge: true });
    } catch (e) {
        console.error("Error updating slip info: ", e);
    }
};

/**
 * (★コール管理 修正★) シャンパンコールをトリガー/更新する
 * (完了済みコールのアイテムを除外するロジックを追加)
 */
const checkAndTriggerChampagneCall = async (slipData) => {
    // 設定、メニュー、またはコール管理コレクションの参照がない場合は何もしない
    if (!settings || !settings.champagneCallBorders || settings.champagneCallBorders.length === 0 || !menu || !menu.items || !champagneCallsCollectionRef) {
        console.log("Call check skipped: feature not configured or data not ready.");
        return;
    }

    // (★新規★) 1. この伝票で既に「完了 (completed)」したコールに含まれるアイテムIDをリストアップ
    // (★重要★) champagneCalls グローバル変数から検索
    const completedCalls = champagneCalls.filter(c => c.slipId === slipData.slipId && c.status === 'completed');
    const completedItemIds = new Set();
    completedCalls.forEach(call => {
        (call.items || []).forEach(item => {
            // (★変更★) slipData.items には menuId が 'id' として入っている
            if(item.id) completedItemIds.add(item.id); 
        });
    });
    console.log("Completed item IDs for this slip:", completedItemIds);

    // 2. この伝票の「シャンパンコール対象」アイテムのうち、
    // (★変更★) 「未完了」のアイテムのみを合計する
    let callSubtotal = 0;
    const callItems = []; // 未完了のコール対象アイテムリスト
    for (const item of (slipData.items || [])) { // (★修正★)
        const menuItem = menu.items.find(m => m.id === item.id);
        
        // (★変更★) 完了済みリストに含まれて *いない* アイテムのみを対象
        if (menuItem && menuItem.isCallTarget && !completedItemIds.has(item.id)) { 
            callSubtotal += (item.price || 0) * (item.qty || 0); // (★修正★)
            // (★変更★) callItems にも item.id (メニューID) を含める
            callItems.push({ id: item.id, name: menuItem.name, qty: item.qty });
        }
    }

    // 3. 適用される最高の金額ボーダーを見つける
    const applicableBorders = settings.champagneCallBorders
        .filter(rule => callSubtotal >= rule.borderAmount)
        .sort((a, b) => b.borderAmount - a.borderAmount); // 金額が高い順 (降順)

    // 4. 適用されるボーダーがない場合
    if (applicableBorders.length === 0) {
        console.log("No champagne call border met for pending items.");
        return;
    }

    const highestBorder = applicableBorders[0];

    // 5. この伝票 (slipId) で、まだ「未対応 (pending)」のコールが既に存在するか確認
    const existingPendingCall = champagneCalls.find(call => call.slipId === slipData.slipId && call.status === 'pending');

    const callData = {
        slipId: slipData.slipId,
        tableId: slipData.tableId,
        totalAmount: callSubtotal, // (★変更★) 未完了アイテムの合計小計
        items: callItems, // (★変更★) 未完了アイテムのリスト
        borderAmount: highestBorder.borderAmount, // 達成したボーダー金額
        callType: highestBorder.callName, // 設定されたデフォルトのコール名
        status: 'pending',
        createdAt: fbServerTimestamp(), // (★エラー修正★) 常にサーバータイムスタンプで更新（リストの先頭に来るように）
        mainMicCastId: null,
        subMicCastId: null,
        completedAt: null
    };

    try {
        if (existingPendingCall) {
            // 6. 既存の「未対応」コールを更新する
            console.log(`Updating existing pending call ${existingPendingCall.id}`);
            const callRef = fbDoc(champagneCallsCollectionRef, existingPendingCall.id); // (★エラー修正★)
            await fbSetDoc(callRef, callData, { merge: true }); // (★エラー修正★)
        } else {
            // 7. 新規に「未対応」コールを作成する
            console.log("Creating new pending champagne call.");
            await fbAddDoc(champagneCallsCollectionRef, callData); // (★エラー修正★)
        }
    } catch (e) {
        console.error("Error triggering champagne call:", e);
    }
};


/**
 * (★コール管理 変更★) 注文リストにアイテムを追加する
 * @param {string} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = async (id, name, price) => {
    if (!slips || !slipsCollectionRef) return; // (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;
    
    if (!slipData.items) slipData.items = []; // (★修正★)

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    
    try {
        const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
        await fbSetDoc(slipRef, { items: slipData.items }, { merge: true }); // (★エラー修正★)
        
        // (★コール管理 追加★) オーダー変更後にコールをチェック
        await checkAndTriggerChampagneCall(slipData);
        
    } catch (e) {
        console.error("Error adding order item: ", e);
    }
    
    // (★修正★) onSnapshot で自動描画
    // renderOrderModal();
};

/**
 * (★コール管理 変更★) 注文リストからアイテムを削除する
 * @param {string} id 商品ID
 */
const removeOrderItem = async (id) => {
    if (!slips || !slipsCollectionRef) return; // (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData || !slipData.items) return; // (★修正★)

    slipData.items = slipData.items.filter(item => item.id !== id);
    
    try {
        const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
        await fbSetDoc(slipRef, { items: slipData.items }, { merge: true }); // (★エラー修正★)
        
        // (★コール管理 追加★) オーダー変更後にコールをチェック
        await checkAndTriggerChampagneCall(slipData);
        
    } catch (e) {
        console.error("Error removing order item: ", e);
    }
    // (★修正★) onSnapshot で自動描画
    // renderOrderModal();
};

/**
 * (★コール管理 変更★) 注文アイテムの数量を変更する
 * @param {string} id 商品ID
 * @param {number} qty 数量
 */
const updateOrderItemQty = async (id, qty) => {
    if (!slips || !slipsCollectionRef) return; // (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData || !slipData.items) return; // (★修正★)

    const item = slipData.items.find(item => item.id === id);
    if (item) {
        item.qty = qty;
    }
    
    try {
        const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
        await fbSetDoc(slipRef, { items: slipData.items }, { merge: true }); // (★エラー修正★)
        
        // (★コール管理 追加★) オーダー変更後にコールをチェック
        await checkAndTriggerChampagneCall(slipData);
        
    } catch (e) {
        console.error("Error updating order item qty: ", e);
    }
    // (★修正★) onSnapshot で自動描画
    // renderOrderModal();
};


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; 

    const store = settings.storeInfo || {}; // (★修正★)
    const rates = settings.rates || { tax: 0.1, service: 0.2 }; // (★修正★)
    
    const receiptSettings = settings.receiptSettings || {
        storeName: store.name,
        address: `〒${store.zip || ''}<br>${store.address || ''}`,
        tel: `TEL: ${store.tel}`,
        invoiceNumber: "" 
    };

    if (slipStoreName) slipStoreName.textContent = store.name;
    if (slipStoreTel) slipStoreTel.textContent = `TEL: ${store.tel}`;
    if (slipServiceRate) slipServiceRate.textContent = `サービス料 (${(rates.service || 0) * 100}%)`; // (★修正★)
    if (slipTaxRate) slipTaxRate.textContent = `消費税 (${(rates.tax || 0) * 100}%)`; // (★修正★)

    if (checkoutStoreName) checkoutStoreName.textContent = store.name;
    if (checkoutStoreTel) checkoutStoreTel.textContent = `TEL: ${store.tel}`;
    if (checkoutServiceRate) checkoutServiceRate.textContent = `サービス料 (${(rates.service || 0) * 100}%)`; // (★修正★)
    if (checkoutTaxRate) checkoutTaxRate.textContent = `消費税 (${(rates.tax || 0) * 100}%)`; // (★修正★)

    if (receiptStoreName) receiptStoreName.textContent = receiptSettings.storeName || store.name;
    if (receiptAddress) receiptAddress.innerHTML = receiptSettings.address || `〒${store.zip || ''}<br>${store.address || ''}`;
    if (receiptTel) receiptTel.textContent = receiptSettings.tel || `TEL: ${store.tel}`;
    const invoiceEl = document.getElementById('receipt-invoice-number');
    if (invoiceEl) {
        if (receiptSettings.invoiceNumber) {
            invoiceEl.textContent = `インボイス登録番号: ${receiptSettings.invoiceNumber}`;
            invoiceEl.style.display = 'block';
        } else {
            invoiceEl.style.display = 'none';
        }
    }
};


/**
 * (変更) 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = async () => {
    if (!settings || !slips || !slipsCollectionRef) return; // (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;
    
    try {
        const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
        await fbSetDoc(slipRef, { status: 'checkout' }, { merge: true }); // (★エラー修正★)
    } catch (e) {
        console.error("Error updating slip status: ", e);
    }
    // (★修正★) onSnapshot でローカルの slipData.status が 'checkout' に更新されるのを待つ
    // slipData.status = 'checkout';


    document.getElementById('slip-preview-title').textContent = `伝票プレビュー (No.${slipData.slipNumber})`;
    
    const now = new Date();
    document.getElementById('slip-datetime').textContent = now.toLocaleString('ja-JP');

    document.getElementById('slip-slip-number').textContent = slipData.slipNumber;
    document.getElementById('slip-table-id').textContent = slipData.tableId;
    document.getElementById('slip-customer-name').textContent = slipData.name || 'ゲスト';
    document.getElementById('slip-nomination').textContent = getCastNameById(slipData.nominationCastId);

    const slipItemsList = document.getElementById('slip-items-list');
    slipItemsList.innerHTML = '';
    let subtotal = 0;
    (slipData.items || []).forEach(item => { // (★修正★)
        const itemTotal = (item.price || 0) * (item.qty || 0); // (★修正★)
        subtotal += itemTotal;
        slipItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(itemTotal)}</span>
            </div>
        `;
    });
    
    const total = calculateSlipTotal(slipData);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount;
    
    const simpleSubtotal = (slipData.items || []).reduce((acc, item) => acc + ((item.price || 0) * (item.qty || 0)), 0); // (★修正★)
    const serviceCharge = simpleSubtotal * (settings.rates.service || 0); // (★修正★)
    const subtotalWithService = simpleSubtotal + serviceCharge;
    const tax = subtotalWithService * (settings.rates.tax || 0); // (★修正★)

    slipSubtotalEl.textContent = formatCurrency(simpleSubtotal);
    slipServiceChargeEl.textContent = formatCurrency(Math.round(serviceCharge));
    slipTaxEl.textContent = formatCurrency(Math.round(tax));
    slipPaidAmountEl.parentElement.style.display = paidAmount > 0 ? 'flex' : 'none';
    slipPaidAmountEl.textContent = `-${formatCurrency(paidAmount)}`;
    slipTotalEl.textContent = formatCurrency(billingAmount);
};


/**
 * (★修正★) 会計モーダルを描画する (割引計算ロジック追加 + 端数処理)
 */
const renderCheckoutModal = () => {
    if (!settings || !slips) return; // (★変更★) (★修正★)
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;

    checkoutModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name}) - お会計`;
    
    let subtotal = 0;
    checkoutItemsList.innerHTML = '';
    (slipData.items || []).forEach(item => { // (★修正★)
        const itemTotal = (item.price || 0) * (item.qty || 0); // (★修正★)
        subtotal += itemTotal;
        checkoutItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(itemTotal)}</span>
            </div>
        `;
    });
    
    const total = calculateSlipTotal(slipData);
    const paidAmount = slipData.paidAmount || 0;
    const preDiscountTotal = total - paidAmount; 

    const discountAmount = parseInt(discountAmountInput.value) || 0;
    const discountType = discountTypeSelect.value;
    
    let finalBillingAmount = preDiscountTotal;
    if (discountType === 'yen') {
        finalBillingAmount = preDiscountTotal - discountAmount;
    } else if (discountType === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discountAmount / 100));
    }
    
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (rounding.type === 'round_up_total') {
        finalBillingAmount = Math.ceil(finalBillingAmount / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_total') {
        finalBillingAmount = Math.floor(finalBillingAmount / rounding.unit) * rounding.unit;
    } else {
        finalBillingAmount = Math.round(finalBillingAmount); 
    }

    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    currentBillingAmount = finalBillingAmount; 
    
    const serviceCharge = subtotal * (settings.rates.service || 0); // (★修正★)
    const tax = (subtotal + serviceCharge) * (settings.rates.tax || 0); // (★修正★)

    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(Math.round(serviceCharge));
    checkoutTaxEl.textContent = formatCurrency(Math.round(tax));
    checkoutPaidAmountEl.parentElement.style.display = paidAmount > 0 ? 'flex' : 'none';
    checkoutPaidAmountEl.textContent = `-${formatCurrency(paidAmount)}`;
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount); 
    
    paymentCashInput.value = '';
    paymentCardInput.value = '';
    paymentCreditInput.value = '';

    updatePaymentStatus(); 

    if(receiptTotalDisplay) receiptTotalDisplay.textContent = formatCurrency(finalBillingAmount);
};

/**
 * (★修正★) 会計モーダルの支払い状況を計算・更新する (割引再計算 + 端数処理)
 */
const updatePaymentStatus = () => {
    if (!settings) return; 

    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;

    const total = calculateSlipTotal(slipData);
    const paidAmount = slipData.paidAmount || 0;
    const preDiscountTotal = total - paidAmount; 

    const discountAmount = parseInt(discountAmountInput.value) || 0;
    const discountType = discountTypeSelect.value;
    
    let finalBillingAmount = preDiscountTotal;
    if (discountType === 'yen') {
        finalBillingAmount = preDiscountTotal - discountAmount;
    } else if (discountType === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discountAmount / 100));
    }

    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (rounding.type === 'round_up_total') {
        finalBillingAmount = Math.ceil(finalBillingAmount / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_total') {
        finalBillingAmount = Math.floor(finalBillingAmount / rounding.unit) * rounding.unit;
    } else {
        finalBillingAmount = Math.round(finalBillingAmount);
    }

    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    currentBillingAmount = finalBillingAmount;
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount);
    
    if(receiptTotalDisplay) receiptTotalDisplay.textContent = formatCurrency(finalBillingAmount);
    
    const billingAmount = currentBillingAmount; 

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
 * (★要望5★) 領収書モーダルを描画・更新する
 */
const renderReceiptModal = () => {
    if (!settings || !slips) return; // (★修正★)
    
    const slipData = slips.find(s => s.slipId === currentSlipId);
    if (!slipData) return;
    
    if (receiptCustomerNameInput) {
        receiptCustomerNameInput.value = slipData.name !== "新規のお客様" ? slipData.name : '';
    }
    if (receiptDescriptionInput) {
        receiptDescriptionInput.value = settings.receiptSettings?.defaultDescription || "お飲食代として";
    }
    if (receiptOptionDate) receiptOptionDate.checked = true;
    if (receiptOptionAmount) receiptOptionAmount.checked = true;
    
    updateReceiptPreview();

    // (★要望5★ 変更) 担当キャスト名を「指名キャスト」または「ログインキャスト」にする
    const receiptStaff = document.getElementById('receipt-staff');
    if (receiptStaff) {
        const nominatedCastName = getCastNameById(slipData.nominationCastId);
        if (nominatedCastName !== 'フリー' && nominatedCastName !== '不明') {
            receiptStaff.textContent = `担当: ${nominatedCastName}`;
        } else {
            receiptStaff.textContent = `担当: ${currentCastName}`; // (フォールバック)
        }
    }
};

/**
 * (★要望5★) 領収書プレビューを更新する
 */
const updateReceiptPreview = () => {
    if (!receiptPreviewArea) return;

    const name = receiptCustomerNameInput.value.trim() ? `${receiptCustomerNameInput.value.trim()} ` : '';
    const description = receiptDescriptionInput.value.trim() || 'お飲食代として';
    const showDate = receiptOptionDate.checked;
    const showAmount = receiptOptionAmount.checked;

    if (receiptCustomerNameDisplay) receiptCustomerNameDisplay.textContent = name;
    if (receiptDescriptionDisplay) receiptDescriptionDisplay.textContent = description;
    
    if (receiptDateDisplay) {
        const now = new Date();
        receiptDateDisplay.textContent = showDate ? `発行日: ${now.toLocaleDateString('ja-JP')}` : '';
    }
    
    if (receiptTotalDisplay) {
        receiptTotalDisplay.textContent = showAmount ? formatCurrency(currentBillingAmount) + " -" : '¥ ---';
    }
};


/**
 * (新規) ボツ伝理由入力モーダルを描画する
 */
const renderCancelSlipModal = () => {
    if (!slips) return; // (★変更★)
    const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
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
 * (★AI対応★) モーダルを閉じる
 */
const closeModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.remove('active');
    }
    // (★AI対応★) オーダーモーダルが閉じる場合、AIサジェストも隠す
    if (modalElement && modalElement.id === 'order-modal' && aiSuggestionBox) {
        aiSuggestionBox.classList.add('hidden');
    }
};

/**
 * (★変更★) 新しい伝票を作成し、伝票モーダルを開く
 * @param {string} tableId 
 * @param {string} startTimeISO (★変更★) 開始時刻のISO文字列
 */
const createNewSlip = async (tableId, startTimeISO) => {
    if (!settings || !slipCounterRef || !slipsCollectionRef) return; // (★変更★)
    const table = (settings.tables || []).find(t => t.id === tableId); // (★変更★) (★修正★)
    if (!table) return;

    // (★変更★) slipCounter を settings から取得してインクリメント
    const newSlipCounter = (slipCounter || 0) + 1;
    const newSlipNumber = newSlipCounter;
    
    // (★変更★) キャストアプリの場合、自動でログインキャストを指名に入れる
    const nominationCastId = currentCastId;

    const newSlip = {
        // slipId は addDoc で自動生成
        slipNumber: newSlipNumber,
        tableId: tableId,
        status: 'active',
        name: "新規のお客様",
        startTime: startTimeISO,
        nominationCastId: nominationCastId, 
        items: [],
        tags: [],
        paidAmount: 0,
        cancelReason: null,
        paymentDetails: { cash: 0, card: 0, credit: 0 },
        paidTimestamp: null, 
        discount: { type: 'yen', value: 0 }, 
    };
    
    try {
        // (★変更★) slipsCollectionRef に新しい伝票を追加
        const docRef = await fbAddDoc(slipsCollectionRef, newSlip); // (★エラー修正★)
        
        // (★変更★) slipCounterRef を更新
        await fbSetDoc(slipCounterRef, { count: newSlipNumber }); // (★エラー修正★)
        
        // (★変更★) ローカルの伝票IDを更新
        currentSlipId = docRef.id;

        // (★追加★) 割引フォームをリセット
        if (discountAmountInput) discountAmountInput.value = '';
        if (discountTypeSelect) discountTypeSelect.value = 'yen';

        // (★新規★) オーダーモーダルのカテゴリをリセット
        currentOrderModalCategoryId = null;
        // (★修正★) onSnapshot が renderOrderModal を呼ぶのを待つ
        // renderOrderModal();
        openModal(orderModal);

    } catch (e) {
        console.error("Error creating new slip: ", e);
    }
};

/**
 * (★一括会計 修正★) 在庫を減算する (エラーを throw するように変更)
 */
const reduceStock = async (slipData) => {
    if (!menu || !menu.items || !inventoryItems || !inventoryItemsCollectionRef) {
        console.warn("Cannot reduce stock: menu or inventory data missing.");
        return; // (★変更★) エラーはスローせず、処理をスキップ
    }

    const updates = new Map();

    for (const slipItem of (slipData.items || [])) { // (★修正★)
        const menuItem = menu.items.find(m => m.id === slipItem.id);
        
        if (menuItem && menuItem.inventoryItemId && menuItem.inventoryConsumption > 0) {
            const inventoryId = menuItem.inventoryItemId;
            const consumption = menuItem.inventoryConsumption * slipItem.qty;
            const currentUpdate = updates.get(inventoryId) || 0;
            updates.set(inventoryId, currentUpdate + consumption);
        }
    }
    
    if (updates.size === 0) {
        console.log(`No inventory items to update for this slip (No.${slipData.slipNumber}).`);
        return; // 在庫更新対象なし
    }

    const updatePromises = [];
    for (const [inventoryId, totalConsumption] of updates.entries()) {
        
        const itemDocRef = fbDoc(inventoryItemsCollectionRef, inventoryId); // (★エラー修正★)
        
        const localItem = inventoryItems.find(i => i.id === inventoryId);
        const currentStock = localItem ? (localItem.currentStock || 0) : 0;
        const newStock = currentStock - totalConsumption;

        console.log(`Reducing stock for ${inventoryId} (Slip No.${slipData.slipNumber}): ${currentStock} -> ${newStock}`);

        updatePromises.push(
            fbSetDoc(itemDocRef, { // (★エラー修正★)
                currentStock: newStock,
                updatedAt: fbServerTimestamp() // (★エラー修正★)
            }, { merge: true })
        );
    }
    
    try {
        await Promise.all(updatePromises);
        console.log(`Stock levels updated successfully for slip ${slipData.slipNumber}.`);
    } catch (error) {
        console.error(`Error updating stock levels for slip ${slipData.slipNumber}: `, error);
        // (★変更★) alert を削除し、エラーを throw して呼び出し元 (handleBulkCheckout) に伝える
        throw new Error(`在庫更新失敗 (伝票No.${slipData.slipNumber}): ${error.message}`);
    }
};


/**
 * (★変更★) 伝票選択モーダルを描画する
 * @param {string} tableId 
 */
const renderSlipSelectionModal = (tableId) => {
    if (!slips) return; // (★変更★)
    slipSelectionModalTitle.textContent = `テーブル ${tableId} の伝票一覧`;
    slipSelectionList.innerHTML = '';

    const activeSlips = slips.filter( // (★変更★)
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    );
    
    activeSlips.sort((a, b) => (b.slipNumber || 0) - (a.slipNumber || 0)); // (★修正★)

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
                default: // (★追加★)
                    statusColor = 'gray';
                    statusText = '不明';
                    break;
            }
            const nominationText = getCastNameById(slip.nominationCastId);

            let elapsedTimeStr = '--:--';
            let startTimeStr = '??:??';
            try { // (★修正★)
                const now = new Date();
                const startTime = new Date(slip.startTime);
                if (!isNaN(startTime.getTime())) {
                    const diffMs = now.getTime() - startTime.getTime();
                    elapsedTimeStr = formatElapsedTime(diffMs);
                    startTimeStr = startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                }
            } catch(e) {}

            slipSelectionList.innerHTML += `
                <button class="w-full text-left p-4 bg-slate-50 rounded-lg hover:bg-slate-100 border" data-slip-id="${slip.slipId}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-lg truncate">(No.${slip.slipNumber || '?'}) ${slip.name} (${nominationText})</span>
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
 * (★変更★) 新規伝票の作成確認モーダルを描画・表示する
 * @param {string} tableId 
 */
const renderNewSlipConfirmModal = (tableId) => {
    const modalStartTimeInput = document.getElementById('new-slip-start-time-input');
    const modalTimeError = document.getElementById('new-slip-time-error');

    newSlipConfirmTitle.textContent = `伝票の新規作成 (${tableId})`;
    newSlipConfirmMessage.textContent = `テーブル ${tableId} で新しい伝票を作成しますか？`;

    if (modalStartTimeInput) {
        modalStartTimeInput.value = formatDateTimeLocal(new Date());
    }
    if (modalTimeError) {
        modalTimeError.textContent = '';
    }

    confirmCreateSlipBtn.dataset.tableId = tableId; 

    openModal(newSlipConfirmModal);
};


/**
 * (★勤怠機能修正★) テーブルカードクリック時の処理
 * @param {string} tableId 
 */
const handleTableClick = (tableId) => {
    // (★勤怠機能追加★) 出勤チェック
    if (!isClockedIn) {
        alert("出勤打刻がされていません。\n操作を行うには「出勤」ページで出勤打刻をしてください。");
        return;
    }

    if (!settings || !settings.tables) return; // (★変更★) (★修正★)
    const tableData = settings.tables.find(t => t.id === tableId); // (★変更★)
    if (!tableData) return;
    
    const activeSlips = getActiveSlipCount(tableId);
    const tableStatus = activeSlips > 0 ? 'occupied' : 'available';

    if (tableStatus === 'available') {
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
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === slipId); // (★変更★)
    if (!slipData) return;

    currentSlipId = slipId; // (★変更★)

    // (★追加★) 割引情報をフォームに読み込む
    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;
    
    // (★新規★) オーダーモーダルのカテゴリをリセット
    currentOrderModalCategoryId = null;
    renderOrderModal();
    openModal(orderModal);

    // (★AI対応★) 伝票を開いたときにもAIサジェストを実行
    runUpsellSuggestion(slipData);
};

/**
 * (新規) 会計済み伝票カードクリック時の処理 (伝票一覧ページ)
 * @param {string} slipId 
 */
const handlePaidSlipClick = (slipId) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === slipId); // (★変更★)
    if (!slipData) return;

    currentSlipId = slipId; // (★変更★)
    
    // (★追加★) 割引情報をフォームに読み込む
    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;

    renderCheckoutModal(); 
    renderReceiptModal();
    openModal(receiptModal);
};


/**
 * (★コール管理 変更★) デフォルトの state を定義する関数
 */
const getDefaultSettings = () => {
    // (★一括会計 修正★)
    return {
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
        ],
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
        ],
        storeInfo: {
            name: "Night POS", address: "東京都新宿区歌舞伎町1-1-1",
            tel: "03-0000-0000", zip: "160-0021"
        },
        rates: { tax: 0.10, service: 0.20 },
        rounding: { type: 'none', unit: 1 }, 
        dayChangeTime: "05:00",
        // (★一括会計 修正★) firstVisitSettings を追加
        firstVisitSettings: {
            maxPhoto: 1,
            maxSend: 1
        },
        ranking: { period: 'monthly', type: 'nominations' },
        // (★コール管理 追加★)
        champagneCallBorders: [
            { callName: "シャンパンコール", borderAmount: 50000 },
        ]
    };
};

const getDefaultMenu = () => {
    const catSetId = getUUID();
    const catDrinkId = getUUID();
    const catCastId = getUUID(); 
    
    return {
        categories: [
            { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false, order: 0 }, // (★修正★)
            { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false, order: 1 }, // (★修正★)
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true, order: 2 }, // (★報酬削除★) (★修正★)
        ],
        items: [
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60, isCallTarget: false, order: 0 }, // (★修正★)
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null, isCallTarget: false, order: 0 }, // (★修正★)
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null, isCallTarget: false, order: 0 }, // (★修正★)
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};

/**
 * (★勤怠機能追加★) 現在の出勤ステータスを更新する
 */
const updateClockedInStatus = () => {
    if (!settings || !currentCastId || !attendances) {
        isClockedIn = false;
        return;
    }
    
    // 1. 今日の営業日を計算
    const businessDayStart = getBusinessDayStart(new Date());
    const businessDayStr = formatDateISO(businessDayStart);
    
    // 2. 今日の勤怠ドキュメントIDを特定
    const attendanceId = `${businessDayStr}_${currentCastId}`;
    
    // 3. 勤怠データを検索
    const todaysData = attendances.find(a => a.id === attendanceId);
    
    if (todaysData && (todaysData.status === 'clocked_in' || todaysData.status === 'late')) {
        isClockedIn = true;
    } else {
        isClockedIn = false;
    }
    console.log(`Cast Clocked In Status (for cast-order.js): ${isClockedIn}`);
};

/**
 * (★新規★) ログインキャストの情報を取得してグローバル変数にセット
 */
const loadCastInfo = async () => {
    if (!currentCastId || !castsCollectionRef) {
        console.warn("Cast ID or collection ref not ready.");
        return;
    }
    
    try {
        const castRef = fbDoc(castsCollectionRef, currentCastId); // (★エラー修正★)
        const castSnap = await fbGetDoc(castRef); // (★エラー修正★)

        if (castSnap.exists()) {
            currentCastName = castSnap.data().name || "キャスト";
        } else {
            console.warn("Cast document not found in Firestore.");
        }
    } catch (error) {
        console.error("Error fetching cast data: ", error);
    }
    
    // UI（ヘッダー名）に反映
    if (castHeaderName) castHeaderName.textContent = currentCastName;
};


// (★新規★) 転卓モーダルを描画する
const openTableTransferModal = () => {
    if (!settings || !slips || !transferTableGrid) return;
    
    const slipData = slips.find(s => s.slipId === currentSlipId);
    if (!slipData) return;
    
    transferSlipNumber.textContent = slipData.slipNumber;
    transferTableGrid.innerHTML = '';
    transferError.textContent = '';
    
    // 現在アクティブな伝票があるテーブルIDのリスト
    const activeTableIds = slips
        .filter(s => (s.status === 'active' || s.status === 'checkout') && s.slipId !== currentSlipId) // (★修正★) 自分自身は除外
        .map(s => s.tableId);
        
    // 全テーブルからアクティブなテーブルを除外 (＝空席)
    const availableTables = (settings.tables || []).filter(t => !activeTableIds.includes(t.id)); // (★修正★)
    
    if (availableTables.length === 0) {
        transferTableGrid.innerHTML = '<p class="text-slate-500 col-span-full">現在、移動可能な空席テーブルはありません。</p>';
    } else {
        availableTables.forEach(table => {
            const isCurrentTable = (table.id === slipData.tableId);
            transferTableGrid.innerHTML += `
                <button class="table-card-option" 
                        data-table-id="${table.id}" 
                        ${isCurrentTable ? 'disabled' : ''}
                        title="${isCurrentTable ? '現在のテーブルです' : ''}">
                    ${table.id}
                </button>
            `;
        });
    }
    
    openModal(tableTransferModal);
};

// (★新規★) 転卓を実行する
const handleTableTransfer = async (newTableId) => {
    if (!currentSlipId || !slipsCollectionRef) return;
    
    const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
    
    try {
        await fbSetDoc(slipRef, { tableId: newTableId }, { merge: true }); // (★エラー修正★)
        
        closeModal(tableTransferModal);
        closeModal(orderModal);
        // onSnapshot が自動でテーブル一覧を更新
        
    } catch (e) {
        console.error("Error transferring table: ", e);
        if (transferError) transferError.textContent = "テーブルの移動に失敗しました。";
    }
};


/**
 * (★コール管理 変更★) --- Firestore リアルタイムリスナー ---
 */
document.addEventListener('firebaseReady', async (e) => {
    
    // (★変更★) 認証情報と参照を取得
    const { 
        currentCastId: cId,
        settingsRef: sRef, 
        menuRef: mRef, 
        slipCounterRef: scRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef,
        attendancesCollectionRef: aRef, // (★勤怠機能追加★)
        inventoryItemsCollectionRef: iRef, // (★在庫管理 追加★)
        champagneCallsCollectionRef: ccRef, // (★コール管理 追加★)
        query, where, orderBy, collection, doc, // (★エラー修正★)
        setDoc, addDoc, deleteDoc, getDoc, serverTimestamp // (★エラー修正★)
    } = e.detail;

    // (★変更★) グローバル変数にセット
    currentCastId = cId;
    settingsRef = sRef;
    menuRef = mRef;
    slipCounterRef = scRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    attendancesCollectionRef = aRef; // (★勤怠機能追加★)
    inventoryItemsCollectionRef = iRef; // (★在庫管理 追加★)
    champagneCallsCollectionRef = ccRef; // (★コール管理 追加★)
    
    // (★エラー修正★) 関数をグローバル変数に割り当て
    fbQuery = query;
    fbWhere = where;
    fbOrderBy = orderBy;
    fbCollection = collection;
    fbDoc = doc;
    fbSetDoc = setDoc;
    fbAddDoc = addDoc;
    fbDeleteDoc = deleteDoc;
    fbGetDoc = getDoc;
    fbServerTimestamp = serverTimestamp;
    
    // (★新規★) まずキャスト情報を読み込む
    await loadCastInfo();

    // (★新規★) 全データをロードできたか確認するフラグ
    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;
    let attendancesLoaded = false; // (★勤怠機能追加★)
    let inventoryLoaded = false; // (★在庫管理 追加★)
    let callsLoaded = false; // (★コール管理 追加★)

    // (★コール管理 変更★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) cast-order.js は renderTableGrid を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded && attendancesLoaded && inventoryLoaded && callsLoaded) { // (★コール管理 変更★)
            console.log("All data loaded. Rendering UI for cast-order.js");
            renderTableGrid();
            updateModalCommonInfo(); 
            updateClockedInStatus(); // (★勤怠機能追加★)
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.log("No settings document found. Creating default settings...");
            const defaultSettings = getDefaultSettings();
            await fbSetDoc(settingsRef, defaultSettings); // (★エラー修正★)
            settings = defaultSettings;
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to settings: ", error);
        settingsLoaded = true;
        checkAndRenderAll();
    });

    // 2. Menu
    onSnapshot(menuRef, async (docSnap) => {
        if (docSnap.exists()) {
            menu = docSnap.data();
        } else {
            console.log("No menu document found. Creating default menu...");
            const defaultMenu = getDefaultMenu();
            await fbSetDoc(menuRef, defaultMenu); // (★エラー修正★)
            menu = defaultMenu;
        }
        menuLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to menu: ", error);
        menuLoaded = true;
        checkAndRenderAll();
    });

    // 3. Slip Counter
    onSnapshot(slipCounterRef, async (docSnap) => {
        if (docSnap.exists()) {
            slipCounter = docSnap.data().count;
        } else {
            console.log("No slip counter document found. Creating default counter...");
            await fbSetDoc(slipCounterRef, { count: 0 }); // (★エラー修正★)
            slipCounter = 0;
        }
        counterLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to slip counter: ", error);
        counterLoaded = true;
        checkAndRenderAll();
    });

    // 4. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to casts: ", error);
        castsLoaded = true;
        checkAndRenderAll();
    });

    // 5. Customers
    onSnapshot(customersCollectionRef, (querySnapshot) => {
        customers = [];
        querySnapshot.forEach((doc) => {
            customers.push({ ...doc.data(), id: doc.id });
        });
        console.log("Customers loaded: ", customers.length);
        customersLoaded = true;
        checkAndRenderAll();
    }, (error) => { // (★修正★)
        console.error("Error listening to customers: ", error);
        customersLoaded = true;
        checkAndRenderAll();
    });
    
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
        slipsLoaded = true; // (★修正★)
        checkAndRenderAll(); // (★修正★)
    });

    // 7. Attendances (★勤怠機能追加★)
    onSnapshot(attendancesCollectionRef, (querySnapshot) => {
        attendances = [];
        querySnapshot.forEach((doc) => {
            attendances.push({ ...doc.data(), id: doc.id }); 
        });
        console.log("Attendances loaded: ", attendances.length);
        attendancesLoaded = true;
        checkAndRenderAll();
        updateClockedInStatus(); // (★勤怠機能追加★) 勤怠データ更新時にもステータスを再チェック
    }, (error) => {
        console.error("Error listening to attendances: ", error);
        attendancesLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
    
    // 8. (★在庫管理 追加★) Inventory Items
    onSnapshot(inventoryItemsCollectionRef, (querySnapshot) => {
        inventoryItems = [];
        querySnapshot.forEach((doc) => {
            inventoryItems.push({ ...doc.data(), id: doc.id });
        });
        console.log("Inventory items loaded (for stock reduction): ", inventoryItems.length);
        inventoryLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to inventory items: ", error);
        inventoryLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
    
    // 9. (★コール管理 追加★) Champagne Calls (Full list)
    onSnapshot(champagneCallsCollectionRef, (querySnapshot) => {
        champagneCalls = [];
        querySnapshot.forEach((doc) => {
            champagneCalls.push({ ...doc.data(), id: doc.id });
        });
        console.log("Champagne calls loaded (for trigger check): ", champagneCalls.length);
        callsLoaded = true; 
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to champagne calls: ", error);
        callsLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
    
    // 10. (★コール管理 追加★) Cast Notification Badge Listener
    // (★重要★) 認証が完了し、`champagneCallsCollectionRef`が定義された後に設定
    const badgeEl = document.getElementById('nav-call-management-cast-badge');
    if (badgeEl && champagneCallsCollectionRef && fbQuery && fbWhere) { // (★修正★)
        // (★新規★) 'pending' (未対応) ステータスのコールのみをクエリ
        const q = fbQuery(champagneCallsCollectionRef, fbWhere("status", "==", "pending")); // (★修正★)
        
        onSnapshot(q, (snapshot) => {
            const pendingCount = snapshot.size;
            if (pendingCount > 0) {
                badgeEl.textContent = pendingCount > 9 ? '9+' : pendingCount;
                badgeEl.style.display = 'inline-flex';
            } else {
                badgeEl.style.display = 'none';
            }
        }, (error) => {
            console.error("Error listening to champagne call notifications: ", error);
            badgeEl.style.display = 'none';
        });
    }
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    // (★修正★) cast-order.html に存在するDOMのみ取得
    castHeaderName = document.getElementById('cast-header-name');
    pageTitle = document.getElementById('page-title');
    tableGrid = document.getElementById('table-grid'); 
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
    
    // (★削除★) menu-editor-modal 関連は不要
    // menuEditorModal = document.getElementById('menu-editor-modal');
    // ...
    
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
    
    // (★新規★) 伝票作成時間
    newSlipStartTimeInput = document.getElementById('new-slip-start-time-input');
    newSlipTimeError = document.getElementById('new-slip-time-error');
    
    orderModalTitle = document.getElementById('order-modal-title');
    orderItemsList = document.getElementById('order-items-list');
    orderCategoryTabsContainer = document.getElementById('order-category-tabs-container'); // (★新規★)
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

    // (新規) モーダル共通情報のDOM
    slipStoreName = document.getElementById('slip-store-name');
    slipStoreTel = document.getElementById('slip-store-tel');
    slipServiceRate = document.getElementById('slip-service-rate');
    slipTaxRate = document.getElementById('slip-tax-rate');
    checkoutStoreName = document.getElementById('checkout-store-name');
    checkoutStoreTel = document.getElementById('checkout-store-tel');
    checkoutServiceRate = document.getElementById('checkout-service-rate');
    checkoutTaxRate = document.getElementById('checkout-tax-rate');
    
    // (★要望5★) 領収書モーダルのDOM
    receiptStoreName = document.getElementById('receipt-store-name');
    receiptAddress = document.getElementById('receipt-address');
    receiptTel = document.getElementById('receipt-tel');
    receiptForm = document.getElementById('receipt-form');
    receiptCustomerNameInput = document.getElementById('receipt-customer-name-input');
    receiptDescriptionInput = document.getElementById('receipt-description-input');
    receiptOptionDate = document.getElementById('receipt-option-date');
    receiptOptionAmount = document.getElementById('receipt-option-amount');
    receiptPreviewArea = document.getElementById('receipt-preview-area');
    receiptDateDisplay = document.getElementById('receipt-date-display');
    receiptCustomerNameDisplay = document.getElementById('receipt-customer-name-display');
    receiptTotalDisplay = document.getElementById('receipt-total-display');
    receiptDescriptionDisplay = document.getElementById('receipt-description-display');
    printReceiptBtn = document.getElementById('print-receipt-btn'); // (★変更★)

    // (★新規★) 割引
    discountAmountInput = document.getElementById('discount-amount');
    discountTypeSelect = document.getElementById('discount-type');
    
    logoutButtonHeader = document.getElementById('logout-button-header'); // (★新規★)

    // (★新規★) 転卓モーダル
    tableTransferModal = document.getElementById('table-transfer-modal');
    openTransferModalBtn = document.getElementById('open-transfer-modal-btn');
    transferSlipNumber = document.getElementById('transfer-slip-number');
    transferTableGrid = document.getElementById('transfer-table-grid');
    transferError = document.getElementById('transfer-error');

    // (★AI対応★) AIサジェスト
    aiSuggestionBox = document.getElementById('ai-suggestion-box');
    aiSuggestionText = document.getElementById('ai-suggestion-text');

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (新規) テーブルカードのイベント委任
    if (tableGrid) {
        tableGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.table-card');
            if (card) {
                handleTableClick(card.dataset.tableId); // (★勤怠機能修正★) この関数内でチェック
            }
        });
    }

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) {
                closeModal(modal);
            }
            // (★追加★) 割引をリセット
            if(discountAmountInput) discountAmountInput.value = '';
            if(discountTypeSelect) discountTypeSelect.value = 'yen';
        });
    });
    
    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', (e) => {
            updateSlipInfo(); // (★変更★)
            const selectedCastId = e.target.value;
            renderCustomerDropdown(selectedCastId);
        });
    }

    if (orderCustomerNameSelect) {
        orderCustomerNameSelect.addEventListener('change', (e) => {
            if (e.target.value === 'new_customer') {
                newCustomerInputGroup.classList.remove('hidden');
                newCustomerNameInput.value = '';
                newCustomerError.textContent = '';
                newCustomerNameInput.focus();
                
                if (slips) { // (★変更★)
                    const slipData = slips.find(s => s.slipId === currentSlipId);
                    if (slipData) {
                        // slipData.name = "新規のお客様"; // (★修正★) 不要
                        updateSlipInfo();
                    }
                }

            } else {
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                updateSlipInfo();
            }
        });
    }

    if (saveNewCustomerBtn) {
        saveNewCustomerBtn.addEventListener('click', async () => { // (★変更★)
            if (!customers || !customersCollectionRef) return; // (★変更★) (★修正★)
            const newName = newCustomerNameInput.value.trim();
            if (newName === "") {
                newCustomerError.textContent = "顧客名を入力してください。";
                return;
            }
            
            const existingCustomer = customers.find(c => c.name === newName); // (★変更★)
            if (existingCustomer) {
                newCustomerError.textContent = "その顧客名は既に使用されています。";
                return;
            }

            const currentCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value;
            const newCustomer = { 
                // id: getUUID(), (★変更★) addDoc に任せる
                name: newName, 
                nominatedCastId: currentCastId,
                memo: "" // (★新規★) メモ欄を追加
            };
            
            // (★変更★)
            try {
                await fbAddDoc(customersCollectionRef, newCustomer); // (★エラー修正★)
                
                // (★修正★) 伝票の顧客名も更新
                const slipData = slips.find(s => s.slipId === currentSlipId);
                if (slipData) {
                    // (★修正★) select の値を新しい名前に設定してから updateSlipInfo を呼ぶ
                    renderCustomerDropdown(currentCastId); // (★修正★) ドロップダウンを再描画
                    orderCustomerNameSelect.value = newName; // (★修正★) 新しい名前を選択
                    updateSlipInfo(); // (★修正★)
                }
                
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                
            } catch (e) {
                 console.error("Error adding new customer: ", e);
                 newCustomerError.textContent = "顧客の保存に失敗しました。";
            }
        });
    }

    if (openSlipPreviewBtn) {
        openSlipPreviewBtn.addEventListener('click', async () => { // (★変更★)
            await updateSlipInfo(); // (★変更★)
            await renderSlipPreviewModal(); // (★変更★)
            closeModal(orderModal);
            openModal(slipPreviewModal);
        });
    }

    // (★新規★) 転卓モーダルを開く
    if (openTransferModalBtn) {
        openTransferModalBtn.addEventListener('click', () => {
            openTableTransferModal();
        });
    }

    // (★新規★) 転卓モーダル内のテーブル選択
    if (transferTableGrid) {
        transferTableGrid.addEventListener('click', (e) => {
            const tableBtn = e.target.closest('.table-card-option');
            if (tableBtn && !tableBtn.disabled) {
                const newTableId = tableBtn.dataset.tableId;
                if (confirm(`伝票をテーブル ${newTableId} に移動しますか？`)) {
                    handleTableTransfer(newTableId);
                }
            }
        });
    }

    if (openCancelSlipModalBtn) {
        openCancelSlipModalBtn.addEventListener('click', () => {
            renderCancelSlipModal();
        });
    }

    if (confirmCancelSlipBtn) {
        confirmCancelSlipBtn.addEventListener('click', async () => { // (★変更★)
            if (!slips || !slipsCollectionRef) return; // (★変更★) (★修正★)
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (slip) {
                // (★変更★)
                try {
                    const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
                    await fbSetDoc(slipRef, { // (★エラー修正★)
                        status: 'cancelled',
                        cancelReason: reason,
                        // (★勤怠機能修正★) ボツ伝にした日時を記録（reports.jsで利用）
                        paidTimestamp: new Date().toISOString() 
                    }, { merge: true });
                    
                    closeModal(orderModal);
                    closeModal(cancelSlipModal);
                } catch (e) {
                     console.error("Error cancelling slip: ", e);
                    cancelSlipError.textContent = "伝票のキャンセルに失敗しました。";
                }
            }
        });
    }

    if (printSlipBtn) {
        printSlipBtn.addEventListener('click', () => {
            window.print();
        });
    }
    
    // (★要望5★) 領収書印刷ボタン
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', () => {
            // (★要望5★) 印刷前にプレビューを最終更新
            updateReceiptPreview(); 
            // 印刷実行
            window.print();
        });
    }

    // (★要望5★) 領収書フォームの入力でプレビューを更新
    if (receiptForm) {
        receiptForm.addEventListener('input', updateReceiptPreview);
    }

    if (goToCheckoutBtn) {
        goToCheckoutBtn.addEventListener('click', () => {
            renderCheckoutModal();
            closeModal(slipPreviewModal);
            openModal(checkoutModal);
        });
    }

    // (★修正★) 割引入力にもリスナーを追加
    if (discountAmountInput) {
        discountAmountInput.addEventListener('input', updatePaymentStatus);
    }
    if (discountTypeSelect) {
        discountTypeSelect.addEventListener('change', updatePaymentStatus);
    }

    if (paymentCashInput) {
        paymentCashInput.addEventListener('input', updatePaymentStatus);
    }
    if (paymentCardInput) {
        paymentCardInput.addEventListener('input', updatePaymentStatus);
    }
    if (paymentCreditInput) {
        paymentCreditInput.addEventListener('input', updatePaymentStatus);
    }

    if (processPaymentBtn) {
        processPaymentBtn.addEventListener('click', async () => { // (★変更★)
            if (!slips || !slipsCollectionRef) return; // (★変更★) (★修正★)
            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (!slip) return;

            // (★変更★)
            const updatedSlipData = {
                paidAmount: currentBillingAmount,
                paymentDetails: {
                    cash: parseInt(paymentCashInput.value) || 0,
                    card: parseInt(paymentCardInput.value) || 0,
                    credit: parseInt(paymentCreditInput.value) || 0
                },
                discount: {
                    type: discountTypeSelect.value,
                    value: parseInt(discountAmountInput.value) || 0
                },
                status: 'paid',
                paidTimestamp: new Date().toISOString()
            };
            
            // (★変更★)
            try {
                // (★在庫管理 追加★) 在庫減算処理を実行
                await reduceStock(slip);

                const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
                await fbSetDoc(slipRef, updatedSlipData, { merge: true }); // (★エラー修正★)

                renderReceiptModal();
                closeModal(checkoutModal);
                openModal(receiptModal);
            } catch (e) {
                 console.error("Error processing payment: ", e);
                 // (★在庫管理 追加★)
                 alert(`会計処理中にエラーが発生しました: ${e.message}\n在庫が正しく減算されていない可能性があります。`);
            }
        });
    }

    if (reopenSlipBtn) {
        reopenSlipBtn.addEventListener('click', async () => { // (★変更★)
            if (!slips || !slipsCollectionRef) return; // (★変更★) (★修正★)
            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (slip) {
                // (★変更★)
                const updatedSlipData = {
                    status: 'active',
                    paidAmount: 0,
                    paymentDetails: { cash: 0, card: 0, credit: 0 },
                    paidTimestamp: null,
                    discount: { type: 'yen', value: 0 }
                };

                // (★在庫管理 追加★)
                alert("伝票を復活させました。\n(注意: 消費した在庫は自動で戻りません。在庫管理ページから手動で調整してください。)");

                // (★変更★)
                try {
                    const slipRef = fbDoc(slipsCollectionRef, currentSlipId); // (★エラー修正★)
                    await fbSetDoc(slipRef, updatedSlipData, { merge: true }); // (★エラー修正★)
                    
                    closeModal(receiptModal);
                    handleSlipClick(currentSlipId);
                } catch (e) {
                    console.error("Error reopening slip: ", e);
                }
            }
        });
    }

    if (orderItemsList) {
        orderItemsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-order-item-btn');
            if (removeBtn) {
                const itemId = removeBtn.dataset.itemId;
                if (itemId) {
                    removeOrderItem(itemId); // (★変更★)
                }
            }
        });
        
        orderItemsList.addEventListener('change', (e) => {
            if (e.target.classList.contains('order-item-qty-input')) {
                const itemId = e.target.dataset.itemId;
                const newQty = parseInt(e.target.value);
                
                if (itemId && !isNaN(newQty) && newQty > 0) {
                    updateOrderItemQty(itemId, newQty); // (★変更★)
                } else if (itemId && (!isNaN(newQty) && newQty <= 0)) {
                    removeOrderItem(itemId); // (★変更★)
                }
            }
        });
    }
    
    // (新規) 伝票タグのイベント委任
    const tagsContainer = document.getElementById('order-tags-container');
    if (tagsContainer) {
        tagsContainer.addEventListener('click', (e) => {
            const tagBtn = e.target.closest('.slip-tag-btn');
            if (tagBtn) {
                toggleSlipTag(tagBtn.dataset.tagName); // (★変更★)
            }
        });
    }
    
    // (★新規★) オーダーモーダルのカテゴリタブ イベント委任
    if (orderCategoryTabsContainer) {
        orderCategoryTabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.order-category-tab');
            if (tab && !tab.classList.contains('active')) {
                switchOrderCategory(tab.dataset.categoryId);
            }
        });
    }

    // (新規) 注文メニューのイベント委任
    if (menuOrderGrid) {
        menuOrderGrid.addEventListener('click', (e) => {
            const menuBtn = e.target.closest('.menu-order-btn');
            if (menuBtn) {
                addOrderItem( // (★変更★)
                    menuBtn.dataset.itemId,
                    menuBtn.dataset.itemName,
                    parseInt(menuBtn.dataset.itemPrice)
                );
            }
        });
    }
    
    // (新規) 伝票選択モーダルのイベント委任
    if (slipSelectionList) {
        slipSelectionList.addEventListener('click', (e) => {
            const slipBtn = e.target.closest('button[data-slip-id]');
            if (slipBtn) {
                handleSlipClick(slipBtn.dataset.slipId);
                closeModal(slipSelectionModal);
            }
        });
    }

    // (新規) 伝票選択モーダル -> 新規伝票作成
    if (createNewSlipBtn) {
        createNewSlipBtn.addEventListener('click', () => {
            const tableId = createNewSlipBtn.dataset.tableId;
            if (tableId) {
                renderNewSlipConfirmModal(tableId);
                closeModal(slipSelectionModal);
            }
        });
    }
    
    // (★変更★) 新規伝票確認モーダル -> OK
    if (confirmCreateSlipBtn) {
        confirmCreateSlipBtn.addEventListener('click', () => {
            const tableId = confirmCreateSlipBtn.dataset.tableId;
            
            const startTimeValue = newSlipStartTimeInput ? newSlipStartTimeInput.value : '';
            if (!startTimeValue) {
                if (newSlipTimeError) newSlipTimeError.textContent = '開始時刻を入力してください。';
                return;
            }
            try { // (★修正★)
                const startTimeISO = new Date(startTimeValue).toISOString();
                if (newSlipTimeError) newSlipTimeError.textContent = '';
                
                if (tableId) {
                    createNewSlip(tableId, startTimeISO); // (★変更★)
                    closeModal(newSlipConfirmModal);
                }
            } catch (e) {
                if (newSlipTimeError) newSlipTimeError.textContent = '有効な日時を入力してください。';
            }
        });
    }

    // (★新規★) ログアウトボタン
    if (logoutButtonHeader) {
        logoutButtonHeader.addEventListener('click', async () => {
            if (confirm("ログアウトしますか？")) {
                try {
                    await signOut(auth);
                    // ログアウト成功時、firebase-init.js が login.html へリダイレクト
                } catch (error) {
                    console.error("Sign out error: ", error);
                }
            }
        });
    }
    
});