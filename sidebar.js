// (★新規★) 共通サイドバーコンポーネント
// (★変更★) db, getDoc, doc をインポート
import { auth, signOut, db, getDoc, doc } from './firebase-init.js';

/**
 * サイドバーのHTMLを生成する
 * @param {string} currentPage - 'index.html', 'tables.html' などのファイル名
 * @returns {string} サイドバーのHTML文字列
 */
const createSidebarHTML = (currentPage) => {
    
    // どのリンクをアクティブにするか定義
    const navLinks = [
        { href: 'index.html', icon: 'fa-chart-pie', text: 'ダッシュボード' },
        { href: 'tables.html', icon: 'fa-border-all', text: 'テーブル管理' },
        { href: 'all-slips.html', icon: 'fa-file-invoice', text: '伝票一覧' },
        { href: 'customers.html', icon: 'fa-users', text: '顧客管理' },
        { href: 'menu.html', icon: 'fa-book-open', text: 'メニュー管理' },
        { href: 'inventory.html', icon: 'fa-boxes-stacked', text: '在庫管理' },
        { href: 'reports.html', icon: 'fa-chart-line', text: '売上分析' },
        { href: 'cast-settings.html', icon: 'fa-users-gear', text: 'キャスト設定' },
        { href: 'attendance.html', icon: 'fa-calendar-check', text: '勤怠管理' },
        { href: 'settings.html', icon: 'fa-gear', text: '店舗設定' },
    ];

    // リンクHTMLを生成
    const navLinksHTML = navLinks.map(link => `
        <a href="${link.href}" class="nav-link ${currentPage === link.href ? 'active' : ''}">
            <i class="fa-solid ${link.icon} fa-fw w-6 text-center"></i>
            <span>${link.text}</span>
        </a>
    `).join('');

    // サイドバー全体のHTML
    // (★レスポンシブ対応★) ロゴ部分のflexコンテナを変更
    return `
        <div class="h-16 flex items-center justify-between border-b px-4">
            <h1 class="text-2xl font-bold text-blue-600">Night POS</h1>
            <button id="sidebar-close-btn" class="lg:hidden text-slate-500 hover:text-slate-800">
                <i class="fa-solid fa-xmark fa-xl"></i>
            </button>
        </div>
        <nav class="flex-grow pt-6 space-y-2">
            ${navLinksHTML}
        </nav>
        <div class="p-4 border-t">
            <div class="flex items-center space-x-3">
                <img src="https://placehold.co/40x40/e0e7ff/4338ca?text=User" alt="User Avatar" class="w-10 h-10 rounded-full">
                <div>
                    <p class="font-semibold text-sm" id="sidebar-user-name">（読み込み中...）</p>
                    <p class="text-xs text-slate-500" id="sidebar-user-role">（...）</p>
                </div>
            </div>
            <button id="sidebar-logout-btn" class="mt-4 w-full text-left text-sm text-slate-600 hover:text-red-600">
                <i class="fa-solid fa-right-from-bracket fa-fw w-6 text-center"></i>
                <span>ログアウト</span>
            </button>
        </div>
    `;
};

/**
 * (★レスポンシブ対応★) サイドバーの表示/非表示を切り替える
 * @param {boolean} [forceClose] - trueなら強制的に閉じる、指定なしならトグル
 */
const toggleSidebar = (forceClose = null) => {
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');
    const body = document.body;
    
    // (★バグ修正★) オーバーレイが見つからなくても早期リターンしない
    if (!sidebar || !body) return;

    const isOpen = body.classList.contains('sidebar-mobile-open');
    
    if (forceClose === true || (forceClose === null && isOpen)) {
        // 閉じる
        body.classList.remove('sidebar-mobile-open');
        sidebar.classList.add('-translate-x-full'); 
        // (★バグ修正★) CSS側で opacity と visibility を制御するため、JSでのクラス操作を削除
    } else if (forceClose === false || (forceClose === null && !isOpen)) {
        // 開く
        body.classList.add('sidebar-mobile-open');
        sidebar.classList.remove('-translate-x-full'); 
        // (★バグ修正★) CSS側で opacity と visibility を制御するため、JSでのクラス操作を削除
    }
};


