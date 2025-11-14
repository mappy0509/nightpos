// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (★新規★) firebase-init.js から必要なモジュールをインポート
import { 
    db, 
    auth,
    onSnapshot,
    doc,
    getDoc,
    setDoc,
    addDoc,
    deleteDoc,
    collection,
    signOut
} from './firebase-init.js';

// ===== グローバル変数 =====
let settingsRef;
let invitesCollectionRef; // (★注意★) このファイルでは invitesCollectionRef は使われていません
let currentStoreId;

let settings = {}; // (★新規★)
let currentTables = []; // (★新規★)
let currentCallBorders = []; // (★新規★)
let ndefReader = null; // (★新規★) NFCリーダー

// ===== DOM要素 =====
// (★新規★) 新しい settings.html に合わせたDOM
let settingsTabs, tabContents,
    storeInfoForm, storeName, storeZip, storeAddress, storeTel, saveStoreInfoBtn, storeInfoFeedback,
    ratesForm, taxRate, serviceRate, dayChangeTime, roundingType, roundingUnit, saveRatesBtn, ratesFeedback,
    receiptForm, receiptStoreName, receiptAddress, receiptTel, receiptInvoiceNumber, receiptDefaultDescription, saveReceiptBtn, receiptFeedback,
    newTableForm, newTableNameInput, addTableBtn, currentTablesList, tableFeedback,
    newCallBorderForm, newCallName, newCallBorder, addCallBorderBtn, callBorderList, callFeedback,
    nfcForm, nfcClockInTagId, scanNfcClockInBtn, nfcClockOutTagId, scanNfcClockOutBtn, nfcScanFeedback, saveNfcBtn, nfcFeedback,
    logoutBtn,
    headerStoreName;

// --- (★新規★) 共通関数 ---

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
 * (★新規★) フィードバックメッセージを表示
 * @param {HTMLElement} el 
 * @param {string} message 
 * @param {boolean} isError 
 */
