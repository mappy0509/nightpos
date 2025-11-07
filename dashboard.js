// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    doc,
    collection 
} from './firebase-init.js';

// (★削除★) エラーの原因となった以下の参照(Ref)のインポートを削除
/*
import {
    settingsRef,
    menuRef,
    slipCounterRef,
    castsCollectionRef,
    customersCollectionRef,
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
let customers = [];
let slips = [];
let attendances = []; // (★勤怠機能追加★)
let slipCounter = 0;

// (★変更★) 現在選択中の伝票ID (ローカル管理)
let currentSlipId = null;
let currentBillingAmount = 0;

// (★新規★) 経過時間更新用のタイマーID
let elapsedTimeTimer = null;

// (★変更★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, slipCounterRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef,
    attendancesCollectionRef; // (★勤怠機能追加★)


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
    orderItemsList, menuOrderGrid, orderSubtotalEl, orderCustomerNameSelect,
    orderNominationSelect, newCustomerInputGroup, newCustomerNameInput,
    saveNewCustomerBtn, newCustomerError, checkoutModalTitle, checkoutItemsList,
    checkoutSubtotalEl, checkoutServiceChargeEl, checkoutTaxEl, checkoutPaidAmountEl,
    checkoutTotalEl, paymentCashInput, paymentCardInput, paymentCreditInput,
    checkoutPaymentTotalEl, checkoutShortageEl, checkoutChangeEl, slipSubtotalEl,
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl, castRankingList,
    rankingPeriodSelect, rankingTypeBtns,
    // (新規) HTML側で追加したID
    summaryTotalSales, summaryTableUsage, summaryAvgSales, summaryCastCount,
    slipStoreName, slipStoreTel, slipServiceRate, slipTaxRate,
    checkoutStoreName, checkoutStoreTel, checkoutServiceRate, checkoutTaxRate,
    receiptStoreName, receiptAddress, receiptTel,
    // (★新規★) 割引機能
    discountAmountInput, discountTypeSelect,
    // (★新規★) 伝票作成時間
    newSlipStartTimeInput, newSlipTimeError;


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
    if (!settings) return 0; 
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    const serviceCharge = subtotal * settings.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax;
    const total = subtotalWithService + tax;
    return Math.round(total);
};


/**
 * ページを切り替える (dashboard.js では不要)
 */
// const switchPage = (targetPageId) => { ... };

/**
 * (新規) キャストIDからキャスト名を取得する
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    // (★変更★) casts を参照
    if (!casts) return '不明'; 
    if (!castId) return 'フリー';
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


/**
 * (変更) テーブル管理画面を描画する (dashboard.jsでは不要)
 */
// (★削除★)
// const renderTableGrid = () => { ... };


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

    const paidSlips = slips.filter(slip => {
        if (slip.status !== 'paid' || !slip.paidTimestamp) return false;
        const paidTime = new Date(slip.paidTimestamp).getTime();
        return paidTime >= startTimestamp && paidTime <= endTimestamp;
    });

    const cancelledSlips = slips.filter(slip => {
        // (注意) ボツ伝の日時は paidTimestamp がないため、仮で startTime を使う (要件次第)
        // 本来はボツにした日時 (cancelledTimestamp) が必要
        if (slip.status !== 'cancelled') return false; 
        
        // (★勤怠機能修正★) 営業日ベースで判定
        if (slip.startTime) {
             const cancelledTime = new Date(slip.startTime).getTime();
             return cancelledTime >= startTimestamp && cancelledTime <= endTimestamp;
        }
        return false;
    });

    return { paidSlips, cancelledSlips, range: { start: startDate, end: endDate } };
};


// =================================================
// /END (★新規★) reports.js から集計ヘルパー関数を移植
// =================================================


/**
 * (変更) ダッシュボードサマリーを更新する
 */
