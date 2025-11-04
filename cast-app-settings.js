// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    doc,
    collection,
    getDoc, // (★新規★)
    signOut, // (★新規★)
    updatePassword, // (★新規★)
    EmailAuthProvider, // (★新規★)
    reauthenticateWithCredential // (★新規★)
} from './firebase-init.js';

// (★変更★) 参照は firebaseReady イベントで受け取る
let castsCollectionRef;
let currentCastId;
let currentCastName = "キャスト";

// ===== DOM要素 =====
// (★新規★) cast-app-settings.html に必要なDOM
let castHeaderName, pageTitle,
    castNameInput,
    passwordChangeForm, // (★新規★)
    castPasswordCurrent, castPasswordNew, castPasswordNewConfirm, // (★新規★)
    savePasswordBtn, passwordFeedback,
    logoutButtonHeader, logoutButtonMain;


// --- 関数 ---

// =================================================
// (★新規★) 設定ページ専用ロジック
// =================================================

/**
 * (★変更★) 認証情報からキャスト情報をフォームに読み込む
 */
const loadCastInfo = async () => {
    if (!currentCastId || !castsCollectionRef) {
        console.warn("Cast ID or collection ref not ready.");
        return;
    }
    
    try {
        // (★新規★) ログイン中のキャストのFirestoreドキュメントを取得
        const castRef = doc(castsCollectionRef, currentCastId);
        const castSnap = await getDoc(castRef);

        if (castSnap.exists()) {
            currentCastName = castSnap.data().name || "キャスト";
        } else {
            console.warn("Cast document not found in Firestore.");
        }

    } catch (error) {
        console.error("Error fetching cast data: ", error);
    }
    
    // UIに反映
    if (castHeaderName) castHeaderName.textContent = currentCastName;
    if (castNameInput) castNameInput.value = currentCastName;
    
    // (★新規★) フォームの disabled を解除
    if (castPasswordCurrent) castPasswordCurrent.disabled = false;
    if (castPasswordNew) castPasswordNew.disabled = false;
    if (castPasswordNewConfirm) castPasswordNewConfirm.disabled = false;
    if (savePasswordBtn) savePasswordBtn.disabled = false;
};

/**
 * (★新規★) ログアウト処理
 */
const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    
    try {
        await signOut(auth);
        // 成功すると firebase-init.js の onAuthStateChanged が発火し、
        // 自動的に login.html にリダイレクトされる
        console.log("User signed out.");
    } catch (error) {
        console.error("Sign out error: ", error);
        alert("ログアウトに失敗しました。");
    }
};

/**
 * (★新規★) パスワード変更処理
 */
const handleChangePassword = async (e) => {
    e.preventDefault();
    
    const currentPassword = castPasswordCurrent.value;
    const newPassword = castPasswordNew.value;
    const newPasswordConfirm = castPasswordNewConfirm.value;

    // バリデーション
    if (newPassword !== newPasswordConfirm) {
        passwordFeedback.textContent = "新しいパスワードが一致しません。";
        passwordFeedback.className = "text-sm text-center text-red-600";
        return;
    }
    if (newPassword.length < 8) {
        passwordFeedback.textContent = "新しいパスワードは8文字以上で入力してください。";
        passwordFeedback.className = "text-sm text-center text-red-600";
        return;
    }
    
    // 処理中表示
    savePasswordBtn.disabled = true;
    passwordFeedback.textContent = "パスワードを変更中...";
    passwordFeedback.className = "text-sm text-center text-slate-500";
    
    const user = auth.currentUser;
    if (!user) {
        passwordFeedback.textContent = "エラー: ログインしていません。";
        passwordFeedback.className = "text-sm text-center text-red-600";
        return;
    }

    try {
        // 1. 現在のパスワードで再認証
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        try {
            // 2. 再認証成功後、パスワードを更新
            await updatePassword(user, newPassword);
            
            passwordFeedback.textContent = "パスワードが正常に変更されました。";
            passwordFeedback.className = "text-sm text-center text-green-600";
            passwordChangeForm.reset();

        } catch (updateError) {
            // パスワード更新失敗 (例: 弱すぎるパスワード)
            console.error("Update password error: ", updateError);
            passwordFeedback.textContent = "パスワードの更新に失敗しました。 (例: パスワードが弱すぎます)";
            passwordFeedback.className = "text-sm text-center text-red-600";
        }

    } catch (reauthError) {
        // 再認証失敗 (現在のパスワードが間違っている)
        console.error("Re-authentication error: ", reauthError);
        passwordFeedback.textContent = "現在のパスワードが間違っています。";
        passwordFeedback.className = "text-sm text-center text-red-600";
    }
    
    savePasswordBtn.disabled = false;
};


// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        castsCollectionRef: cRef,
        currentCastId: cId
    } = e.detail;
    
    castsCollectionRef = cRef;
    currentCastId = cId;
    
    // (★新規★) UIに反映
    loadCastInfo();
    
    // (★削除★) 以前の onSnapshot(castsCollectionRef, ...) は不要
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    castHeaderName = document.getElementById('cast-header-name');
    pageTitle = document.getElementById('page-title');
    castNameInput = document.getElementById('cast-name-input');
    
    passwordChangeForm = document.getElementById('password-change-form');
    castPasswordCurrent = document.getElementById('cast-password-current');
    castPasswordNew = document.getElementById('cast-password-new');
    castPasswordNewConfirm = document.getElementById('cast-password-new-confirm');
    
    savePasswordBtn = document.getElementById('save-password-btn');
    passwordFeedback = document.getElementById('password-feedback');
    logoutButtonHeader = document.getElementById('logout-button-header');
    logoutButtonMain = document.getElementById('logout-button-main');
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★変更★) パスワード変更ボタン
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', handleChangePassword);
    }

    // (★変更★) ログアウトボタン (両方)
    if (logoutButtonHeader) {
        logoutButtonHeader.addEventListener('click', handleLogout);
    }
    if (logoutButtonMain) {
        logoutButtonMain.addEventListener('click', handleLogout);
    }

});