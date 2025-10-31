// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// Your web app's Firebase configuration (お客様から提供された設定)
const firebaseConfig = {
    apiKey: "AIzaSyAyr7I7_ED0vBZnfRJEJgYWwWGij9iqKOQ",
    authDomain: "nightpos-59cb5.firebaseapp.com",
    projectId: "nightpos-59cb5",
    storageBucket: "nightpos-59cb5.firebasestorage.app",
    messagingSenderId: "532677898283",
    appId: "1:532677898283:web:71ce14ea01024be516fa6e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// (新規) Firestoreのデバッグログを有効にする
setLogLevel('debug');

// アプリ全体で共有する変数
let userId = null;
let stateRef = null; // Firestoreのドキュメント参照を保持する変数

// (削除) 互換性のための getFirebaseServices() 関数を削除
// この関数はレースコンディション（競合状態）を引き起こすため削除します。
// 代わりに 'firebaseReady' イベントを使用します。

// (新規) 認証状態の監視と匿名サインイン
const initializeFirebase = () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // ユーザーがサインイン済み
            console.log("Firebase Auth: User is signed in.", user.uid);
            userId = user.uid;
            // ユーザーIDに基づいてFirestoreのドキュメント参照を設定
            stateRef = doc(db, "state", userId);
            
            // 認証が完了したことを知らせるカスタムイベント
            document.dispatchEvent(new CustomEvent('firebaseReady', { detail: { userId, stateRef, db, auth } })); // (修正) dbとauthも渡す

        } else {
            // ユーザーがサインインしていない -> 匿名でサインイン
            console.log("Firebase Auth: User is signed out. Signing in anonymously...");
            try {
                await signInAnonymously(auth);
                // 成功すると onAuthStateChanged が再度呼び出される
            } catch (error) {
                console.error("Firebase Auth: Anonymous sign-in failed", error);
                // (重要) ここでエラーが発生した場合のUIフィードバック
                document.body.innerHTML = `<div class="p-8 text-center text-red-600">Firebaseへの接続に失敗しました。設定（firebaseConfig）が正しいか、コンソールの「Authentication」で「匿名」が有効になっているか確認してください。</div>`;
            }
        }
    });
};

// --- 初期化実行 ---
initializeFirebase();

// --- 他ファイルへのエクスポート ---
// 他のJSファイル (dashboard.js, tables.js など) はこれらをインポートして使用する
export { 
    db, 
    auth, 
    userId, // (注意) 初期読み込み時は null の可能性がある
    stateRef, // (注意) 初期読み込み時は null の可能性がある
    doc, 
    setDoc, 
    onSnapshot 
};

