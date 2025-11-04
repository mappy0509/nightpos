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
// (変更) cast-settings.js 専用のDOM要素
let modalCloseBtns,
    saveSettingsBtn, settingsFeedback,
    
    // キャスト設定
    newCastNameInput, addCastBtn, currentCastsList, castSettingsError,

    // (★新規★) cast-settings.html に存在するモーダル用DOM
    newSlipConfirmModal, newSlipConfirmTitle, newSlipConfirmMessage, confirmCreateSlipBtn,
    newSlipStartTimeInput, newSlipTimeError,
    slipSelectionModal, slipSelectionModalTitle, slipSelectionList, createNewSlipBtn,
    
    // (★新規★) 他のモーダルDOM (HTMLに存在するため)
    orderModal, checkoutModal, receiptModal, slipPreviewModal,
    cancelSlipModal, menuEditorModal,
    
    // (★新規★) 伝票モーダル内のDOM (HTMLに存在するため)
    orderModalTitle, orderItemsList, menuOrderGrid, orderSubtotalEl, orderCustomerNameSelect,
    orderNominationSelect, newCustomerInputGroup, newCustomerNameInput,
    saveNewCustomerBtn, newCustomerError, 
    // (★新規★) 会計モーダル内のDOM (HTMLに存在するため)
    checkoutModalTitle, checkoutItemsList,
    checkoutSubtotalEl, checkoutServiceChargeEl, checkoutTaxEl, checkoutPaidAmountEl,
    checkoutTotalEl, paymentCashInput, paymentCardInput, paymentCreditInput,
    checkoutPaymentTotalEl, checkoutShortageEl, checkoutChangeEl, 
    // (★新規★) 伝票プレビューモーダル内のDOM (HTMLに存在するため)
    slipSubtotalEl,
    slipServiceChargeEl, slipTaxEl, slipPaidAmountEl, slipTotalEl,
    // (★新規★) 割引
    discountAmountInput, discountTypeSelect,
    // (★新規★) ストア情報
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
 * (変更) 伝票の合計金額（割引前）を計算する (共通ロジック)
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
 * (新規) キャストIDからキャスト名を取得する (共通ロジック)
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
 * (変更) 未会計伝票の数を取得する (共通ロジック)
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
    // (変更) HTML上にあるすべてのモーダルを閉じる
    const modals = document.querySelectorAll('.modal-backdrop');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
};

/**
 * (新規) 設定フォームに現在の値を読み込む
 */
const loadSettingsToForm = () => {
    if (!casts || !slips) return; // (★変更★)

    // キャストリストの描画
    renderCastSettingsList();
};


/**
 * (新規) フォームから設定を保存する
 * (将来的に権限変更などをここで保存)
 */
const saveSettingsFromForm = async () => { // (★変更★) async
    if (!casts) return; // (★変更★)
    
    // (★新規★) 権限変更のロジック
    const newCastData = [...casts]; // (★変更★)
    let updateError = false;

    // (★変更★) 権限select要素をすべて取得
    const roleSelects = currentCastsList.querySelectorAll('select[data-cast-id]');
    
    // (★変更★) 更新用Promiseの配列を作成
    const updatePromises = [];
    
    roleSelects.forEach(select => {
        const castId = select.dataset.castId;
        const newRole = select.value;
        const cast = newCastData.find(c => c.id === castId);
        
        if (cast && cast.role !== newRole) {
            cast.role = newRole; // (★変更★) ローカルを更新
            // (★変更★) 更新Promiseを作成
            const castRef = doc(castsCollectionRef, castId);
            updatePromises.push(setDoc(castRef, { role: newRole }, { merge: true }));
        }
    });

    if (updatePromises.length === 0) {
         if (settingsFeedback) {
            settingsFeedback.textContent = "変更された項目はありません。";
            settingsFeedback.className = "text-sm text-slate-500";
            setTimeout(() => {
                settingsFeedback.textContent = "";
            }, 3000);
        }
        return;
    }
    
    // (★変更★) Firestoreに並列で保存
    try {
        await Promise.all(updatePromises);
        
        if (settingsFeedback) {
            settingsFeedback.textContent = "設定を保存しました。";
            settingsFeedback.className = "text-sm text-green-600";
            setTimeout(() => {
                settingsFeedback.textContent = "";
            }, 3000);
        }
    } catch (e) {
        console.error("Error saving cast settings: ", e);
        if (settingsFeedback) {
            settingsFeedback.textContent = "設定の保存に失敗しました。";
            settingsFeedback.className = "text-sm text-red-600";
        }
    }
};


