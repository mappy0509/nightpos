// (★修正★) firebase/app から initializeApp をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
// (★修正★) firebase/auth から getAuth, onAuthStateChanged などをインポート
import { 
    getAuth, // (★追加★)
    onAuthStateChanged, // (★追加★)
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    collection, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    onSnapshot,
    setLogLevel,
    query,
    where,
    getDoc,
    getDocs,
    serverTimestamp,
    orderBy // (★修正★) orderBy をインポート
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
const auth = getAuth(app); // (★修正★) getAuth(app) を使用

// (新規) Firestoreのデバッグログを有効にする (v9+では setLogLevel をインポートして使用)
// setLogLevel('debug'); // (★コメントアウト★) 必要に応じて有効化

// (★変更★) 
// 認証されたユーザーのストアIDとキャストID（または管理者ロール）を保持する
let currentStoreId = null;
let currentCastId = null; // (★新規★) キャストのFirestoreドキュメントID
let currentAuthUid = null; // (★新規★) Firebase Auth の UID
let currentUserRole = null; // (★新規★) 'admin' or 'cast'

// (★変更★) 認証が完了し、ストアIDが確定してから参照を構築する必要があるため、
// (★変更★) ここでは参照をエクスポートせず、dbとauthのみをエクスポートする。
// (★変更★) 各JSファイルが `firebaseReady` イベントで参照を受け取るように変更する。


// (★新規★) ログインページへのリダイレクト
const redirectToLogin = () => {
    // (★修正★) store-signup.html も例外に追加
    if (!window.location.pathname.endsWith('/login.html') && 
        !window.location.pathname.endsWith('/signup.html') &&
        !window.location.pathname.endsWith('/store-signup.html')) {
        
        console.log("User not authenticated. Redirecting to login.html");
        window.location.href = 'login.html';
    }
};

// (★新規★) 認証状態の監視とストア情報の取得
const initializeFirebase = () => {
    // (★修正★) onAuthStateChanged を使用
    onAuthStateChanged(auth, async (user) => {
        
        // (★修正★) 登録ページ（signup, store-signup）にいる間は、
        // (★修正★) onAuthStateChanged によるプロファイルチェックをスキップする
        // (★修正★) （これらのページがプロファイルを作成する責任を持つため）
        if (user && (window.location.pathname.endsWith('/signup.html') || window.location.pathname.endsWith('/store-signup.html'))) {
            console.log("User is on signup page, skipping profile check...");
            // store-signup.js や signup.js が処理を継続する
            return;
        }

        if (user) {
            // --- ユーザーがサインイン済み (かつ、登録ページにいない) ---
            console.log("Firebase Auth: User is signed in.", user.uid);
            currentAuthUid = user.uid;

            try {
                // (★新規★) 1. userProfiles からストアIDとロールを取得
                const userProfileRef = doc(db, "userProfiles", user.uid);
                const userProfileSnap = await getDoc(userProfileRef);

                if (!userProfileSnap.exists()) {
                    // データベースにプロファイルが存在しない (＝不正な状態)
                    console.error("Auth user exists, but no userProfile found in Firestore. Logging out.");
                    await signOut(auth);
                    redirectToLogin();
                    return;
                }
                
                const userProfile = userProfileSnap.data();
                currentStoreId = userProfile.storeId;
                currentUserRole = userProfile.role;
                
                if (!currentStoreId) {
                     // ストアIDが無い (＝不正な状態)
                    console.error("userProfile found, but no storeId. Logging out.");
                    await signOut(auth);
                    redirectToLogin();
                    return;
                }

                // (★新規★) 2. ロールに応じて admin か cast かを判定
                // let currentCastDocId = null; // (★修正★) この行は不要
                if (currentUserRole === 'cast') {
                    // (★新規★) 3. キャストの場合、Auth UID を使って casts コ_レクションから自分のドキュメントIDを取得
                    const castsQuery = query(collection(db, "stores", currentStoreId, "casts"), where("authUid", "==", user.uid));
                    const querySnapshot = await getDocs(castsQuery);
                    
                    if (querySnapshot.empty) {
                        console.error("userProfile is 'cast', but no matching cast document found in store. Logging out.");
                        await signOut(auth);
                        redirectToLogin();
                        return;
                    }
                    
                    // 該当するキャストドキュメントIDを取得
                    currentCastId = querySnapshot.docs[0].id;
                }

                console.log(`Auth Success: StoreID: ${currentStoreId}, Role: ${currentUserRole}, CastDocID: ${currentCastId || 'N/A'}`);
                
                // (★新規★) 4. 認証とストアID確定後に、動的に参照を構築
                const settingsRef = doc(db, "stores", currentStoreId, "settings", "data");
                const menuRef = doc(db, "stores", currentStoreId, "menu", "data");
                const slipCounterRef = doc(db, "stores", currentStoreId, "counters", "slip");
                const castsCollectionRef = collection(db, "stores", currentStoreId, "casts");
                const customersCollectionRef = collection(db, "stores", currentStoreId, "customers");
                const slipsCollectionRef = collection(db, "stores", currentStoreId, "slips");
                const invitesCollectionRef = collection(db, "stores", currentStoreId, "invites"); 
                const attendancesCollectionRef = collection(db, "stores", currentStoreId, "attendances");
                const inventoryItemsCollectionRef = collection(db, "stores", currentStoreId, "inventoryItems");
                const champagneCallsCollectionRef = collection(db, "stores", currentStoreId, "champagneCalls"); // (★新規★)

                // (★新規★) 5. 認証が完了したことを知らせるカスタムイベント
                document.dispatchEvent(new CustomEvent('firebaseReady', { 
                    detail: { 
                        auth,
                        db,
                        currentAuthUid: user.uid,
                        currentStoreId: currentStoreId,
                        currentUserRole: currentUserRole,
                        currentCastId: currentCastId, // キャストの場合のみセットされる
                        
                        // 動的に構築された参照
                        settingsRef,
                        menuRef,
                        slipCounterRef,
                        castsCollectionRef,
                        customersCollectionRef,
                        slipsCollectionRef,
                        invitesCollectionRef,
                        attendancesCollectionRef,
                        inventoryItemsCollectionRef,
                        champagneCallsCollectionRef, // (★新規★)
                        
                        // (★エラー修正★) Firestore 関数をイベントで渡す
                        query,
                        where,
                        orderBy,
                        collection, // (★修正★) collection も渡す
                        doc // (★修正★) doc も渡す
                    } 
                }));

            } catch (error) {
                console.error("Error fetching user profile:", error);
                redirectToLogin();
            }

        } else {
            // --- ユーザーがサインインしていない ---
            console.log("Firebase Auth: User is signed out.");
            currentAuthUid = null;
            currentStoreId = null;
            currentUserRole = null;
            currentCastId = null;
            redirectToLogin();
        }
    });
};

// --- 初期化実行 ---
initializeFirebase();

// --- 他ファイルへのエクスポート ---
// (★変更★)
// 認証メソッドと、基本的な db, auth のみエクスポート
// (★エラー修正★) query, where, orderBy などを export から削除
export { 
    db, 
    auth, 
    
    // 認証メソッド
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    
    // Firestoreメソッド (★エラー修正★)
    // (★注意★) これらは `firebaseReady` で渡されるが、
    // login.js, signup.js など `firebaseReady` を待たないファイルのために
    // エクスポートも維持する
    doc, 
    collection,
    setDoc, 
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    getDoc,
    getDocs,
    serverTimestamp,
    orderBy
};