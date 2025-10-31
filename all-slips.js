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
// (変更) DOM要素をグローバルスコープに移動
let navLinks, pages, pageTitle, tableGrid, dashboardSlips, menuTabsContainer, menuTabs,
    menuTabContents, menuPage, allSlipsList, orderModal, checkoutModal, receiptModal,
    slipPreviewModal, modalCloseBtns, openSlipPreviewBtn, processPaymentBtn,
    printSlipBtn, goToCheckoutBtn, reopenSlipBtn, menuEditorModal,
    menuEditorModalTitle, menuEditorForm, menuCategorySelect, menuNameInput,
    menuDurationGroup, menuDurationInput, menuPriceInput, menuEditorError,
    openNewMenuModalBtn, saveMenuItemBtn, setMenuTbody, drinkMenuTbody,
    bottleMenuTbody, foodMenuTbody, castMenuTbody, otherMenuTbody,
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
    slipStoreName, slipStoreTel, slipServiceRate, slipTaxRate,
    checkoutStoreName, checkoutStoreTel, checkoutServiceRate, checkoutTaxRate,
    receiptStoreName, receiptAddress, receiptTel;


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
 * ページを切り替える (all-slips.jsでは不要)
 */
// const switchPage = (targetPageId) => { ... };

/**
 * (新規) キャストIDからキャスト名を取得する
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
 * (変更) 未会計伝票の数を取得する (ボツ伝は除外)
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
* (共通) テーブルカードのHTMLを生成する (all-slips.jsでは不要)
*/
// const createTableCardHTML = (table) => { ... };


/**
 * (変更) テーブル管理画面を描画する (all-slips.jsでは不要)
 */
// const renderTableGrid = () => { ... };

/**
 * (変更) ダッシュボードに未会計「伝票」一覧を描画する (all-slips.jsでは不要)
 */
// const renderDashboardSlips = () => { ... };

/**
 * (変更) 「伝票一覧」ページを描画する
 */
const renderAllSlipsPage = () => {
    if (!allSlipsList || !state) return; // (変更) state がロードされるまで待つ
    allSlipsList.innerHTML = '';

    if (!state.slips || state.slips.length === 0) {
        allSlipsList.innerHTML = '<p class="text-slate-500 text-sm">本日の伝票はありません。</p>';
        return;
    }

    const sortedSlips = [...state.slips].sort((a, b) => b.slipNumber - a.slipNumber);

    sortedSlips.forEach(slip => {
        let statusColor, statusText, cardClass;
        switch (slip.status) {
            case 'active':
                statusColor = 'blue'; statusText = '利用中'; cardClass = ''; break;
            case 'checkout':
                statusColor = 'orange'; statusText = '会計待ち'; cardClass = ''; break;
            case 'paid':
                statusColor = 'gray'; statusText = '会計済み'; cardClass = ''; break;
            case 'cancelled': 
                statusColor = 'red'; statusText = 'ボツ伝'; cardClass = 'slip-card-cancelled'; break;
            default:
                statusColor = 'gray'; statusText = '不明'; cardClass = 'slip-card-cancelled'; break;
        }
        const nominationText = getCastNameById(slip.nominationCastId);
        const total = calculateSlipTotal(slip);
        const paidAmount = slip.paidAmount || 0;

        const card = `
            <button class="w-full text-left p-4 bg-white rounded-lg shadow-md border hover:bg-slate-50 ${cardClass}" 
                    data-slip-id="${slip.slipId}" data-status="${slip.status}">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xl font-bold truncate">
                        <i class="fa-solid fa-table fa-fw text-slate-400 mr-1"></i>${slip.tableId} (No.${slip.slipNumber}) - ${slip.name || 'ゲスト'}
                    </span>
                    <span class="text-xs font-semibold px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 border border-${statusColor}-300 rounded-full">${statusText}</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-sm">
                    <div>
                        <p class="text-xs text-slate-500">指名</p>
                        <p class="font-medium text-pink-600 truncate">${nominationText}</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">合計金額</p>
                        <p class="font-medium">${formatCurrency(total)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">支払い済み</p>
                        <p class="font-medium text-red-600">${formatCurrency(paidAmount)}</p>
                    </div>
                </div>
                ${slip.status === 'cancelled' ? `
                <div class="mt-2 pt-2 border-t border-slate-300">
                    <p class="text-xs text-red-700 font-medium">理由: ${slip.cancelReason || '未入力'}</p>
                </div>
                ` : ''}
            </button>
        `;
        allSlipsList.innerHTML += card;
    });

    // (変更) イベントリスナーは DOMContentLoaded 内で一括設定
    // allSlipsList.querySelectorAll('button[data-slip-id]').forEach(card => { ... });
};