const showFeedback = (el, message, isError = false) => {
    if (!el) return;
    el.textContent = message;
    el.className = `text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
    setTimeout(() => {
        el.textContent = '';
    }, 3000);
};

// --- (★新規★) タブ切り替え ---
const openTab = (targetTabId) => {
    // すべてのタブコンテンツを非表示
    tabContents.forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('active');
    });
    // すべてのタブボタンの active クラスを削除
    settingsTabs.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('active');
    });

    // 対象のタブコンテンツを表示
    const content = document.getElementById(targetTabId);
    if (content) {
        content.classList.remove('hidden');
        content.classList.add('active');
    }
    // 対象のタブボタンを active に
    const button = settingsTabs.querySelector(`button[data-tab="${targetTabId}"]`);
    if (button) {
        button.classList.add('active');
    }
};

// --- (★新規★) 設定の読み込み・保存 ---

/**
 * (★新規★) Firestoreから設定を読み込み、全フォームに反映
 */
const loadSettings = async () => {
    if (!settingsRef) return;
    try {
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            settings = docSnap.data();
            
            // 1. 店舗情報
            if (settings.storeInfo) {
                storeName.value = settings.storeInfo.name || '';
                storeZip.value = settings.storeInfo.zip || '';
                storeAddress.value = settings.storeInfo.address || '';
                storeTel.value = settings.storeInfo.tel || '';
            }
            
            // 2. 料金・税
            if (settings.rates) {
                taxRate.value = (settings.rates.tax || 0.1) * 100;
                serviceRate.value = (settings.rates.service || 0.2) * 100;
            }
            dayChangeTime.value = settings.dayChangeTime || '05:00';
            if (settings.rounding) {
                roundingType.value = settings.rounding.type || 'none';
                roundingUnit.value = settings.rounding.unit || 10;
            }

            // 3. 領収書
            if (settings.receiptSettings) {
                receiptStoreName.value = settings.receiptSettings.storeName || '';
                receiptAddress.value = settings.receiptSettings.address || '';
                receiptTel.value = settings.receiptSettings.tel || '';
                receiptInvoiceNumber.value = settings.receiptSettings.invoiceNumber || '';
                receiptDefaultDescription.value = settings.receiptSettings.defaultDescription || 'お飲食代として';
            }
            
            // 4. テーブル
            currentTables = settings.tables || [];
            renderTableList();

            // 5. コール管理
            currentCallBorders = settings.champagneCallBorders || [];
            renderCallBorders();

            // 6. NFC
            if (settings.nfcTagIds) {
                nfcClockInTagId.value = settings.nfcTagIds.clockIn || '';
                nfcClockOutTagId.value = settings.nfcTagIds.clockOut || '';
            }
            
            // (★要望4★) ヘッダーのストア名も更新
            if (headerStoreName) {
                headerStoreName.textContent = (settings.storeInfo && settings.storeInfo.name) ? settings.storeInfo.name : "店舗";
            }

        } else {
            console.log("No settings document found. Using defaults.");
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
};

/**
 * (★新規★) 店舗情報 (storeInfo) のみ保存
 */
const saveStoreInfo = async (e) => {
    e.preventDefault();
    const dataToSave = {
        storeInfo: {
            name: storeName.value.trim(),
            zip: storeZip.value.trim(),
            address: storeAddress.value.trim(),
            tel: storeTel.value.trim()
        }
    };
    try {
        await setDoc(settingsRef, dataToSave, { merge: true });
        showFeedback(storeInfoFeedback, '店舗情報を保存しました。');
    } catch (error) {
        showFeedback(storeInfoFeedback, `保存エラー: ${error.message}`, true);
    }
};

/**
 * (★新規★) 料金・税 (rates, dayChangeTime, rounding) のみ保存
 */
const saveRates = async (e) => {
    e.preventDefault();
    const dataToSave = {
        rates: {
            tax: parseFloat(taxRate.value) / 100,
            service: parseFloat(serviceRate.value) / 100
        },
        dayChangeTime: dayChangeTime.value,
        rounding: {
            type: roundingType.value,
            unit: parseInt(roundingUnit.value) || 10
        }
    };
    try {
        await setDoc(settingsRef, dataToSave, { merge: true });
        showFeedback(ratesFeedback, '料金・税設定を保存しました。');
    } catch (error) {
        showFeedback(ratesFeedback, `保存エラー: ${error.message}`, true);
    }
};

/**
 * (★新規★) 領収書 (receiptSettings) のみ保存
 */
const saveReceipt = async (e) => {
    e.preventDefault();
    const dataToSave = {
        receiptSettings: {
            storeName: receiptStoreName.value.trim(),
            address: receiptAddress.value.trim(),
            tel: receiptTel.value.trim(),
            invoiceNumber: receiptInvoiceNumber.value.trim(),
            defaultDescription: receiptDefaultDescription.value.trim()
        }
    };
    try {
        await setDoc(settingsRef, dataToSave, { merge: true });
        showFeedback(receiptFeedback, '領収書設定を保存しました。');
    } catch (error) {
        showFeedback(receiptFeedback, `保存エラー: ${error.message}`, true);
    }
};

/**
 * (★新規★) NFC (nfcTagIds) のみ保存
 */
const saveNfc = async (e) => {
    e.preventDefault();
    const dataToSave = {
        nfcTagIds: {
            clockIn: nfcClockInTagId.value.trim(),
            clockOut: nfcClockOutTagId.value.trim()
        }
    };
    try {
        await setDoc(settingsRef, dataToSave, { merge: true });
        showFeedback(nfcFeedback, 'NFC設定を保存しました。');
    } catch (error) {
        showFeedback(nfcFeedback, `保存エラー: ${error.message}`, true);
    }
};

// --- (★新規★) テーブル管理 ---

const renderTableList = () => {
    if (!currentTablesList) return;
    currentTablesList.innerHTML = '';
    currentTables.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    
    currentTables.forEach(table => {
        currentTablesList.innerHTML += `
            <div class="flex items-center justify-between bg-slate-100 px-4 py-2 rounded-lg">
                <span class="font-semibold">${table.id}</span>
                <button type="button" class="delete-table-btn text-red-500 hover:text-red-700" data-table-id="${table.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    });
};

const addTable = async (e) => {
    e.preventDefault();
    const newName = newTableNameInput.value.trim();
    if (newName === "") {
        showFeedback(tableFeedback, "テーブル名を入力してください。", true);
        return;
    }
    if (currentTables.some(t => t.id === newName)) {
        showFeedback(tableFeedback, "そのテーブル名は既に使用されています。", true);
        return;
    }

    currentTables.push({ id: newName, status: 'available' }); // (★修正★) statusは不要かも
    
    try {
        await setDoc(settingsRef, { tables: currentTables }, { merge: true });
        showFeedback(tableFeedback, `テーブル「${newName}」を追加しました。`);
        newTableNameInput.value = '';
        renderTableList(); // UIを即時更新
    } catch (error) {
        showFeedback(tableFeedback, `追加エラー: ${error.message}`, true);
        currentTables.pop(); // 失敗したらローカルからも削除
    }
};

