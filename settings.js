// ===== グローバル定数・変数 =====
// (変更) stateから読み込むようにするため、ダミー定数を削除
// const DUMMY_SERVICE_CHARGE_RATE = 0.20; 
// const DUMMY_TAX_RATE = 0.10;

/**
 * UUIDを生成する
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

// (変更) ===== state管理 =====

const LOCAL_STORAGE_KEY = 'nightPosState';

/**
 * (新規) デフォルトのstateを定義する関数
 * @returns {object} デフォルトのstateオブジェクト
 */
const getDefaultState = () => ({
    currentPage: 'settings', // (変更) このページのデフォルト
    currentStore: 'store1',
    slipCounter: 3,
    // (変更) キャストマスタ (IDと名前)
    casts: [ 
        { id: 'c1', name: 'あい' },
        { id: 'c2', name: 'みう' },
        { id: 'c3', name: 'さくら' },
        { id: 'c4', name: 'れな' },
        { id: 'c5', name: 'ひな' },
        { id: 'c6', name: '体験A' },
    ],
    // (変更) 顧客マスタ (指名キャストIDを持たせる)
    customers: [
        { id: 'cust1', name: '鈴木様', nominatedCastId: 'c1' }, // あいの指名
        { id: 'cust2', name: '田中様', nominatedCastId: null }, // フリー
        { id: 'cust3', name: '佐藤様', nominatedCastId: 'c2' }, // みうの指名
        { id: 'cust4', name: '山田様', nominatedCastId: 'c1' }, // あいの指名
        { id: 'cust5', name: '渡辺様', nominatedCastId: 'c3' }, // さくらの指名
        { id: 'cust6', name: '伊藤様', nominatedCastId: null }, // フリー
    ],
    // (変更) テーブル設定をデフォルトで定義 (これが編集対象になる)
    tables: [
        { id: 'V1', status: 'occupied' }, // (変更) statusは保持する
        { id: 'V2', status: 'available' },
        { id: 'V3', status: 'occupied' },
        { id: 'V4', status: 'available' },
        { id: 'T1', status: 'available' },
        { id: 'T2', status: 'occupied' },
        { id: 'T3', status: 'available' },
        { id: 'T4', status: 'available' },
        { id: 'C1', status: 'available' },
        { id: 'C2', status: 'available' },
    ],
    slips: [
        { 
            slipId: 'slip-1', 
            slipNumber: 1,
            tableId: 'V1', 
            status: 'active',
            name: '鈴木様', 
            startTime: '20:30', 
            nominationCastId: 'c1', // (変更) 名前 -> ID
            items: [
                { id: 'm1', name: '基本セット (指名)', price: 10000, qty: 1 },
                { id: 'm7', name: 'キャストドリンク', price: 1500, qty: 2 },
                { id: 'm10', name: '鏡月 (ボトル)', price: 8000, qty: 1 },
            ],
            paidAmount: 0, 
            cancelReason: null,
            paymentDetails: { cash: 0, card: 0, credit: 0 } 
        },
        { 
            slipId: 'slip-3', 
            slipNumber: 2,
            tableId: 'V3', 
            status: 'checkout', 
            name: '田中様', 
            startTime: '21:00', 
            nominationCastId: null, // (変更) "フリー" -> null
            items: [
                { id: 'm2', name: '基本セット (フリー)', price: 8000, qty: 1 },
                { id: 'm8', name: 'ビール', price: 1000, qty: 6 },
            ],
            paidAmount: 0,
            cancelReason: null, 
            paymentDetails: { cash: 0, card: 0, credit: 0 } 
        },
        { 
            slipId: 'slip-4', 
            slipNumber: 3,
            tableId: 'T2', 
            status: 'active', 
            name: '佐藤様', 
            startTime: '22:15', 
            nominationCastId: 'c2', // (変更) 名前 -> ID
            items: [
                { id: 'm1', name: '基本セット (指名)', price: 10000, qty: 1 },
                { id: 'm12', name: 'シャンパン (ゴールド)', price: 50000, qty: 1 },
                { id: 'm7', name: 'キャストドリンク', price: 1500, qty: 8 },
            ],
            paidAmount: 0,
            cancelReason: null, 
            paymentDetails: { cash: 0, card: 0, credit: 0 } 
        },
    ],
    menu: {
        set: [
            { id: 'm1', name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: 'm2', name: '基本セット (フリー)', price: 8000, duration: 60 },
            { id: 'm3', name: '延長 (自動)', price: 5000, duration: 30 },
        ],
        drink: [
            { id: 'm7', name: 'キャストドリンク', price: 1500 },
            { id: 'm8', name: 'ビール', price: 1000 },
        ],
        bottle: [
            { id: 'm11', name: '鏡月 (ボトル)', price: 8000 },
            { id: 'm12', name: 'シャンパン (ゴールド)', price: 50000 },
        ],
        food: [
            { id: 'm4', name: '乾き物盛り合わせ', price: 2000 },
        ],
        cast: [
            { id: 'm14', name: '本指名料', price: 3000 },
        ],
        other: [
            { id: 'm6', name: 'カラオケ', price: 1000 },
        ]
    },
    // (新規) 店舗設定用の項目
    storeInfo: {
        name: "Night POS 新宿本店",
        address: "東京都新宿区歌舞伎町1-1-1",
        tel: "03-0000-0000"
    },
    // (新規) 税率用の項目 (0.xx の形式で保存)
    rates: {
        tax: 0.10, // 消費税 10%
        service: 0.20 // サービス料 20%
    },
    currentSlipId: null, 
    currentEditingMenuId: null,
    currentBillingAmount: 0, 
    ranking: {
        period: 'monthly',
        type: 'nominations'
    }
});