/**
 * (変更) 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    orderNominationSelect.innerHTML = '<option value="null">フリー</option>';
    state.casts.forEach(cast => {
        orderNominationSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
    });
    orderNominationSelect.value = slipData.nominationCastId || 'null';

    renderCustomerDropdown(slipData.nominationCastId);
    
    const customerExists = state.customers.find(c => c.name === slipData.name);
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

    // メニュー選択グリッドを描画 (変更)
    if (menuOrderGrid.innerHTML === '') { 
        const allMenuItems = [
            ...(state.menu.set || []), 
            ...(state.menu.drink || []), 
            ...(state.menu.bottle || []),
            ...(state.menu.food || []),
            ...(state.menu.cast || []),
            ...(state.menu.other || [])
        ];
        allMenuItems.forEach(item => {
            menuOrderGrid.innerHTML += `
                <button class="menu-order-btn p-3 bg-white rounded-lg shadow border text-left hover:bg-slate-100" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}">
                    <p class="font-semibold text-sm">${item.name}</p>
                    <p class="text-xs text-slate-500">${formatCurrency(item.price)}</p>
                </button>
            `;
        });
        
        // (変更) イベントリスナーは DOMContentLoaded 内で一括設定
        // document.querySelectorAll('.menu-order-btn').forEach(btn => { ... });
    }
};

/**
 * (新規) 伝票タグを描画する
 * @param {object} slipData 
 */
const renderSlipTags = (slipData) => {
    const container = document.getElementById('order-tags-container');
    if (!container || !state) return;
    container.innerHTML = '';
    
    state.slipTagsMaster.forEach(tag => {
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
const toggleSlipTag = (tagName) => {
    if (!state) return;
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;
    
    const tagIndex = slipData.tags.indexOf(tagName);
    if (tagIndex > -1) {
        slipData.tags.splice(tagIndex, 1);
    } else {
        slipData.tags.push(tagName);
    }
    
    updateStateInFirestore(state);
    renderSlipTags(slipData);
};


/**
 * (新規) 顧客ドロップダウンを描画する
 * @param {string | null} selectedCastId 選択中のキャストID ('null' 文字列または実際のID)
 */
const renderCustomerDropdown = (selectedCastId) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const targetCastId = selectedCastId === 'null' ? null : selectedCastId;

    const filteredCustomers = state.customers.filter(
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
const updateSlipInfo = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const customerName = orderCustomerNameSelect.value;
    const nominationCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value; 

    if (customerName !== 'new_customer' && customerName !== "") { 
        slipData.name = customerName;
    }
    slipData.nominationCastId = nominationCastId; 
    
    orderModalTitle.textContent = `テーブル ${slipData.tableId} (No.${slipData.slipNumber} - ${slipData.name})`;

    updateStateInFirestore(state);
};


/**
 * 注文リストにアイテムを追加する
 * @param {string} id 商品ID
 * @param {string} name 商品名
 * @param {number} price 価格
 */
const addOrderItem = (id, name, price) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    
    updateStateInFirestore(state);
    renderOrderModal();
};

/**
 * (新規) 注文リストからアイテムを削除する
 * @param {string} id 商品ID
 */
const removeOrderItem = (id) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    slipData.items = slipData.items.filter(item => item.id !== id);
    
    updateStateInFirestore(state);
    renderOrderModal();
};

/**
 * (新規) 注文アイテムの数量を変更する
 * @param {string} id 商品ID
 * @param {number} qty 数量
 */
const updateOrderItemQty = (id, qty) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;

    const item = slipData.items.find(item => item.id === id);
    if (item) {
        item.qty = qty;
    }
    
    updateStateInFirestore(state);
    renderOrderModal();
};

/**
 * (新規) メニュー管理タブとリストを描画する (all-slips.jsでは不要)
 */
// const renderMenuTabs = () => { ... };


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!state) return;

    const store = state.storeInfo;
    const rates = state.rates;

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
    if (receiptAddress) receiptAddress.innerHTML = `〒${store.zip || ''}<br>${store.address || ''}`;
    if (receiptTel) receiptTel.textContent = `TEL: ${store.tel}`;
};


/**
 * (変更) 伝票プレビューモーダルを描画する
 */
const renderSlipPreviewModal = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (!slipData) return;
    
    slipData.status = 'checkout';
    updateStateInFirestore(state);

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
    
    const serviceCharge = subtotal * state.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * state.rates.tax;
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
 * 会計モーダルを描画する
 */
const renderCheckoutModal = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
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
    
    const serviceCharge = subtotal * state.rates.service;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * state.rates.tax;
    const total = Math.round(subtotalWithService + tax);
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount; 

    const finalBillingAmount = billingAmount; 

    state.currentBillingAmount = finalBillingAmount;

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
 * (新規) 会計モーダルの支払い状況を計算・更新する
 */