const deleteTable = async (e) => {
    const btn = e.target.closest('.delete-table-btn');
    if (!btn) return;
    
    const tableId = btn.dataset.tableId;
    if (!confirm(`テーブル「${tableId}」を削除しますか？\n(注意: 関連する伝票には影響しません)`)) {
        return;
    }

    currentTables = currentTables.filter(t => t.id !== tableId);
    
    try {
        await setDoc(settingsRef, { tables: currentTables }, { merge: true });
        showFeedback(tableFeedback, `テーブル「${tableId}」を削除しました。`);
        renderTableList(); // UIを即時更新
    } catch (error) {
        showFeedback(tableFeedback, `削除エラー: ${error.message}`, true);
        // (★簡易的★) 失敗したらリロード
        loadSettings();
    }
};

// --- (★新規★) コール管理 ---

const renderCallBorders = () => {
    if (!callBorderList) return;
    callBorderList.innerHTML = '';
    currentCallBorders.sort((a, b) => a.borderAmount - b.borderAmount);

    currentCallBorders.forEach(rule => {
        callBorderList.innerHTML += `
            <div class="flex items-center justify-between bg-slate-100 px-4 py-2 rounded-lg">
                <div>
                    <span class="font-semibold">${rule.callName}</span>
                    <span class="text-sm text-slate-600 ml-2">(¥${rule.borderAmount.toLocaleString()} 以上)</span>
                </div>
                <button type="button" class="delete-call-btn text-red-500 hover:text-red-700" data-amount="${rule.borderAmount}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    });
};

const addCallBorder = async (e) => {
    e.preventDefault();
    const name = newCallName.value.trim();
    const amount = parseInt(newCallBorder.value);

    if (name === "" || isNaN(amount) || amount <= 0) {
        showFeedback(callFeedback, "コール名と有効な金額 (円) を入力してください。", true);
        return;
    }
    if (currentCallBorders.some(r => r.borderAmount === amount)) {
        showFeedback(callFeedback, `金額 (¥${amount.toLocaleString()}) は既に使用されています。`, true);
        return;
    }
    
    currentCallBorders.push({ callName: name, borderAmount: amount });
    
    try {
        await setDoc(settingsRef, { champagneCallBorders: currentCallBorders }, { merge: true });
        showFeedback(callFeedback, `コール「${name}」を追加しました。`);
        newCallName.value = '';
        newCallBorder.value = '';
        renderCallBorders();
    } catch (error) {
        showFeedback(callFeedback, `追加エラー: ${error.message}`, true);
        currentCallBorders.pop();
    }
};

const deleteCallBorder = async (e) => {
    const btn = e.target.closest('.delete-call-btn');
    if (!btn) return;

    const amount = parseInt(btn.dataset.amount);
    const rule = currentCallBorders.find(r => r.borderAmount === amount);
    if (!rule) return;

    if (!confirm(`コール「${rule.callName} (¥${rule.borderAmount.toLocaleString()})」を削除しますか？`)) {
        return;
    }

    currentCallBorders = currentCallBorders.filter(r => r.borderAmount !== amount);
    
    try {
        await setDoc(settingsRef, { champagneCallBorders: currentCallBorders }, { merge: true });
        showFeedback(callFeedback, `コール「${rule.callName}」を削除しました。`);
        renderCallBorders();
    } catch (error) {
        showFeedback(callFeedback, `削除エラー: ${error.message}`, true);
        loadSettings(); // (★簡易的★) 失敗したらリロード
    }
};

// --- (★新規★) NFCスキャン ---

const scanNfcTag = async (targetInput) => {
    if (!('NDEFReader' in window)) {
        nfcScanFeedback.textContent = "お使いのブラウザは Web NFC に対応していません。";
        return;
    }

    if (!ndefReader) {
        ndefReader = new NDEFReader();
    }

    try {
        await ndefReader.scan();
        nfcScanFeedback.textContent = "NFCタグをスキャン待機中...";

        ndefReader.onreading = (event) => {
            const serialNumber = event.serialNumber;
            targetInput.value = serialNumber;
            nfcScanFeedback.textContent = `タグ (ID: ${serialNumber}) を読み取りました。`;
            // (★注意★) `scan()` は一度しか読み取らない
        };
        ndefReader.onreadingerror = (event) => {
            nfcScanFeedback.textContent = "NFCタグの読み取りに失敗しました。";
        };

    } catch (error) {
        console.error("NFC scan error:", error);
        nfcScanFeedback.textContent = `NFCスキャンを開始できませんでした: ${error.message}`;
    }
};


// --- (★新規★) DOMContentLoaded & firebaseReady ---

document.addEventListener('firebaseReady', (e) => {
    // Firestore参照の取得
    settingsRef = e.detail.settingsRef;
    invitesCollectionRef = e.detail.invitesCollectionRef;
    currentStoreId = e.detail.currentStoreId;
    
    // (★新規★) 必要なDOMを取得
    headerStoreName = document.getElementById('header-store-name');
    settingsTabs = document.getElementById('settings-tabs');
    tabContents = document.querySelectorAll('#settings-tab-content .tab-content');
    
    storeInfoForm = document.getElementById('store-info-form');
    storeName = document.getElementById('storeName');
    storeZip = document.getElementById('storeZip');
    storeAddress = document.getElementById('storeAddress');
    storeTel = document.getElementById('storeTel');
    saveStoreInfoBtn = document.getElementById('save-store-info-btn');
    storeInfoFeedback = document.getElementById('store-info-feedback');

    ratesForm = document.getElementById('rates-form');
    taxRate = document.getElementById('taxRate');
    serviceRate = document.getElementById('serviceRate');
    dayChangeTime = document.getElementById('dayChangeTime');
    roundingType = document.getElementById('roundingType');
    roundingUnit = document.getElementById('roundingUnit');
    saveRatesBtn = document.getElementById('save-rates-btn');
    ratesFeedback = document.getElementById('rates-feedback');
    
    receiptForm = document.getElementById('receipt-form');
    receiptStoreName = document.getElementById('receiptStoreName');
    receiptAddress = document.getElementById('receiptAddress');
    receiptTel = document.getElementById('receiptTel');
    receiptInvoiceNumber = document.getElementById('receiptInvoiceNumber');
    receiptDefaultDescription = document.getElementById('receiptDefaultDescription');
    saveReceiptBtn = document.getElementById('save-receipt-btn');
    receiptFeedback = document.getElementById('receipt-feedback');

    newTableForm = document.getElementById('new-table-form');
    newTableNameInput = document.getElementById('new-table-name-input');
    addTableBtn = document.getElementById('add-table-btn');
    currentTablesList = document.getElementById('current-tables-list');
    tableFeedback = document.getElementById('table-feedback');

    newCallBorderForm = document.getElementById('new-call-border-form');
    newCallName = document.getElementById('newCallName');
    newCallBorder = document.getElementById('newCallBorder');
    addCallBorderBtn = document.getElementById('addCallBorderBtn');
    callBorderList = document.getElementById('call-border-list');
    callFeedback = document.getElementById('call-feedback');

    nfcForm = document.getElementById('nfc-form');
    nfcClockInTagId = document.getElementById('nfcClockInTagId');
    scanNfcClockInBtn = document.getElementById('scanNfcClockInBtn');
    nfcClockOutTagId = document.getElementById('nfcClockOutTagId');
    scanNfcClockOutBtn = document.getElementById('scanNfcClockOutBtn');
    nfcScanFeedback = document.getElementById('nfc-scan-feedback');
    saveNfcBtn = document.getElementById('save-nfc-btn');
    nfcFeedback = document.getElementById('nfc-feedback');

    logoutBtn = document.getElementById('logoutBtn');

    // (★新規★) イベントリスナーを設定
    settingsTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('button.ranking-type-btn');
        if (btn && btn.dataset.tab) {
            openTab(btn.dataset.tab);
        }
    });

    saveStoreInfoBtn.addEventListener('click', saveStoreInfo);
    saveRatesBtn.addEventListener('click', saveRates);
    saveReceiptBtn.addEventListener('click', saveReceipt);
    addTableBtn.addEventListener('click', addTable);
    currentTablesList.addEventListener('click', deleteTable);
    addCallBorderBtn.addEventListener('click', addCallBorder);
    callBorderList.addEventListener('click', deleteCallBorder);
    saveNfcBtn.addEventListener('click', saveNfc);

    scanNfcClockInBtn.addEventListener('click', () => scanNfcTag(nfcClockInTagId));
    scanNfcClockOutBtn.addEventListener('click', () => scanNfcTag(nfcClockOutTagId));

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });

    // (★新規★) データをロード
    loadSettings();
});

document.addEventListener('DOMContentLoaded', () => {
    // サイドバーを描画
    renderSidebar('sidebar-container', 'settings.html');
});