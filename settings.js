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
    
    // キャスト設定 (★新規★)
    newCastNameInput, addCastBtn, currentCastsList, castSettingsError,

    // 成績設定
    performanceCastItemsContainer,
    settingScSalesValue, settingScSalesType, // (★修正★) サービス料
    settingTaxSalesValue, settingTaxSalesType, // (★修正★) 消費税
    settingSideSalesValue, // (★修正★) 枝
    settingSideCountNomination; // (★修正★) 枝


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
 * (新規) キャストIDからキャスト名を取得する (settings.jsでは不要だが共通ロジックとして残す)
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
 * (変更) 未会計伝票の数を取得する (settings.jsでは不要だが共通ロジックとして残す)
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
    if (!state) return; // (変更) state がロードされるまで待つ

    // 店舗情報
    if (storeNameInput) storeNameInput.value = state.storeInfo.name;
    if (storeAddressInput) storeAddressInput.value = state.storeInfo.address;
    if (storeTelInput) storeTelInput.value = state.storeInfo.tel;

    // 税率・サービス料
    if (taxRateInput) taxRateInput.value = state.rates.tax * 100;
    if (serviceRateInput) serviceRateInput.value = state.rates.service * 100;
    
    // 営業日付
    if (dayChangeTimeInput) dayChangeTimeInput.value = state.dayChangeTime; 
    
    // 各リストの描画
    renderTableSettingsList();
    renderTagSettingsList(); // (★新規★)
    renderCastSettingsList(); // (★新規★)
    renderPerformanceSettings();
};

/**
 * (新規) キャスト成績反映設定セクションを描画する
 */