const renderDashboardSummary = () => {
    // (★変更★) settings, attendances を参照
    if (!settings || !attendances) return; 
    
    // (★修正★) 「本日」の営業日データを取得
    const { paidSlips } = getSlipsForPeriod('daily', new Date());

    // 1. 本日の総売上
    // (★修正★) paidSlips は既にフィルタリング済み
    let totalSales = 0;
    paidSlips.forEach(slip => {
        // (★変更★) 伝票の paidAmount (割引後) を集計する
        totalSales += slip.paidAmount || 0;
    });
    if (summaryTotalSales) summaryTotalSales.textContent = formatCurrency(totalSales);

    // 2. テーブル稼働率
    const activeTables = settings.tables.filter(t => getActiveSlipCount(t.id) > 0).length;
    const totalTables = settings.tables.length;
    const usageRate = totalTables > 0 ? (activeTables / totalTables) * 100 : 0;
    if (summaryTableUsage) {
        // (★修正★) index.html の構造に合わせてセレクタを修正
        const rateEl = summaryTableUsage.querySelector('p.text-3xl');
        const detailEl = summaryTableUsage.querySelector('p.text-sm');
        if (rateEl) rateEl.textContent = `${Math.round(usageRate)}%`;
        if (detailEl) detailEl.textContent = `${activeTables} / ${totalTables} 卓`;
    }

    // 3. 平均客単価
    const avgSales = paidSlips.length > 0 ? totalSales / paidSlips.length : 0;
    if (summaryAvgSales) {
        // (★修正★) index.html の構造に合わせてセレクタを修正
        const avgEl = summaryAvgSales.querySelector('p.text-3xl');
        if (avgEl) avgEl.textContent = formatCurrency(Math.round(avgSales));
    }
    
    // 4. (★勤怠機能修正★) 出勤キャスト
    if (summaryCastCount) {
        // (★修正★) index.html の構造に合わせてセレクタを修正
        const countEl = summaryCastCount.querySelector('p.text-3xl');
        
        // (★勤怠機能修正★) attendances から本日の出勤者数をカウント
        const businessDayStart = getBusinessDayStart(new Date());
        const businessDayStr = formatDateISO(businessDayStart);
        
        // (★勤怠機能修正★) date が今日で、ステータスが 'clocked_in' または 'late' のキャスト
        const checkedInCasts = attendances.filter(a => 
            a.date === businessDayStr && 
            (a.status === 'clocked_in' || a.status === 'late')
        ).length;
        
        if (countEl) countEl.innerHTML = `${checkedInCasts} <span class="text-lg font-medium">名</span>`; // (innerHTMLに変更)
    }
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
    
    activeSlips.sort((a, b) => b.slipNumber - a.slipNumber);

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
        }
        
        const nominationText = getCastNameById(slip.nominationCastId);
        
        // (★変更★) 経過時間表示用の要素を追加
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
 * (新規) 「伝票一覧」ページを描画する (dashboard.jsでは不要)
 */
// (★削除★)
// const renderAllSlipsPage = () => { ... };


/**
 * (★変更★) 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    // (★変更★) menu と settings を参照
    if (!settings || !menu) return; 
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

    menuOrderGrid.innerHTML = ''; 
    
    // (★変更★) menu.items を参照
    const allMenuItems = (menu.items || []).sort((a,b) => a.name.localeCompare(b.name));
    
    if (allMenuItems.length === 0) {
        menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">メニューが登録されていません。<br>「メニュー管理」ページから追加してください。</p>';
    } else {
        allMenuItems.forEach(item => {
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
 * (新規) 伝票タグを描画する
 * @param {object} slipData 
 */
const renderSlipTags = (slipData) => {
    const container = document.getElementById('order-tags-container');
    if (!container || !settings) return; // (★変更★)
    container.innerHTML = '';
    
    // (★変更★) settings.slipTagsMaster を参照
    settings.slipTagsMaster.forEach(tag => {
        const isSelected = slipData.tags.includes(tag.name);
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
    if (!slips) return;
    const slipData = slips.find(s => s.slipId === currentSlipId);
    if (!slipData) return;
    
    const tagIndex = slipData.tags.indexOf(tagName);
    if (tagIndex > -1) {
        slipData.tags.splice(tagIndex, 1);
    } else {
        slipData.tags.push(tagName);
    }
    
    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { tags: slipData.tags }, { merge: true });
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
    if (!slips) return; // (★変更★)
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
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { 
            name: newName,
            nominationCastId: nominationCastId
        }, { merge: true });
    } catch (e) {
        console.error("Error updating slip info: ", e);
    }
};


