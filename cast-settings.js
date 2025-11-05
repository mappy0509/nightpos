// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    doc,
    collection,
    query, // (★新規★)
    where, // (★新規★)
    getDocs // (★新規★)
} from './firebase-init.js';

// (★削除★) エラーの原因となった以下の参照(Ref)のインポートを削除
/*
import { 
    settingsRef, castsCollectionRef, slipsCollectionRef, invitesCollectionRef
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

// (★変更★) state を分割して管理
let settings = null; 
let casts = [];
let slips = []; 
let currentEditingCastId = null; // (★新規★) 編集モーダル用のID

// (★新規★) 参照(Ref)はグローバル変数として保持 (firebaseReady で設定)
let settingsRef, castsCollectionRef, slipsCollectionRef, invitesCollectionRef;
let currentStoreId;

// ===== DOM要素 =====
// (変更) cast-settings.js 専用のDOM要素
let modalCloseBtns,
    saveRolesBtn, settingsFeedback, // (★変更★) ID変更
    
    // (★変更★) キャスト一覧
    openNewCastModalBtn, // (★変更★)
    currentCastsList, castSettingsError,
    
    // (★新規★) 招待モーダル
    inviteModal, inviteQrCodeContainer, inviteLinkInput,
    
    // (★新規★) キャスト編集モーダル
    castEditorModal, castEditorModalTitle, castEditorForm,
    castDisplayNameInput, castRealNameInput, castEmailInput,
    castAuthUidInput, castPhoneInput, castAddressInput,
    castHireDateInput, castEditorError,
    saveCastBtn, deleteCastBtn;


// --- 関数 ---

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
 * (★変更★) キャスト権限（ロール）設定を保存する
 */
const saveRoles = async () => { 
    if (!casts || !castsCollectionRef) return; 
    
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
            
            // 1. /stores/{storeId}/casts/{castId} ドキュメントを更新
            const castRef = doc(castsCollectionRef, castId);
            updatePromises.push(setDoc(castRef, { role: newRole }, { merge: true }));
            
            // 2. /userProfiles/{authUid} ドキュメントを更新
            if (cast.authUid) {
                const userProfileRef = doc(db, "userProfiles", cast.authUid);
                updatePromises.push(setDoc(userProfileRef, { role: newRole }, { merge: true }));
            }
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
            settingsFeedback.textContent = "権限設定を保存しました。";
            settingsFeedback.className = "text-sm text-green-600";
            setTimeout(() => {
                settingsFeedback.textContent = "";
            }, 3000);
        }
    } catch (e) {
        console.error("Error saving cast roles: ", e);
        if (settingsFeedback) {
            settingsFeedback.textContent = "権限の保存に失敗しました。";
            settingsFeedback.className = "text-sm text-red-600";
        }
    }
};


