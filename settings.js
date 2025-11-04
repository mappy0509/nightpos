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
let currentBillingAmount = 0;


// ===== DOM要素 =====
// (変更) settings.js 専用のDOM要素のみを取得
let modalCloseBtns,
    storeNameInput, storeAddressInput, storeTelInput,
    taxRateInput, serviceRateInput,
    dayChangeTimeInput,
    saveSettingsBtn, settingsFeedback,
    
    // (★修正★) HTML側のIDに合わせてDOM取得変数を全面的に見直し
    
    // テーブル設定
    newTableIdInput, addTableBtn, currentTablesList, tableSettingsError,
    
    // 伝票タグ設定 (★新規★)
    newTagNameInput, addTagBtn, currentTagsList, tagSettingsError,
    
    // (★削除★) キャスト設定DOMを削除
    // newCastNameInput, addCastBtn, currentCastsList, castSettingsError,

    // 成績設定
    performanceCastItemsContainer,
    settingScSalesValue, settingScSalesType, // (★修正★) サービス料
    settingTaxSalesValue, settingTaxSalesType, // (★修正★) 消費税
    settingSideSalesValue, // (★修正★) 枝
    settingSideCountNomination, // (★修正★) 枝

    // (★新規★) settings.html に存在するモーダル用DOM
    newSlipConfirmModal, newSlipConfirmTitle, newSlipConfirmMessage, confirmCreateSlipBtn,
    newSlipStartTimeInput, newSlipTimeError,
    slipSelectionModal, slipSelectionModalTitle, slipSelectionList, createNewSlipBtn,
    
    // (★新規★) 他のモーダルDOM (HTMLに存在するため)
    orderModal, checkoutModal, receiptModal, slipPreviewModal,
    cancelSlipModal, menuEditorModal;


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
 * (変更) 伝票の合計金額（割引前）を計算する (settings.jsでは不要だが共通ロジックとして残す)
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
 * (新規) キャストIDからキャスト名を取得する (settings.jsでは不要だが共通ロジックとして残す)
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!casts) return '不明'; // (★変更★)
    if (!castId) return 'フリー';
    const cast = (casts || []).find(c => c.id === castId); // (★変更★)
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (settings.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    if (!slips) return 0; // (★変更★)
    return (slips || []).filter( // (★変更★)
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
    // (変更) settings.js ではモーダルを開かないが、HTML上にあるため閉じるロジックのみ残す
    // (DOM要素を限定的に取得するため、引数ではなくIDで直接探す)
    const modals = document.querySelectorAll('.modal-backdrop');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
};

/**
 * (新規) 設定フォームに現在の値を読み込む
 */
const loadSettingsToForm = () => {
    if (!settings) return; // (★変更★)

    // 店舗情報
    if (storeNameInput) storeNameInput.value = settings.storeInfo.name;
    if (storeAddressInput) storeAddressInput.value = settings.storeInfo.address;
    if (storeTelInput) storeTelInput.value = settings.storeInfo.tel;

    // 税率・サービス料
    if (taxRateInput) taxRateInput.value = settings.rates.tax * 100;
    if (serviceRateInput) serviceRateInput.value = settings.rates.service * 100;
    
    // 営業日付
    if (dayChangeTimeInput) dayChangeTimeInput.value = settings.dayChangeTime; 
    
    // 各リストの描画
    renderTableSettingsList();
    renderTagSettingsList(); // (★新規★)
    // (★削除★) renderCastSettingsList();
    renderPerformanceSettings();
};

/**
 * (★変更★) キャスト成績反映設定セクションを描画する
 */
const renderPerformanceSettings = () => {
    if (!settings || !menu) return; // (★変更★)
    
    // 1. キャスト料金項目の動的生成
    if (performanceCastItemsContainer) {
        performanceCastItemsContainer.innerHTML = '';
        
        // (★変更★) `isCastCategory: true` のカテゴリIDを探す
        const castCategory = (menu.categories || []).find(c => c.isCastCategory === true);
        
        let castMenuItems = [];
        if (castCategory) {
            // (★変更★) `state.menu.items` から該当カテゴリの商品をフィルタリング
            castMenuItems = (menu.items || []).filter(item => item.categoryId === castCategory.id);
        }
        
        if (castMenuItems.length === 0) {
            performanceCastItemsContainer.innerHTML = '<p class="text-sm text-slate-500">「メニュー管理」の「カテゴリ管理」で「キャスト料金(成績反映)」にチェックを入れたカテゴリに、メニュー項目を追加してください。</p>';
        } else {
            castMenuItems.forEach(item => {
                const setting = settings.performanceSettings.menuItems[item.id] || { // (★変更★)
                    salesType: 'percentage',
                    salesValue: 100,
                    countNomination: true
                };

                const itemHtml = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center p-3 bg-slate-50 rounded-lg border">
                    <span class="font-medium">${item.name} (${formatCurrency(item.price)})</span>
                    <div>
                        <label class="text-xs font-semibold text-slate-600">個人売上への反映</label>
                        <div class="flex mt-1">
                            <input type="number" value="${setting.salesValue}" class="w-2/3 p-2 border border-slate-300 rounded-l-lg focus:outline-none setting-menu-sales-value" data-menu-id="${item.id}">
                            <select class="w-1/3 p-2 border-t border-b border-r border-slate-300 rounded-r-lg bg-slate-100 focus:outline-none setting-menu-sales-type" data-menu-id="${item.id}">
                                <option value="percentage" ${setting.salesType === 'percentage' ? 'selected' : ''}>%</option>
                                <option value="fixed" ${setting.salesType === 'fixed' ? 'selected' : ''}>円</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="flex items-center space-x-2 mt-5 cursor-pointer">
                            <input type="checkbox" ${setting.countNomination ? 'checked' : ''} class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 setting-menu-count-nomination" data-menu-id="${item.id}">
                            <span class="text-sm font-medium text-slate-700">指名本数としてカウント</span>
                        </label>
                    </div>
                </div>
                `;
                performanceCastItemsContainer.innerHTML += itemHtml;
            });
        }
    }

    // 2. サービス料・税
    // (★修正★) HTML側のID (setting-sc-sales-value など) に合わせる
    const scSetting = settings.performanceSettings.serviceCharge; // (★変更★)
    const taxSetting = settings.performanceSettings.tax; // (★変更★)
    if (settingScSalesValue) settingScSalesValue.value = scSetting.salesValue;
    if (settingScSalesType) settingScSalesType.value = scSetting.salesType;
    if (settingTaxSalesValue) settingTaxSalesValue.value = taxSetting.salesValue;
    if (settingTaxSalesType) settingTaxSalesType.value = taxSetting.salesType;

    // 3. 枝（サイド）設定
    // (★修正★) HTML側のID (setting-side-sales-value など) に合わせる
    const sideSetting = settings.performanceSettings.sideCustomer; // (★変更★)
    if (settingSideSalesValue) settingSideSalesValue.value = sideSetting.salesValue;
    if (settingSideCountNomination) settingSideCountNomination.checked = sideSetting.countNomination;
};


/**
 * (新規) フォームから設定を保存する
 */
const saveSettingsFromForm = async () => { // (★変更★) async
    if (!settings) return; // (★変更★)
    
    // --- 店舗情報 ---
    const newStoreInfo = {
        name: storeNameInput.value.trim(),
        address: storeAddressInput.value.trim(),
        tel: storeTelInput.value.trim(),
        zip: settings.storeInfo.zip || "" // (★変更★) zipを維持
    };

    // --- 税率 ---
    const newTaxRate = parseFloat(taxRateInput.value) / 100;
    const newServiceRate = parseFloat(serviceRateInput.value) / 100;

    if (isNaN(newTaxRate) || newTaxRate < 0 || isNaN(newServiceRate) || newServiceRate < 0) {
        if (settingsFeedback) {
            settingsFeedback.textContent = "税率とサービス料には有効な数値を入力してください。";
            settingsFeedback.className = "text-sm text-red-600";
        }
        return;
    }
    
    const newRates = {
        tax: newTaxRate,
        service: newServiceRate,
    };

    // --- 営業日付 ---
    const newDayChangeTime = dayChangeTimeInput.value;
    if (!newDayChangeTime) { 
        if (settingsFeedback) {
            settingsFeedback.textContent = "営業日付の変更時刻を有効な形式で入力してください。";
            settingsFeedback.className = "text-sm text-red-600";
        }
        return;
    }
    
    // --- 成績反映設定 ---
    const newPerformanceSettings = {
        menuItems: {},
        serviceCharge: {
            salesValue: parseInt(settingScSalesValue.value) || 0,
            salesType: settingScSalesType.value
        },
        tax: {
            salesValue: parseInt(settingTaxSalesValue.value) || 0,
            salesType: settingTaxSalesType.value
        },
        sideCustomer: {
            salesValue: parseInt(settingSideSalesValue.value) || 0,
            countNomination: settingSideCountNomination.checked
        }
    };
    
    if (performanceCastItemsContainer) {
        const itemInputs = performanceCastItemsContainer.querySelectorAll('.setting-menu-sales-value');
        const itemTypes = performanceCastItemsContainer.querySelectorAll('.setting-menu-sales-type');
        const itemCounts = performanceCastItemsContainer.querySelectorAll('.setting-menu-count-nomination');
        
        itemInputs.forEach((input, index) => {
            const menuId = input.dataset.menuId;
            if (menuId) {
                newPerformanceSettings.menuItems[menuId] = {
                    salesValue: parseInt(input.value) || 0,
                    salesType: itemTypes[index].value,
                    countNomination: itemCounts[index].checked
                };
            }
        });
    }


    // (★変更★) settings オブジェクトを直接更新
    settings.storeInfo = newStoreInfo;
    settings.rates = newRates;
    settings.dayChangeTime = newDayChangeTime;
    settings.performanceSettings = newPerformanceSettings;
    // (★変更★) tables, slipTagsMaster はローカルの 'settings' オブジェクト上で
    // 既に追加・削除が反映されているはず
    
    // (★変更★) Firestoreに保存
    try {
        await setDoc(settingsRef, settings);

        if (settingsFeedback) {
            settingsFeedback.textContent = "設定を保存しました。";
            settingsFeedback.className = "text-sm text-green-600";
            setTimeout(() => {
                settingsFeedback.textContent = "";
            }, 3000);
        }
    } catch (e) {
        console.error("Error saving settings: ", e);
        if (settingsFeedback) {
            settingsFeedback.textContent = "設定の保存に失敗しました。";
            settingsFeedback.className = "text-sm text-red-600";
        }
    }
};

// ===================================
// (★新規★) テーブル設定セクション
// ===================================

/**
 * (新規) テーブル設定リストをUIに描画する
 */
const renderTableSettingsList = () => {
    if (!currentTablesList || !settings) return; // (★変更★)
    
    currentTablesList.innerHTML = '';
    if (tableSettingsError) tableSettingsError.textContent = '';
    
    if (!settings.tables || settings.tables.length === 0) { // (★変更★)
        currentTablesList.innerHTML = '<p class="text-sm text-slate-500">テーブルが登録されていません。</p>';
        return;
    }

    const sortedTables = [...settings.tables].sort((a, b) => // (★変更★)
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedTables.forEach(table => {
        const isOccupied = (slips || []).some(s => s.tableId === table.id && (s.status === 'active' || s.status === 'checkout')); // (★変更★)
        
        const itemHTML = `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <span class="font-semibold">${table.id}</span>
                ${isOccupied ? 
                    `<span class="text-xs text-red-600 font-medium">(利用中のため削除不可)</span>` : 
                    `<button type="button" class="delete-table-btn text-red-500 hover:text-red-700" data-table-id="${table.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>`
                }
            </div>
        `;
        currentTablesList.innerHTML += itemHTML;
    });
};

/**
 * (新規) テーブル設定を追加する
 */
const addTableSetting = async () => { // (★変更★) async
    if (!newTableIdInput || !tableSettingsError || !settings) return; // (★変更★)
    
    const newId = newTableIdInput.value.trim().toUpperCase();
    
    if (newId === "") {
        tableSettingsError.textContent = "テーブル名を入力してください。";
        return;
    }
    
    const exists = settings.tables.some(table => table.id === newId); // (★変更★)
    if (exists) {
        tableSettingsError.textContent = "そのテーブル名は既に使用されています。";
        return;
    }
    
    const newTable = {
        id: newId,
        status: 'available' 
    };
    
    settings.tables.push(newTable); // (★変更★)
    
    // (★変更★) settingsRef に保存
    try {
        await setDoc(settingsRef, settings);
        newTableIdInput.value = '';
        tableSettingsError.textContent = '';
    } catch (e) {
        console.error("Error adding table: ", e);
        tableSettingsError.textContent = "テーブルの追加に失敗しました。";
        settings.tables.pop(); // (★変更★) 失敗したらローカルからも削除
    }
};

/**
 * (新規) テーブル設定を削除する
 * @param {string} tableId 
 */
const deleteTableSetting = async (tableId) => { // (★変更★) async
    if (!settings) return; // (★変更★)
    const table = settings.tables.find(t => t.id === tableId); // (★変更★)
    
    const isOccupied = (slips || []).some(s => s.tableId === tableId && (s.status === 'active' || s.status === 'checkout')); // (★変更★)

    if (!table || isOccupied) {
        tableSettingsError.textContent = `${tableId} は利用中のため削除できません。`;
        return;
    }

    settings.tables = settings.tables.filter(t => t.id !== tableId); // (★変更★)
    
    // (★変更★) settingsRef に保存
    try {
        await setDoc(settingsRef, settings);
    } catch (e) {
        console.error("Error deleting table: ", e);
        tableSettingsError.textContent = "テーブルの削除に失敗しました。";
        settings.tables.push(table); // (★変更★) 失敗したらローカルに戻す
    }
};

// ===================================
// (★新規★) 伝票タグ設定セクション
// ===================================

/**
 * (★新規★) 伝票タグ設定リストをUIに描画する
 */
const renderTagSettingsList = () => {
    if (!currentTagsList || !settings) return; // (★変更★)
    
    currentTagsList.innerHTML = '';
    if (tagSettingsError) tagSettingsError.textContent = '';
    
    if (!settings.slipTagsMaster || settings.slipTagsMaster.length === 0) { // (★変更★)
        currentTagsList.innerHTML = '<p class="text-sm text-slate-500">タグが登録されていません。</p>';
        return;
    }
    
    settings.slipTagsMaster.forEach(tag => { // (★変更★)
        const itemHTML = `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <span class="font-semibold">${tag.name}</span>
                <button type="button" class="delete-tag-btn text-red-500 hover:text-red-700" data-tag-id="${tag.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        currentTagsList.innerHTML += itemHTML;
    });
};

/**
 * (★新規★) 伝票タグを追加する
 */
const addTagSetting = async () => { // (★変更★) async
    if (!newTagNameInput || !tagSettingsError || !settings) return; // (★変更★)
    
    const newName = newTagNameInput.value.trim();
    if (newName === "") {
        tagSettingsError.textContent = "タグ名を入力してください。";
        return;
    }
    
    const exists = settings.slipTagsMaster.some(tag => tag.name === newName); // (★変更★)
    if (exists) {
        tagSettingsError.textContent = "そのタグ名は既に使用されています。";
        return;
    }
    
    const newTag = { id: getUUID(), name: newName };
    
    settings.slipTagsMaster.push(newTag); // (★変更★)
    
    // (★変更★)
    try {
        await setDoc(settingsRef, settings);
        newTagNameInput.value = '';
        tagSettingsError.textContent = '';
    } catch (e) {
        console.error("Error adding tag: ", e);
        tagSettingsError.textContent = "タグの追加に失敗しました。";
        settings.slipTagsMaster.pop(); // (★変更★)
    }
};

/**
 * (★新規★) 伝票タグを削除する
 * @param {string} tagId 
 */
const deleteTagSetting = async (tagId) => { // (★変更★) async
    if (!settings) return; // (★変更★)
    
    const tagToDelete = settings.slipTagsMaster.find(t => t.id === tagId); // (★変更★)
    if (!tagToDelete) return;
    
    settings.slipTagsMaster = settings.slipTagsMaster.filter(t => t.id !== tagId); // (★変更★)
    
    // (★変更★)
    try {
        await setDoc(settingsRef, settings);
    } catch (e) {
        console.error("Error deleting tag: ", e);
        tagSettingsError.textContent = "タグの削除に失敗しました。";
        settings.slipTagsMaster.push(tagToDelete); // (★変更★)
    }
};


// ===================================
// (★削除★) キャスト設定セクション (cast-settings.js に移動)
// ===================================
// renderCastSettingsList
// addCastSetting
// deleteCastSetting


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; // (★変更★)
    // (変更) settings.js でモーダル内のDOM要素は取得しないため、中身を空にする
    // (ただし、HTMLにはモーダルが存在するため、関数自体は残す)
};


// ===================================
// (★新規★) 伝票作成ロジック (settings.js では基本使われないが、HTMLのモーダル定義と一貫性を保つため)
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
        
        // (★変更★) 伝票モーダルは settings.js には存在しないため、描画・表示ロジックは削除
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
        // currentPage: 'settings', (settings には不要)
        slipTagsMaster: [
            { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
            { id: 'tag3', name: '初回' }, { id: 'tag4', name: '枝' },
        ],
        tables: [
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
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
            { id: 'm7', categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
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
        // (★変更★) settings.js は loadSettingsToForm を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded) {
            console.log("All data loaded. Rendering UI for settings.js");
            loadSettingsToForm();
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
    storeNameInput = document.getElementById('store-name');
    storeAddressInput = document.getElementById('store-address');
    storeTelInput = document.getElementById('store-tel');
    taxRateInput = document.getElementById('tax-rate');
    serviceRateInput = document.getElementById('service-rate');
    dayChangeTimeInput = document.getElementById('day-change-time'); 
    saveSettingsBtn = document.getElementById('save-settings-btn');
    settingsFeedback = document.getElementById('settings-feedback');

    // テーブル
    newTableIdInput = document.getElementById('new-table-id-input');
    addTableBtn = document.getElementById('add-table-btn');
    currentTablesList = document.getElementById('current-tables-list');
    tableSettingsError = document.getElementById('table-settings-error');
    
    // (★新規★) タグ
    newTagNameInput = document.getElementById('new-tag-name-input');
    addTagBtn = document.getElementById('add-tag-btn');
    currentTagsList = document.getElementById('current-tags-list');
    tagSettingsError = document.getElementById('tag-settings-error');

    // (★削除★) キャスト
    // newCastNameInput = document.getElementById('new-cast-name-input');
    // addCastBtn = document.getElementById('add-cast-btn');
    // currentCastsList = document.getElementById('current-casts-list');
    // castSettingsError = document.getElementById('cast-settings-error');

    // (★修正★) 成績設定 (HTMLのID変更を反映)
    performanceCastItemsContainer = document.getElementById('performance-cast-items-container');
    settingScSalesValue = document.getElementById('setting-sc-sales-value');
    settingScSalesType = document.getElementById('setting-sc-sales-type');
    settingTaxSalesValue = document.getElementById('setting-tax-sales-value');
    settingTaxSalesType = document.getElementById('setting-tax-sales-type');
    settingSideSalesValue = document.getElementById('setting-side-sales-value');
    settingSideCountNomination = document.getElementById('setting-side-count-nomination');

    // (★新規★) settings.html に存在するモーダル用DOM
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
    
    // (★新規★) 他のモーダルDOM (HTMLに存在するため)
    orderModal = document.getElementById('order-modal');
    checkoutModal = document.getElementById('checkout-modal');
    receiptModal = document.getElementById('receipt-modal');
    slipPreviewModal = document.getElementById('slip-preview-modal');
    cancelSlipModal = document.getElementById('cancel-slip-modal');
    menuEditorModal = document.getElementById('menu-editor-modal');
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // (★変更★) settings.js が知っているすべてのモーダルを閉じる
            closeModal(newSlipConfirmModal);
            closeModal(slipSelectionModal);
            // (★変更★) 他のモーダルもHTMLには存在するため、閉じるロジックは残す
            closeModal(orderModal);
            closeModal(cancelSlipModal);
            closeModal(slipPreviewModal);
            closeModal(checkoutModal);
            closeModal(receiptModal);
            closeModal(menuEditorModal);
        });
    });

    // 設定保存ボタン
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveSettingsFromForm(); // (★変更★)
        });
    }
    
    // --- テーブル設定 ---
    if (addTableBtn) {
        addTableBtn.addEventListener('click', () => {
            addTableSetting(); // (★変更★)
        });
    }
    if (newTableIdInput) {
        newTableIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTableSetting(); // (★変更★)
            }
        });
    }
    if (currentTablesList) {
        currentTablesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-table-btn');
            if (deleteBtn) {
                if (confirm(`テーブル「${deleteBtn.dataset.tableId}」を削除しますか？`)) {
                    deleteTableSetting(deleteBtn.dataset.tableId); // (★変更★)
                }
            }
        });
    }

    // --- (★新規★) タグ設定 ---
    if (addTagBtn) {
        addTagBtn.addEventListener('click', () => {
            addTagSetting(); // (★変更★)
        });
    }
    if (newTagNameInput) {
        newTagNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagSetting(); // (★変更★)
            }
        });
    }
    if (currentTagsList) {
        currentTagsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-tag-btn');
            if (deleteBtn) {
                if (confirm(`タグを削除しますか？`)) {
                    deleteTagSetting(deleteBtn.dataset.tagId); // (★変更★)
                }
            }
        });
    }

    // --- (★削除★) キャスト設定 ---
    // if (addCastBtn) { ... }
    // if (newCastNameInput) { ... }
    // if (currentCastsList) { ... }
    
    // (★新規★) 伝票選択モーダルのイベント委任
    if (slipSelectionList) {
        slipSelectionList.addEventListener('click', (e) => {
            const slipBtn = e.target.closest('button[data-slip-id]');
            if (slipBtn) {
                // handleSlipClick(slipBtn.dataset.slipId); // (★変更★) settings.js には handleSlipClick がない
                console.warn('handleSlipClick is not implemented in settings.js');
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