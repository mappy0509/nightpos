// (★新規★) 共通サイドバーコンポーネント
import { auth, signOut } from './firebase-init.js';

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
        { href: 'reports.html', icon: 'fa-chart-line', text: '売上分析' },
        { href: 'cast-settings.html', icon: 'fa-users-gear', text: 'キャスト設定' },
        // (★勤怠機能追加★)
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
    return `
        <div class="h-16 flex items-center justify-center border-b px-4">
            <h1 class="text-2xl font-bold text-blue-600">Night POS</h1>
        </div>
        <nav class="flex-grow pt-6 space-y-2">
            ${navLinksHTML}
        </nav>
        <div class="p-4 border-t">
            <div class="flex items-center space-x-3">
                <img src="https://placehold.co/40x40/e0e7ff/4338ca?text=User" alt="User Avatar" class="w-10 h-10 rounded-full">
                <div>
                    <p class="font-semibold text-sm">山田 太郎</p>
                    <p class="text-xs text-slate-500">マネージャー</p>
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
};