// (★新規★) firebase-init.js から必要なモジュールをインポート
import { 
    auth, 
    signInWithEmailAndPassword, 
    db, 
    doc, 
    getDoc 
} from './firebase-init.js';

// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    const loginForm = document.getElementById('login-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    // (★新規★) ログインフォームの送信イベント
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!loginEmailInput || !loginPasswordInput || !loginBtn || !loginError) return;

            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            
            // (★新規★) 読み込み中の表示
            loginBtn.disabled = true;
            loginBtn.textContent = 'ログイン中...';
            loginError.textContent = '';

            try {
                // (★新規★) 1. Firebase Auth でサインイン
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // (★新規★) 2. ログイン成功。userProfiles からロールを取得してリダイレクト
                const userProfileRef = doc(db, "userProfiles", user.uid);
                const userProfileSnap = await getDoc(userProfileRef);

                if (userProfileSnap.exists()) {
                    const role = userProfileSnap.data().role;
                    
                    if (role === 'admin') {
                        // (★新規★) 管理者の場合は index.html へ
                        window.location.href = 'index.html';
                    } else if (role === 'cast') {
                        // (★新規★) キャストの場合は cast-dashboard.html へ
                        window.location.href = 'cast-dashboard.html';
                    } else {
                        // (★新規★) 万が一ロールがない場合
                        console.warn("User logged in, but role is undefined.");
                        window.location.href = 'login.html'; // ログインページに留まる
                    }
                } else {
                    // (★新規★) Auth ユーザーは存在するが、DBにプロファイルがない（＝異常）
                    console.error("User profile document not found in Firestore.");
                    loginError.textContent = "ログインに成功しましたが、ユーザープロファイルが見つかりません。管理者に連絡してください。";
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'ログイン';
                }

            } catch (error) {
                // (★新規★) 3. ログイン失敗
                console.error("Login error: ", error.code, error.message);
                
                if (error.code === 'auth/invalid-email' || 
                    error.code === 'auth/invalid-credential' || // (★変更★) v9以降の一般的なエラーコード
                    error.code === 'auth/wrong-password' || // (★旧★)
                    error.code === 'auth/user-not-found') { // (★旧★)
                    loginError.textContent = "メールアドレスまたはパスワードが間違っています。";
                } else {
                    loginError.textContent = `ログインに失敗しました。 (${error.code})`;
                }
                
                loginBtn.disabled = false;
                loginBtn.textContent = 'ログイン';
            }
        });
    }
});