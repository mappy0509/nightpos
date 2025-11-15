// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc,
    collection,
    query, 
    where, 
    serverTimestamp
} from './firebase-init.js';

// ===== グローバル定数・変数 =====
let settings = null;
let slips = [];
let casts = [];
let firstVisitSlips = []; // (★新規★) 絞り込んだ初回伝票リスト

// (★新規★) 参照(Ref)はグローバル変数として保持
let settingsRef, slipsCollectionRef, castsCollectionRef, currentStoreId;

// --- DOM要素 ---
let pageTitle, firstVisitList, firstVisitLoading, headerStoreName,
    modalCloseBtns;

// (★新規★) 初回管理モーダル
let editorModal, modalTitle, hostSelect, 
    photoList, addPhotoBtn, sendList, addSendBtn, 
    sequenceList, addSequenceBtn, modalError;

// (★新規★) キャスト選択モーダル
let castSelectModal, castSelectTitle, castSearch, castGrid;

// --- 状態変数 ---
let currentEditingSlipId = null;
let currentCastSelectMode = 'photo'; // 'photo', 'send', 'sequence'
let sequenceSortable = null;

// --- ヘルパー関数 ---

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
 * キャストIDからキャスト名を取得する
 * @param {string | null} castId
 * @returns {string} キャスト名
 */
const getCastNameById = (castId) => {
    if (!casts) return '不明'; 
    if (!castId || castId === 'none') return '（未選択）';
    const cast = casts.find(c => c.id === castId);
    return cast ? cast.name : '不明';
};

/**
 * ヘッダーのストア名をレンダリングする
 */
const renderHeaderStoreName = () => {
    if (!headerStoreName || !settings || !currentStoreId) return;
    const currentStoreName = (settings.storeInfo && settings.storeInfo.name) ? settings.storeInfo.name : "店舗";
    headerStoreName.textContent = currentStoreName;
};

// --- (★新規★) 初回管理ロジック ---

/**
 * (★新規★) 伝票データをFirestoreに自動保存
 * @param {object} dataToSave - `firstVisitData` オブジェクト
 */
const saveFirstVisitData = async (dataToSave) => {
    if (!currentEditingSlipId || !slipsCollectionRef) return;
    
    const slipRef = doc(slipsCollectionRef, currentEditingSlipId);
    try {
        await setDoc(slipRef, { 
            firstVisitData: dataToSave,
            updatedAt: serverTimestamp() // (★任意★) 伝票の最終更新日を更新
        }, { merge: true });
        
        // (★任意★) 成功フィードバック (例: モーダル内に小さく表示)
        
    } catch (e) {
        console.error("Error saving first visit data: ", e);
        if (modalError) modalError.textContent = "保存に失敗しました。";
    }
};

/**
 * (★新規★) モーダル内のキャストリストを描画 (写真/送り/つけ回し共通)
 * @param {HTMLElement} container - 描画対象のDOM (photoList, sendList, sequenceList)
 * @param {Array} castArray - 伝票の `firstVisitData` 内の配列
 * @param {'photo'|'send'|'sequence'} type - リストの種別
 */
