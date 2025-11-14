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
    collection,
    getDoc, 
    serverTimestamp,
    query, // (★新規★)
    where, // (★新規★)
    orderBy // (★新規★)
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
let inventoryItems = []; // (★在庫管理 追加★)
let champagneCalls = []; // (★新規★) コール管理データ
let slipCounter = 0;

// (★変更★) 現在選択中の伝票ID (モーダル用)
let currentSlipId = null;
let currentBillingAmount = 0;
let currentOrderModalCategoryId = null; 

// (★新規★) コール管理ページの現在地
let currentCallStatusTab = 'pending'; // 'pending' or 'completed'

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, slipCounterRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef,
    inventoryItemsCollectionRef, 
    champagneCallsCollectionRef, // (★新規★)
    currentStoreId; 


// ===== DOM要素 =====
// (★新規★) call-management.html に必要なDOM
let pageTitle,
    callTabs,
    callListContainer,
    callListLoading,
    headerStoreName;

// (★新規★) all-slips.html からコピーしたモーダル用のDOM
let allSlipsList, 
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
    orderCategoryTabsContainer, 
    menuOrderGrid, orderSubtotalEl, orderCustomerNameSelect,
    orderNominationSelect, newCustomerInputGroup, newCustomerNameInput,
    saveNewCustomerBtn, newCustomerError, checkoutModalTitle, checkoutItemsList,
    checkoutSubtotalEl, checkoutServiceChargeEl, checkoutTaxEl, checkoutPaidAmountEl,
    checkoutTotalEl, paymentCashInput, paymentCardInput, paymentCreditInput,
    checkoutPaymentTotalEl, checkoutShortageEl, checkoutChangeEl, slipSubtotalEl,
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl,
    slipStoreName, slipStoreTel, slipServiceRate, slipTaxRate,
    checkoutStoreName, checkoutStoreTel, checkoutServiceRate, checkoutTaxRate,
    receiptStoreName, receiptAddress, receiptTel,
    receiptForm, receiptCustomerNameInput, receiptDescriptionInput,
    receiptOptionDate, receiptOptionAmount,
    receiptPreviewArea, receiptDateDisplay, receiptCustomerNameDisplay,
    receiptTotalDisplay, receiptDescriptionDisplay, printReceiptBtn, 
    discountAmountInput, discountTypeSelect,
    newSlipStartTimeInput, newSlipTimeError,
    tableTransferModal, openTransferModalBtn, transferSlipNumber, 
    transferTableGrid, transferError;


// --- (★新規★) 営業日計算ヘルパー関数 ---
// (all-slips.js / dashboard.js からコピー)

/**
 * 営業日付の開始時刻を取得する
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
 * 営業日付の終了時刻を取得する
 * @param {Date} businessDayStart 営業開始日時
 * @returns {Date} 営業終了日時
 */
const getBusinessDayEnd = (businessDayStart) => {
    const endDate = new Date(businessDayStart);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    return endDate;
};


// --- (★新規★) コール管理専用ロジック ---

/**
 * (★新規★) コール一覧を描画する
 */