/**
 * 注文リストにアイテムを追加する
 * @param {string} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = async (id, name, price) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    
    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
    } catch (e) {
        console.error("Error adding order item: ", e);
    }
    
    // (★変更★) onSnapshotが自動でUIを更新するが、即時反映のためにローカルで呼ぶ
    renderOrderModal();
};

/**
 * (新規) 注文リストからアイテムを削除する
 * @param {string} id 商品ID
 */
const removeOrderItem = async (id) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    slipData.items = slipData.items.filter(item => item.id !== id);
    
    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
    } catch (e) {
        console.error("Error removing order item: ", e);
    }

    renderOrderModal();
};

/**
 * (新規) 注文アイテムの数量を変更する
 * @param {string} id 商品ID
 * @param {number} qty 数量
 */
const updateOrderItemQty = async (id, qty) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const item = slipData.items.find(item => item.id === id);
    if (item) {
        item.qty = qty;
    }
    
    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
    } catch (e) {
        console.error("Error updating order item qty: ", e);
    }
    renderOrderModal();
};

/**
 * (新規) メニュー管理タブとリストを描画する (dashboard.jsでは不要)
 */
// (★削除★)
// const renderMenuTabs = () => { ... };


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; // (★変更★)

    const store = settings.storeInfo; // (★変更★)
    const rates = settings.rates; // (★変更★)

    // 伝票プレビュー
    if (slipStoreName) slipStoreName.textContent = store.name;
    if (slipStoreTel) slipStoreTel.textContent = `TEL: ${store.tel}`;
    if (slipServiceRate) slipServiceRate.textContent = `サービス料 (${rates.service * 100}%)`;
    if (slipTaxRate) slipTaxRate.textContent = `消費税 (${rates.tax * 100}%)`;

    // 会計
    if (checkoutStoreName) checkoutStoreName.textContent = store.name;
    if (checkoutStoreTel) checkoutStoreTel.textContent = `TEL: ${store.tel}`;
    if (checkoutServiceRate) checkoutServiceRate.textContent = `サービス料 (${rates.service * 100}%)`;
    if (checkoutTaxRate) checkoutTaxRate.textContent = `消費税 (${rates.tax * 100}%)`;

    // 領収書
    if (receiptStoreName) receiptStoreName.textContent = store.name;
    if (receiptAddress) receiptAddress.innerHTML = `〒${store.zip || ''}<br>${store.address || ''}`; // (変更) 郵便番号・改行対応
    if (receiptTel) receiptTel.textContent = `TEL: ${store.tel}`;
};


/**
 * (変更) 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = async () => {
    if (!settings) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    // (★変更★) 伝票ドキュメントを直接更新
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { status: 'checkout' }, { merge: true });
    } catch (e) {
        console.error("Error updating slip status: ", e);
    }
    // (★変更★) onSnapshotが自動更新するが、ローカルデータも念のため更新
    slipData.status = 'checkout';


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
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
        slipItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(item.price * item.qty)}</span>
            </div>
        `;
    });
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount;

    slipSubtotalEl.textContent = formatCurrency(subtotal);
    slipServiceChargeEl.textContent = formatCurrency(Math.round(serviceCharge));
    slipTaxEl.textContent = formatCurrency(Math.round(tax));
    slipPaidAmountEl.parentElement.style.display = paidAmount > 0 ? 'flex' : 'none';
    slipPaidAmountEl.textContent = `-${formatCurrency(paidAmount)}`;
    slipTotalEl.textContent = formatCurrency(billingAmount);
};


/**
 * (★修正★) 会計モーダルを描画する (割引計算ロジック追加)
 */
const renderCheckoutModal = () => {
    if (!settings) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
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
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const preDiscountTotal = total - paidAmount; 

    // (★追加★) 割引計算
    const discountAmount = parseInt(discountAmountInput.value) || 0;
    const discountType = discountTypeSelect.value;
    
    let finalBillingAmount = preDiscountTotal;
    if (discountType === 'yen') {
        finalBillingAmount = preDiscountTotal - discountAmount;
    } else if (discountType === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discountAmount / 100));
    }
    finalBillingAmount = Math.round(finalBillingAmount); // 最終金額を丸める

    // 0円未満にはしない
    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    // (★変更★) ローカル変数で保持
    currentBillingAmount = finalBillingAmount; 

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

    document.getElementById('receipt-total').textContent = formatCurrency(finalBillingAmount);
};