const renderCastList = (container, castArray, type) => {
    if (!container) return;
    container.innerHTML = '';
    
    const isSequence = (type === 'sequence');
    
    if (!castArray || castArray.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 italic p-2">${isSequence ? 'キャストを追加してください' : '（未選択）'}</p>`;
        return;
    }
    
    // つけ回しの場合は order でソート
    if (isSequence) {
        castArray.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    castArray.forEach((cast, index) => {
        const castName = getCastNameById(cast.id);
        const itemHTML = `
            <div class="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border" data-cast-id="${cast.id}">
                <div class="flex items-center">
                    ${isSequence ? `<i class="fa-solid fa-grip-vertical text-slate-400 cursor-move mr-3 fv-drag-handle"></i>` : ''}
                    <span class="font-semibold">
                        ${isSequence ? `${index + 1}. ` : ''}${castName}
                    </span>
                </div>
                <button class="text-red-500 hover:text-red-700 fv-remove-btn" data-type="${type}" data-cast-id="${cast.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.innerHTML += itemHTML;
    });
};

/**
 * (★新規★) 初回管理モーダルを開く
 * @param {string} slipId 
 */
const openFirstVisitModal = (slipId) => {
    const slip = firstVisitSlips.find(s => s.slipId === slipId);
    if (!slip) {
        console.error("Slip not found in first visit list:", slipId);
        return;
    }
    
    currentEditingSlipId = slipId;
    
    // モーダルタイトル
    modalTitle.textContent = `初回管理 (T${slip.tableId} - No.${slip.slipNumber} - ${slip.name})`;
    modalError.textContent = '';
    
    // 担当ホストのドロップダウンを生成
    hostSelect.innerHTML = '<option value="none">--- 担当者を選択 ---</option>';
    (casts || []).forEach(cast => {
        // (★仮★) admin ロールを持つキャストをホスト候補とする
        if (cast.role === 'admin') {
            hostSelect.innerHTML += `<option value="${cast.id}">${cast.name}</option>`;
        }
    });
    
    const fvData = slip.firstVisitData || {};
    hostSelect.value = fvData.hostCastId || 'none';
    
    // 各リストを描画
    renderCastList(photoList, fvData.photoNominations || [], 'photo');
    renderCastList(sendList, fvData.sendNominations || [], 'send');
    renderCastList(sequenceList, fvData.sequence || [], 'sequence');
    
    // つけ回しリストの並び替えを有効化
    if (sequenceSortable) {
        sequenceSortable.destroy();
    }
    sequenceSortable = new Sortable(sequenceList, {
        animation: 150,
        handle: '.fv-drag-handle',
        onEnd: async (evt) => {
            const slip = firstVisitSlips.find(s => s.slipId === currentEditingSlipId);
            if (!slip || !slip.firstVisitData || !slip.firstVisitData.sequence) return;
            
            // DOMから新しいIDの順序を取得
            const newOrderIds = Array.from(evt.target.children).map(child => child.dataset.castId);
            
            // 伝票データの配列を並び替え
            slip.firstVisitData.sequence.forEach(cast => {
                const newIndex = newOrderIds.indexOf(cast.id);
                cast.order = newIndex !== -1 ? newIndex : 0;
            });
            
            // 自動保存
            await saveFirstVisitData(slip.firstVisitData);
            // 画面にも即時反映 (番号の振り直し)
            renderCastList(sequenceList, slip.firstVisitData.sequence, 'sequence');
        }
    });
    
    openModal(editorModal);
};

/**
 * (★新規★) キャスト選択モーダル内のキャスト一覧を検索・描画
 */
const renderCastSelectGrid = () => {
    if (!castGrid) return;
    
    const searchTerm = castSearch.value.toLowerCase();
    const filteredCasts = (casts || []).filter(cast => 
        cast.name.toLowerCase().includes(searchTerm)
    );
    
    castGrid.innerHTML = '';
    if (filteredCasts.length === 0) {
        castGrid.innerHTML = '<p class="text-slate-500 col-span-full text-center">該当するキャストがいません。</p>';
        return;
    }
    
    filteredCasts.forEach(cast => {
        castGrid.innerHTML += `
            <button class="p-3 bg-white rounded-lg shadow border text-left hover:bg-slate-100 fv-cast-select-btn" 
                    data-cast-id="${cast.id}" data-cast-name="${cast.name}">
                <p class="font-semibold text-sm">${cast.name}</p>
            </button>
        `;
    });
};

/**
 * (★新規★) キャスト選択モーダルを開く
 * @param {'photo'|'send'|'sequence'} mode 
 */
const openCastSelectModal = (mode) => {
    currentCastSelectMode = mode;
    
    // モーダルタイトルを設定
    if (mode === 'photo') castSelectTitle.textContent = '写真指名キャストを選択';
    if (mode === 'send') castSelectTitle.textContent = '送り指名キャストを選択';
    if (mode === 'sequence') castSelectTitle.textContent = 'つけ回しキャストを選択';
    
    castSearch.value = '';
    renderCastSelectGrid();
    openModal(castSelectModal);
};

/**
 * (★新規★) キャスト選択モーダルでキャストをクリックした時の処理
 * @param {string} castId 
 * @param {string} castName 
 */
const handleCastSelect = async (castId, castName) => {
    const slip = firstVisitSlips.find(s => s.slipId === currentEditingSlipId);
    if (!slip || !settings) return;
    
    const fvData = slip.firstVisitData || {};
    const settingsFV = settings.firstVisitSettings || { maxPhoto: 1, maxSend: 1 };
    
    // 1. 伝票データ (fvData) を更新
    if (currentCastSelectMode === 'photo') {
        if (!fvData.photoNominations) fvData.photoNominations = [];
        // 既に存在するかチェック
        if (fvData.photoNominations.some(c => c.id === castId)) {
             closeModal(castSelectModal);
             return;
        }
        // 最大人数チェック
        if (fvData.photoNominations.length >= settingsFV.maxPhoto) {
            alert(`写真指名は最大 ${settingsFV.maxPhoto} 名までです。`);
            return;
        }
        fvData.photoNominations.push({ id: castId, name: castName });
        
    } else if (currentCastSelectMode === 'send') {
        if (!fvData.sendNominations) fvData.sendNominations = [];
        if (fvData.sendNominations.some(c => c.id === castId)) {
             closeModal(castSelectModal);
             return;
        }
        if (fvData.sendNominations.length >= settingsFV.maxSend) {
            alert(`送り指名は最大 ${settingsFV.maxSend} 名までです。`);
            return;
        }
        fvData.sendNominations.push({ id: castId, name: castName });

    } else if (currentCastSelectMode === 'sequence') {
        if (!fvData.sequence) fvData.sequence = [];
        if (fvData.sequence.some(c => c.id === castId)) {
             closeModal(castSelectModal);
             return;
        }
        // order を最後尾に追加
        const newOrder = fvData.sequence.length;
        fvData.sequence.push({ id: castId, name: castName, order: newOrder });
    }
    
    // 2. Firestoreに自動保存
    await saveFirstVisitData(fvData);
    
    // 3. モーダルを閉じて、編集モーダルを再描画
    closeModal(castSelectModal);
    
    if (currentCastSelectMode === 'photo') renderCastList(photoList, fvData.photoNominations, 'photo');
    if (currentCastSelectMode === 'send') renderCastList(sendList, fvData.sendNominations, 'send');
    if (currentCastSelectMode === 'sequence') renderCastList(sequenceList, fvData.sequence, 'sequence');
};

/**
 * (★新規★) 編集モーダルでキャストをリストから削除
 * @param {'photo'|'send'|'sequence'} type 
 * @param {string} castId 
 */
const handleRemoveCastFromList = async (type, castId) => {
    const slip = firstVisitSlips.find(s => s.slipId === currentEditingSlipId);
    if (!slip || !slip.firstVisitData) return;
    
    const fvData = slip.firstVisitData;
    let listContainer = null;
    let listArray = null;

    if (type === 'photo') {
        listArray = fvData.photoNominations || [];
        fvData.photoNominations = listArray.filter(c => c.id !== castId);
        listContainer = photoList;
        
    } else if (type === 'send') {
        listArray = fvData.sendNominations || [];
        fvData.sendNominations = listArray.filter(c => c.id !== castId);
        listContainer = sendList;
        
    } else if (type === 'sequence') {
        listArray = fvData.sequence || [];
        fvData.sequence = listArray.filter(c => c.id !== castId);
        // 順序を振り直す
        fvData.sequence.sort((a,b) => (a.order || 0) - (b.order || 0));
        fvData.sequence.forEach((c, index) => c.order = index);
        listContainer = sequenceList;
    }
    
    // 自動保存
    await saveFirstVisitData(fvData);
    // 再描画
    renderCastList(listContainer, fvData[type === 'photo' ? 'photoNominations' : (type === 'send' ? 'sendNominations' : 'sequence')], type);
};

/**
 * (★新規★) 担当ホストの変更を自動保存
 */
const handleHostChange = async (e) => {
    const slip = firstVisitSlips.find(s => s.slipId === currentEditingSlipId);
    if (!slip) return;
    
    const newHostId = e.target.value === 'none' ? null : e.target.value;
    
    const fvData = slip.firstVisitData || {};
    fvData.hostCastId = newHostId;
    
    await saveFirstVisitData(fvData);
};


/**
 * (★新規★) 初回管理リストのメイン描画関数
 */
const renderFirstVisitList = () => {
    if (!firstVisitList || !slips || !settings) return;

    // "初回" または "枝" タグを持つ、未会計の伝票をフィルタリング
    // (★変更★) settings.slipTagsMaster に "初回" と "枝" が存在することを前提
    // (★仮★) タグ名を直接指定
    const firstVisitTags = ["初回", "枝"]; 
    
    firstVisitSlips = slips.filter(slip => 
        (slip.status === 'active' || slip.status === 'checkout') &&
        (slip.tags && slip.tags.some(tag => firstVisitTags.includes(tag)))
    );

    // 伝票番号でソート
    firstVisitSlips.sort((a, b) => (b.slipNumber || 0) - (a.slipNumber || 0));

    if (firstVisitLoading) firstVisitLoading.style.display = 'none';
    firstVisitList.innerHTML = '';
    
    if (firstVisitSlips.length === 0) {
        firstVisitList.innerHTML = `
            <p class="text-slate-500 md:col-span-3 text-center p-8">
                現在、初回・枝の伝票はありません。
            </p>`;
        return;
    }
    
    firstVisitSlips.forEach(slip => {
        const fvData = slip.firstVisitData || {};
        
        // 担当ホスト名
        const hostName = getCastNameById(fvData.hostCastId);
        
        // 写真指名
        const photoNames = (fvData.photoNominations || []).map(c => getCastNameById(c.id)).join(', ');
        const photoHtml = photoNames ? `<p class="font-medium text-pink-600">${photoNames}</p>` : `<p class="font-medium text-slate-400">（未選択）</p>`;
        
        // 送り指名
        const sendNames = (fvData.sendNominations || []).map(c => getCastNameById(c.id)).join(', ');
        const sendHtml = sendNames ? `<p class="font-medium text-green-600">${sendNames}</p>` : `<p class="font-medium text-slate-400">（未選択）</p>`;
        
        // タグ (初回 or 枝)
        const tag = slip.tags.includes("初回") ? "初回" : (slip.tags.includes("枝") ? "枝" : "他");
        const tagColor = tag === "初回" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";

        const cardHTML = `
            <div class="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <span class="text-xl font-bold text-blue-600">テーブル ${slip.tableId}</span>
                        <span class="text-sm text-slate-500 ml-2">(No.${slip.slipNumber})</span>
                    </div>
                    <span class="text-xs font-semibold px-2 py-1 ${tagColor} rounded-full">${tag}</span>
                </div>
                <p class="font-semibold mb-3">${slip.name}</p>
                
                <div class="space-y-3">
                    <div>
                        <label class="text-xs font-semibold text-slate-500">担当ホスト</label>
                        <p class="font-medium">${hostName}</p>
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-slate-500">写真指名</label>
                        ${photoHtml}
                    </div>
                    <div>
                        <label class="text-xs font-semibold text-slate-500">送り指名</label>
                        ${sendHtml}
                    </div>
                </div>
                
                <button class="w-full mt-4 px-4 py-2 rounded-lg bg-white text-blue-600 font-semibold border border-blue-300 hover:bg-blue-50 first-visit-card-btn" data-slip-id="${slip.slipId}">
                    詳細・つけ回し編集
                </button>
            </div>
        `;
        firstVisitList.innerHTML += cardHTML;
    });
};


// (★新規★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    // (★新規★) 必要な参照を取得
    const { 
        settingsRef: sRef,
        castsCollectionRef: cRef, 
        slipsCollectionRef: slRef,
        currentStoreId: csId
    } = e.detail;

    settingsRef = sRef;
    castsCollectionRef = cRef;
    slipsCollectionRef = slRef;
    currentStoreId = csId;

    let settingsLoaded = false;
    let castsLoaded = false;
    let slipsLoaded = false;

    const checkAndRenderAll = () => {
        if (settingsLoaded && castsLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for first-visit.js");
            renderFirstVisitList();
            renderHeaderStoreName();
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found.");
            settings = { storeInfo: { name: "店舗" }, firstVisitSettings: { maxPhoto: 1, maxSend: 1 } };
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // 2. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));
    
    // 3. Slips
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id });
        });
        console.log("Slips loaded (for first-visit): ", slips.length);
        slipsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to slips: ", error);
        slipsLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'first-visit.html');

    // ===== DOM要素の取得 =====
    pageTitle = document.getElementById('page-title');
    firstVisitList = document.getElementById('first-visit-list');
    firstVisitLoading = document.getElementById('first-visit-loading');
    headerStoreName = document.getElementById('header-store-name');
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');

    editorModal = document.getElementById('first-visit-editor-modal');
    modalTitle = document.getElementById('fv-modal-title');
    hostSelect = document.getElementById('fv-host-select');
    photoList = document.getElementById('fv-photo-list');
    addPhotoBtn = document.getElementById('fv-add-photo-btn');
    sendList = document.getElementById('fv-send-list');
    addSendBtn = document.getElementById('fv-add-send-btn');
    sequenceList = document.getElementById('fv-sequence-list');
    addSequenceBtn = document.getElementById('fv-add-sequence-btn');
    modalError = document.getElementById('fv-modal-error');
    
    castSelectModal = document.getElementById('cast-select-modal');
    castSelectTitle = document.getElementById('cast-select-modal-title');
    castSearch = document.getElementById('fv-cast-search');
    castGrid = document.getElementById('fv-cast-grid');

    
    // ===== イベントリスナーの設定 =====

    // (★新規★) モーダルを閉じるボタン (共通)
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-backdrop');
                if (modal) {
                    closeModal(modal);
                }
            });
        });
    }

    // (★新規★) 初回伝票カードクリック (イベント委任)
    if (firstVisitList) {
        firstVisitList.addEventListener('click', (e) => {
            const cardBtn = e.target.closest('.first-visit-card-btn');
            if (cardBtn) {
                openFirstVisitModal(cardBtn.dataset.slipId);
            }
        });
    }
    
    // --- 編集モーダル内のイベント ---
    if (hostSelect) {
        hostSelect.addEventListener('change', handleHostChange);
    }
    if (addPhotoBtn) {
        addPhotoBtn.addEventListener('click', () => openCastSelectModal('photo'));
    }
    if (addSendBtn) {
        addSendBtn.addEventListener('click', () => openCastSelectModal('send'));
    }
    if (addSequenceBtn) {
        addSequenceBtn.addEventListener('click', () => openCastSelectModal('sequence'));
    }
    
    // (★新規★) 編集モーダル内のリスト削除 (イベント委任)
    if (editorModal) {
        editorModal.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.fv-remove-btn');
            if (removeBtn) {
                const type = removeBtn.dataset.type;
                const castId = removeBtn.dataset.castId;
                handleRemoveCastFromList(type, castId);
            }
        });
    }

    // --- キャスト選択モーダル内のイベント ---
    if (castSearch) {
        castSearch.addEventListener('input', renderCastSelectGrid);
    }
    if (castGrid) {
        castGrid.addEventListener('click', (e) => {
            const selectBtn = e.target.closest('.fv-cast-select-btn');
            if (selectBtn) {
                handleCastSelect(selectBtn.dataset.castId, selectBtn.dataset.castName);
            }
        });
    }
});