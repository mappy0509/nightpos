// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc 
} from './firebase-init.js';

// (★削除★) エラーの原因となった以下の参照(Ref)のインポートを削除
/*
import {
    settingsRef,
    menuRef,
    slipsCollectionRef // (★追加★) slips もインポート
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

// (★変更★) state を分割して管理 (settings と menu のみ)
let settings = null;
// (★削除★) let menu = null;
let slips = []; // (★追加★) 削除判定のために slips が必要
// (★削除★) casts, customers, slipCounter, currentSlipId は不要

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, /* (★削除★) menuRef, */ slipsCollectionRef,
    currentStoreId; // (★動的表示 追加★)


// ===== DOM要素 =====
// (変更) settings.js 専用のDOM要素のみを取得
let modalCloseBtns, // (★注意★) settings.html にモーダルは無いため、本当は不要
    storeNameInput, storeAddressInput, storeTelInput,
    taxRateInput, serviceRateInput,
    dayChangeTimeInput,
    
    // (★新規★) 端数処理
    settingRoundingType, settingRoundingUnit,
    
    saveSettingsBtn, settingsFeedback,
    
    // テーブル設定
    newTableIdInput, addTableBtn, currentTablesList, tableSettingsError,
    
    // 伝票タグ設定
    newTagNameInput, addTagBtn, currentTagsList, tagSettingsError,
    
    // (★削除★) キャスト設定DOMを削除

    // (★削除★) 成績設定
    // performanceCastItemsContainer,
    // settingScSalesValue, settingScSalesType,
    // settingTaxSalesValue, settingTaxSalesType,
    // settingSideSalesValue,
    // settingSideCountNomination,
    
    storeSelector; // (★動的表示 追加★)

// (★削除★) 伝票関連モーダルDOM (newSlipConfirmModal, slipSelectionModal, etc...) をすべて削除


// --- 関数 ---

/**
 * 通貨形式（例: ¥10,000）にフォーマットする
 * @param {number} amount 金額
 * @returns {string} フォーマットされた通貨文字列
 */
const formatCurrency = (amount) => {
    return `¥${amount.toLocaleString()}`;
};

// (★削除★) 伝票関連のヘルパー関数 (formatDateTimeLocal, formatElapsedTime, calculateSlipTotal, getCastNameById, getActiveSlipCount) をすべて削除

/**
 * モーダルを開く (settings.js では使われないが念のため残す)
 * @param {HTMLElement} modalElement 
 */
const openModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.add('active');
    }
};

/**
 * モーダルを閉じる (settings.js では使われないが念のため残す)
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    const modals = document.querySelectorAll('.modal-backdrop');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
};

/**
 * (★報酬削除★) 設定フォームに現在の値を読み込む
 */
const loadSettingsToForm = () => {
    if (!settings) return; 

    // 店舗情報
    if (storeNameInput) storeNameInput.value = settings.storeInfo.name;
    if (storeAddressInput) storeAddressInput.value = settings.storeInfo.address;
    if (storeTelInput) storeTelInput.value = settings.storeInfo.tel;

    // 税率・サービス料
    if (taxRateInput) taxRateInput.value = settings.rates.tax * 100;
    if (serviceRateInput) serviceRateInput.value = settings.rates.service * 100;
    
    // 営業日付
    if (dayChangeTimeInput) dayChangeTimeInput.value = settings.dayChangeTime; 
    
    // (★新規★) 端数処理
    const rounding = settings.rounding || { type: 'none', unit: 1 };
    if (settingRoundingType) settingRoundingType.value = rounding.type;
    if (settingRoundingUnit) settingRoundingUnit.value = rounding.unit;

    // 各リストの描画
    renderTableSettingsList();
    renderTagSettingsList(); 
    // (★削除★) renderCastSettingsList();
    // (★削除★) renderPerformanceSettings();
};

/**
 * (★削除★) キャスト成績反映設定セクションを描画する
 */
// const renderPerformanceSettings = () => { ... };


/**
 * (★報酬削除★) フォームから設定を保存する
 */