// ===================================
// (★新規★) キャスト設定セクション (settings.js から移植・変更)
// ===================================

/**
 * (★変更★) キャスト設定リストをUIに描画する
 * (cast-settings.html のレイアウトに合わせて変更)
 */
const renderCastSettingsList = () => {
    if (!currentCastsList || !casts) return; // (★変更★)
    
    currentCastsList.innerHTML = '';
    if (castSettingsError) castSettingsError.textContent = '';
    
    if (!casts || casts.length === 0) { // (★変更★)
        currentCastsList.innerHTML = '<p class="text-sm text-slate-500">キャストが登録されていません。</p>';
        return;
    }
    
    // (★新規★) 権限の表示名 (将来用)
    // const roleNames = {
    //     admin: '管理者',
    //     cast: 'キャスト'
    // };
    
    // (★変更★) casts を直接使用
    const sortedCasts = [...casts].sort((a,b) => a.name.localeCompare(b.name));

    sortedCasts.forEach(cast => {
        const isUsed = (slips || []).some(s => s.nominationCastId === cast.id); // (★変更★)
        
        // (★変更★) HTMLのレイアウトに合わせる
        const itemHTML = `
            <div class="flex flex-col md:flex-row justify-between md:items-center bg-slate-50 p-4 rounded-lg border gap-3">
                <div>
                    <p class="font-semibold text-lg">${cast.name}</p>
                    <p class="text-xs text-slate-500 font-mono">ID: ${cast.id}</p>
                </div>
                
                <div class="flex items-center space-x-3">
                    <select class="p-2 border border-slate-300 rounded-lg bg-white text-sm" data-cast-id="${cast.id}">
                        <option value="cast" ${(!cast.role || cast.role === 'cast') ? 'selected' : ''}>キャスト</option>
                        <option value="admin" ${(cast.role === 'admin') ? 'selected' : ''}>管理者</option>
                    </select>
                    
                    <button type="button" class="text-blue-600 hover:text-blue-800 disabled:opacity-30" title="パスワードリセット" disabled>
                        <i class="fa-solid fa-key"></i>
                    </button>
                    
                    <button type="button" class="delete-cast-btn text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" 
                            data-cast-id="${cast.id}" 
                            ${isUsed ? 'disabled' : ''}
                            title="${isUsed ? '伝票で使用中のため削除不可' : 'キャストを削除'}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        currentCastsList.innerHTML += itemHTML;
    });
};

/**
 * (★新規★) キャストを追加する (settings.js から移植)
 */
const addCastSetting = async () => { // (★変更★) async
    if (!newCastNameInput || !castSettingsError || !casts) return; // (★変更★)
    
    const newName = newCastNameInput.value.trim();
    if (newName === "") {
        castSettingsError.textContent = "キャスト名を入力してください。";
        return;
    }
    
    const exists = casts.some(cast => cast.name === newName); // (★変更★)
    if (exists) {
        castSettingsError.textContent = "そのキャスト名は既に使用されています。";
        return;
    }
    
    const newCast = { 
        // idはaddDocで自動生成
        name: newName,
        role: 'cast' // (★新規★) デフォルト権限
    };
    
    // (★変更★) castsCollectionRef に追加
    try {
        await addDoc(castsCollectionRef, newCast);
        newCastNameInput.value = '';
        castSettingsError.textContent = '';
    } catch (e) {
        console.error("Error adding cast: ", e);
        castSettingsError.textContent = "キャストの追加に失敗しました。";
    }
    // (★変更★) onSnapshotがUIを更新する
};

/**
 * (★新規★) キャストを削除する (settings.js から移植)
 * @param {string} castId 
 */
const deleteCastSetting = async (castId) => { // (★変更★) async
    if (!casts || !slips) return; // (★変更★)
    
    const isUsed = slips.some(s => s.nominationCastId === castId); // (★変更★)
    if (isUsed) {
        castSettingsError.textContent = `そのキャストは伝票で使用中のため削除できません。`;
        return;
    }

    // (★変更★) castsCollectionRef から削除
    try {
        const castRef = doc(castsCollectionRef, castId);
        await deleteDoc(castRef);
    } catch (e) {
        console.error("Error deleting cast: ", e);
        castSettingsError.textContent = "キャストの削除に失敗しました。";
    }
    // (★変更★) onSnapshotがUIを更新する
};


/**
 * (変更) 伝票・会計・領収書モーダルの共通情報を更新する
 * (cast-settings.jsでは不要だが、HTMLにモーダルが存在するため関数は残す)
 */
const updateModalCommonInfo = () => {
    if (!settings) return; // (★変更★)
    
    // (★変更★) 伝票関連のモーダルがあるので、共通情報を設定
    const store = settings.storeInfo;
    const rates = settings.rates;

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


// ===================================
// (★新規★) 伝票作成ロジック (HTMLのモーダル定義と一貫性を保つため)
// ===================================

/**
 * (★変更★) 伝票モーダル（注文入力）を描画する
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

    menuOrderGrid.innerHTML = ''; 
    
    const allMenuItems = (menu.items || []).sort((a,b) => a.name.localeCompare(b.name)); // (★変更★)
    
    if (allMenuItems.length === 0) {
        menuOrderGrid.innerHTML = '<p class="text-slate-500 text-sm col-span-3">メニューが登録されていません。<br>「メニュー管理」ページから追加してください。</p>';
    } else {
        allMenuItems.forEach(item => {
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

        const discountAmountInput = document.getElementById('discount-amount');
        const discountTypeSelect = document.getElementById('discount-type');
        if (discountAmountInput) discountAmountInput.value = '';
        if (discountTypeSelect) discountTypeSelect.value = 'yen';

        renderOrderModal();
        openModal(orderModal);

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

/**
 * (★新規★) 未会計伝票カードクリック時の処理
 * @param {string} slipId 
 */
const handleSlipClick = (slipId) => {
    if (!slips) return; 
    const slipData = slips.find(s => s.slipId === slipId); 
    if (!slipData) return;

    currentSlipId = slipId; 

    const discount = slipData.discount || { type: 'yen', value: 0 };
    discountAmountInput.value = discount.value;
    discountTypeSelect.value = discount.type;
    
    renderOrderModal();
    openModal(orderModal);
};


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    return {
        // currentPage: 'cast-settings', (settings には不要)
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
        // (★変更★) cast-settings.js は loadSettingsToForm を呼ぶ
        if (settingsLoaded && menuLoaded && castsLoaded && customersLoaded && slipsLoaded && counterLoaded) {
            console.log("All data loaded. Rendering UI for cast-settings.js");
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
    saveSettingsBtn = document.getElementById('save-cast-settings-btn'); // (★修正★)
    settingsFeedback = document.getElementById('settings-feedback');

    // (★新規★) キャスト
    newCastNameInput = document.getElementById('new-cast-name-input');
    addCastBtn = document.getElementById('add-cast-btn');
    currentCastsList = document.getElementById('current-casts-list');
    castSettingsError = document.getElementById('cast-settings-error');

    // (★新規★) cast-settings.html に存在するモーダル用DOM
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
    
    // (★新規★) 伝票モーダル内のDOM (HTMLに存在するため)
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
    // (★新規★) 会計モーダル内のDOM (HTMLに存在するため)
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
    // (★新規★) 伝票プレビューモーダル内のDOM (HTMLに存在するため)
    slipSubtotalEl = document.getElementById('slip-subtotal');
    slipServiceChargeEl = document.getElementById('slip-service-charge');
    slipTaxEl = document.getElementById('slip-tax');
    slipPaidAmountEl = document.getElementById('slip-paid-amount');
    slipTotalEl = document.getElementById('slip-total');
    // (★新規★) 割引
    discountAmountInput = document.getElementById('discount-amount');
    discountTypeSelect = document.getElementById('discount-type');
    // (★新規★) ストア情報
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
    
    // ===== イベントリスナーの設定 =====

    // モーダルを閉じるボタン
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(); // (★変更★) 引数なしですべて閉じる
        });
    });

    // 設定保存ボタン
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveSettingsFromForm(); // (★変更★)
        });
    }

    // --- (★新規★) キャスト設定 ---
    if (addCastBtn) {
        addCastBtn.addEventListener('click', () => {
            addCastSetting(); // (★変更★)
        });
    }
    if (newCastNameInput) {
        newCastNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCastSetting(); // (★変更★)
            }
        });
    }
    if (currentCastsList) {
        currentCastsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-cast-btn');
            if (deleteBtn && !deleteBtn.disabled) {
                if (confirm(`キャストを削除しますか？\n(この操作は取り消せません)`)) {
                    deleteCastSetting(deleteBtn.dataset.castId); // (★変更★)
                }
            }
        });
        
        // (★新規★) 権限変更のリスナー (将来用)
        currentCastsList.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT') {
                // (★変更★) 保存ボタンが押されたときに処理されるため、
                // ここでの即時保存は不要。
                // const castId = e.target.dataset.castId;
                // const newRole = e.target.value;
                console.log(`Role selection changed for ${e.target.dataset.castId}. Ready to save.`);
            }
        });
    }
    
    // (★新規★) 伝票選択モーダルのイベント委任
    if (slipSelectionList) {
        slipSelectionList.addEventListener('click', (e) => {
            const slipBtn = e.target.closest('button[data-slip-id]');
            if (slipBtn) {
                handleSlipClick(slipBtn.dataset.slipId); // (★変更★)
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
    
    // (★新規★) 伝票関連のリスナー (cast-settings.htmlのモーダル群に含まれるため)
    // (★変更★)
    if (orderNominationSelect) {
        orderNominationSelect.addEventListener('change', (e) => {
            updateSlipInfo(); 
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
                
                if (slips) {
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
        saveNewCustomerBtn.addEventListener('click', async () => {
            if (!customers) return;
            const newName = newCustomerNameInput.value.trim();
            if (newName === "") {
                newCustomerError.textContent = "顧客名を入力してください。";
                return;
            }
            
            const existingCustomer = customers.find(c => c.name === newName);
            if (existingCustomer) {
                newCustomerError.textContent = "その顧客名は既に使用されています。";
                return;
            }

            const currentCastId = orderNominationSelect.value === 'null' ? null : orderNominationSelect.value;
            const newCustomer = { id: getUUID(), name: newName, nominatedCastId: currentCastId };
            
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
        openSlipPreviewBtn.addEventListener('click', async () => {
            await updateSlipInfo();
            await renderSlipPreviewModal(); 
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
        confirmCancelSlipBtn.addEventListener('click', async () => {
            if (!slips) return;
            const reason = cancelSlipReasonInput.value.trim();
            if (reason === "") {
                cancelSlipError.textContent = "ボツ伝にする理由を必ず入力してください。";
                return;
            }

            const slip = slips.find(s => s.slipId === currentSlipId);
            if (slip) {
                try {
                    const slipRef = doc(slipsCollectionRef, currentSlipId);
                    await setDoc(slipRef, { 
                        status: 'cancelled',
                        cancelReason: reason
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
        processPaymentBtn.addEventListener('click', async () => {
            if (!slips) return;
            const slip = slips.find(s => s.slipId === currentSlipId);
            if (!slip) return;

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
            
            try {
                const slipRef = doc(slipsCollectionRef, currentSlipId);
                await setDoc(slipRef, updatedSlipData, { merge: true });

                renderReceiptModal();
                closeModal(checkoutModal);
                openModal(receiptModal);
            } catch (e) {
                 console.error("Error processing payment: ", e);
            }
        });
    }

    if (reopenSlipBtn) {
        reopenSlipBtn.addEventListener('click', async () => {
            if (!slips) return;
            const slip = slips.find(s => s.slipId === currentSlipId);
            if (slip) {
                const updatedSlipData = {
                    status: 'active',
                    paidAmount: 0,
                    paymentDetails: { cash: 0, card: 0, credit: 0 },
                    paidTimestamp: null,
                    discount: { type: 'yen', value: 0 }
                };

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
    
    const tagsContainer = document.getElementById('order-tags-container');
    if (tagsContainer) {
        tagsContainer.addEventListener('click', (e) => {
            const tagBtn = e.target.closest('.slip-tag-btn');
            if (tagBtn) {
                toggleSlipTag(tagBtn.dataset.tagName);
            }
        });
    }
    
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
});