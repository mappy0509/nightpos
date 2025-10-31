// ===== Firebase =====
// (新規) Firebase SDK と 初期化モジュールをインポート
import { getFirebaseServices } from './firebase-init.js';
import {
    doc,
    onSnapshot,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// (新規) Firebaseサービス (db, auth, userId, appId) を保持するグローバル変数
let db, auth, userId, appId;
let stateDocRef; // (新規) Firestore の state ドキュメント参照
let unsubscribeState = null; // (新規) onSnapshot の購読解除関数

// ===== グローバル定数・変数 =====
/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (変更) ===== state管理 =====

// (削除) const LOCAL_STORAGE_KEY = 'nightPosState';

/**
 * (変更) デフォルトのstateを定義する関数 (Firestore新規作成用)
 * @returns {object} デフォルトのstateオブジェクト
 */
const getDefaultState = () => ({
    currentPage: 'settings', // (変更) このページのデフォルト
    currentStore: 'store1',
    slipCounter: 0,
    slipTagsMaster: [
        { id: 'tag1', name: '指名' },
        { id: 'tag2', name: '初指名' },
        { id: 'tag3', name: '初回' },
        { id: 'tag4', name: '枝' },
        { id: 'tag5', name: '切替' },
        { id: 'tag6', name: '案内所' },
        { id: 'tag7', name: '20歳未満' },
        { id: 'tag8', name: '同業' },
    ],
    casts: [
        { id: 'c1', name: 'あい' },
        { id: 'c2', name: 'みう' },
        { id: 'c3', name: 'さくら' },
    ],
    customers: [
        { id: 'cust1', name: '鈴木様', nominatedCastId: 'c1' },
        { id: 'cust2', name: '田中様', nominatedCastId: null },
    ],
    tables: [
        { id: 'V1', status: 'available' },
        { id: 'V2', status: 'available' },
        { id: 'T1', status: 'available' },
    ],
    slips: [],
    menu: {
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', name: '基本セット (フリー)', price: 8000, duration: 60 },
        ],
        drink: [
            { id: 'm7', name: 'キャストドリンク', price: 1500 },
            { id: 'm8', name: 'ビール', price: 1000 },
        ],
        bottle: [],
        food: [],
        cast: [
            { id: 'm14', name: '本指名料', price: 3000 },
        ],
        other: []
    },
    storeInfo: {
        name: "Night POS 新宿本店",
        address: "東京都新宿区歌舞伎町1-1-1",
        tel: "03-0000-0000"
    },
    rates: {
        tax: 0.10,
        service: 0.20
    },
    dayChangeTime: "05:00",
    performanceSettings: {
        menuItems: {},
        serviceCharge: { salesType: 'percentage', salesValue: 0 },
        tax: { salesType: 'percentage', salesValue: 0 },
        sideCustomer: { salesValue: 100, countNomination: true }
    },
    currentSlipId: null,
    currentEditingMenuId: null,
    currentBillingAmount: 0,
    ranking: {
        period: 'monthly',
        type: 'nominations'
    }
});

// (削除) loadState 関数
// (削除) saveState 関数

// (変更) グローバルな state は Firestore からのデータで上書きされる
let state = getDefaultState();

/**
 * (変更) state変更時にFirestoreに保存する
 * @param {object} newState 更新後のstateオブジェクト
 */
const updateStateInFirestore = async (newState) => {
    state = newState; // ローカルのstateを即時更新
    if (stateDocRef) {
        try {
            await setDoc(stateDocRef, state);
            console.log("State updated in Firestore");
        } catch (e) {
            console.error("Error updating state in Firestore:", e);
        }
    } else {
        console.warn("stateDocRef is not ready. State not saved to Firestore.");
    }
};

// (変更) 従来の updateState を updateStateInFirestore を呼ぶように変更
const updateState = (newState) => {
    state = newState;
    updateStateInFirestore(newState);
};


