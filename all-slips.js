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
    query, // (★コール管理 追加★)
    where // (★コール管理 追加★)
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
let champagneCalls = []; // (★コール管理 追加★)
let slipCounter = 0;

// (★変更★) 現在選択中の伝票ID (ローカル管理)
let currentSlipId = null;
let currentBillingAmount = 0;
let currentOrderModalCategoryId = null; // (★新規★) オーダーモーダルで選択中のカテゴリID

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, menuRef, slipCounterRef, castsCollectionRef, customersCollectionRef, slipsCollectionRef,
    inventoryItemsCollectionRef, // (★在庫管理 追加★)
    champagneCallsCollectionRef, // (★コール管理 追加★)
    currentStoreId; // (★動的表示 追加★)


// ===== DOM要素 =====
// (★修正★) all-slips.js (all-slips.html) に必要なDOMのみに限定
let /* navLinks, (★削除★) */ pages, pageTitle, allSlipsList, 
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
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl,
    // (新規) HTML側で追加したID
    slipStoreName, slipStoreTel, slipServiceRate, slipTaxRate,
    checkoutStoreName, checkoutStoreTel, checkoutServiceRate, checkoutTaxRate,
    
    // (★要望5★) 領収書DOMを (dashboard.js と同様に) 追加
    receiptStoreName, receiptAddress, receiptTel,
    receiptForm, receiptCustomerNameInput, receiptDescriptionInput,
    receiptOptionDate, receiptOptionAmount,
    receiptPreviewArea, receiptDateDisplay, receiptCustomerNameDisplay,
    receiptTotalDisplay, receiptDescriptionDisplay, printReceiptBtn, // printSlipBtn は printReceiptBtn に
    
    // (★新規★) 割引機能
    discountAmountInput, discountTypeSelect,
    // (★新規★) 伝票作成時間
    newSlipStartTimeInput, newSlipTimeError,
    
    headerStoreName, // (★要望4★) storeSelector から変更
    
    // (★新規★) 転卓モーダル
    tableTransferModal, openTransferModalBtn, transferSlipNumber, 
    transferTableGrid, transferError;


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
    
    // (★新規★) 端数処理
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    
    // (★新規★) サービス料・税金計算前に小計を端数処理 (例: 10円単位に切り上げ)
    if (rounding.type === 'round_up_subtotal') {
        subtotal = Math.ceil(subtotal / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_subtotal') {
        subtotal = Math.floor(subtotal / rounding.unit) * rounding.unit;
    }

    const serviceCharge = subtotal * settings.rates.service; // (★変更★)
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax; // (★変更★)
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
 * ページを切り替える (all-slips.jsでは不要)
 */
// const switchPage = (targetPageId) => { ... };

/**
 * (新規) キャストIDからキャスト名を取得する
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
 * (変更) 未会計伝票の数を取得する (ボツ伝は除外)
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
* (共通) テーブルカードのHTMLを生成する (all-slips.jsでは不要)
*/
// (★削除★)
// const createTableCardHTML = (table) => { ... };


/**
 * (変更) テーブル管理画面を描画する (all-slips.jsでは不要)
 */
// (★削除★)
// const renderTableGrid = () => { ... };

/**
 * (変更) ダッシュボードに未会計「伝票」一覧を描画する (all-slips.jsでは不要)
 */
// (★削除★)
// const renderDashboardSlips = () => { ... };


// ===================================
// (★新規★) 営業日計算ヘルパー関数
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
 * (★変更★) 「伝票一覧」ページを描画する
 * (当日の営業日で作成された伝票のみ表示)
 */
const renderAllSlipsPage = () => {
    if (!allSlipsList || !settings || !slips) return; // (★変更★)
    allSlipsList.innerHTML = '';

    if (!slips || slips.length === 0) { // (★変更★)
        allSlipsList.innerHTML = '<p class="text-slate-500 text-sm">本日の伝票はありません。</p>';
        return;
    }

    // (★新規★) 当日の営業日範囲を取得
    const todayBusinessStart = getBusinessDayStart(new Date());
    const todayBusinessEnd = getBusinessDayEnd(todayBusinessStart);
    
    // (★新規★) 伝票の「作成時刻 (startTime)」が当日の営業日範囲内のものだけフィルタリング
    const todaySlips = slips.filter(slip => { // (★変更★)
        if (!slip.startTime) return false; // startTime がないデータは除外
        try {
            const startTime = new Date(slip.startTime);
            if (isNaN(startTime.getTime())) return false; // 不正な日付形式は除外
            
            const startTimeMs = startTime.getTime();
            return startTimeMs >= todayBusinessStart.getTime() && startTimeMs <= todayBusinessEnd.getTime();
        } catch (e) {
            return false;
        }
    });

    if (todaySlips.length === 0) {
        allSlipsList.innerHTML = '<p class="text-slate-500 text-sm">本日の伝票はありません。</p>';
        return;
    }

    const sortedSlips = [...todaySlips].sort((a, b) => b.slipNumber - a.slipNumber);

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
        
        // (★変更★) paidAmount (割引後) と calculateSlipTotal (割引前)
        const total = calculateSlipTotal(slip); // 割引前
        const paidAmount = slip.paidAmount || 0; // 割引後 (会計済みの場合)

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
                        <p class="text-xs text-slate-500">合計金額 (割引前)</p>
                        <p class="font-medium">${formatCurrency(total)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">会計金額</p>
                        <p class="font-medium text-red-600">${slip.status === 'paid' ? formatCurrency(paidAmount) : '-'}</p>
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
};


/**
 * (★修正★) 伝票モーダル（注文入力）を描画する
 */
const renderOrderModal = () => {
    if (!settings || !menu) return; // (★変更★)
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
 
    // (★新規★) オーダーモーダルのカテゴリタブを描画
    if (!menu.categories || menu.categories.length === 0) {
        if(orderCategoryTabsContainer) orderCategoryTabsContainer.innerHTML = '';
        if(menuOrderGrid) menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">メニューカテゴリが登録されていません。</p>';
        return;
    }
    
    // (★新規★) 選択中のカテゴリIDがなければ、先頭のカテゴリを選択
    if (!currentOrderModalCategoryId || !menu.categories.some(c => c.id === currentOrderModalCategoryId)) {
        currentOrderModalCategoryId = menu.categories[0].id;
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
 * (★新規★) オーダーモーダルのメニューグリッド部分のみを描画する
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
    if (!container || !settings) return; // (★変更★)
    container.innerHTML = '';
    
    settings.slipTagsMaster.forEach(tag => { // (★変更★)
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
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    const tagIndex = slipData.tags.indexOf(tagName);
    if (tagIndex > -1) {
        slipData.tags.splice(tagIndex, 1);
    } else {
        slipData.tags.push(tagName);
    }
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { tags: slipData.tags }, { merge: true });
    } catch (e) {
        console.error("Error updating slip tags: ", e);
    }
    
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

    // (★変更★)
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

// (★コール管理 新規★) シャンパンコールをトリガー/更新する
const checkAndTriggerChampagneCall = async (slipData) => {
    // 設定、メニュー、またはコール管理コレクションの参照がない場合は何もしない
    if (!settings || !settings.champagneCallBorders || settings.champagneCallBorders.length === 0 || !menu || !menu.items || !champagneCallsCollectionRef) {
        console.log("Call check skipped: feature not configured or data not ready.");
        return;
    }

    // 1. この伝票の「シャンパンコール対象」アイテムとその小計を計算
    let callSubtotal = 0;
    const callItems = [];
    for (const item of slipData.items) {
        const menuItem = menu.items.find(m => m.id === item.id);
        if (menuItem && menuItem.isCallTarget) { 
            callSubtotal += item.price * item.qty;
            callItems.push({ name: menuItem.name, qty: item.qty });
        }
    }

    // 2. 適用される最高の金額ボーダーを見つける
    const applicableBorders = settings.champagneCallBorders
        .filter(rule => callSubtotal >= rule.borderAmount)
        .sort((a, b) => b.borderAmount - a.borderAmount); // 金額が高い順 (降順)

    // 3. 適用されるボーダーがない場合
    if (applicableBorders.length === 0) {
        console.log("No champagne call border met.");
        return;
    }

    const highestBorder = applicableBorders[0];

    // 4. この伝票 (slipId) で、まだ「未対応 (pending)」のコールが既に存在するか確認
    const existingPendingCall = champagneCalls.find(call => call.slipId === slipData.slipId && call.status === 'pending');

    const callData = {
        slipId: slipData.slipId,
        tableId: slipData.tableId,
        totalAmount: callSubtotal, // コール対象アイテムの合計小計
        items: callItems,
        borderAmount: highestBorder.borderAmount, // 達成したボーダー金額
        callType: highestBorder.callName, // 設定されたデフォルトのコール名
        status: 'pending',
        createdAt: serverTimestamp(), // (★重要★) 常にサーバータイムスタンプで更新（リストの先頭に来るように）
        mainMicCastId: null,
        subMicCastId: null,
        completedAt: null
    };

    try {
        if (existingPendingCall) {
            // 5. 既存の「未対応」コールを更新する
            console.log(`Updating existing pending call ${existingPendingCall.id}`);
            const callRef = doc(champagneCallsCollectionRef, existingPendingCall.id);
            await setDoc(callRef, callData); 
        } else {
            // 6. 新規に「未対応」コールを作成する
            console.log("Creating new pending champagne call.");
            await addDoc(champagneCallsCollectionRef, callData);
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
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    const existingItem = slipData.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        slipData.items.push({ id, name, price, qty: 1 });
    }
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
        
        // (★コール管理 追加★) オーダー変更後にコールをチェック
        await checkAndTriggerChampagneCall(slipData);
        
    } catch (e) {
        console.error("Error adding order item: ", e);
    }
    
    renderOrderModal();
};

/**
 * (★コール管理 変更★) 注文リストからアイテムを削除する
 * @param {string} id 商品ID
 */
const removeOrderItem = async (id) => {
    if (!slips) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    slipData.items = slipData.items.filter(item => item.id !== id);
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
        
        // (★コール管理 追加★) オーダー変更後にコールをチェック
        await checkAndTriggerChampagneCall(slipData);
        
    } catch (e) {
        console.error("Error removing order item: ", e);
    }
    renderOrderModal();
};

/**
 * (★コール管理 変更★) 注文アイテムの数量を変更する
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
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { items: slipData.items }, { merge: true });
        
        // (★コール管理 追加★) オーダー変更後にコールをチェック
        await checkAndTriggerChampagneCall(slipData);
        
    } catch (e) {
        console.error("Error updating order item qty: ", e);
    }
    renderOrderModal();
};

/**
 * (★要望5★) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; // (★変更★)

    const store = settings.storeInfo; // (★変更★)
    const rates = settings.rates; // (★変更★)

    // (★要望5★) 領収書のカスタム設定を取得
    const receiptSettings = settings.receiptSettings || {
        storeName: store.name,
        address: `〒${store.zip || ''}<br>${store.address || ''}`,
        tel: `TEL: ${store.tel}`,
        invoiceNumber: "" // (★要望5★) 将来的なインボイス番号設定欄
    };

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
    // (★要望5★)
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
    if (!settings) return; // (★変更★)
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;
    
    // (★変更★)
    try {
        const slipRef = doc(slipsCollectionRef, currentSlipId);
        await setDoc(slipRef, { status: 'checkout' }, { merge: true });
        slipData.status = 'checkout'; // (★変更★)
    } catch (e) {
        console.error("Error updating slip status: ", e);
    }

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
    
    // (★変更★) 割引前の合計を計算 (端数処理も考慮)
    const total = calculateSlipTotal(slipData);
    
    const paidAmount = slipData.paidAmount || 0;
    const billingAmount = total - paidAmount;
    
    // (★変更★) calculateSlipTotal で端数処理が行われるため、
    // (★変更★) 個別の serviceCharge や tax の計算は表示上困難になる。
    // (★変更★) ここでは簡略化し、小計と合計のみ表示する（もしくは別途計算）
    const simpleSubtotal = slipData.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const serviceCharge = simpleSubtotal * settings.rates.service;
    const subtotalWithService = simpleSubtotal + serviceCharge;
    const tax = subtotalWithService * settings.rates.tax;

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
    
    // (★変更★) 割引前の合計を calculateSlipTotal で計算
    const total = calculateSlipTotal(slipData);
    
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
    
    // (★変更★) 割引後にも端数処理を適用
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (rounding.type === 'round_up_total') {
        finalBillingAmount = Math.ceil(finalBillingAmount / rounding.unit) * rounding.unit;
    } else if (rounding.type === 'round_down_total') {
        finalBillingAmount = Math.floor(finalBillingAmount / rounding.unit) * rounding.unit;
    } else {
        finalBillingAmount = Math.round(finalBillingAmount); // 割引計算での端数は丸める
    }

    // 0円未満にはしない
    if (finalBillingAmount < 0) {
        finalBillingAmount = 0;
    }

    // (★変更★) ローカル変数で保持
    currentBillingAmount = finalBillingAmount; 
    
    // (★変更★) 個別表示用の簡易計算
    const serviceCharge = subtotal * settings.rates.service;
    const tax = (subtotal + serviceCharge) * settings.rates.tax;

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

    // (★要望5★) 領収書モーダルの合計金額も更新 (renderReceiptModalより先)
    if(receiptTotalDisplay) receiptTotalDisplay.textContent = formatCurrency(finalBillingAmount);
};

/**
 * (★修正★) 会計モーダルの支払い状況を計算・更新する (割引再計算 + 端数処理)
 */
const updatePaymentStatus = () => {
    if (!settings) return; // (★変更★)

    // (★追加★) 割引を先に再計算
    const slipData = slips.find(s => s.slipId === currentSlipId); // (★変更★)
    if (!slipData) return;

    // (★変更★) 割引前の合計を calculateSlipTotal で計算
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

    // (★変更★) 割引後にも端数処理を適用
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

    // (★修正★) ローカル変数を更新
    currentBillingAmount = finalBillingAmount;
    checkoutTotalEl.textContent = formatCurrency(finalBillingAmount);
    
    // (★要望5★) 領収書モーダルの合計金額も更新
    if(receiptTotalDisplay) receiptTotalDisplay.textContent = formatCurrency(finalBillingAmount);
    
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
 * (★要望5★) 領収書モーダルを描画・更新する
 */
const renderReceiptModal = () => {
    if (!settings) return;
    
    const slipData = slips.find(s => s.slipId === currentSlipId);
    if (!slipData) return;
    
    // (★要望5★) フォームの初期値を設定
    if (receiptCustomerNameInput) {
        receiptCustomerNameInput.value = slipData.name !== "新規のお客様" ? slipData.name : '';
    }
    if (receiptDescriptionInput) {
        // (★要望5★) settings から但し書きのデフォルトを取得
        receiptDescriptionInput.value = settings.receiptSettings?.defaultDescription || "お飲食代として";
    }
    if (receiptOptionDate) receiptOptionDate.checked = true;
    if (receiptOptionAmount) receiptOptionAmount.checked = true;
    
    // (★要望5★) プレビューを更新
    updateReceiptPreview();
};

/**
 * (★要望5★) 領収書プレビューを更新する
 */
const updateReceiptPreview = () => {
    if (!receiptPreviewArea) return;

    // フォームの値を取得
    const name = receiptCustomerNameInput.value.trim() ? `${receiptCustomerNameInput.value.trim()} ` : '';
    const description = receiptDescriptionInput.value.trim() || 'お飲食代として';
    const showDate = receiptOptionDate.checked;
    const showAmount = receiptOptionAmount.checked;

    // プレビューに反映
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
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.remove('active');
    }
};

/**
 * (★新規★) 新しい伝票を作成し、伝票モーダルを開く
 * (all-slips.js では tableId が不明なため、現状呼び出されない想定)
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

    // (★変更★)
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
    
    // (★変更★)
    try {
        const docRef = await addDoc(slipsCollectionRef, newSlip);
        await setDoc(slipCounterRef, { count: newSlipNumber });
        currentSlipId = docRef.id;

        const discountAmountInput = document.getElementById('discount-amount');
        const discountTypeSelect = document.getElementById('discount-type');
        if (discountAmountInput) discountAmountInput.value = '';
        if (discountTypeSelect) discountTypeSelect.value = 'yen';

        // (★新規★) オーダーモーダルのカテゴリをリセット
        currentOrderModalCategoryId = null;
        renderOrderModal();
        openModal(orderModal);

    } catch (e) {
        console.error("Error creating new slip: ", e);
    }
};

/**
 * (★在庫管理 変更★) 在庫を減算する
 * @param {object} slipData 
 */
const reduceStock = async (slipData) => {
    if (!menu || !menu.items || !inventoryItems || !inventoryItemsCollectionRef) {
        console.warn("Cannot reduce stock: menu or inventory data missing.");
        return;
    }

    const updates = new Map();

    // 1. 伝票内のアイテムをループ
    for (const slipItem of slipData.items) {
        // 2. メニュー定義を検索
        const menuItem = menu.items.find(m => m.id === slipItem.id);
        
        // 3. メニューが在庫に紐付いているか確認
        if (menuItem && menuItem.inventoryItemId && menuItem.inventoryConsumption > 0) {
            const inventoryId = menuItem.inventoryItemId;
            const consumption = menuItem.inventoryConsumption * slipItem.qty;
            
            // 4. Map に減算量を加算 (同じ在庫品目が複数メニューで使われる場合)
            const currentUpdate = updates.get(inventoryId) || 0;
            updates.set(inventoryId, currentUpdate + consumption);
        }
    }
    
    if (updates.size === 0) {
        console.log("No inventory items to update for this slip.");
        return; // 在庫更新対象なし
    }

    // 5. Firestore の在庫品目を更新
    const updatePromises = [];
    for (const [inventoryId, totalConsumption] of updates.entries()) {
        
        const itemDocRef = doc(inventoryItemsCollectionRef, inventoryId);
        
        const localItem = inventoryItems.find(i => i.id === inventoryId);
        const currentStock = localItem ? (localItem.currentStock || 0) : 0;
        const newStock = currentStock - totalConsumption;

        console.log(`Reducing stock for ${inventoryId}: ${currentStock} -> ${newStock}`);

        updatePromises.push(
            setDoc(itemDocRef, {
                currentStock: newStock,
                updatedAt: serverTimestamp()
            }, { merge: true })
        );
    }
    
    try {
        await Promise.all(updatePromises);
        console.log("Stock levels updated successfully.");
    } catch (error) {
        console.error("Error updating stock levels: ", error);
        alert(`会計処理中にエラーが発生しました: ${error.message}\n在庫が正しく減算されていない可能性があります。`);
    }
};


/**
 * (★新規★) 伝票選択モーダルを描画する 
 * (all-slips.js では呼び出し元がないが、関数は定義しておく)
 * @param {string} tableId 
 */
const renderSlipSelectionModal = (tableId) => {
    if (!slips) return; // (★変更★)
    if (!slipSelectionModalTitle || !slipSelectionList) return; 

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
 * (all-slips.js では呼び出し元がないが、関数は定義しておく)
 * @param {string} tableId 
 */
const renderNewSlipConfirmModal = (tableId) => {
    if (!newSlipConfirmModal) return; 

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


/**
 * (変更) テーブルカードクリック時の処理 (all-slips.jsでは不要)
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

    // (★新規★) オーダーモーダルのカテゴリをリセット
    currentOrderModalCategoryId = null;
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
 * (新規) キャストランキングを描画する (all-slips.jsでは不要)
 */
// (★削除★)
// const renderCastRanking = () => { ... };

// (★コール管理 変更★) デフォルトの state を定義する関数
const getDefaultSettings = () => {
    return {
        // currentPage: 'all-slips', (settings には不要)
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
        // (★新規★) 端数処理設定
        rounding: { type: 'none', unit: 1 }, // 'none', 'round_up_total', 'round_down_total', 'round_up_subtotal'
        // (★要望5★) 領収書設定
        receiptSettings: {
            storeName: "Night POS",
            address: "〒160-0021<br>東京都新宿区歌舞伎町1-1-1",
            tel: "TEL: 03-0000-0000",
            invoiceNumber: "T1234567890",
            defaultDescription: "お飲食代として"
        },
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
        ranking: { period: 'monthly', type: 'nominations' },
        // (★コール管理 追加★) デフォルトのシャンパンコール設定
        champagneCallBorders: [
            { callName: "シャンパンコール", borderAmount: 50000 },
            { callName: "ロングコール (曲A)", borderAmount: 150000 },
            { callName: "ロングコール (曲B)", borderAmount: 250000 },
            { callName: "オールコール", borderAmount: 750000 },
            { callName: "ミリオンコール", borderAmount: 1000000 }
        ]
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
            { id: 'm1', categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60, inventoryItemId: null, inventoryConsumption: null, isCallTarget: false },
            { id: 'm2', categoryId: catSetId, name: '基本セット (フリー)', price: 8000, duration: 60, inventoryItemId: null, inventoryConsumption: null, isCallTarget: false },
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null, inventoryItemId: null, inventoryConsumption: null, isCallTarget: false },
            { id: 'm11', categoryId: catBottleId, name: '鏡月 (ボトル)', price: 8000, duration: null, inventoryItemId: null, inventoryConsumption: null, isCallTarget: false },
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null, inventoryItemId: null, inventoryConsumption: null, isCallTarget: false },
            // (★コール管理 追加★)
            { id: getUUID(), categoryId: catBottleId, name: 'ドン・ペリニヨン', price: 80000, duration: null, inventoryItemId: null, inventoryConsumption: null, isCallTarget: true },
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};

// (★削除★) Firestore への state 保存関数
// const updateStateInFirestore = async (newState) => { ... };

// (★要望4, 5★)
/**
 * (★新規★) ヘッダーのストアセレクターを描画する
 */
const renderHeaderStoreName = () => {
    if (!headerStoreName || !settings || !currentStoreId) return;

    const currentStoreName = settings.storeInfo.name || "店舗";
    
    // (★変更★) loading... を店舗名で上書き
    headerStoreName.textContent = currentStoreName;
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
    const availableTables = settings.tables.filter(t => !activeTableIds.includes(t.id));
    
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
    
    const slipRef = doc(slipsCollectionRef, currentSlipId);
    
    try {
        await setDoc(slipRef, { tableId: newTableId }, { merge: true });
        
        closeModal(tableTransferModal);
        closeModal(orderModal);
        // onSnapshot が自動でダッシュボードとテーブル一覧を更新
        
    } catch (e) {
        console.error("Error transferring table: ", e);
        if (transferError) transferError.textContent = "テーブルの移動に失敗しました。";
    }
};


/**
 * (★コール管理 変更★) --- Firestore リアルタイムリスナー ---
 */
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        settingsRef: sRef, 
        menuRef: mRef, 
        slipCounterRef: scRef,
        castsCollectionRef: cRef, 
        customersCollectionRef: cuRef, 
        slipsCollectionRef: slRef,
        inventoryItemsCollectionRef: iRef, // (★在庫管理 追加★)
        champagneCallsCollectionRef: ccRef, // (★コール管理 追加★)
        currentStoreId: csId // (★動的表示 追加★)
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    menuRef = mRef;
    slipCounterRef = scRef;
    castsCollectionRef = cRef;
    customersCollectionRef = cuRef;
    slipsCollectionRef = slRef;
    inventoryItemsCollectionRef = iRef; // (★在庫管理 追加★)
    champagneCallsCollectionRef = ccRef; // (★コール管理 追加★)
    currentStoreId = csId; // (★動的表示 追加★)

    // (★新規★) 全データをロードできたか確認するフラグ
    let settingsLoaded = false;
    let menuLoaded = false;
    let castsLoaded = false;
    let customersLoaded = false;
    let slipsLoaded = false;
    let counterLoaded = false;
    let inventoryLoaded = false; // (★在庫管理 追加★)
    let callsLoaded = false; // (★コール管理 追加★)

    // (★コール管理 変更★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) all-slips.js は renderAllSlipsPage を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded && inventoryLoaded && callsLoaded) { // (★コール管理 変更★)
            console.log("All data loaded. Rendering UI for all-slips.js");
            renderAllSlipsPage();
            updateModalCommonInfo(); 
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
    
    // 7. (★在庫管理 追加★) Inventory Items
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
    
    // 8. (★コール管理 追加★) Champagne Calls
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
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'all-slips.html');

    // ===== DOM要素の取得 =====
    // (★修正★) all-slips.html に存在するDOMのみ取得
    // navLinks = document.querySelectorAll('.nav-link'); // (★削除★)
    pageTitle = document.getElementById('page-title');
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
    printReceiptBtn = document.getElementById('print-receipt-btn');


    // (★新規★) 割引
    discountAmountInput = document.getElementById('discount-amount');
    discountTypeSelect = document.getElementById('discount-type');
    
    // (★要望4★)
    headerStoreName = document.getElementById('header-store-name');
    
    // (★新規★) 転卓モーダル
    tableTransferModal = document.getElementById('table-transfer-modal');
    openTransferModalBtn = document.getElementById('open-transfer-modal-btn');
    transferSlipNumber = document.getElementById('transfer-slip-number');
    transferTableGrid = document.getElementById('transfer-table-grid');
    transferError = document.getElementById('transfer-error');

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
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
            closeModal(tableTransferModal); // (★新規★) 転卓モーダル

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
        saveNewCustomerBtn.addEventListener('click', async () => { // (★変更★)
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
            
            // (★変更★)
            try {
                await addDoc(customersCollectionRef, newCustomer);
                
                const slipData = slips.find(s => s.slipId === currentSlipId);
                if (slipData) {
                    slipData.name = newName;
                    updateSlipInfo();
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
            if (!slips) return; // (★変更★)
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = slips.find(s => s.slipId === currentSlipId); // (★変更★)
            if (slip) {
                // (★変更★)
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

    // (★変更★) 伝票プレビューの印刷ボタン
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
            if (!slips) return; // (★変更★)
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

                const slipRef = doc(slipsCollectionRef, currentSlipId);
                await setDoc(slipRef, updatedSlipData, { merge: true });

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
            if (!slips) return; // (★変更★)
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
                    const slipRef = doc(slipsCollectionRef, currentSlipId);
                    await setDoc(slipRef, updatedSlipData, { merge: true });
                    
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
            // (★変更★)
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