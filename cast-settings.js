// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    doc,
    collection 
} from './firebase-init.js';

// (★新規★) 新しい参照をインポート
import {
    settingsRef, // (★追加★) 削除可否判定のために slips を参照
    castsCollectionRef,
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
let settings = null; // (★追加★)
let casts = [];
let slips = []; // (★追加★) キャスト削除可否の判定に必要

// (★削除★) 伝票関連のローカル変数を削除


// ===== DOM要素 =====
// (変更) cast-settings.js 専用のDOM要素
let modalCloseBtns, // (★削除★) モーダルが無いため削除
    saveSettingsBtn, settingsFeedback,
    
    // キャスト設定
    newCastNameInput, addCastBtn, currentCastsList, castSettingsError;

// (★削除★) 伝票関連モーダルDOM (newSlipConfirmModal, slipSelectionModal, etc...) をすべて削除
// (★削除★) 伝票モーダル内のDOM (orderModalTitle, etc...) をすべて削除


// --- 関数 ---

// (★削除★) 伝票関連のヘルパー関数 (formatCurrency, formatDateTimeLocal, formatElapsedTime, calculateSlipTotal, getCastNameById, getActiveSlipCount) をすべて削除

/**
 * モーダルを開く (cast-settings.js では使われないが念のため残す)
 * @param {HTMLElement} modalElement 
 */
const openModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.add('active');
    }
};

/**
 * モーダルを閉じる (cast-settings.js では使われないが念のため残す)
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
    if (!casts || !slips) return; 

    // キャストリストの描画
    renderCastSettingsList();
};


/**
 * (新規) フォームから設定を保存する
 * (将来的に権限変更などをここで保存)
 */
const saveSettingsFromForm = async () => { 
    if (!casts) return; 
    
    // (★新規★) 権限変更のロジック
    const newCastData = [...casts]; 
    let updateError = false;

    const roleSelects = currentCastsList.querySelectorAll('select[data-cast-id]');
    
    const updatePromises = [];
    
    roleSelects.forEach(select => {
        const castId = select.dataset.castId;
        const newRole = select.value;
        const cast = newCastData.find(c => c.id === castId);
        
        if (cast && cast.role !== newRole) {
            cast.role = newRole; 
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
    if (!currentCastsList || !casts) return; 
    
    currentCastsList.innerHTML = '';
    if (castSettingsError) castSettingsError.textContent = '';
    
    if (!casts || casts.length === 0) { 
        currentCastsList.innerHTML = '<p class="text-sm text-slate-500">キャストが登録されていません。</p>';
        return;
    }
    
    const sortedCasts = [...casts].sort((a,b) => a.name.localeCompare(b.name));

    sortedCasts.forEach(cast => {
        const isUsed = (slips || []).some(s => s.nominationCastId === cast.id); 
        
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
const addCastSetting = async () => { 
    if (!newCastNameInput || !castSettingsError || !casts) return; 
    
    const newName = newCastNameInput.value.trim();
    if (newName === "") {
        castSettingsError.textContent = "キャスト名を入力してください。";
        return;
    }
    
    const exists = casts.some(cast => cast.name === newName); 
    if (exists) {
        castSettingsError.textContent = "そのキャスト名は既に使用されています。";
        return;
    }
    
    const newCast = { 
        name: newName,
        role: 'cast' 
    };
    
    try {
        await addDoc(castsCollectionRef, newCast);
        newCastNameInput.value = '';
        castSettingsError.textContent = '';
    } catch (e) {
        console.error("Error adding cast: ", e);
        castSettingsError.textContent = "キャストの追加に失敗しました。";
    }
};

/**
 * (★新規★) キャストを削除する (settings.js から移植)
 * @param {string} castId 
 */
const deleteCastSetting = async (castId) => { 
    if (!casts || !slips) return; 
    
    const isUsed = slips.some(s => s.nominationCastId === castId); 
    if (isUsed) {
        castSettingsError.textContent = `そのキャストは伝票で使用中のため削除できません。`;
        return;
    }

    try {
        const castRef = doc(castsCollectionRef, castId);
        await deleteDoc(castRef);
    } catch (e) {
        console.error("Error deleting cast: ", e);
        castSettingsError.textContent = "キャストの削除に失敗しました。";
    }
};


/**
 * (★削除★) 伝票・注文関連の関数をすべて削除
 */
// updateModalCommonInfo, createNewSlip, renderSlipSelectionModal, renderNewSlipConfirmModal


// (★変更★) デフォルトの state を定義する関数（Firestoreにデータがない場合）
const getDefaultSettings = () => {
    // (★簡易版★ cast-settings.js は settings を参照しないため空でも良い)
    return {};
};


// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        settingsRef, // (★追加★)
        castsCollectionRef,
        slipsCollectionRef
    } = e.detail;

    let settingsLoaded = false; // (★追加★)
    let castsLoaded = false;
    let slipsLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) cast-settings.js は loadSettingsToForm を呼ぶ
        if (settingsLoaded && castsLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for cast-settings.js");
            loadSettingsToForm();
            // (★削除★) updateModalCommonInfo(); 
        }
    };

    // 1. Settings (★追加★) - 削除可否判定のためにslipsが必要なため
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            // (★変更★) settings.js が作成するはずなので、ここでは作成しない
            console.warn("No settings document found.");
            settings = getDefaultSettings(); // フォールバック
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // (★削除★) 2. Menu

    // (★削除★) 3. Slip Counter

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

    // (★削除★) 5. Customers
    
    // 6. Slips
    onSnapshot(slipsCollectionRef, (querySnapshot) => {
        slips = [];
        querySnapshot.forEach((doc) => {
            slips.push({ ...doc.data(), slipId: doc.id }); 
        });
        console.log("Slips loaded (for cast delete check): ", slips.length);
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
    saveSettingsBtn = document.getElementById('save-cast-settings-btn'); 
    settingsFeedback = document.getElementById('settings-feedback');

    // (★新規★) キャスト
    newCastNameInput = document.getElementById('new-cast-name-input');
    addCastBtn = document.getElementById('add-cast-btn');
    currentCastsList = document.getElementById('current-casts-list');
    castSettingsError = document.getElementById('cast-settings-error');

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
            if (deleteBtn && !deleteBtn.disabled) {
                if (confirm(`キャストを削除しますか？\n(この操作は取り消せません)`)) {
                    deleteCastSetting(deleteBtn.dataset.castId); 
                }
            }
        });
        
        currentCastsList.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT') {
                console.log(`Role selection changed for ${e.target.dataset.castId}. Ready to save.`);
            }
        });
    }
    
    // (★削除★) 伝票関連モーダルリスナー
    // ...
});