/**
 * (新規) localStorageからstateを読み込む
 * @returns {object} stateオブジェクト
 */
const loadState = () => {
    const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedState) {
        const defaultState = getDefaultState();
        const parsedState = JSON.parse(storedState);
        // (変更) ネストされたオブジェクトも正しくマージする
        const mergedState = {
            ...defaultState,
            ...parsedState,
            storeInfo: { ...defaultState.storeInfo, ...parsedState.storeInfo },
            rates: { ...defaultState.rates, ...parsedState.rates },
            ranking: { ...defaultState.ranking, ...parsedState.ranking },
            menu: { ...defaultState.menu, ...parsedState.menu },
            // (新規) tables, slips, casts, customers もマージ対象にする
            tables: parsedState.tables || defaultState.tables, 
            slips: parsedState.slips || defaultState.slips,
            casts: parsedState.casts || defaultState.casts,
            customers: parsedState.customers || defaultState.customers,
            currentPage: 'settings' // (変更) このページのデフォルト
        };
        
        // (変更) ratesが%表記(10)で保存されていたら小数(0.10)に変換する
        if (mergedState.rates.tax > 1) {
            mergedState.rates.tax = mergedState.rates.tax / 100;
        }
        if (mergedState.rates.service > 1) {
            mergedState.rates.service = mergedState.rates.service / 100;
        }

        // (新規) 起動時にテーブルのステータスを伝票情報に基づいて更新する
        // (settingsページでは slips もロードするため、ここでステータスを同期できる)
        const activeTableIds = new Set(
            mergedState.slips
                .filter(s => s.status === 'active' || s.status === 'checkout')
                .map(s => s.tableId)
        );
        mergedState.tables.forEach(table => {
            if (activeTableIds.has(table.id)) {
                table.status = 'occupied';
            } else {
                table.status = 'available';
            }
        });


        return mergedState;
    } else {
        const defaultState = getDefaultState();
        saveState(defaultState);
        return defaultState;
    }
};

/**
 * (新規) stateをlocalStorageに保存する
 * @param {object} newState 保存するstateオブジェクト
 */
const saveState = (newState) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
};

// (新規) 起動時にstateをロード
let state = loadState();

/**
 * (新規) state変更時に保存するラッパー関数
 * @param {object} newState 更新後のstateオブジェクト
 */
const updateState = (newState) => {
    state = newState;
    saveState(state);
};