// ===================================
// (★変更★) キャスト設定セクション
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
        currentCastsList.innerHTML = '<p class="text-sm text-slate-500">キャストが登録されていません。「新規キャスト登録」から招待してください。</p>';
        return;
    }
    
    const sortedCasts = [...casts].sort((a,b) => (a.name || "未設定").localeCompare(b.name || "未設定"));

    sortedCasts.forEach(cast => {
        const isUsed = (slips || []).some(s => s.nominationCastId === cast.id); 
        
        // (★変更★) メールアドレスと編集ボタンを追加
        const itemHTML = `
            <div class="flex flex-col md:flex-row justify-between md:items-center bg-slate-50 p-4 rounded-lg border gap-3">
                <div>
                    <p class="font-semibold text-lg">${cast.name || "（名前未設定）"}</p>
                    <p class="text-sm text-slate-500">${cast.email || "（メール未設定）"}</p>
                    <p class="text-xs text-slate-400 font-mono mt-1">CastID: ${cast.id}</p>
                </div>
                
                <div class="flex items-center space-x-3">
                    <select class="p-2 border border-slate-300 rounded-lg bg-white text-sm" data-cast-id="${cast.id}">
                        <option value="cast" ${(!cast.role || cast.role === 'cast') ? 'selected' : ''}>キャスト</option>
                        <option value="admin" ${(cast.role === 'admin') ? 'selected' : ''}>管理者</option>
                    </select>
                    
                    <button type="button" class="edit-cast-btn text-blue-600 hover:text-blue-800" 
                            data-cast-id="${cast.id}" title="キャスト情報編集">
                        <i class="fa-solid fa-pen"></i>
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
 * (★新規★) キャスト招待モーダルを開く
 */
const openInviteModal = async () => {
    if (!invitesCollectionRef || !currentStoreId || !inviteQrCodeContainer) return;
    
    const token = getUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1時間有効
    
    try {
        // 招待トークンをFirestoreに保存
        await addDoc(invitesCollectionRef, {
            token: token,
            expires: expires.toISOString(),
            role: 'cast', // 管理者も招待できるようにするなら、ここで選択
            used: false
        });
        
        // 招待URLを生成
        const inviteUrl = `${window.location.origin}/signup.html?storeId=${currentStoreId}&token=${token}`;
        
        // QRコードを生成
        inviteQrCodeContainer.innerHTML = ''; // 既存のQRコードをクリア
        new QRCode(inviteQrCodeContainer, {
            text: inviteUrl,
            width: 256,
            height: 256,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        
        // 招待リンクを表示
        inviteLinkInput.value = inviteUrl;
        
        openModal(inviteModal);

    } catch (e) {
        console.error("Error creating invite token: ", e);
        castSettingsError.textContent = "招待リンクの作成に失敗しました。";
    }
};

/**
 * (★新規★) キャスト編集モーダルを開く
 * @param {string} castId
 */
const openCastEditorModal = (castId) => {
    const cast = casts.find(c => c.id === castId);
    if (!cast) {
        castSettingsError.textContent = "キャスト情報の読み込みに失敗しました。";
        return;
    }
    
    currentEditingCastId = castId;
    castEditorModalTitle.textContent = `キャスト情報編集: ${cast.name || cast.email}`;
    castEditorError.textContent = '';
    
    // フォームにデータを入力
    castDisplayNameInput.value = cast.name || '';
    castRealNameInput.value = cast.realName || '';
    castEmailInput.value = cast.email || '';
    castAuthUidInput.value = cast.authUid || '';
    castPhoneInput.value = cast.phone || '';
    castAddressInput.value = cast.address || '';
    castHireDateInput.value = cast.hireDate || '';
    
    // Auth UID と Email は編集不可にする（重要）
    castEmailInput.disabled = true;
    castAuthUidInput.disabled = true;
    
    deleteCastBtn.classList.remove('hidden');
    
    openModal(castEditorModal);
};

/**
 * (★新規★) キャスト詳細情報を保存（編集）
 */
const saveCastDetails = async () => {
    if (!currentEditingCastId || !castsCollectionRef) return;
    
    const castData = {
        name: castDisplayNameInput.value.trim(),
        realName: castRealNameInput.value.trim(),
        phone: castPhoneInput.value.trim(),
        address: castAddressInput.value.trim(),
        hireDate: castHireDateInput.value,
        // email と authUid は変更しない
    };
    
    try {
        const castRef = doc(castsCollectionRef, currentEditingCastId);
        await setDoc(castRef, castData, { merge: true });
        closeModal(castEditorModal);
    } catch (e) {
        console.error("Error saving cast details: ", e);
        castEditorError.textContent = "キャスト情報の保存に失敗しました。";
    }
};


/**
 * (★変更★) キャストを削除する
 */
const deleteCast = async () => { 
    if (!currentEditingCastId || !casts || !slips) return; 
    
    const cast = casts.find(c => c.id === currentEditingCastId);
    if (!cast) {
        castEditorError.textContent = "対象のキャストが見つかりません。";
        return;
    }
    
    const isUsed = slips.some(s => s.nominationCastId === cast.id); 
    if (isUsed) {
        // (★変更★) エラー表示をモーダル内または一覧のエラー欄に表示
        const errorElement = castEditorModal.classList.contains('active') ? castEditorError : castSettingsError;
        errorElement.textContent = `このキャストは伝票で使用中のため削除できません。`;
        return;
    }
    
    if (!confirm(`キャスト「${cast.name}」を削除しますか？\n(※注意: 認証アカウント(Auth)は自動削除されません。Firestoreのデータのみ削除されます)`)) {
        return;
    }

    try {
        // 1. /stores/{storeId}/casts/{castId} を削除
        const castRef = doc(castsCollectionRef, currentEditingCastId);
        await deleteDoc(castRef);
        
        // 2. /userProfiles/{authUid} を削除
        if (cast.authUid) {
            const userProfileRef = doc(db, "userProfiles", cast.authUid);
            await deleteDoc(userProfileRef);
        }
        
        // (★注意★) Firebase Auth のアカウント削除は、セキュリティルール上
        // クライアント(ブラウザ)からは実行できません。
        // 別途 Firebase Functions (バックエンド) で実装するか、
        // Firebaseコンソールから手動で削除する必要があります。
        
        console.log(`Cast ${cast.id} deleted from Firestore.`);
        
        closeModal(castEditorModal);
        
    } catch (e) {
        console.error("Error deleting cast: ", e);
         const errorElement = castEditorModal.classList.contains('active') ? castEditorError : castSettingsError;
        errorElement.textContent = "キャストの削除に失敗しました。";
    }
};


// (★変更★) --- Firestore リアルタイムリスナー ---
// firebaseReady イベントを待ってからリスナーを設定
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照をグローバル変数にセット
    const { 
        settingsRef: sRef, 
        castsCollectionRef: cRef, 
        slipsCollectionRef: slRef,
        invitesCollectionRef: iRef,
        currentStoreId: csId
    } = e.detail;
    
    settingsRef = sRef;
    castsCollectionRef = cRef;
    slipsCollectionRef = slRef;
    invitesCollectionRef = iRef;
    currentStoreId = csId;

    let settingsLoaded = false; 
    let castsLoaded = false;
    let slipsLoaded = false;

    // (★新規★) 全データロード後にUIを初回描画する関数
    const checkAndRenderAll = () => {
        // (★変更★) cast-settings.js は renderCastSettingsList を呼ぶ
        if (settingsLoaded && castsLoaded && slipsLoaded) {
            console.log("All data loaded. Rendering UI for cast-settings.js");
            renderCastSettingsList();
        }
    };

    // 1. Settings (権限チェックなどに将来使う)
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found.");
            settings = {}; // フォールバック
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to settings: ", error);
        settingsLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });

    // 2. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to casts: ", error);
        castsLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });

    // 3. Slips (削除可否判定用)
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
        slipsLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
    
    // (★新規★) QRコードライブラリをロード
    if (!document.getElementById('qrcode-script')) {
        const script = document.createElement('script');
        script.id = 'qrcode-script';
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
        script.onerror = () => {
             console.error("Failed to load qrcode.min.js");
             if(castSettingsError) castSettingsError.textContent = "QRコードライブラリの読み込みに失敗しました。";
        };
        document.head.appendChild(script);
    }
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'cast-settings.html');
    
    // ===== DOM要素の取得 =====
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');
    saveRolesBtn = document.getElementById('save-cast-settings-btn'); // (★変更★) ID変更
    settingsFeedback = document.getElementById('settings-feedback');

    // (★変更★) キャスト
    openNewCastModalBtn = document.getElementById('add-cast-btn'); // (★変更★) ID変更
    currentCastsList = document.getElementById('current-casts-list');
    castSettingsError = document.getElementById('cast-settings-error');
    
    // (★新規★) 招待モーダル
    inviteModal = document.getElementById('invite-modal'); // (★新規★)
    inviteQrCodeContainer = document.getElementById('invite-qr-code'); // (★新規★)
    inviteLinkInput = document.getElementById('invite-link-input'); // (★新規★)
    
    // (★新規★) 編集モーダル
    castEditorModal = document.getElementById('cast-editor-modal');
    castEditorModalTitle = document.getElementById('cast-editor-modal-title');
    castEditorForm = document.getElementById('cast-editor-form');
    castDisplayNameInput = document.getElementById('cast-display-name');
    castRealNameInput = document.getElementById('cast-real-name');
    castEmailInput = document.getElementById('cast-email');
    castAuthUidInput = document.getElementById('cast-auth-uid');
    castPhoneInput = document.getElementById('cast-phone');
    castAddressInput = document.getElementById('cast-address');
    castHireDateInput = document.getElementById('cast-hire-date');
    castEditorError = document.getElementById('cast-editor-error');
    saveCastBtn = document.getElementById('save-cast-btn');
    deleteCastBtn = document.getElementById('delete-cast-btn');

    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★変更★) モーダルを閉じるボタン (共通)
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


    // (★変更★) 権限保存ボタン
    if (saveRolesBtn) {
        saveRolesBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            saveRoles(); 
        });
    }

    // --- (★変更★) キャスト招待 ---
    if (openNewCastModalBtn) {
        openNewCastModalBtn.addEventListener('click', () => {
            // (★変更★) QRコードライブラリが読み込まれているかチェック
            if (typeof QRCode === 'undefined') {
                castSettingsError.textContent = "QRコードライブラリが読み込み中です。再度お試しください。";
                return;
            }
            openInviteModal(); 
        });
    }

    // --- (★変更★) キャスト一覧のイベント委任 ---
    if (currentCastsList) {
        currentCastsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-cast-btn');
            const editBtn = e.target.closest('.edit-cast-btn');
            
            if (editBtn) {
                openCastEditorModal(editBtn.dataset.castId);
                return;
            }
            
            if (deleteBtn && !deleteBtn.disabled) {
                currentEditingCastId = deleteBtn.dataset.castId; // (★変更★) 削除対象IDをセット
                deleteCast(); // (★変更★) 編集モーダルを開かずに削除
                return;
            }
        });
    }
    
    // --- (★新規★) キャスト編集モーダル ---
    if (castEditorForm) {
        castEditorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCastDetails();
        });
    }
    if (deleteCastBtn) {
        deleteCastBtn.addEventListener('click', () => {
            deleteCast();
        });
    }

});