const renderPerformanceSettings = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    
    // 1. キャスト料金項目の動的生成
    if (performanceCastItemsContainer) {
        performanceCastItemsContainer.innerHTML = '';
        const castMenuItems = state.menu.cast || [];
        
        if (castMenuItems.length === 0) {
            performanceCastItemsContainer.innerHTML = '<p class="text-sm text-slate-500">メニュー管理で「キャスト料金」カテゴリに項目を追加してください。</p>';
        } else {
            castMenuItems.forEach(item => {
                const setting = state.performanceSettings.menuItems[item.id] || {
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
    const scSetting = state.performanceSettings.serviceCharge;
    const taxSetting = state.performanceSettings.tax;
    if (settingScSalesValue) settingScSalesValue.value = scSetting.salesValue;
    if (settingScSalesType) settingScSalesType.value = scSetting.salesType;
    if (settingTaxSalesValue) settingTaxSalesValue.value = taxSetting.salesValue;
    if (settingTaxSalesType) settingTaxSalesType.value = taxSetting.salesType;

    // 3. 枝（サイド）設定
    // (★修正★) HTML側のID (setting-side-sales-value など) に合わせる
    const sideSetting = state.performanceSettings.sideCustomer;
    if (settingSideSalesValue) settingSideSalesValue.value = sideSetting.salesValue;
    if (settingSideCountNomination) settingSideCountNomination.checked = sideSetting.countNomination;
};


/**
 * (新規) フォームから設定を保存する
 */
const saveSettingsFromForm = () => {
    if (!state) return; // (変更) state がロードされるまで待つ
    
    // --- 店舗情報 ---
    const newStoreInfo = {
        name: storeNameInput.value.trim(),
        address: storeAddressInput.value.trim(),
        tel: storeTelInput.value.trim(),
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
    // (★修正★) HTML側のID (setting-sc-sales-value など) に合わせてロジックを修正
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


    // (変更) state を丸ごと更新
    const newState = { 
        ...state, 
        storeInfo: newStoreInfo, 
        rates: newRates,
        dayChangeTime: newDayChangeTime,
        performanceSettings: newPerformanceSettings
        // state.tables, state.slipTagsMaster, state.casts は各リストの追加/削除関数で直接更新済み
    };
    
    updateStateInFirestore(newState);

    if (settingsFeedback) {
        settingsFeedback.textContent = "設定を保存しました。";
        settingsFeedback.className = "text-sm text-green-600";
        setTimeout(() => {
            settingsFeedback.textContent = "";
        }, 3000);
    }
};

// ===================================
// (★新規★) テーブル設定セクション
// ===================================

/**
 * (新規) テーブル設定リストをUIに描画する
 */
const renderTableSettingsList = () => {
    if (!currentTablesList || !state) return; 
    
    currentTablesList.innerHTML = '';
    if (tableSettingsError) tableSettingsError.textContent = '';
    
    if (!state.tables || state.tables.length === 0) {
        currentTablesList.innerHTML = '<p class="text-sm text-slate-500">テーブルが登録されていません。</p>';
        return;
    }

    const sortedTables = [...state.tables].sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedTables.forEach(table => {
        const isOccupied = state.slips.some(s => s.tableId === table.id && (s.status === 'active' || s.status === 'checkout'));
        
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
const addTableSetting = () => {
    if (!newTableIdInput || !tableSettingsError || !state) return; 
    
    const newId = newTableIdInput.value.trim().toUpperCase();
    
    if (newId === "") {
        tableSettingsError.textContent = "テーブル名を入力してください。";
        return;
    }
    
    const exists = state.tables.some(table => table.id === newId);
    if (exists) {
        tableSettingsError.textContent = "そのテーブル名は既に使用されています。";
        return;
    }
    
    const newTable = {
        id: newId,
        status: 'available' 
    };
    
    state.tables.push(newTable);
    updateStateInFirestore(state);
    
    newTableIdInput.value = '';
    tableSettingsError.textContent = '';
};

/**
 * (新規) テーブル設定を削除する
 * @param {string} tableId 
 */
const deleteTableSetting = (tableId) => {
    if (!state) return; 
    const table = state.tables.find(t => t.id === tableId);
    
    const isOccupied = state.slips.some(s => s.tableId === tableId && (s.status === 'active' || s.status === 'checkout'));

    if (!table || isOccupied) {
        tableSettingsError.textContent = `${tableId} は利用中のため削除できません。`;
        return;
    }

    state.tables = state.tables.filter(t => t.id !== tableId);
    updateStateInFirestore(state);
};

// ===================================
// (★新規★) 伝票タグ設定セクション
// ===================================

/**
 * (★新規★) 伝票タグ設定リストをUIに描画する
 */
const renderTagSettingsList = () => {
    if (!currentTagsList || !state) return;
    
    currentTagsList.innerHTML = '';
    if (tagSettingsError) tagSettingsError.textContent = '';
    
    if (!state.slipTagsMaster || state.slipTagsMaster.length === 0) {
        currentTagsList.innerHTML = '<p class="text-sm text-slate-500">タグが登録されていません。</p>';
        return;
    }
    
    state.slipTagsMaster.forEach(tag => {
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
const addTagSetting = () => {
    if (!newTagNameInput || !tagSettingsError || !state) return;
    
    const newName = newTagNameInput.value.trim();
    if (newName === "") {
        tagSettingsError.textContent = "タグ名を入力してください。";
        return;
    }
    
    const exists = state.slipTagsMaster.some(tag => tag.name === newName);
    if (exists) {
        tagSettingsError.textContent = "そのタグ名は既に使用されています。";
        return;
    }
    
    const newTag = { id: getUUID(), name: newName };
    
    state.slipTagsMaster.push(newTag);
    updateStateInFirestore(state);
    
    newTagNameInput.value = '';
    tagSettingsError.textContent = '';
};

/**
 * (★新規★) 伝票タグを削除する
 * @param {string} tagId 
 */
const deleteTagSetting = (tagId) => {
    if (!state) return;
    
    // (注意) 削除する前に、このタグを使っている伝票がないか確認するロジックが将来的に必要
    
    state.slipTagsMaster = state.slipTagsMaster.filter(t => t.id !== tagId);
    updateStateInFirestore(state);
};


// ===================================
// (★新規★) キャスト設定セクション
// ===================================

/**
 * (★新規★) キャスト設定リストをUIに描画する
 */
const renderCastSettingsList = () => {
    if (!currentCastsList || !state) return;
    
    currentCastsList.innerHTML = '';
    if (castSettingsError) castSettingsError.textContent = '';
    
    if (!state.casts || state.casts.length === 0) {
        currentCastsList.innerHTML = '<p class="text-sm text-slate-500">キャストが登録されていません。</p>';
        return;
    }
    
    state.casts.forEach(cast => {
        // (注意) 将来的に「指名あり」「退店済み」などを確認するロジック
        const isUsed = state.slips.some(s => s.nominationCastId === cast.id);
        
        const itemHTML = `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <span class="font-semibold">${cast.name}</span>
                ${isUsed ? 
                    `<span class="text-xs text-red-600 font-medium">(使用中のため削除不可)</span>` : 
                    `<button type="button" class="delete-cast-btn text-red-500 hover:text-red-700" data-cast-id="${cast.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>`
                }
            </div>
        `;
        currentCastsList.innerHTML += itemHTML;
    });
};

/**
 * (★新規★) キャストを追加する
 */
const addCastSetting = () => {
    if (!newCastNameInput || !castSettingsError || !state) return;
    
    const newName = newCastNameInput.value.trim();
    if (newName === "") {
        castSettingsError.textContent = "キャスト名を入力してください。";
        return;
    }
    
    const exists = state.casts.some(cast => cast.name === newName);
    if (exists) {
        castSettingsError.textContent = "そのキャスト名は既に使用されています。";
        return;
    }
    
    const newCast = { id: getUUID(), name: newName };
    
    state.casts.push(newCast);
    updateStateInFirestore(state);
    
    newCastNameInput.value = '';
    castSettingsError.textContent = '';
};

/**
 * (★新規★) キャストを削除する
 * @param {string} castId 
 */
const deleteCastSetting = (castId) => {
    if (!state) return;
    
    const isUsed = state.slips.some(s => s.nominationCastId === castId);
    if (isUsed) {
        castSettingsError.textContent = `そのキャストは伝票で使用中のため削除できません。`;
        return;
    }

    state.casts = state.casts.filter(c => c.id !== castId);
    updateStateInFirestore(state);
};


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (店舗名、税率など)
 */
const updateModalCommonInfo = () => {
    if (!state) return;
    // (変更) settings.js でモーダル内のDOM要素は取得しないため、中身を空にする
    // (ただし、HTMLにはモーダルが存在するため、関数自体は残す)
};


// (新規) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultState = () => ({
    currentPage: 'settings',
    currentStore: 'store1',
    slipCounter: 0,
    slipTagsMaster: [
        { id: 'tag1', name: '指名' }, { id: 'tag2', name: '初指名' },
        { id: 'tag3', name: '初回' }, { id: 'tag4', name: '枝' },
    ],
    casts: [ 
        { id: 'c1', name: 'あい' }, { id: 'c2', name: 'みう' },
    ],
    customers: [
        { id: 'cust1', name: '鈴木様', nominatedCastId: 'c1' },
    ],
    tables: [
        { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
    ],
    slips: [],
    menu: {
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
        ],
        drink: [{ id: 'm7', name: 'キャストドリンク', price: 1500 }],
        bottle: [],
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
            loadSettingsToForm();
            updateModalCommonInfo(); // (新規) モーダル内の共通情報を更新
            
        } else {
            console.log("No state document found. Creating default state...");
            const defaultState = getDefaultState();
            state = defaultState;
            
            try {
                await setDoc(stateDocRef, defaultState);
                console.log("Default state saved to Firestore.");
                // (重要) state がロードされたら、UIを初回描画
                loadSettingsToForm();
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

    // (★新規★) キャスト
    newCastNameInput = document.getElementById('new-cast-name-input');
    addCastBtn = document.getElementById('add-cast-btn');
    currentCastsList = document.getElementById('current-casts-list');
    castSettingsError = document.getElementById('cast-settings-error');

    // (★修正★) 成績設定 (HTMLのID変更を反映)
    performanceCastItemsContainer = document.getElementById('performance-cast-items-container');
    settingScSalesValue = document.getElementById('setting-sc-sales-value');
    settingScSalesType = document.getElementById('setting-sc-sales-type');
    settingTaxSalesValue = document.getElementById('setting-tax-sales-value');
    settingTaxSalesType = document.getElementById('setting-tax-sales-type');
    settingSideSalesValue = document.getElementById('setting-side-sales-value');
    settingSideCountNomination = document.getElementById('setting-side-count-nomination');

    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });

    // 設定保存ボタン
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveSettingsFromForm();
        });
    }
    
    // --- テーブル設定 ---
    if (addTableBtn) {
        addTableBtn.addEventListener('click', () => {
            addTableSetting();
        });
    }
    if (newTableIdInput) {
        newTableIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTableSetting();
            }
        });
    }
    if (currentTablesList) {
        currentTablesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-table-btn');
            if (deleteBtn) {
                if (confirm(`テーブル「${deleteBtn.dataset.tableId}」を削除しますか？`)) {
                    deleteTableSetting(deleteBtn.dataset.tableId);
                }
            }
        });
    }

    // --- (★新規★) タグ設定 ---
    if (addTagBtn) {
        addTagBtn.addEventListener('click', () => {
            addTagSetting();
        });
    }
    if (newTagNameInput) {
        newTagNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagSetting();
            }
        });
    }
    if (currentTagsList) {
        currentTagsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-tag-btn');
            if (deleteBtn) {
                if (confirm(`タグを削除しますか？`)) {
                    deleteTagSetting(deleteBtn.dataset.tagId);
                }
            }
        });
    }

    // --- (★新規★) キャスト設定 ---
    if (addCastBtn) {
        addCastBtn.addEventListener('click', () => {
            addCastSetting();
        });
    }
    if (newCastNameInput) {
        newCastNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCastSetting();
            }
        });
    }
    if (currentCastsList) {
        currentCastsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-cast-btn');
            if (deleteBtn) {
                if (confirm(`キャストを削除しますか？`)) {
                    deleteCastSetting(deleteBtn.dataset.castId);
                }
            }
        });
    }
});