// ===== DOM要素 =====
// (変更) settings.jsで必要なDOMのみ
let modalCloseBtns,
    storeNameInput, storeAddressInput, storeTelInput,
    taxRateInput, serviceRateInput,
    dayChangeTimeInput, // (新規)
    saveSettingsBtn, settingsFeedback,
    // (新規) テーブル設定用DOM
    newTableIdInput, addTableBtn, currentTablesList, tableSettingsError,
    // (新規) 成績設定用DOM
    performanceCastItemsContainer, // (変更) IDに合わせて変更
    settingServiceCharge, // (変更) IDに合わせて変更
    settingTax, // (変更) IDに合わせて変更
    settingBranchSales, // (変更) IDに合わせて変更
    settingBranchNoms; // (変更) IDに合わせて変更

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
 * (変更) 伝票の合計金額（割引前）を計算する (settings.jsでは不要だが共通ロジックとして残す)
 * @param {object} slip 伝票データ
 * @returns {number} 合計金額
 */
const calculateSlipTotal = (slip) => {
    if (!slip || slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    // (変更) slip.items が存在するかチェック
    (slip.items || []).forEach(item => {
        subtotal += item.price * item.qty;
    });
    
    // (変更) state.rates が存在するかチェック
    const taxRate = (state.rates && state.rates.tax) ? state.rates.tax : 0.10;
    const serviceRate = (state.rates && state.rates.service) ? state.rates.service : 0.20;

    const serviceCharge = subtotal * serviceRate;
    const subtotalWithService = subtotal + serviceCharge;
    const tax = subtotalWithService * taxRate;
    const total = subtotalWithService + tax;
    return Math.round(total);
};


/**
 * (新規) キャストIDからキャスト名を取得する (settings.jsでは不要だが共通ロジックとして残す)
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!castId) return 'フリー';
    // (変更) state.casts が存在するかチェック
    const cast = (state.casts || []).find(c => c.id === castId);
    return cast ? cast.name : '不明';
};


/**
 * (変更) 未会計伝票の数を取得する (settings.jsでは不要だが共通ロジックとして残す)
 * @param {string} tableId 
 * @returns {number} 未会計伝票数
 */
const getActiveSlipCount = (tableId) => {
    // (変更) state.slips が存在するかチェック
    return (state.slips || []).filter(
        slip => slip.tableId === tableId && (slip.status === 'active' || slip.status === 'checkout')
    ).length;
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
    // (変更) state.storeInfo が存在するかチェック
    if (storeNameInput && state.storeInfo) storeNameInput.value = state.storeInfo.name;
    if (storeAddressInput && state.storeInfo) storeAddressInput.value = state.storeInfo.address;
    if (storeTelInput && state.storeInfo) storeTelInput.value = state.storeInfo.tel;

    // (変更) 0.10 -> 10 のように % に変換して表示
    if (taxRateInput && state.rates) taxRateInput.value = state.rates.tax * 100;
    if (serviceRateInput && state.rates) serviceRateInput.value = state.rates.service * 100;
    
    if (dayChangeTimeInput) dayChangeTimeInput.value = state.dayChangeTime; // (新規)
    
    // (新規) テーブル設定リストを描画
    renderTableSettingsList();
    
    // (新規) 成績反映設定を描画
    renderPerformanceSettings();
};

/**
 * (新規) キャスト成績反映設定セクションを描画する
 */
const renderPerformanceSettings = () => {
    // 1. キャスト料金項目の動的生成
    if (performanceCastItemsContainer) {
        performanceCastItemsContainer.innerHTML = '';
        const castMenuItems = state.menu?.cast || [];
        
        if (castMenuItems.length === 0) {
            performanceCastItemsContainer.innerHTML = '<p class="text-sm text-slate-500">メニュー管理で「キャスト料金」カテゴリに項目を追加してください。</p>';
        } else {
            castMenuItems.forEach(item => {
                // (変更) state.performanceSettings が存在するかチェック
                const setting = state.performanceSettings?.menuItems?.[item.id] || {
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
    
    // (変更) HTMLのID変更に合わせて、ロジックを修正
    
    // 2. サービス料・税
    const perfSettings = state.performanceSettings || {};
    const scSetting = perfSettings.serviceCharge || { salesType: 'percentage', salesValue: 0 };
    const taxSetting = perfSettings.tax || { salesType: 'percentage', salesValue: 0 };
    
    if (settingServiceCharge) {
        settingServiceCharge.value = (scSetting.salesValue === 100 && scSetting.salesType === 'percentage') ? 'personal_100' : 'store';
    }
    if (settingTax) {
        settingTax.value = (taxSetting.salesValue === 100 && taxSetting.salesType === 'percentage') ? 'personal_100' : 'store';
    }
    
    // 3. 枝（サイド）設定の読み込み
    const sideSetting = perfSettings.sideCustomer || { salesValue: 100, countNomination: true };
    if (settingBranchSales) {
        if (sideSetting.salesValue === 100) settingBranchSales.value = 'personal_100';
        else if (sideSetting.salesValue === 50) settingBranchSales.value = 'personal_50';
        else if (sideSetting.salesValue === 0) settingBranchSales.value = 'personal_0';
        else settingBranchSales.value = 'store'; // デフォルト
    }
    if (settingBranchNoms) {
        settingBranchNoms.value = sideSetting.countNomination ? 'personal' : 'none';
    }
};


/**
 * (新規) フォームから設定を保存する
 */
const saveSettingsFromForm = () => {
    // --- 店舗情報 ---
    const newStoreInfo = {
        name: storeNameInput.value.trim(),
        address: storeAddressInput.value.trim(),
        tel: storeTelInput.value.trim(),
    };

    // --- 税率 ---
    // (変更) 10 -> 0.10 のように 小数点に変換して保存
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

    // (新規) 日付変更時刻
    const newDayChangeTime = dayChangeTimeInput.value;
    if (!newDayChangeTime) { // (新規) バリデーション
        if (settingsFeedback) {
            settingsFeedback.textContent = "営業日付の変更時刻を有効な形式で入力してください。";
            settingsFeedback.className = "text-sm text-red-600";
        }
        return;
    }
    
    // (新規) 成績反映設定
    const newPerformanceSettings = {
        menuItems: {},
        // (変更) HTMLのID変更に合わせて、ロジックを修正
        serviceCharge: settingServiceCharge.value === 'personal_100' ? 
            { salesType: 'percentage', salesValue: 100 } : 
            { salesType: 'percentage', salesValue: 0 },
        tax: settingTax.value === 'personal_100' ? 
            { salesType: 'percentage', salesValue: 100 } : 
            { salesType: 'percentage', salesValue: 0 },
        sideCustomer: {
            salesValue: parseInt(settingBranchSales.value.replace('personal_', '')) || 0,
            countNomination: settingBranchNoms.value === 'personal'
        }
    };
    // 'store' (NaN) は 0 になる
    if (settingBranchSales.value === 'store') {
        newPerformanceSettings.sideCustomer.salesValue = 0; // 'store' は 0% 反映として扱う (要確認)
    }

    
    // 動的に生成されたキャスト料金項目を収集
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


    // (変更) stateを更新
    // (テーブル設定は既に追加/削除時に state.tables が直接更新されている)
    updateState({ 
        ...state, 
        storeInfo: newStoreInfo, 
        rates: newRates,
        dayChangeTime: newDayChangeTime, // (新規)
        performanceSettings: newPerformanceSettings // (新規)
        // state.tables は add/deleteTableSetting で既に更新済み
    });

    if (settingsFeedback) {
        settingsFeedback.textContent = "設定を保存しました。";
        settingsFeedback.className = "text-sm text-green-600";
        setTimeout(() => {
            settingsFeedback.textContent = "";
        }, 3000);
    }
};

/**
 * (新規) テーブル設定リストをUIに描画する
 */
const renderTableSettingsList = () => {
    if (!currentTablesList) return;
    
    currentTablesList.innerHTML = '';
    if (tableSettingsError) tableSettingsError.textContent = '';
    
    // (変更) state.tables が存在するかチェック
    const tables = state.tables || [];
    
    if (tables.length === 0) {
        currentTablesList.innerHTML = '<p class="text-sm text-slate-500">テーブルが登録されていません。</p>';
        return;
    }

    const sortedTables = [...tables].sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedTables.forEach(table => {
        // (変更) state.slips が存在するかチェック
        const activeSlips = (state.slips || []).filter(
            s => s.tableId === table.id && (s.status === 'active' || s.status === 'checkout')
        ).length;
        const isOccupied = activeSlips > 0;

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

    // (新規) 削除ボタンにイベントリスナーを追加 (イベント委任に変更)
    // currentTablesList.querySelectorAll('.delete-table-btn').forEach(btn => { ... });
};

/**
 * (新規) テーブル設定を追加する
 */
const addTableSetting = () => {
    if (!newTableIdInput || !tableSettingsError) return;
    
    const newId = newTableIdInput.value.trim().toUpperCase(); 
    
    if (newId === "") {
        tableSettingsError.textContent = "テーブル名を入力してください。";
        return;
    }
    
    // (変更) state.tables が存在するかチェック
    const exists = (state.tables || []).some(table => table.id === newId);
    if (exists) {
        tableSettingsError.textContent = "そのテーブル名は既に使用されています。";
        return;
    }
    
    const newTable = {
        id: newId,
        status: 'available' // 新規テーブルは必ず「空席」
    };
    
    // (変更) stateを更新
    const newTables = [...(state.tables || []), newTable];
    updateState({ ...state, tables: newTables });
    
    newTableIdInput.value = '';
    tableSettingsError.textContent = '';
    // (変更) UI更新はonSnapshotに任せる
    // renderTableSettingsList(); 
};

/**
 * (新規) テーブル設定を削除する
 * @param {string} tableId 
 */
const deleteTableSetting = (tableId) => {
    // (変更) state.tables が存在するかチェック
    const table = (state.tables || []).find(t => t.id === tableId);
    
    // (安全装置) 利用中のテーブルは削除しない (getActiveSlipCount を使用)
    const activeSlips = getActiveSlipCount(tableId);
    if (!table || activeSlips > 0) {
        if (tableSettingsError) tableSettingsError.textContent = `${tableId} は利用中のため削除できません。`;
        return;
    }

    // (変更) stateを更新
    const newTables = (state.tables || []).filter(t => t.id !== tableId);
    updateState({ ...state, tables: newTables });
    
    // (変更) UI更新はonSnapshotに任せる
    // renderTableSettingsList(); 
};


// --- イベントリスナー ---

document.addEventListener('DOMContentLoaded', async () => {
    
    // ===== DOM要素の取得 =====
    // (変更) settings.js で必要なDOMのみ取得
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    storeNameInput = document.getElementById('store-name');
    storeAddressInput = document.getElementById('store-address');
    storeTelInput = document.getElementById('store-tel');
    taxRateInput = document.getElementById('tax-rate');
    serviceRateInput = document.getElementById('service-rate');
    dayChangeTimeInput = document.getElementById('day-change-time'); // (新規)
    saveSettingsBtn = document.getElementById('save-settings-btn');
    settingsFeedback = document.getElementById('settings-feedback');
    // (新規) テーブル設定用DOM
    newTableIdInput = document.getElementById('new-table-id-input');
    addTableBtn = document.getElementById('add-table-btn');
    currentTablesList = document.getElementById('current-tables-list');
    tableSettingsError = document.getElementById('table-settings-error');
    // (新規) 成績設定用DOM
    performanceCastItemsContainer = document.getElementById('performance-cast-items-container'); // (変更) ID
    settingServiceCharge = document.getElementById('setting-service-charge'); // (変更) ID
    settingTax = document.getElementById('setting-tax'); // (変更) ID
    settingBranchSales = document.getElementById('setting-branch-sales'); // (変更) ID
    settingBranchNoms = document.getElementById('setting-branch-noms'); // (変更) ID

    
    // ===== (新規) Firebase 初期化とデータリッスン =====
    try {
        const services = await getFirebaseServices();
        db = services.db;
        auth = services.auth;
        userId = services.userId;
        appId = services.appId;

        // (新規) ユーザーの state ドキュメントへの参照を作成
        stateDocRef = doc(db, "artifacts", appId, "users", userId, "data", "mainState");

        // (新規) Firestore の state をリアルタイムでリッスン
        if (unsubscribeState) unsubscribeState(); 
        
        unsubscribeState = onSnapshot(stateDocRef, (doc) => {
            if (doc.exists()) {
                const firestoreState = doc.data();
                const defaultState = getDefaultState();
                state = { 
                    ...defaultState, 
                    ...firestoreState,
                    storeInfo: { ...defaultState.storeInfo, ...(firestoreState.storeInfo || {}) },
                    rates: { ...defaultState.rates, ...(firestoreState.rates || {}) },
                    ranking: { ...defaultState.ranking, ...(firestoreState.ranking || {}) },
                    menu: { ...defaultState.menu, ...(firestoreState.menu || {}) },
                    // (変更) settings.js では slips のマージも必要 (テーブル削除判定のため)
                    slips: (firestoreState.slips || []).map(slip => ({
                        ...slip,
                        tags: slip.tags || []
                    })),
                    performanceSettings: { 
                        ...defaultState.performanceSettings, 
                        ...(firestoreState.performanceSettings || {}),
                        menuItems: { ...defaultState.performanceSettings.menuItems, ...(firestoreState.performanceSettings?.menuItems || {}) },
                        serviceCharge: { ...defaultState.performanceSettings.serviceCharge, ...(firestoreState.performanceSettings?.serviceCharge || {}) },
                        tax: { ...defaultState.performanceSettings.tax, ...(firestoreState.performanceSettings?.tax || {}) },
                        sideCustomer: { ...defaultState.performanceSettings.sideCustomer, ...(firestoreState.performanceSettings?.sideCustomer || {}) },
                    },
                };
                console.log("Local state updated from Firestore");
            } else {
                console.log("No state document found. Creating new one...");
                state = getDefaultState();
                updateStateInFirestore(state); 
            }

            // (新規) ページが settings の場合のみUIを更新
            loadSettingsToForm();

        }, (error) => {
            console.error("Error listening to state document:", error);
        });

    } catch (e) {
        console.error("Failed to initialize Firebase or auth:", e);
        // (新規) Firebaseが失敗した場合でも、ローカルのデフォルトstateでUIを描画
        loadSettingsToForm();
    }
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // (変更) settings.js ではモーダルを開かないが、HTML上にあるため閉じるロジックのみ残す
            closeModal();
        });
    });

    // (新規) 設定保存ボタン
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault(); // (変更) formの送信を止める
            saveSettingsFromForm();
        });
    }
    
    // (新規) テーブル追加ボタン
    if (addTableBtn) {
        addTableBtn.addEventListener('click', () => {
            addTableSetting();
        });
    }

    // (新規) テーブル入力欄でEnterキー
    if (newTableIdInput) {
        newTableIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTableSetting();
            }
        });
    }
    
    // (新規) テーブル削除ボタン (イベント委任)
    if (currentTablesList) {
        currentTablesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-table-btn');
            if (deleteBtn) {
                deleteTableSetting(deleteBtn.dataset.tableId);
            }
        });
    }

});
