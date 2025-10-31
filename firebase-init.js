// Firebase v9+ モジュラー SDK をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- グローバル変数の取得 ---

// Firebase設定 (Canvas環境から提供)
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {}; // デフォルトの空オブジェクト

// アプリID (Canvas環境から提供)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 初期認証トークン (Canvas環境から提供)
const initialAuthToken = typeof __initial_auth_token !== 'undefined' 
    ? __initial_auth_token 
    : null;

// --- Firebase の初期化 ---

let app;
let auth;
let db;
let userId = null; // 認証後に設定
let isAuthReady = false; // 認証完了フラグ

// Firestoreのデバッグログを有効化
setLogLevel('Debug');

try {
    // Firebaseアプリを初期化
    app = initializeApp(firebaseConfig);
    // Auth と Firestore のインスタンスを取得
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase initialization error:", e);
}

// --- 認証処理 ---

/**
 * Firebase認証を実行し、ユーザーIDを取得する
 * @returns {Promise<string>} 認証されたユーザーID
 */
const authenticateUser = () => {
    return new Promise((resolve, reject) => {
        // 既に認証済みの場合は、現在のユーザーIDを返す
        if (isAuthReady && userId) {
            resolve(userId);
            return;
        }

        // 認証状態の監視
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // 最初の1回だけ実行
            
            if (user) {
                // 既にログインしている場合
                console.log("User already signed in:", user.uid);
                userId = user.uid;
                isAuthReady = true;
                resolve(userId);
            } else {
                // 未ログインの場合
                try {
                    if (initialAuthToken) {
                        // カスタムトークンで認証
                        console.log("Signing in with custom token...");
                        await signInWithCustomToken(auth, initialAuthToken);
                        userId = auth.currentUser.uid;
                        console.log("Signed in with custom token. UID:", userId);
                    } else {
                        // 匿名認証
                        console.log("Signing in anonymously...");
                        await signInAnonymously(auth);
                        userId = auth.currentUser.uid;
                        console.log("Signed in anonymously. UID:", userId);
                    }
                    isAuthReady = true;
                    resolve(userId);
                } catch (error) {
                    console.error("Firebase sign-in error:", error);
                    isAuthReady = false; // 認証失敗
                    reject(error);
                }
            }
        });
    });
};

// --- エクスポート ---

/**
 * 認証が完了し、db/auth/userId が利用可能になるまで待機する
 * @returns {Promise<{db: object, auth: object, userId: string, appId: string}>}
 */
const getFirebaseServices = async () => {
    if (!isAuthReady || !userId) {
        await authenticateUser();
    }
    if (!db || !auth || !userId) {
        throw new Error("Firebase services are not available.");
    }
    return { db, auth, userId, appId };
};

// db, auth, userId, appId を直接エクスポートすることも可能ですが、
// 認証完了を保証するために getFirebaseServices() 関数経由での利用を推奨します。
export { db, auth, userId, appId, getFirebaseServices };