const saveSettingsFromForm = async () => { 
    if (!settings) return; 
    
    // --- 店舗情報 ---
    const newStoreInfo = {
        name: storeNameInput.value.trim(),
        address: storeAddressInput.value.trim(),
        tel: storeTelInput.value.trim(),
        zip: settings.storeInfo.zip || "" 
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
    
    // (★新規★) --- 端数処理 ---
    const newRounding = {
        type: settingRoundingType.value,
        unit: parseInt(settingRoundingUnit.value) || 1
    };

    // (★削除★) --- 成績反映設定 ---
    // const newPerformanceSettings = { ... };

    // (★変更★) settings オブジェクトを直接更新
    settings.storeInfo = newStoreInfo;
    settings.rates = newRates;
    settings.dayChangeTime = newDayChangeTime;
    settings.rounding = newRounding; // (★新規★)
    // (★削除★) settings.performanceSettings = newPerformanceSettings;
    
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
    if (!currentTablesList || !settings || !slips) return; // (★変更★) slips もチェック
    
    currentTablesList.innerHTML = '';
    if (tableSettingsError) tableSettingsError.textContent = '';
    
    if (!settings.tables || settings.tables.length === 0) { 
        currentTablesList.innerHTML = '<p class="text-sm text-slate-500">テーブルが登録されていません。</p>';
        return;
    }

    const sortedTables = [...settings.tables].sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedTables.forEach(table => {
        // (★変更★) slips を参照
        const isOccupied = (slips || []).some(s => s.tableId === table.id && (s.status === 'active' || s.status === 'checkout'));
        
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
const addTableSetting = async () => { 
    if (!newTableIdInput || !tableSettingsError || !settings) return; 
    
    const newId = newTableIdInput.value.trim().toUpperCase();
    
    if (newId === "") {
        tableSettingsError.textContent = "テーブル名を入力してください。";
        return;
    }
    
    const exists = settings.tables.some(table => table.id === newId); 
    if (exists) {
        tableSettingsError.textContent = "そのテーブル名は既に使用されています。";
        return;
    }
    
    const newTable = {
        id: newId,
        status: 'available' 
    };
    
    settings.tables.push(newTable); 
    
    try {
        await setDoc(settingsRef, settings);
        newTableIdInput.value = '';
        tableSettingsError.textContent = '';
    } catch (e) {
        console.error("Error adding table: ", e);
        tableSettingsError.textContent = "テーブルの追加に失敗しました。";
        settings.tables.pop(); 
    }
};

/**
 * (新規) テーブル設定を削除する
 * @param {string} tableId 
 */
const deleteTableSetting = async (tableId) => { 
    if (!settings || !slips) return; // (★変更★) slips もチェック
    const table = settings.tables.find(t => t.id === tableId); 
    
    const isOccupied = (slips || []).some(s => s.tableId === tableId && (s.status === 'active' || s.status === 'checkout')); 

    if (!table || isOccupied) {
        tableSettingsError.textContent = `${tableId} は利用中のため削除できません。`;
        return;
    }

    settings.tables = settings.tables.filter(t => t.id !== tableId); 
    
    try {
        await setDoc(settingsRef, settings);
    } catch (e) {
        console.error("Error deleting table: ", e);
        tableSettingsError.textContent = "テーブルの削除に失敗しました。";
        settings.tables.push(table); 
    }
};

// ===================================
// (★新規★) 伝票タグ設定セクション
// ===================================

/**
 * (★新規★) 伝票タグ設定リストをUIに描画する
 */
const renderTagSettingsList = () => {
    if (!currentTagsList || !settings) return;
    
    currentTagsList.innerHTML = '';
    if (tagSettingsError) tagSettingsError.textContent = '';
    
    if (!settings.slipTagsMaster || settings.slipTagsMaster.length === 0) { 
        currentTagsList.innerHTML = '<p class="text-sm text-slate-500">タグが登録されていません。</p>';
        return;
    }
    
    settings.slipTagsMaster.forEach(tag => { 
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
const addTagSetting = async () => { 
    if (!newTagNameInput || !tagSettingsError || !settings) return;
    
    const newName = newTagNameInput.value.trim();
    if (newName === "") {
        tagSettingsError.textContent = "タグ名を入力してください。";
        return;
    }
    
    const exists = settings.slipTagsMaster.some(tag => tag.name === newName); 
    if (exists) {
        tagSettingsError.textContent = "そのタグ名は既に使用されています。";
        return;
    }
    
    const newTag = { id: getUUID(), name: newName };
    
    settings.slipTagsMaster.push(newTag); 
    
    try {
        await setDoc(settingsRef, settings);
        newTagNameInput.value = '';
        tagSettingsError.textContent = '';
    } catch (e) {
        console.error("Error adding tag: ", e);
        tagSettingsError.textContent = "タグの追加に失敗しました。";
        settings.slipTagsMaster.pop(); 
    }
};

/**
 * (★新規★) 伝票タグを削除する
 * @param {string} tagId 
 */
const deleteTagSetting = async (tagId) => { 
    if (!settings) return;
    
    const tagToDelete = settings.slipTagsMaster.find(t => t.id === tagId); 
    if (!tagToDelete) return;
    
    settings.slipTagsMaster = settings.slipTagsMaster.filter(t => t.id !== tagId); 
    
    try {
        await setDoc(settingsRef, settings);
    } catch (e) {
        console.error("Error deleting tag: ", e);
        tagSettingsError.textContent = "タグの削除に失敗しました。";
        settings.slipTagsMaster.push(tagToDelete); 
    }
};


// (★削除★) キャスト設定セクション (cast-settings.js に移動)
// (★削除★) 伝票作成関連のロジック (createNewSlip, renderSlipSelectionModal, renderNewSlipConfirmModal)

// (★動的表示 追加★)
/**
 * (★新規★) ヘッダーのストアセレクターを描画する
 */
const renderStoreSelector = () => {
    if (!storeSelector || !settings || !currentStoreId) return;

    const currentStoreName = settings.storeInfo.name || "店舗";
    
    // (★変更★) 現在は複数店舗の切り替えをサポートしていないため、
    // (★変更★) 現在の店舗名のみを表示し、ドロップダウンを無効化する
    storeSelector.innerHTML = `<option value="${currentStoreId}">${currentStoreName}</option>`;
    storeSelector.value = currentStoreId;
    storeSelector.disabled = true;
};


/**
 * (★報酬削除★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
 */
const getDefaultSettings = () => {
    return {
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
            zip: "160-0021" 
        },
        rates: { tax: 0.10, service: 0.20 },
        rounding: { type: 'none', unit: 1 }, // (★新規★)
        dayChangeTime: "05:00",
        // (★削除★) performanceSettings を削除
        ranking: { period: 'monthly', type: 'nominations' }
    };
};

// (★削除★) getDefaultMenu を削除
// const getDefaultMenu = () => { ... };


/**
 * (★報酬削除★) --- Firestore リアルタイムリスナー ---
 */
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        settingsRef: sRef, 
        // (★削除★) menuRef: mRef, 
        slipsCollectionRef: slRef,
        currentStoreId: csId // (★動的表示 追加★)
    } = e.detail;

    // (★変更★) グローバル変数に参照をセット
    settingsRef = sRef;
    // (★削除★) menuRef = mRef;
    slipsCollectionRef = slRef;
    currentStoreId = csId; // (★動的表示 追加★)

    let settingsLoaded = false;
    // (★削除★) let menuLoaded = false;
    let slipsLoaded = false; // (★追加★) テーブル削除可否の判定に必要

    const checkAndRenderAll = () => {
        // (★報酬削除★) menuLoaded を依存関係から削除
        if (settingsLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for settings.js");
            loadSettingsToForm();
            renderStoreSelector(); // (★動的表示 追加★)
            // (★削除★) updateModalCommonInfo();
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

    // (★削除★) 2. Menu
    // onSnapshot(menuRef, ...)

    // (★削除★) slipCounter, casts, customers のリスナーを削除
    
    // 6. Slips (★追加★)
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id }); 
        });
        console.log("Slips loaded (for table check): ", slips.length);
        slipsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to slips: ", error);
        slipsLoaded = true; // (★変更★) エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'settings.html');

    // ===== DOM要素の取得 =====
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    storeNameInput = document.getElementById('store-name');
    storeAddressInput = document.getElementById('store-address');
    storeTelInput = document.getElementById('store-tel');
    taxRateInput = document.getElementById('tax-rate');
    serviceRateInput = document.getElementById('service-rate');
    dayChangeTimeInput = document.getElementById('day-change-time'); 
    
    // (★新規★) 端数処理
    settingRoundingType = document.getElementById('setting-rounding-type');
    settingRoundingUnit = document.getElementById('setting-rounding-unit');
    
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
    // ...

    // (★削除★) 成績設定
    // performanceCastItemsContainer = document.getElementById('performance-cast-items-container');
    // ...
    
    storeSelector = document.getElementById('store-selector'); // (★動的表示 追加★)

    // (★削除★) 伝票関連モーダルDOM
    // ...
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★変更★) モーダルを閉じるボタン (HTMLにはもう存在しないが、念のため残す)
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => { // (★動的表示 変更★)
                const modal = e.target.closest('.modal-backdrop'); // (★動的表示 変更★)
                if (modal) {
                    closeModal(modal);
                }
            });
        });
    }


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

    // (★削除★) キャスト設定関連リスナー
    // ...
    
    // (★削除★) 伝票関連モーダルリスナー
    // ...
});