/**
 * (★修正★) 会計モーダルの支払い状況を計算・更新する (割引再計算)
 */
const updatePaymentStatus = () => {
    if (!settings) return; // (★変更★)

    // (★追加★) 割引を先に再計算
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    let subtotal = 0;
    slipData.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    
    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
    const total = Math.round(subtotalWithService + tax);
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
    finalBillingAmount = Math.round(finalBillingAmount);

    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    // (★修正★) ローカル変数を更新
    currentBillingAmount = finalBillingAmount;
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount);
    document.getElementById('receipt-total').textContent = formatCurrency(finalBillingAmount);
    
    // --- ここから下は支払い計算 ---
    const billingAmount = currentBillingAmount; // (★変更★)

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
 * 領収書モーダルを描画する
 */
const renderReceiptModal = () => {
    if (!settings) return; // (★変更★)
    const now = new Date();
    document.getElementById('receipt-date').textContent = now.toLocaleDateString('ja-JP');
    
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (slipData) {
        const receiptCustomerName = document.getElementById('receipt-customer-name');
        if (receiptCustomerName) receiptCustomerName.value = slipData.name || '';
    }
    // (★修正★) 領収書の合計金額も割引後の金額を反映
    document.getElementById('receipt-total').textContent = formatCurrency(currentBillingAmount); // (★変更★)
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
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.remove('active');
    }
};

/**
 * (★変更★) 新しい伝票を作成し、伝票モーダルを開く
 * @param {string} tableId 
 * @param {string} startTimeISO (★変更★) 開始時刻のISO文字列
 */