const renderCallList = () => {
    if (!callListContainer || !settings || !casts || !champagneCalls) {
        if (callListLoading) callListLoading.textContent = "データが不足しているため表示できません。";
        return;
    }

    if (callListLoading) callListLoading.style.display = 'none';
    callListContainer.innerHTML = '';

    // 1. 表示するコールをフィルタリング (タブに基づく)
    let filteredCalls = [];
    if (currentCallStatusTab === 'pending') {
        filteredCalls = champagneCalls.filter(c => c.status === 'pending');
    } else {
        // 「対応済み」タブは、本日の営業日中に完了したもののみ表示
        const todayBusinessStart = getBusinessDayStart(new Date());
        const todayBusinessEnd = getBusinessDayEnd(todayBusinessStart);
        
        filteredCalls = champagneCalls.filter(c => {
            if (c.status !== 'completed' || !c.completedAt) return false;
            try {
                const completedTime = new Date(c.completedAt).getTime();
                return completedTime >= todayBusinessStart.getTime() && completedTime <= todayBusinessEnd.getTime();
            } catch (e) {
                return false;
            }
        });
    }

    // 2. 発生時刻の降順 (新しいものが上) にソート
    filteredCalls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 3. リストが空の場合のメッセージ
    if (filteredCalls.length === 0) {
        callListContainer.innerHTML = `<p class="text-slate-500 text-center p-8">
            ${currentCallStatusTab === 'pending' ? '未対応のコールはありません。' : '本日対応済みのコールはありません。'}
        </p>`;
        return;
    }

    // 4. HTMLを生成
    filteredCalls.forEach(call => {
        const callTime = new Date(call.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        
        // コール種別のドロップダウンHTMLを生成
        const callTypeOptions = (settings.champagneCallBorders || [])
            .filter(rule => call.totalAmount >= rule.borderAmount) // 金額ボーダーを満たすもののみ
            .map(rule => `<option value="${rule.callName}" ${call.callType === rule.callName ? 'selected' : ''}>${rule.callName} (¥${(rule.borderAmount/10000).toLocaleString()}万〜)</option>`)
            .join('');
        
        // キャストのドロップダウンHTMLを生成
        const castOptions = casts.map(cast => `<option value="${cast.id}">${cast.name}</option>`).join('');

        const isCompleted = (call.status === 'completed');
        const cardBorderColor = isCompleted ? 'border-green-300' : 'border-yellow-300';

        const itemHTML = `
            <div class="bg-white p-4 rounded-xl shadow-lg border ${cardBorderColor}">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <span class="text-2xl font-bold text-blue-600">テーブル ${call.tableId}</span>
                        <span class="text-sm text-slate-500 ml-2">(${callTime} 発生)</span>
                    </div>
                    <span class="text-2xl font-bold text-red-600">${formatCurrency(call.totalAmount)}</span>
                </div>
                <p class="text-sm text-slate-600 mb-3">
                    ${call.items.map(item => `${item.name} x ${item.qty}`).join(', ')}
                </p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="text-xs font-semibold text-slate-500">コール種別</label>
                        <select class="w-full p-2 border border-slate-300 rounded-lg mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 call-type-select" 
                                data-call-id="${call.id}" ${isCompleted ? 'disabled' : ''}>
                            <option value="none">--- 選択 ---</option>
                            ${callTypeOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-slate-500">メインマイク</label>
                        <select class="w-full p-2 border border-slate-300 rounded-lg mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 call-main-mic-select" 
                                data-call-id="${call.id}" ${isCompleted ? 'disabled' : ''}>
                            <option value="none">--- 担当者 ---</option>
                            ${castOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-slate-500">サブマイク</label>
                        <select class="w-full p-2 border border-slate-300 rounded-lg mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 call-sub-mic-select" 
                                data-call-id="${call.id}" ${isCompleted ? 'disabled' : ''}>
                            <option value="none">--- 担当者 ---</option>
                            ${castOptions}
                        </select>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <button class="text-sm text-blue-600 hover:underline open-slip-btn" data-slip-id="${call.slipId}">
                        <i class="fa-solid fa-file-invoice mr-1"></i> 伝票詳細を開く
                    </button>
                    
                    ${isCompleted ? `
                        <span class="text-sm font-semibold text-green-700">
                            <i class="fa-solid fa-check-double mr-1"></i> 対応完了 (${new Date(call.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})
                        </span>
                    ` : `
                        <button class="px-6 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 complete-call-btn" data-call-id="${call.id}">
                            <i class="fa-solid fa-check mr-2"></i> 対応完了
                        </button>
                    `}
                </div>
            </div>
        `;
        callListContainer.innerHTML += itemHTML;
        
        // (★重要★) HTMLを挿入した *後* で、ドロップダウンの選択値を設定する
        if (isCompleted) {
            const mainMicSelect = callListContainer.querySelector(`.call-main-mic-select[data-call-id="${call.id}"]`);
            const subMicSelect = callListContainer.querySelector(`.call-sub-mic-select[data-call-id="${call.id}"]`);
            if (mainMicSelect) mainMicSelect.value = call.mainMicCastId || 'none';
            if (subMicSelect) subMicSelect.value = call.subMicCastId || 'none';
        }
    });
};

/**
 * (★新規★) コール詳細を (ドロップダウン変更時に) 自動保存する
 * @param {string} callId 
 * @param {object} dataToUpdate - { callType, mainMicCastId, subMicCastId } のいずれか
 */
const saveCallDetails = async (callId, dataToUpdate) => {
    if (!champagneCallsCollectionRef || !callId) return;
    
    const callRef = doc(champagneCallsCollectionRef, callId);
    
    try {
        await setDoc(callRef, dataToUpdate, { merge: true });
        console.log(`Call ${callId} updated:`, dataToUpdate);
    } catch (e) {
        console.error("Error saving call details:", e);
        alert("コール情報の保存に失敗しました。");
    }
};

/**
 * (★新規★) コールを「対応完了」にする
 * @param {string} callId 
 */
const completeCall = async (callId) => {
    if (!champagneCallsCollectionRef || !callId) return;

    // 1. DOMから最新の選択値を取得
    const callCard = document.querySelector(`.complete-call-btn[data-call-id="${callId}"]`).closest('.bg-white');
    const callType = callCard.querySelector('.call-type-select').value;
    const mainMicCastId = callCard.querySelector('.call-main-mic-select').value;
    const subMicCastId = callCard.querySelector('.call-sub-mic-select').value;

    // 2. バリデーション
    if (callType === 'none' || mainMicCastId === 'none') {
        alert("「コール種別」と「メインマイク」を選択してから完了してください。");
        return;
    }
    
    // 3. 更新データを作成
    const dataToUpdate = {
        callType: callType,
        mainMicCastId: mainMicCastId,
        subMicCastId: subMicCastId === 'none' ? null : subMicCastId,
        status: 'completed',
        completedAt: serverTimestamp() // サーバー時刻で完了
    };

    // 4. Firestoreを更新
    const callRef = doc(champagneCallsCollectionRef, callId);
    try {
        await setDoc(callRef, dataToUpdate, { merge: true });
        // onSnapshotが自動でUIを再描画する
    } catch (e) {
        console.error("Error completing call:", e);
        alert("コールの完了処理に失敗しました。");
    }
};


// --- (★新規★) all-slips.js から伝票モーダル用ロジックを移植 ---
// (※ 必要な関数のみを抜粋・コピー)

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
// (★重複★) const formatCurrency = (amount) => { ... }; (上部で定義済み)

/**
 * Dateオブジェクトを 'YYYY-MM-DDTHH:MM' 形式の文字列に変換する
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
 * 経過時間を HH:MM 形式でフォーマットする
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
 * 伝票の合計金額（割引前）を計算する
 * @param {object} slip 伝票データ
 * @returns {number} 合計金額
 */
const calculateSlipTotal = (slip) => {
    if (!settings) return 0; 
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (slip.status === 'cancelled') return 0;
    
    let subtotal = 0;
    (slip.items || []).forEach(item => { // (★修正★) items が無い場合に備える
        subtotal += item.price * item.qty;
    });
    
    if (rounding.type === 'round_up_subtotal') {
        subtotal = Math.ceil(subtotal / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_subtotal') {
        subtotal = Math.floor(subtotal / rounding.unit) * rounding.unit;
    }

    const serviceCharge = subtotal * settings.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax;
    let total = subtotalWithService + tax;
    
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
 * キャストIDからキャスト名を取得する
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!casts) return '不明'; 
    if (!castId) return 'フリー';
    const cast = casts.find(c => c.id === castId); 
    return cast ? cast.name : '不明';
};

/**
 * 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    if (!settings || !menu || !slips) return; 
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    orderNominationSelect.innerHTML = '<option value="null">フリー</option>';
    casts.forEach(cast => { 
        orderNominationSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
    });
    orderNominationSelect.value = slipData.nominationCastId || 'null';

    renderCustomerDropdown(slipData.nominationCastId);
    
    const customerExists = customers.find(c => c.name === slipData.name); 
    if (customerExists) {
        orderCustomerNameSelect.value = slipData.name;
        newCustomerInputGroup.classList.add('hidden');
    } else {
        orderCustomerNameSelect.value = 'new_customer';
        newCustomerInputGroup.classList.remove('hidden');
        newCustomerNameInput.value = (slipData.name === "新規のお客様") ? "" : slipData.name;
    }
    newCustomerError.textContent = '';
    
    renderSlipTags(slipData);

    orderItemsList.innerHTML = '';
    let subtotal = 0;
    (slipData.items || []).forEach(item => { // (★修正★) items が無い場合に備える
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
 
    if (!menu.categories || menu.categories.length === 0) {
        if(orderCategoryTabsContainer) orderCategoryTabsContainer.innerHTML = '';
        if(menuOrderGrid) menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">メニューカテゴリが登録されていません。</p>';
        return;
    }
    
    if (!currentOrderModalCategoryId || !menu.categories.some(c => c.id === currentOrderModalCategoryId)) {
        currentOrderModalCategoryId = menu.categories[0].id;
    }
    
    renderOrderCategoryTabs();
    renderOrderMenuGrid();
};

/**
 * オーダーモーダルのカテゴリタブを描画する
 */
const renderOrderCategoryTabs = () => {
    if (!orderCategoryTabsContainer || !menu || !menu.categories) return;
    
    orderCategoryTabsContainer.innerHTML = '';
    menu.categories.forEach(category => {
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
 * オーダーモーダルのメニューグリッド部分のみを描画する
 */
const renderOrderMenuGrid = () => {
    if (!menuOrderGrid || !menu || !menu.items || !currentOrderModalCategoryId) return;

    menuOrderGrid.innerHTML = ''; 
    
    const filteredItems = (menu.items || [])
        .filter(item => item.categoryId === currentOrderModalCategoryId)
        .sort((a,b) => a.name.localeCompare(b.name));
    
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
 * 伝票タグを描画する
 * @param {object} slipData 
 */
const renderSlipTags = (slipData) => {
    const container = document.getElementById('order-tags-container');
    if (!container || !settings) return; 
    container.innerHTML = '';
    
    (settings.slipTagsMaster || []).forEach(tag => { // (★修正★)
        const isSelected = (slipData.tags || []).includes(tag.name); // (★修正★)
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
 * 顧客ドロップダウンを描画する
 * @param {string | null} selectedCastId 
 */
const renderCustomerDropdown = (selectedCastId) => {
    if (!customers) return; 
    const targetCastId = selectedCastId === 'null' ? null : selectedCastId;

    const filteredCustomers = customers.filter( 
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
 * 伝票・会計・領収書モーダルの共通情報を更新する
 */
const updateModalCommonInfo = () => {
    if (!settings) return; 

    const store = settings.storeInfo || {}; // (★修正★)
    const rates = settings.rates || { tax: 0, service: 0 }; // (★修正★)
    const receiptSettings = settings.receiptSettings || {};

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

    // 領収書 (★要望5★ 設定を反映)
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
 * 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = async () => {
    if (!settings || !slips) return; 
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;
    
    // (★変更★) call-management.js では伝票ステータスは変更しない
    // try { ... setDoc ... }

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
        subtotal += item.price * item.qty;
        slipItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(item.price * item.qty)}</span>
            </div>
        `;
    });
    
    const total = calculateSlipTotal(slipData);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount;
    
    const simpleSubtotal = (slipData.items || []).reduce((acc, item) => acc + (item.price * item.qty), 0);
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
 * 会計モーダルを描画する (call-management.js では編集不可)
 */
const renderCheckoutModal = () => {
    if (!settings || !slips) return; 
    const slipData = slips.find(s => s.slipId === currentSlipId); 
    if (!slipData) return;

    checkoutModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name}) - お会計`;
    
    let subtotal = 0;
    checkoutItemsList.innerHTML = '';
    (slipData.items || []).forEach(item => { // (★修正★)
        subtotal += item.price * item.qty;
        checkoutItemsList.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} x ${item.qty}</span>
                <span class="font-medium">${formatCurrency(item.price * item.qty)}</span>
            </div>
        `;
    });
    
    const total = calculateSlipTotal(slipData);
    const paidAmount = slipData.paidAmount || 0;
    const preDiscountTotal = total - paidAmount; 

    // (★変更★) call-management.js では割引計算は *表示のみ*
    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;
    
    let finalBillingAmount = preDiscountTotal;
    if (discount.type === 'yen') {
        finalBillingAmount = preDiscountTotal - discount.value;
    } else if (discount.type === 'percent') {
        finalBillingAmount = preDiscountTotal * (1 - (discount.value / 100));
    }
    
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (rounding.type === 'round_up_total') {
        finalBillingAmount = Math.ceil(finalBillingAmount / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_total') {
        finalBillingAmount = Math.floor(finalBillingAmount / rounding.unit) * rounding.unit;
    } else {
        finalBillingAmount = Math.round(finalBillingAmount); 
    }
    if (finalBillingAmount < 0) finalBillingAmount = 0;
    
    // (★重要★) call-management.js では編集不可にする
    discountAmountInput.disabled = true;
    discountTypeSelect.disabled = true;
    paymentCashInput.disabled = true;
    paymentCardInput.disabled = true;
    paymentCreditInput.disabled = true;
    processPaymentBtn.disabled = true;
    processPaymentBtn.textContent = (slipData.status === 'paid') ? '会計済み' : '会計は伝票/テーブルから';

    currentBillingAmount = finalBillingAmount; 
    
    const serviceCharge = subtotal * (settings.rates.service || 0); // (★修正★)
    const tax = (subtotal + serviceCharge) * (settings.rates.tax || 0); // (★修正★)

    checkoutSubtotalEl.textContent = formatCurrency(subtotal);
    checkoutServiceChargeEl.textContent = formatCurrency(Math.round(serviceCharge));
    checkoutTaxEl.textContent = formatCurrency(Math.round(tax));
    checkoutPaidAmountEl.parentElement.style.display = paidAmount > 0 ? 'flex' : 'none';
    checkoutPaidAmountEl.textContent = `-${formatCurrency(paidAmount)}`;
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount); 
    
    // (★変更★) 支払い済みの情報を表示
    const payment = slipData.paymentDetails || { cash: 0, card: 0, credit: 0 };
    paymentCashInput.value = payment.cash;
    paymentCardInput.value = payment.card;
    paymentCreditInput.value = payment.credit;
    
    const totalPayment = payment.cash + payment.card + payment.credit;
    checkoutPaymentTotalEl.textContent = formatCurrency(totalPayment);
    checkoutShortageEl.textContent = formatCurrency(0);
    checkoutChangeEl.textContent = formatCurrency(Math.max(0, totalPayment - finalBillingAmount));
    
    if(receiptTotalDisplay) receiptTotalDisplay.textContent = formatCurrency(finalBillingAmount);
};


/**
 * 領収書モーダルを描画・更新する
 */
const renderReceiptModal = () => {
    if (!settings || !slips) return;
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
};

/**
 * 領収書プレビューを更新する
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
 * 未会計伝票カードクリック時の処理 (伝票詳細モーダルを開く)
 * @param {string} slipId 
 */
const handleSlipClick = (slipId) => {
    if (!slips) return; 
    const slipData = slips.find(s => s.slipId === slipId); 
    if (!slipData) return;

    currentSlipId = slipId; 

    // (★変更★) call-management.js では伝票は読み取り専用
    // (★変更★) そのため、割引情報を読み込む必要はない
    // const discount = slipData.discount || { type: 'yen', value: 0 };
    // discountAmountInput.value = discount.value;
    // discountTypeSelect.value = discount.type;
    
    currentOrderModalCategoryId = null;
    renderOrderModal();
    
    // (★重要★) call-management.js では編集不可にする
    orderModal.querySelectorAll('input, select, button').forEach(el => {
        if (!el.classList.contains('modal-close-btn')) {
            el.disabled = true;
        }
    });
    // (★変更★) プレビューボタンは「閉じる」に変更
    openSlipPreviewBtn.textContent = '閉じる';
    
    openModal(orderModal);
};

/**
 * 会計済み伝票カードクリック時の処理 (領収書モーダルを開く)
 * @param {string} slipId 
 */
const handlePaidSlipClick = (slipId) => {
    if (!slips) return; 
    const slipData = slips.find(s => s.slipId === slipId); 
    if (!slipData) return;

    currentSlipId = slipId; 
    
    // (★変更★) 割引情報をフォームに読み込む (表示用)
    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;

    renderCheckoutModal(); 
    renderReceiptModal();
    
    // (★重要★) call-management.js では編集不可にする
    reopenSlipBtn.disabled = true;
    reopenSlipBtn.classList.add('hidden');
    
    openModal(receiptModal);
};


/**
 * (★要望4★) ヘッダーのストア名をレンダリングする
 */
const renderHeaderStoreName = () => {
    if (!headerStoreName || !settings || !currentStoreId) return;
    const currentStoreName = (settings.storeInfo && settings.storeInfo.name) ? settings.storeInfo.name : "店舗";
    headerStoreName.textContent = currentStoreName;
};


// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照をすべて取得
    const { 
        settingsRef: sRef, 
        menuRef: mRef, 
        slipCounterRef: scRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef,
        inventoryItemsCollectionRef: iRef, 
        champagneCallsCollectionRef: ccRef, // (★新規★)
        currentStoreId: csId 
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    menuRef = mRef;
    slipCounterRef = scRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    inventoryItemsCollectionRef = iRef; 
    champagneCallsCollectionRef = ccRef; // (★新規★)
    currentStoreId = csId;

    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;
    let inventoryLoaded = false; 
    let callsLoaded = false; // (★新規★)

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded && inventoryLoaded && callsLoaded) { 
            console.log("All data loaded. Rendering UI for call-management.js");
            renderCallList();
            updateModalCommonInfo(); 
            renderHeaderStoreName(); 
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found.");
            settings = { storeInfo: { name: "店舗" }, rates: { tax: 0.1, service: 0.2 }, dayChangeTime: "05:00" };
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // 2. Menu
    onSnapshot(menuRef, async (docSnap) => {
        if (docSnap.exists()) {
            menu = docSnap.data();
        } else {
            console.warn("No menu document found.");
            menu = { categories: [], items: [] };
        }
        menuLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to menu: ", error));

    // 3. Slip Counter (※伝票モーダル内で利用される可能性があるため残す)
    onSnapshot(slipCounterRef, async (docSnap) => {
        if (docSnap.exists()) {
            slipCounter = docSnap.data().count;
        } else {
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
    
    // 7. Inventory Items (※伝票モーダル内で利用される可能性があるため残す)
    onSnapshot(inventoryItemsCollectionRef, (querySnapshot) => {
        inventoryItems = [];
        querySnapshot.forEach((doc) => {
            inventoryItems.push({ ...doc.data(), id: doc.id });
        });
        console.log("Inventory items loaded: ", inventoryItems.length);
        inventoryLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to inventory items: ", error);
        inventoryLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
    
    // 8. (★新規★) Champagne Calls
    onSnapshot(champagneCallsCollectionRef, (querySnapshot) => {
        champagneCalls = [];
        querySnapshot.forEach((doc) => {
            champagneCalls.push({ ...doc.data(), id: doc.id }); 
        });
        console.log("Champagne calls loaded: ", champagneCalls.length);
        callsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to champagne calls: ", error);
        callsLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    // (★変更★) call-management.html をアクティブにする
    renderSidebar('sidebar-container', 'call-management.html'); 

    // ===== DOM要素の取得 =====
    // (★新規★) コール管理ページ用
    pageTitle = document.getElementById('page-title');
    callTabs = document.getElementById('call-tabs');
    callListContainer = document.getElementById('call-list-container');
    callListLoading = document.getElementById('call-list-loading');
    headerStoreName = document.getElementById('header-store-name');

    // (★新規★) 伝票モーダル用 (all-slips.js からコピー)
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
    cancelSlipModal = document.getElementById('cancel-slip-modal');
    openCancelSlipModalBtn = document.getElementById('open-cancel-slip-modal-btn');
    cancelSlipModalTitle = document.getElementById('cancel-slip-modal-title');
    cancelSlipNumber = document.getElementById('cancel-slip-number');
    cancelSlipReasonInput = document.getElementById('cancel-slip-reason-input');
    cancelSlipError = document.getElementById('cancel-slip-error');
    confirmCancelSlipBtn = document.getElementById('confirm-cancel-slip-btn');
    slipSelectionModal = document.getElementById('slip-selection-modal');
    newSlipConfirmModal = document.getElementById('new-slip-confirm-modal');
    
    newSlipStartTimeInput = document.getElementById('new-slip-start-time-input');
    newSlipTimeError = document.getElementById('new-slip-time-error');
    
    orderModalTitle = document.getElementById('order-modal-title');
    orderItemsList = document.getElementById('order-items-list');
    orderCategoryTabsContainer = document.getElementById('order-category-tabs-container'); 
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

    slipStoreName = document.getElementById('slip-store-name');
    slipStoreTel = document.getElementById('slip-store-tel');
    slipServiceRate = document.getElementById('slip-service-rate');
    slipTaxRate = document.getElementById('slip-tax-rate');
    checkoutStoreName = document.getElementById('checkout-store-name');
    checkoutStoreTel = document.getElementById('checkout-store-tel');
    checkoutServiceRate = document.getElementById('checkout-service-rate');
    checkoutTaxRate = document.getElementById('checkout-tax-rate');
    
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
    printReceiptBtn = document.getElementById('print-receipt-btn');

    discountAmountInput = document.getElementById('discount-amount');
    discountTypeSelect = document.getElementById('discount-type');
    
    tableTransferModal = document.getElementById('table-transfer-modal');
    openTransferModalBtn = document.getElementById('open-transfer-modal-btn');
    transferSlipNumber = document.getElementById('transfer-slip-number');
    transferTableGrid = document.getElementById('transfer-table-grid');
    transferError = document.getElementById('transfer-error');

    
    // ===== イベントリスナーの設定 =====
    
    // (★新規★) コール管理タブ
    if (callTabs) {
        callTabs.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.ranking-type-btn');
            if (tabBtn && !tabBtn.classList.contains('active')) {
                callTabs.querySelectorAll('.ranking-type-btn').forEach(btn => btn.classList.remove('active'));
                tabBtn.classList.add('active');
                currentCallStatusTab = tabBtn.dataset.status;
                renderCallList();
            }
        });
    }

    // (★新規★) コール一覧のイベント委任
    if (callListContainer) {
        callListContainer.addEventListener('click', (e) => {
            // 完了ボタン
            const completeBtn = e.target.closest('.complete-call-btn');
            if (completeBtn) {
                if (confirm("このコールを「対応完了」にしますか？")) {
                    completeCall(completeBtn.dataset.callId);
                }
                return;
            }
            
            // 伝票詳細ボタン
            const slipBtn = e.target.closest('.open-slip-btn');
            if (slipBtn) {
                // (★変更★) 伝票IDから伝票ステータスをチェック
                const slip = slips.find(s => s.slipId === slipBtn.dataset.slipId);
                if (slip) {
                    if (slip.status === 'paid') {
                        handlePaidSlipClick(slip.slipId);
                    } else {
                        handleSlipClick(slip.slipId);
                    }
                } else {
                    alert("対象の伝票が見つかりません。");
                }
                return;
            }
        });
        
        // (★新規★) ドロップダウン自動保存
        callListContainer.addEventListener('change', (e) => {
            const select = e.target;
            const callId = select.dataset.callId;
            if (!callId) return;
            
            let dataToUpdate = {};
            if (select.classList.contains('call-type-select')) {
                dataToUpdate = { callType: select.value };
            } else if (select.classList.contains('call-main-mic-select')) {
                dataToUpdate = { mainMicCastId: select.value === 'none' ? null : select.value };
            } else if (select.classList.contains('call-sub-mic-select')) {
                dataToUpdate = { subMicCastId: select.value === 'none' ? null : select.value };
            }
            
            if (Object.keys(dataToUpdate).length > 0) {
                saveCallDetails(callId, dataToUpdate);
            }
        });
    }

    // (★新規★) モーダルを閉じるボタン (共通)
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) {
                closeModal(modal);
            }
        });
    });
    
    // (★新規★) 伝票モーダル内の「プレビューへ」ボタン
    // (★変更★) call-management.js では「閉じる」として機能
    if (openSlipPreviewBtn) {
        openSlipPreviewBtn.addEventListener('click', () => { 
            // (★変更★)
            if (openSlipPreviewBtn.textContent === '閉じる') {
                closeModal(orderModal);
                return;
            }
            // (※ 本来のプレビュー機能は call-management.js では呼ばれない想定)
            // renderSlipPreviewModal(); 
            // closeModal(orderModal);
            // openModal(slipPreviewModal);
        });
    }
    
    // (★新規★) 伝票プレビューモーダル内のボタン
    if (goToCheckoutBtn) {
        goToCheckoutBtn.addEventListener('click', () => {
            // (★変更★) call-management.js では会計モーダルも読み取り専用
            renderCheckoutModal();
            closeModal(slipPreviewModal);
            openModal(checkoutModal);
        });
    }

    // (★新規★) 領収書フォームの入力でプレビューを更新
    if (receiptForm) {
        receiptForm.addEventListener('input', updateReceiptPreview);
    }

    // (★新規★) 領収書印刷ボタン
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', () => {
            updateReceiptPreview(); 
            window.print();
        });
    }
    
    // (★新規★) 伝票プレビューの印刷ボタン
    if (printSlipBtn) {
        printSlipBtn.addEventListener('click', () => {
            window.print();
        });
    }

});