const updatePaymentStatus = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const billingAmount = state.currentBillingAmount;

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
    if (!state) return; // (変更) state がロードされるまで待つ
    const now = new Date();
    document.getElementById('receipt-date').textContent = now.toLocaleDateString('ja-JP');
    
    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
    if (slipData) {
        document.querySelector('#receipt-content input[type="text"]').value = slipData.name || '';
    }
};

/**
 * (新規) ボツ伝理由入力モーダルを描画する
 */
const renderCancelSlipModal = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slip = state.slips.find(s => s.slipId === state.currentSlipId);
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
 * (新規) 新しい伝票を作成し、伝票モーダルを開く (all-slips.jsでは不要)
 */
// const createNewSlip = (tableId) => { ... };

/**
 * (新規) 伝票選択モーダルを描画する (all-slips.jsでは不要)
 */
// const renderSlipSelectionModal = (tableId) => { ... };

/**
 * (新規) 新規伝票の作成確認モーダルを描画・表示する (all-slips.jsでは不要)
 */
// const renderNewSlipConfirmModal = (tableId) => { ... };


/**
 * (変更) テーブルカードクリック時の処理 (all-slips.jsでは不要)
 */
// const handleTableClick = (tableId) => { ... };

/**
 * (新規) 未会計伝票カードクリック時の処理 (ダッシュボード、伝票一覧ページなど)
 * @param {string} slipId 
 */
const handleSlipClick = (slipId) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const slipData = state.slips.find(s => s.slipId === slipId);
    if (!slipData) return;

    state.currentSlipId = slipId;
    updateStateInFirestore(state);
    
    renderOrderModal();
    openModal(orderModal);
};

/**
 * (新規) 会計済み伝票カードクリック時の処理 (伝票一覧ページ)
 * @param {string} slipId 
 */
const handlePaidSlipClick = (slipId) => {
    if (!state) return; // (変更) state がロードされるまで待つ

    state.currentSlipId = slipId;
    updateStateInFirestore(state);
    
    renderCheckoutModal(); 
    renderReceiptModal();
    openModal(receiptModal);
};


/**
 * (新規) キャストランキングを描画する (all-slips.jsでは不要)
 */
// const renderCastRanking = () => { ... };

// (新規) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultState = () => ({
    currentPage: 'all-slips',
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

