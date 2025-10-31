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
let modalCloseBtns,
    storeNameInput, storeAddressInput, storeTelInput,
    taxRateInput, serviceRateInput,
    dayChangeTimeInput,
    saveSettingsBtn, settingsFeedback,
    newTableIdInput, addTableBtn, currentTablesList, tableSettingsError,
    // (変更) 成績設定用DOM
    performanceCastItemsContainer, // (変更) ID を修正
    settingServiceCharge, // (変更) ID を修正
    settingTax, // (変更) ID を修正
    settingBranchSales, // (変更) ID を修正
    settingBranchNoms; // (変更) ID を修正

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

    if (storeNameInput) storeNameInput.value = state.storeInfo.name;
    if (storeAddressInput) storeAddressInput.value = state.storeInfo.address;
    if (storeTelInput) storeTelInput.value = state.storeInfo.tel;

    if (taxRateInput) taxRateInput.value = state.rates.tax * 100;
    if (serviceRateInput) serviceRateInput.value = state.rates.service * 100;
    
    if (dayChangeTimeInput) dayChangeTimeInput.value = state.dayChangeTime; 
    
    renderTableSettingsList();
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

    // 2. 全体項目の読み込み (HTMLのID変更に対応)
    // (変更) 簡略化されたロジック（HTMLのID変更を反映）
    const scSetting = state.performanceSettings.serviceCharge.salesValue > 0 ? 'personal_100' : 'store';
    const taxSetting = state.performanceSettings.tax.salesValue > 0 ? 'personal_100' : 'store';
    
    if (settingServiceCharge) settingServiceCharge.value = scSetting;
    if (settingTax) settingTax.value = taxSetting;
    
    // 3. 枝（サイド）設定の読み込み (HTMLのID変更に対応)
    const branchSalesMapping = {
        100: 'personal_100',
        50: 'personal_50',
        0: 'personal_0'
    };
    const branchSalesValue = state.performanceSettings.sideCustomer.salesValue;
    const branchSalesKey = branchSalesMapping[branchSalesValue] || 'store';
    
    const branchNomsKey = state.performanceSettings.sideCustomer.countNomination ? 'personal' : 'none';
    
    if (settingBranchSales) settingBranchSales.value = branchSalesKey;
    if (settingBranchNoms) settingBranchNoms.value = branchNomsKey;
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

    const newDayChangeTime = dayChangeTimeInput.value;
    if (!newDayChangeTime) { 
        if (settingsFeedback) {
            settingsFeedback.textContent = "営業日付の変更時刻を有効な形式で入力してください。";
            settingsFeedback.className = "text-sm text-red-600";
        }
        return;
    }
    
    // (変更) 成績反映設定 (HTMLのID変更に対応)
    const newPerformanceSettings = {
        menuItems: {},
        serviceCharge: {
            salesValue: settingServiceCharge.value === 'personal_100' ? 100 : 0,
            salesType: 'percentage' // (変更) 簡易的に percentage に固定
        },
        tax: {
            salesValue: settingTax.value === 'personal_100' ? 100 : 0,
            salesType: 'percentage' // (変更) 簡易的に percentage に固定
        },
        sideCustomer: {
            salesValue: parseInt(settingBranchSales.value.replace('personal_', '')) || 0,
            countNomination: settingBranchNoms.value === 'personal'
        }
    };
    
    // (変更) 'store' (店舗売上) の場合は salesValue を 0 にする
    if (settingBranchSales.value === 'store') {
        newPerformanceSettings.sideCustomer.salesValue = 0;
    }
    
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
        // state.tables は add/deleteTableSetting で既に更新済み
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

/**
 * (新規) テーブル設定リストをUIに描画する
 */
const renderTableSettingsList = () => {
    if (!currentTablesList || !state) return; // (変更) state がロードされるまで待つ
    
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
        // (変更) state.slips を参照して最新のステータスをチェック
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

    // (削除) 削除ボタンのリスナーは DOMContentLoaded に移動
};

/**
 * (新規) テーブル設定を追加する
 */
const addTableSetting = () => {
    if (!newTableIdInput || !tableSettingsError || !state) return; // (変更) state がロードされるまで待つ
    
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
    
    // (変更) state を直接変更
    state.tables.push(newTable);
    updateStateInFirestore(state);
    
    newTableIdInput.value = '';
    tableSettingsError.textContent = '';
    // (変更) renderTableSettingsList() は onSnapshot が自動で呼び出す
};

/**
 * (新規) テーブル設定を削除する
 * @param {string} tableId 
 */
const deleteTableSetting = (tableId) => {
    if (!state) return; // (変更) state がロードされるまで待つ
    const table = state.tables.find(t => t.id === tableId);
    
    // (変更) state.slips を参照して最新のステータスをチェック
    const isOccupied = state.slips.some(s => s.tableId === tableId && (s.status === 'active' || s.status === 'checkout'));

    if (!table || isOccupied) {
        tableSettingsError.textContent = `${tableId} は利用中のため削除できません。`;
        return;
    }

    // (変更) state を直接変更
    state.tables = state.tables.filter(t => t.id !== tableId);
    updateStateInFirestore(state);
    
    // (変更) renderTableSettingsList() は onSnapshot が自動で呼び出す
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
    newTableIdInput = document.getElementById('new-table-id-input');
    addTableBtn = document.getElementById('add-table-btn');
    currentTablesList = document.getElementById('current-tables-list');
    tableSettingsError = document.getElementById('table-settings-error');
    
    // (変更) 成績設定用DOM (HTMLのID変更を反映)
    performanceCastItemsContainer = document.getElementById('performance-cast-items-container');
    settingServiceCharge = document.getElementById('setting-service-charge');
    settingTax = document.getElementById('setting-tax');
    settingBranchSales = document.getElementById('setting-branch-sales');
    settingBranchNoms = document.getElementById('setting-branch-noms');

    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    // if (saveSettingsBtn) { ... }
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveSettingsFromForm();
        });
    }
    
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

    // (新規) テーブル削除ボタンのイベント委任
    if (currentTablesList) {
        currentTablesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-table-btn');
            if (deleteBtn) {
                // (変更) 確認ダイアログを追加
                if (confirm(`テーブル「${deleteBtn.dataset.tableId}」を削除しますか？`)) {
                    deleteTableSetting(deleteBtn.dataset.tableId);
                }
            }
        });
    }
});