// ===== DOM要素 =====
// (変更) settings.jsで必要なDOMのみ
let modalCloseBtns,
    storeNameInput, storeAddressInput, storeTelInput,
    taxRateInput, serviceRateInput,
    saveSettingsBtn, settingsFeedback,
    // (新規) テーブル設定用DOM
    newTableIdInput, addTableBtn, currentTablesList, tableSettingsError;

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
    if (slip.status === 'cancelled') {
        return 0;
    }
    let subtotal = 0;
    slip.items.forEach(item => {
        subtotal += item.price * item.qty;
    });
    // (変更) stateから税率を読み込む
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
    if (storeNameInput) storeNameInput.value = state.storeInfo.name;
    if (storeAddressInput) storeAddressInput.value = state.storeInfo.address;
    if (storeTelInput) storeTelInput.value = state.storeInfo.tel;

    // (変更) 0.10 -> 10 のように % に変換して表示
    if (taxRateInput) taxRateInput.value = state.rates.tax * 100;
    if (serviceRateInput) serviceRateInput.value = state.rates.service * 100;
    
    // (新規) テーブル設定リストを描画
    renderTableSettingsList();
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

    // (変更) stateを更新
    // (テーブル設定は既に追加/削除時に state.tables が直接更新されている)
    updateState({ 
        ...state, 
        storeInfo: newStoreInfo, 
        rates: newRates 
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
    
    if (state.tables.length === 0) {
        currentTablesList.innerHTML = '<p class="text-sm text-slate-500">テーブルが登録されていません。</p>';
        return;
    }

    // (新規) ID順 (V1, V10, V2 -> V1, V2, V10) でソート
    const sortedTables = [...state.tables].sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedTables.forEach(table => {
        const isOccupied = table.status === 'occupied';
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

    // (新規) 削除ボタンにイベントリスナーを追加
    currentTablesList.querySelectorAll('.delete-table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteTableSetting(btn.dataset.tableId);
        });
    });
};

/**
 * (新規) テーブル設定を追加する
 */
const addTableSetting = () => {
    if (!newTableIdInput || !tableSettingsError) return;
    
    const newId = newTableIdInput.value.trim().toUpperCase(); // (変更) 大文字に統一
    
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
        status: 'available' // 新規テーブルは必ず「空席」
    };
    
    // (変更) stateを更新
    const newTables = [...state.tables, newTable];
    updateState({ ...state, tables: newTables });
    
    newTableIdInput.value = '';
    tableSettingsError.textContent = '';
    renderTableSettingsList(); // リストを再描画
};

/**
 * (新規) テーブル設定を削除する
 * @param {string} tableId 
 */
const deleteTableSetting = (tableId) => {
    const table = state.tables.find(t => t.id === tableId);
    
    // (安全装置) 利用中のテーブルは削除しない
    if (!table || table.status === 'occupied') {
        tableSettingsError.textContent = `${tableId} は利用中のため削除できません。`;
        return;
    }

    // (変更) stateを更新
    const newTables = state.tables.filter(t => t.id !== tableId);
    updateState({ ...state, tables: newTables });
    
    renderTableSettingsList(); // リストを再描C画
};


// --- イベントリスナー ---

document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    // (変更) settings.js で必要なDOMのみ取得
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    storeNameInput = document.getElementById('store-name');
    storeAddressInput = document.getElementById('store-address');
    storeTelInput = document.getElementById('store-tel');
    taxRateInput = document.getElementById('tax-rate');
    serviceRateInput = document.getElementById('service-rate');
    saveSettingsBtn = document.getElementById('save-settings-btn');
    settingsFeedback = document.getElementById('settings-feedback');
    // (新規) テーブル設定用DOM
    newTableIdInput = document.getElementById('new-table-id-input');
    addTableBtn = document.getElementById('add-table-btn');
    currentTablesList = document.getElementById('current-tables-list');
    tableSettingsError = document.getElementById('table-settings-error');

    
    // ===== 初期化処理 =====
    if (saveSettingsBtn) { // (変更) settingsページ以外では実行しない
        loadSettingsToForm();
        // (変更) loadSettingsToForm 内で renderTableSettingsList も呼ばれる
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

});