const createNewSlip = async (tableId, startTimeISO) => {
    if (!settings) return; // (★変更★)
    const table = settings.tables.find(t => t.id === tableId); // (★変更★)
    if (!table) return;

    // (★変更★) slipCounter を settings から取得してインクリメント
    const newSlipCounter = (slipCounter || 0) + 1;
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
    
    try {
        // (★変更★) slipsCollectionRef に新しい伝票を追加
        const docRef = await addDoc(slipsCollectionRef, newSlip);
        
        // (★変更★) slipCounterRef を更新
        await setDoc(slipCounterRef, { count: newSlipNumber });
        
        // (★変更★) ローカルの伝票IDを更新
        currentSlipId = docRef.id;

        // (★追加★) 割引フォームをリセット
        if (discountAmountInput) discountAmountInput.value = '';
        if (discountTypeSelect) discountTypeSelect.value = 'yen';

        // (★変更★) onSnapshot が renderDashboardSlips 等を更新
        
        renderOrderModal();
        openModal(orderModal);

    } catch (e) {
        console.error("Error creating new slip: ", e);
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
 * (変更) テーブルカードクリック時の処理 (dashboard.jsでは不要)
 */
// (★削除★)
// const handleTableClick = (tableId) => { ... };

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
    
    renderOrderModal();
    openModal(orderModal);
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
 * (★修正★) キャストランキングを描画する
 */
const renderCastRanking = () => {
    // (★変更★) settings がないと ranking の設定が読めない
    if (!settings || !settings.ranking) {
        // デフォルトを設定（ただし保存はしない）
        if (!settings) settings = {};
        if (!settings.ranking) settings.ranking = { period: 'monthly', type: 'nominations' };
    }
    const { period, type } = settings.ranking;
    
    // (★修正★) 基準日（本日）で期間フィルタリング
    const { paidSlips } = getSlipsForPeriod(period, new Date());

    if (!castRankingList) return;
    
    // (★修正★) 集計ロジック
    const rankingMap = new Map();

    paidSlips.forEach(slip => {
        const castId = slip.nominationCastId;
        if (!castId) return; // フリーは除外

        const current = rankingMap.get(castId) || { id: castId, name: getCastNameById(castId), sales: 0, nominations: 0 };
        
        current.sales += slip.paidAmount || 0; 
        current.nominations += 1;
        
        rankingMap.set(castId, current);
    });

    let sortedData = [];
    if (type === 'sales') {
        sortedData = [...rankingMap.values()].sort((a, b) => b.sales - a.sales);
    } else { // nominations
        sortedData = [...rankingMap.values()].sort((a, b) => b.nominations - a.nominations);
    }

    if (sortedData.length === 0) {
        castRankingList.innerHTML = '<p class="text-slate-500 text-sm">データがありません。</p>';
        return;
    }

    castRankingList.innerHTML = '';
    sortedData.slice(0, 5).forEach((cast, index) => { // 上位5名のみ表示
        const rank = index + 1;
        let rankColor = 'text-slate-400';
        if (rank === 1) rankColor = 'text-yellow-500';
        if (rank === 2) rankColor = 'text-gray-400';
        if (rank === 3) rankColor = 'text-amber-700';

        const valueString = type === 'sales' ? formatCurrency(cast.sales) : `${cast.nominations} 組`;

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

// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
// (★変更★) settings, menu のデフォルトデータを返す関数に変更
const getDefaultSettings = () => {
    return {
        // currentPage: 'dashboard', (settings には不要)
        // currentStore: 'store1', (settings には不要)
        // slipCounter: 0, (別ドキュメント管理)
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
            { id: 'tag3', name: '初回' }, { id: 'tag4', name: '枝' },
            { id: 'tag5', name: '切替' }, { id: 'tag6', name: '案内所' },
            { id: 'tag7', name: '20歳未満' }, { id: 'tag8', name: '同業' },
        ],
        // casts: [], (別コレクション)
        // customers: [], (別コレクション)
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
            { id: 'T1', status: 'available' }, { id: 'T2', status: 'available' },
            { id: 'C1', status: 'available' }, { id: 'C2', status: 'available' },
        ],
        // slips: [], (別コレクション)
        // menu: {}, (別ドキュメント)
        // currentActiveMenuCategoryId: catSetId, (menu に移動)
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
        // currentSlipId: null, (ローカル変数)
        // currentEditingMenuId: null, (ローカル変数)
        // currentBillingAmount: 0, (ローカル変数)
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


// (★削除★) Firestore への state 保存関数（各関数内で直接実行）
// const updateStateInFirestore = async (newState) => { ... };


// (★変更★) --- Firestore リアルタイムリスナー ---
// (★変更★) firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 新しい参照を取得
    const { 
        settingsRef: sRef, 
        menuRef: mRef, 
        slipCounterRef: scRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef,
        attendancesCollectionRef: aRef // (★勤怠機能追加★)
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    menuRef = mRef;
    slipCounterRef = scRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    attendancesCollectionRef = aRef; // (★勤怠機能追加★)


    // (★新規★) 全データをロードできたか確認するフラグ
    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;
    let attendancesLoaded = false; // (★勤怠機能追加★)

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded && attendancesLoaded) { // (★勤怠機能追加★)
            console.log("All data loaded. Rendering UI.");
            renderDashboardSummary();
            renderCastRanking();
            renderDashboardSlips();
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

    // 7. Attendances (★勤怠機能追加★)
    onSnapshot(attendancesCollectionRef, (querySnapshot) => {
        attendances = [];
        querySnapshot.forEach((doc) => {
            attendances.push({ ...doc.data(), id: doc.id }); 
        });
        console.log("Attendances loaded: ", attendances.length);
        attendancesLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to attendances: ", error);
        attendancesLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    // 'index.html' はダッシュボードのファイル名
    renderSidebar('sidebar-container', 'index.html');

    // ===== DOM要素の取得 =====
    // (★修正★) index.html に存在するDOMのみ取得
    // navLinks = document.querySelectorAll('.nav-link'); // (★削除★)
    pageTitle = document.getElementById('page-title');
    dashboardSlips = document.getElementById('dashboard-slips');
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
    saveMenuItemBtn = document.getElementById('save-menu-item-btn');
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
    
    // (★新規★) 伝票作成時間 (DOMContentLoaded 内で取得)
    newSlipStartTimeInput = document.getElementById('new-slip-start-time-input');
    newSlipTimeError = document.getElementById('new-slip-time-error');
    
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
    
    // (新規) ダッシュボードサマリーカードのDOM
    summaryTotalSales = document.getElementById('summary-total-sales');
    summaryTableUsage = document.getElementById('summary-table-usage');
    summaryAvgSales = document.getElementById('summary-avg-sales');
    summaryCastCount = document.getElementById('summary-cast-count');
    
    // (新規) モーダル共通情報のDOM
    slipStoreName = document.getElementById('slip-store-name');
    slipStoreTel = document.getElementById('slip-store-tel');
    slipServiceRate = document.getElementById('slip-service-rate');
    slipTaxRate = document.getElementById('slip-tax-rate');
    // (★修正★) index.html には checkout/receipt のストア情報ID がないので null チェック
    checkoutStoreName = document.getElementById('checkout-store-name');
    checkoutStoreTel = document.getElementById('checkout-store-tel');
    checkoutServiceRate = document.getElementById('checkout-service-rate');
    checkoutTaxRate = document.getElementById('checkout-tax-rate');
    receiptStoreName = document.getElementById('receipt-store-name');
    receiptAddress = document.getElementById('receipt-address');
    receiptTel = document.getElementById('receipt-tel');

    // (★新規★) 割引
    discountAmountInput = document.getElementById('discount-amount');
    discountTypeSelect = document.getElementById('discount-type');


    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (新規) ダッシュボード伝票一覧のイベント委任
    if (dashboardSlips) {
        dashboardSlips.addEventListener('click', (e) => {
            const card = e.target.closest('button[data-slip-id]');
            if (card) {
                if (card.dataset.status !== 'paid') {
                    handleSlipClick(card.dataset.slipId);
                }
            }
        });
    }

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
            
            // (★追加★) 割引をリセット
            if(discountAmountInput) discountAmountInput.value = '';
            if(discountTypeSelect) discountTypeSelect.value = 'yen';
        });
    });
    
    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', (e) => {
            // (★変更★) updateSlipInfo は非同期になった
            updateSlipInfo(); 
            // (★変更★) renderCustomerDropdown は同期のまま
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
                
                if (slips) {
                    const slipData = slips.find(s => s.slipId === currentSlipId);
                    if (slipData) {
                        slipData.name = "新規のお客様"; // (★変更★) ローカルを更新
                        updateSlipInfo(); // (★変更★) DBを更新
                    }
                }

            } else {
                newCustomerInputGroup.classList.add('hidden');
                newCustomerError.textContent = '';
                updateSlipInfo(); // (★変更★)
            }
        });
    }

    if (saveNewCustomerBtn) {
        saveNewCustomerBtn.addEventListener('click', async () => { // (★変更★) async
            if (!customers) return; // (★変更★)
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
                //(★変更★) IDはaddDocに任せる
                name: newName, 
                nominatedCastId: currentCastId,
                memo: "" // (★新規★)
            };
            
            // (★変更★) customersCollectionRef に追加
            try {
                await addDoc(customersCollectionRef, newCustomer);
                // (★変更★) onSnapshotがローカルの 'customers' を更新する

                const slipData = slips.find(s => s.slipId === currentSlipId);
                if (slipData) {
                    slipData.name = newName; // (★変更★) ローカルを更新
                    updateSlipInfo(); // (★変更★) DBを更新
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
        openSlipPreviewBtn.addEventListener('click', async () => { // (★変更★) async
            await updateSlipInfo(); // (★変更★)
            await renderSlipPreviewModal(); // (★変更★)
            closeModal(orderModal);
            openModal(slipPreviewModal);
        });
    }

    if (openCancelSlipModalBtn) {
        openCancelSlipModalBtn.addEventListener('click', () => {
            renderCancelSlipModal();
        });
    }

    if (confirmCancelSlipBtn) {
        confirmCancelSlipBtn.addEventListener('click', async () => { // (★変更★) async
            if (!slips) return; // (★変更★)
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (slip) {
                // (★変更★) 伝票ドキュメントを直接更新
                try {
                    const slipRef = doc(slipsCollectionRef, currentSlipId);
                    await setDoc(slipRef, { 
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
        processPaymentBtn.addEventListener('click', async () => { // (★変更★) async
            if (!slips) return; // (★変更★)
            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (!slip) return;

            // (★変更★) 更新用データを作成
            const updatedSlipData = {
                paidAmount: currentBillingAmount, // (★変更★)
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

            // (★変更★) 伝票ドキュメントを直接更新
            try {
                const slipRef = doc(slipsCollectionRef, currentSlipId);
                await setDoc(slipRef, updatedSlipData, { merge: true });

                renderReceiptModal();
                closeModal(checkoutModal);
                openModal(receiptModal);

            } catch (e) {
                console.error("Error processing payment: ", e);
            }
        });
    }

    if (reopenSlipBtn) {
        reopenSlipBtn.addEventListener('click', async () => { // (★変更★) async
            if (!slips) return; // (★変更★)
            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (slip) {
                
                // (★変更★) 更新用データを作成
                const updatedSlipData = {
                    status: 'active',
                    paidAmount: 0,
                    paymentDetails: { cash: 0, card: 0, credit: 0 },
                    paidTimestamp: null,
                    discount: { type: 'yen', value: 0 }
                };

                // (★変更★) 伝票ドキュメントを直接更新
                try {
                    const slipRef = doc(slipsCollectionRef, currentSlipId);
                    await setDoc(slipRef, updatedSlipData, { merge: true });
                    
                    closeModal(receiptModal);
                    handleSlipClick(currentSlipId); // (★変更★)

                } catch (e) {
                    console.error("Error reopening slip: ", e);
                }
            }
        });
    }

    if (rankingPeriodSelect) {
        rankingPeriodSelect.addEventListener('change', async (e) => { // (★変更★) async
            if (!settings) return; // (★変更★)
            
            const newPeriod = e.target.value;
            // (★変更★) settings ドキュメントを直接更新
            try {
                await setDoc(settingsRef, { 
                    ranking: { ...settings.ranking, period: newPeriod }
                }, { merge: true });
                // (★変更★) onSnapshotが renderCastRanking を呼び出す
            } catch (e) {
                console.error("Error updating ranking period: ", e);
            }
        });
    }

    if (rankingTypeBtns) {
        rankingTypeBtns.forEach(btn => {
            btn.addEventListener('click', async () => { // (★変更★) async
                if (!settings) return; // (★変更★)
                
                const newType = btn.dataset.type;
                // (★変更★) settings ドキュメントを直接更新
                try {
                    await setDoc(settingsRef, { 
                        ranking: { ...settings.ranking, type: newType }
                    }, { merge: true });
                    
                    // (★変更★) 即時反映のためローカルでも active クラスを付け替える
                    rankingTypeBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // (★変更★) onSnapshotが renderCastRanking を呼び出す
                    
                } catch (e) {
                    console.error("Error updating ranking type: ", e);
                }
            });
        });
    }

    if (orderItemsList) {
        orderItemsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-order-item-btn');
            if (removeBtn) {
                const itemId = removeBtn.dataset.itemId;
                if (itemId) {
                    removeOrderItem(itemId); // (★変更★) 非同期
                }
            }
        });
        
        orderItemsList.addEventListener('change', (e) => {
            if (e.target.classList.contains('order-item-qty-input')) {
                const itemId = e.target.dataset.itemId;
                const newQty = parseInt(e.target.value);
                
                if (itemId && !isNaN(newQty) && newQty > 0) {
                    updateOrderItemQty(itemId, newQty); // (★変更★) 非同期
                } else if (itemId && (!isNaN(newQty) && newQty <= 0)) {
                    removeOrderItem(itemId); // (★変更★) 非同期
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
                toggleSlipTag(tagBtn.dataset.tagName); // (★変更★) 非同期
            }
        });
    }
    
    // (新規) 注文メニューのイベント委任
    if (menuOrderGrid) {
        menuOrderGrid.addEventListener('click', (e) => {
            const menuBtn = e.target.closest('.menu-order-btn');
            if (menuBtn) {
                addOrderItem( // (★変更★) 非同期
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
                // (★変更★) モーダルを開くだけ
                renderNewSlipConfirmModal(tableId);
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
                createNewSlip(tableId, startTimeISO); // (★変更★) 非同期
                closeModal(newSlipConfirmModal);
            }
        });
    }

});