// (新規) Firestore への state 保存関数（エラーハンドリング付き）
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
            renderAllSlipsPage();
            updateModalCommonInfo(); // (新規) モーダル内の共通情報を更新
            
        } else {
            console.log("No state document found. Creating default state...");
            const defaultState = getDefaultState();
            state = defaultState;
            
            try {
                await setDoc(stateDocRef, defaultState);
                console.log("Default state saved to Firestore.");
                // (重要) state がロードされたら、UIを初回描画
                renderAllSlipsPage();
                updateModalCommonInfo(); // (新規) モーダル内の共通情報を更新
                
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
    navLinks = document.querySelectorAll('.nav-link');
    pages = document.querySelectorAll('[data-page]');
    pageTitle = document.getElementById('page-title');
    tableGrid = document.getElementById('table-grid'); 
    dashboardSlips = document.getElementById('dashboard-slips'); 
    menuTabsContainer = document.getElementById('menu-tabs'); 
    menuTabs = document.querySelectorAll('.menu-tab'); 
    menuTabContents = document.querySelectorAll('.menu-tab-content'); 
    menuPage = document.getElementById('menu'); 
    allSlipsList = document.getElementById('all-slips-list'); 
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
    openNewMenuModalBtn = document.getElementById('open-new-menu-modal-btn'); 
    saveMenuItemBtn = document.getElementById('save-menu-item-btn');
    setMenuTbody = document.getElementById('set-menu-tbody'); 
    drinkMenuTbody = document.getElementById('drink-menu-tbody'); 
    bottleMenuTbody = document.getElementById('bottle-menu-tbody'); 
    foodMenuTbody = document.getElementById('food-menu-tbody'); 
    castMenuTbody = document.getElementById('cast-menu-tbody'); 
    otherMenuTbody = document.getElementById('other-menu-tbody'); 
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

    // (新規) モーダル共通情報のDOM
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

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    // renderAllSlipsPage(); 
    
    // ===== イベントリスナーの設定 =====

    // (新規) 伝票一覧リストのイベント委任
    if (allSlipsList) {
        allSlipsList.addEventListener('click', (e) => {
            const card = e.target.closest('button[data-slip-id]');
            if (!card) return;

            const slipId = card.dataset.slipId;
            const status = card.dataset.status;

            if (status === 'cancelled') {
                return;
            }
            if (status === 'paid') {
                handlePaidSlipClick(slipId);
            } else {
                handleSlipClick(slipId);
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
        });
    });
    
    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', (e) => {
            const selectedCastId = e.target.value;
            renderCustomerDropdown(selectedCastId);
            updateSlipInfo(); 
        });
    }

    if (orderCustomerNameSelect) {
        orderCustomerNameSelect.addEventListener('change', (e) => {
            if (e.target.value === 'new_customer') {
                newCustomerInputGroup.classList.remove('hidden');
                newCustomerNameInput.value = '';
                newCustomerError.textContent = '';
                newCustomerNameInput.focus();
                
                if (state) {
                    const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
                    if (slipData) {
                        slipData.name = "新規のお客様";
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
        saveNewCustomerBtn.addEventListener('click', () => {
            if (!state) return;
            const newName = newCustomerNameInput.value.trim();
            if (newName === "") {
                newCustomerError.textContent = "顧客名を入力してください。";
                return;
            }
            
            const existingCustomer = state.customers.find(c => c.name === newName);
            if (existingCustomer) {
                newCustomerError.textContent = "その顧客名は既に使用されています。";
                return;
            }

            const currentCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value;
            const newCustomer = { id: getUUID(), name: newName, nominatedCastId: currentCastId };
            
            state.customers.push(newCustomer);
            
            const slipData = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slipData) {
                slipData.name = newName;
            }
            
            renderCustomerDropdown(currentCastId);
            orderCustomerNameSelect.value = newName;
            
            newCustomerInputGroup.classList.add('hidden');
            newCustomerError.textContent = '';
            
            updateSlipInfo();
        });
    }

    if (openSlipPreviewBtn) {
        openSlipPreviewBtn.addEventListener('click', () => {
            updateSlipInfo();
            renderSlipPreviewModal(); 
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
        confirmCancelSlipBtn.addEventListener('click', () => {
            if (!state) return;
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slip) {
                slip.status = 'cancelled';
                slip.cancelReason = reason;
                
                updateStateInFirestore(state);
                
                closeModal(orderModal);
                closeModal(cancelSlipModal);
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
        processPaymentBtn.addEventListener('click', () => {
            if (!state) return;
            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (!slip) return;

            const total = calculateSlipTotal(slip);
            slip.paidAmount = total; 
            slip.paymentDetails = {
                cash: parseInt(paymentCashInput.value) || 0,
                card: parseInt(paymentCardInput.value) || 0,
                credit: parseInt(paymentCreditInput.value) || 0
            };
            slip.status = 'paid';
            
            updateStateInFirestore(state);

            renderReceiptModal();
            closeModal(checkoutModal);
            openModal(receiptModal);
        });
    }

    if (reopenSlipBtn) {
        reopenSlipBtn.addEventListener('click', () => {
            if (!state) return;
            const slip = state.slips.find(s => s.slipId === state.currentSlipId);
            if (slip) {
                slip.status = 'active'; 
                slip.paidAmount = 0;
                slip.paymentDetails = { cash: 0, card: 0, credit: 0 };
                
                updateStateInFirestore(state);
                
                closeModal(receiptModal);
                handleSlipClick(state.currentSlipId);
            }
        });
    }

    if (orderItemsList) {
        orderItemsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-order-item-btn');
            if (removeBtn) {
                const itemId = removeBtn.dataset.itemId;
                if (itemId) {
                    removeOrderItem(itemId);
                }
            }
        });
        
        orderItemsList.addEventListener('change', (e) => {
            if (e.target.classList.contains('order-item-qty-input')) {
                const itemId = e.target.dataset.itemId;
                const newQty = parseInt(e.target.value);
                
                if (itemId && !isNaN(newQty) && newQty > 0) {
                    updateOrderItemQty(itemId, newQty);
                } else if (itemId && (!isNaN(newQty) && newQty <= 0)) {
                    removeOrderItem(itemId);
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
                toggleSlipTag(tagBtn.dataset.tagName);
            }
        });
    }
    
    // (新規) 注文メニューのイベント委任
    if (menuOrderGrid) {
        menuOrderGrid.addEventListener('click', (e) => {
            const menuBtn = e.target.closest('.menu-order-btn');
            if (menuBtn) {
                addOrderItem(
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
                createNewSlip(tableId);
                closeModal(slipSelectionModal);
            }
        });
    }
    
    // (新規) 新規伝票確認モーダル -> OK
    if (confirmCreateSlipBtn) {
        confirmCreateSlipBtn.addEventListener('click', () => {
            const tableId = confirmCreateSlipBtn.dataset.tableId;
            if (tableId) {
                createNewSlip(tableId);
                closeModal(newSlipConfirmModal);
            }
        });
    }

});

