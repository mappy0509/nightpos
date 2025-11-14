// (★変更★) firebase-init.js から必要なモジュールをインポート
import { 
    db, 
    auth, 
    createUserWithEmailAndPassword, 
    doc, 
    collection, 
    query, 
    where, 
    getDocs, 
    setDoc,
    addDoc,
    getDoc // (★念のため getDoc もインポート)
} from './firebase-init.js';

// --- グローバル変数 ---
let validStoreId = null;
let validInviteTokenId = null; // (★変更★) ドキュメントIDを保持
let validInviteRole = 'cast'; 

// --- DOM要素 ---
let loadingContainer, signupForm, successContainer, invalidTokenContainer;
let signupEmailInput, signupPasswordInput, signupPasswordConfirmInput,
    signupDisplayNameInput, signupRealNameInput,
    signupBtn, signupError;

/**
 * (★新規★) 画面の状態を切り替える
 * @param {'loading' | 'form' | 'success' | 'invalid'} state 
 */
const setSignupState = (state) => {
    if (!loadingContainer || !signupForm || !successContainer || !invalidTokenContainer) {
        console.error("Signup DOM elements not found.");
        return;
    }
    loadingContainer.classList.add('hidden');
    signupForm.classList.add('hidden');
    successContainer.classList.add('hidden');
    invalidTokenContainer.classList.add('hidden');

    switch (state) {
        case 'loading':
            loadingContainer.classList.remove('hidden');
            break;
        case 'form':
            signupForm.classList.remove('hidden');
            break;
        case 'success':
            successContainer.classList.remove('hidden');
            break;
        case 'invalid':
            invalidTokenContainer.classList.remove('hidden');
            break;
    }
};

/**
 * (★変更★) URLから招待トークンを検証する
 * (cast-settings.js の openInviteModal で生成されるURLを想定)
 */
const validateInviteToken = async () => {
    try {
        const params = new URLSearchParams(window.location.search);
        // (★修正★) storeId と token を取得
        const storeId = params.get('storeId');
        const token = params.get('token');

        if (!storeId || !token) {
            console.warn("StoreId or Token missing from URL.");
            setSignupState('invalid');
            return;
        }

        // 1. invites コレクションからトークンを検索
        const invitesRef = collection(db, "stores", storeId, "invites");
        // (★修正★) 'token' フィールドでクエリ
        const q = query(invitesRef, where("token", "==", token), where("used", "==", false));
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("Token not found or already used.");
            setSignupState('invalid');
            return;
        }

        const inviteDoc = querySnapshot.docs[0];
        const inviteData = inviteDoc.data();

        // 2. 有効期限をチェック
        // (★修正★) cast-settings.js (L218) は 'expires' を使用
        const expires = new Date(inviteData.expires);
        if (expires < new Date()) {
            console.warn("Token expired.");
            setSignupState('invalid');
            return;
        }

        // 3. トークンが有効
        console.log("Token validated successfully.");
        validStoreId = storeId;
        validInviteTokenId = inviteDoc.id; // (★修正★) 更新用のドキュメントID
        validInviteRole = inviteData.role || 'cast';
        
        setSignupState('form');

    } catch (error) {
        console.error("Error validating token: ", error);
        setSignupState('invalid');
    }
};

/**
 * (★新規★) アカウント登録処理
 */
const handleSignup = async (e) => {
    e.preventDefault();
    if (!validStoreId || !validInviteTokenId) {
        signupError.textContent = "無効なセッションです。ページを再読み込みしてください。";
        return;
    }

    // フォーム入力値を取得
    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    const passwordConfirm = signupPasswordConfirmInput.value;
    const displayName = signupDisplayNameInput.value.trim();
    const realName = signupRealNameInput.value.trim();

    // バリデーション
    if (password !== passwordConfirm) {
        signupError.textContent = "パスワードが一致しません。";
        return;
    }
    if (password.length < 8) {
        signupError.textContent = "パスワードは8文字以上で設定してください。";
        return;
    }
    if (displayName === "" || realName === "" || email === "") {
        signupError.textContent = "すべての必須項目を入力してください。";
        return;
    }

    // 読み込み中表示
    signupError.textContent = '';
    signupBtn.disabled = true;
    signupBtn.textContent = '登録中...';

    try {
        // 1. Firebase Auth でアカウント作成
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. userProfiles ドキュメント作成
        const userProfileRef = doc(db, "userProfiles", user.uid);
        const userProfileData = {
            storeId: validStoreId,
            role: validInviteRole
        };

        // 3. casts ドキュメント作成
        const castsCollectionRef = collection(db, "stores", validStoreId, "casts");
        const castData = {
            authUid: user.uid,
            email: email,
            name: displayName,
            realName: realName,
            role: validInviteRole,
            hireDate: new Date().toISOString().split('T')[0], // (★修正★)
            phone: "",
            address: "",
        };

        // 4. 招待トークンを使用済みに更新
        const inviteRef = doc(db, "stores", validStoreId, "invites", validInviteTokenId);
        const inviteUpdateData = {
            used: true,
            usedByAuthUid: user.uid,
            usedAt: new Date().toISOString()
        };

        // 5. Firestoreに一括書き込み
        await Promise.all([
            setDoc(userProfileRef, userProfileData),
            addDoc(castsCollectionRef, castData), // (★変更★) ID自動生成
            setDoc(inviteRef, inviteUpdateData, { merge: true })
        ]);

        // 6. 成功画面を表示
        console.log("Signup successful!");
        setSignupState('success');
        
        // 5秒後にログインページへ
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 5000);

    } catch (error) {
        // (★新規★) エラーハンドリング
        console.error("Signup error: ", error.code, error.message);
        if (error.code === 'auth/email-already-in-use') {
            signupError.textContent = "このメールアドレスは既に使用されています。";
        } else if (error.code === 'auth/weak-password') {
            signupError.textContent = "パスワードが弱すぎます。8文字以上で設定してください。";
        } else if (error.code === 'auth/invalid-email') {
            signupError.textContent = "有効なメールアドレスを入力してください。";
        } else {
            signupError.textContent = `登録に失敗しました。 (${error.code})`;
        }
        
        signupBtn.disabled = false;
        signupBtn.textContent = '同意して登録する';
    }
};


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // DOM要素の取得
    loadingContainer = document.getElementById('loading-container');
    signupForm = document.getElementById('signup-form');
    successContainer = document.getElementById('success-container');
    invalidTokenContainer = document.getElementById('invalid-token-container');
    
    signupEmailInput = document.getElementById('signup-email');
    signupPasswordInput = document.getElementById('signup-password');
    signupPasswordConfirmInput = document.getElementById('signup-password-confirm');
    signupDisplayNameInput = document.getElementById('signup-display-name');
    signupRealNameInput = document.getElementById('signup-real-name');
    
    signupBtn = document.getElementById('signup-btn');
    signupError = document.getElementById('signup-error');

    // フォーム送信イベント
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // (★新規★) ページ読み込み時にトークンを検証
    validateInviteToken();
});