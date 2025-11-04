// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc 
} from './firebase-init.js';

// (★新規★) 新しい参照をインポート (settings と menu のみ)
import {
    settingsRef,
    menuRef
} from './firebase-init.js';

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
let menu = null;
// (★削除★) casts, customers, slips, slipCounter, currentSlipId は不要

// ===== DOM要素 =====
// (変更) settings.js 専用のDOM要素のみを取得
let modalCloseBtns, // (★注意★) settings.html にモーダルは無いため、本当は不要
    storeNameInput, storeAddressInput, storeTelInput,
    taxRateInput, serviceRateInput,
    dayChangeTimeInput,
    saveSettingsBtn, settingsFeedback,
    
    // テーブル設定
    newTableIdInput, addTableBtn, currentTablesList, tableSettingsError,
    
    // 伝票タグ設定
    newTagNameInput, addTagBtn, currentTagsList, tagSettingsError,
    
    // (★削除★) キャスト設定DOMを削除

    // 成績設定
    performanceCastItemsContainer,
    settingScSalesValue, settingScSalesType,
    settingTaxSalesValue, settingTaxSalesType,
    settingSideSalesValue,
    settingSideCountNomination;

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
 * (新規) 設定フォームに現在の値を読み込む
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
    
    // 各リストの描画
    renderTableSettingsList();
    renderTagSettingsList(); 
    // (★削除★) renderCastSettingsList();
    renderPerformanceSettings();
};

/**
 * (★変更★) キャスト成績反映設定セクションを描画する
 */
const renderPerformanceSettings = () => {
    if (!settings || !menu) return; 
    
    // 1. キャスト料金項目の動的生成
    if (performanceCastItemsContainer) {
        performanceCastItemsContainer.innerHTML = '';
        
        // (★変更★) isCastCategory: true のカテゴリIDを探す
        // (★変更★) settings 側で指定された「キャスト料金カテゴリID」を使う
        const castPriceCategoryId = settings.performanceSettings?.castPriceCategoryId;
        const castCategory = (menu.categories || []).find(c => c.id === castPriceCategoryId);
        
        let castMenuItems = [];
        if (castCategory) {
            // (★変更★) `menu.items` から該当カテゴリの商品をフィルタリング
            castMenuItems = (menu.items || []).filter(item => item.categoryId === castCategory.id);
        }
        
        if (castMenuItems.length === 0) {
            performanceCastItemsContainer.innerHTML = '<p class="text-sm text-slate-500">「メニュー管理」の「カテゴリ管理」で「キャスト料金(成績反映)」にチェックを入れ、このページで「保存」を押してください。</p>';
        } else {
            castMenuItems.forEach(item => {
                const setting = settings.performanceSettings.menuItems[item.id] || {
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
    const scSetting = settings.performanceSettings.serviceCharge;
    const taxSetting = settings.performanceSettings.tax;
    if (settingScSalesValue) settingScSalesValue.value = scSetting.salesValue;
    if (settingScSalesType) settingScSalesType.value = scSetting.salesType;
    if (settingTaxSalesValue) settingTaxSalesValue.value = taxSetting.salesValue;
    if (settingTaxSalesType) settingTaxSalesType.value = taxSetting.salesType;

    // 3. 枝（サイド）設定
    const sideSetting = settings.performanceSettings.sideCustomer;
    if (settingSideSalesValue) settingSideSalesValue.value = sideSetting.salesValue;
    if (settingSideCountNomination) settingSideCountNomination.checked = sideSetting.countNomination;
};


/**
 * (新規) フォームから設定を保存する
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
    
    // --- 成績反映設定 ---
    const newPerformanceSettings = {
        ...settings.performanceSettings, // (★変更★) castPriceCategoryId などを維持
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
    if (!currentTablesList || !settings) return; 
    
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
    if (!settings) return; 
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


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
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
        dayChangeTime: "05:00",
        performanceSettings: {
            castPriceCategoryId: null, // (★変更★) menu.js側で設定される
            menuItems: {
                // 'm14_default': { salesType: 'percentage', salesValue: 100, countNomination: true }
            },
            serviceCharge: { salesType: 'percentage', salesValue: 0 },
            tax: { salesType: 'percentage', salesValue: 0 },
            sideCustomer: { salesValue: 100, countNomination: true }
        },
        ranking: { period: 'monthly', type: 'nominations' }
    };
};

const getDefaultMenu = () => {
    // (★簡易版★ settings.js が必要なデータのみ)
    const catCastId = getUUID();
    return {
        categories: [
             { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true }, 
        ],
        items: [
            { id: 'm14_default', categoryId: catCastId, name: '本指名料', price: 3000, duration: null }, 
        ],
        currentActiveMenuCategoryId: catCastId,
    };
};


// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        settingsRef, menuRef, slipsCollectionRef
    } = e.detail;

    let settingsLoaded = false;
    let menuLoaded = false;
    let slipsLoaded = false; // (★追加★) テーブル削除可否の判定に必要

    const checkAndRenderAll = () => {
        // (★変更★) settings.js は loadSettingsToForm を呼ぶ
        if (settingsLoaded && menuLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for settings.js");
            loadSettingsToForm();
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
    // ...

    // (★修正★) 成績設定
    performanceCastItemsContainer = document.getElementById('performance-cast-items-container');
    settingScSalesValue = document.getElementById('setting-sc-sales-value');
    settingScSalesType = document.getElementById('setting-sc-sales-type');
    settingTaxSalesValue = document.getElementById('setting-tax-sales-value');
    settingTaxSalesType = document.getElementById('setting-tax-sales-type');
    settingSideSalesValue = document.getElementById('setting-side-sales-value');
    settingSideCountNomination = document.getElementById('setting-side-count-nomination');

    // (★削除★) 伝票関連モーダルDOM
    // ...
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★変更★) モーダルを閉じるボタン (HTMLにはもう存在しないが、念のため残す)
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(); // (★変更★)
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