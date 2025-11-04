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
    collection, // (★新規★)
    setDoc, 
    addDoc, // (★新規★)
    deleteDoc, // (★新規★)
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
// (★削除★) stateRef は廃止
// let stateRef = null; 

// (★新規★) マルチテナント用の設定
// 開発中は 'devStore' に固定することで、匿名認証IDが変わってもデータを維持します。
// 本番環境では、ここはログインユーザーに紐づく店舗IDに動的に切り替えます。
const storeId = "devStore"; 

// (★新規★) 新しいデータ構造への参照
const storeRef = doc(db, "stores", storeId);
const settingsRef = doc(db, "stores", storeId, "settings", "data");
const menuRef = doc(db, "stores", storeId, "menu", "data");
const slipCounterRef = doc(db, "stores", storeId, "counters", "slip");

const castsCollectionRef = collection(db, "stores", storeId, "casts");
const customersCollectionRef = collection(db, "stores", storeId, "customers");
const slipsCollectionRef = collection(db, "stores", storeId, "slips");


// (新規) 認証状態の監視と匿名サインイン
const initializeFirebase = () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // ユーザーがサインイン済み
            console.log("Firebase Auth: User is signed in.", user.uid);
            userId = user.uid;
            // (★削除★) stateRef の設定ロジックを削除
            
            // 認証が完了したことを知らせるカスタムイベント
            // (★変更★) 新しい参照を detail に追加
            document.dispatchEvent(new CustomEvent('firebaseReady', { 
                detail: { 
                    userId, 
                    storeId,
                    db, 
                    auth,
                    settingsRef,
                    menuRef,
                    slipCounterRef,
                    castsCollectionRef,
                    customersCollectionRef,
                    slipsCollectionRef
                } 
            }));

        } else {
            // ユーザーがサインインしていない -> 匿名でサインイン
            console.log("Firebase Auth: User is signed out. Signing in anonymously...");
            try {
                await signInAnonymously(auth);
                // 成功すると onAuthStateChanged が再度呼び出される
            } catch (error) {
                console.error("Firebase Auth: Anonymous sign-in failed", error);
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
    storeId, // (★新規★)
    
    // (★新規★) 新しい参照
    settingsRef,
    menuRef,
    slipCounterRef,
    castsCollectionRef,
    customersCollectionRef,
    slipsCollectionRef,
    
    // (★変更★) Firestoreメソッド
    doc, 
    collection,
    setDoc, 
    addDoc,
    deleteDoc,
    onSnapshot 
};