// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    doc,
    collection 
} from './firebase-init.js';

// (★新規★) 新しい参照をインポート
import {
    // settingsRef, (★不要★)
    // menuRef, (★不要★)
    castsCollectionRef
    // customersCollectionRef, (★不要★)
    // slipsCollectionRef (★不要★)
} from './firebase-init.js';


// ===== グローバル定数・変数 =====

// (★変更★) state を分割して管理
let casts = [];

// (★新規★) 開発用のログインキャストID (本来は認証情報から取得)
let DEV_CAST_ID = null; 
let DEV_CAST_NAME = "キャスト";

// ===== DOM要素 =====
// (★新規★) cast-app-settings.html に必要なDOM
let castHeaderName, pageTitle,
    castNameInput,
    savePasswordBtn, passwordFeedback,
    logoutButtonHeader, logoutButtonMain;


// --- 関数 ---

// (★削除★) ヘルパー関数は不要

// =================================================
// (★新規★) 設定ページ専用ロジック
// =================================================

/**
 * (★新規★) キャスト情報をフォームに読み込む
 */
const loadCastInfo = () => {
    if (castHeaderName) castHeaderName.textContent = DEV_CAST_NAME;
    if (castNameInput) castNameInput.value = DEV_CAST_NAME;
    
    // (★新規★) 将来的に認証を実装したら、パスワード変更やログアウトを有効化する
    // if (savePasswordBtn) savePasswordBtn.disabled = false;
    // if (logoutButtonHeader) logoutButtonHeader.disabled = false;
    // if (logoutButtonMain) logoutButtonMain.disabled = false;
};

// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    // (★変更★) 必要な参照のみ取得
    const { 
        castsCollectionRef
    } = e.detail;

    // (★変更★) casts のみリッスン
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        
        // (★新規★) 開発用キャストIDを設定
        if (casts.length > 0) {
            DEV_CAST_ID = casts[0].id; 
            DEV_CAST_NAME = casts[0].name;
        } else {
            console.warn("No casts found. Defaulting DEV_CAST_ID to null.");
            DEV_CAST_ID = null;
            DEV_CAST_NAME = "キャスト未登録";
        }
        
        // (★新規★) UIに反映
        loadCastInfo();
        
    }, (error) => console.error("Error listening to casts: ", error));
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    castHeaderName = document.getElementById('cast-header-name');
    pageTitle = document.getElementById('page-title');
    castNameInput = document.getElementById('cast-name-input');
    savePasswordBtn = document.getElementById('save-password-btn');
    passwordFeedback = document.getElementById('password-feedback');
    logoutButtonHeader = document.getElementById('logout-button-header');
    logoutButtonMain = document.getElementById('logout-button-main');
    
    // (削除) 初期化処理は 'firebaseReady' イベントリスナーに移動
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) パスワード変更ボタン (現在は無効)
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // (★将来実装★) パスワード変更ロジック
            if (passwordFeedback) {
                passwordFeedback.textContent = "この機能は現在開発中です。";
                passwordFeedback.className = "text-sm text-center text-blue-600";
            }
        });
    }

    // (★新規★) ログアウトボタン (両方)
    const handleLogout = () => {
        // (★将来実装★) Firebase auth.signOut() などのロジック
        alert("ログアウト機能は現在開発中です。");
    };
    
    if (logoutButtonHeader) {
        logoutButtonHeader.addEventListener('click', handleLogout);
    }
    if (logoutButtonMain) {
        logoutButtonMain.addEventListener('click', handleLogout);
    }

});