/**
 * サイドバーを指定されたコンテナに描画し、イベントリスナーを設定する
 * @param {string} containerId - サイドバーを挿入する要素のID (例: 'sidebar-container')
 * @param {string} currentPage - 'index.html' などのファイル名
 */
export const renderSidebar = (containerId, currentPage) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Sidebar container with id "${containerId}" not found.`);
        return;
    }

    // HTMLを挿入
    container.innerHTML = createSidebarHTML(currentPage);
    
    // (★レスポンシブ対応★) 
    // 1. オーバーレイを body (または .flex) に追加
    const mainFlexContainer = container.closest('.flex.h-screen');
    if (mainFlexContainer && !document.getElementById('sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay'; // (★バグ修正★) IDを設定
        // (★バグ修正★) className の設定を削除 (style.css の #sidebar-overlay を参照させる)
        mainFlexContainer.appendChild(overlay);

        // オーバーレイクリックで閉じる
        overlay.addEventListener('click', () => toggleSidebar(true));
    }

    // (★レスポンシブ対応★) 
    // 2. ヘッダーのトグルボタンを取得 (これは各HTMLに記述が必要)
    //    (HTML側で <header> 内に <button id="sidebar-toggle-btn" ...> が追加される想定)
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(false));
    }

    // (★レスポンシブ対応★) 
    // 3. サイドバー内部の閉じるボタン
    const closeBtn = document.getElementById('sidebar-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleSidebar(true));
    }

    // (★レスポンシブ対応★) 
    // 4. ナビリンククリックで閉じる (スマホ時のみ)
    container.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            // (★修正★) ページ遷移を伴うため、すぐに閉じるとちらつく可能性。
            // (★修正★) 基本的にページ遷移で閉じるので不要かもしれないが、
            // (★修正★) 将来的にSPA化した場合のために残す
            if (window.innerWidth < 1024) { // lg breakpoint
                // リンク遷移を妨げないように、クリックイベントのデフォルト動作を止めない
            }
        });
    });


    // ログアウトボタンにイベントリスナーを設定
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("ログアウトしますか？")) {
                try {
                    await signOut(auth);
                    // ログアウト成功時、firebase-init.js が login.html へリダイレクト
                } catch (error) {
                    console.error("Sign out error: ", error);
                }
            }
        });
    }

    // (★動的表示 追加★)
    // 認証情報が読み込まれたら、ユーザー名を更新する
    // (※ firebase-init.js が先に読み込まれ、イベントが発火する前提)
    document.addEventListener('firebaseReady', async (e) => {
        const { auth, db, currentUserRole, currentCastId, castsCollectionRef } = e.detail;
        
        const userNameEl = document.getElementById('sidebar-user-name');
        const userRoleEl = document.getElementById('sidebar-user-role');

        if (!userNameEl || !userRoleEl) return;

        try {
            if (currentUserRole === 'admin') {
                userRoleEl.textContent = '管理者';
                // 管理者の名前は Auth の Email を使う (登録時に名前を入力しないため)
                if (auth.currentUser) {
                    userNameEl.textContent = auth.currentUser.email;
                } else {
                    userNameEl.textContent = '管理者ユーザー';
                }
            } else if (currentUserRole === 'cast' && currentCastId && castsCollectionRef) {
                userRoleEl.textContent = 'キャスト';
                // Castsコレクションから名前を取得
                const castRef = doc(castsCollectionRef, currentCastId);
                const castSnap = await getDoc(castRef);
                if (castSnap.exists()) {
                    userNameEl.textContent = castSnap.data().name || auth.currentUser.email;
                } else {
                    userNameEl.textContent = auth.currentUser.email || 'キャスト';
                }
            } else {
                userNameEl.textContent = 'ゲスト';
                userRoleEl.textContent = '不明';
            }
        } catch (error) {
            console.error("Error fetching user name for sidebar: ", error);
            userNameEl.textContent = (auth.currentUser && auth.currentUser.email) ? auth.currentUser.email : 'エラー';
        }
    });
};