import { 
    setDoc, 
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { 
    auth,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";


let settingsRef;
let invitesCollectionRef;
let currentStoreId;

// ★新規★ シャンパンコール設定用変数
let currentCallBorders = []; // UIで編集中のコールルールリスト

document.addEventListener('firebaseReady', (e) => {
    // Firestore参照の取得
    settingsRef = e.detail.settingsRef;
    invitesCollectionRef = e.detail.invitesCollectionRef;
    currentStoreId = e.detail.currentStoreId;

    // 一般設定フォームのリスナー
    document.getElementById('generalSettingsForm').addEventListener('submit', (e) => saveSettings(e, 'general'));
    
    // キャスト設定フォームのリスナー
    document.getElementById('castSettingsForm').addEventListener('submit', (e) => saveSettings(e, 'cast'));
    document.getElementById('generateInviteLinkBtn').addEventListener('click', generateInviteLink);

    // 在庫設定フォームのリスナー
    document.getElementById('inventorySettingsForm').addEventListener('submit', (e) => saveSettings(e, 'inventory'));

    // (★新規★) コール設定タブのイベントリスナー
    document.getElementById('addCallBorderBtn').addEventListener('click', addCallBorder);
    document.getElementById('saveCallBordersBtn').addEventListener('click', saveCallBorders);

    loadSettings();
});

// 設定の読み込み
const loadSettings = async () => {
    try {
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // --- 一般設定 ---
            document.getElementById('storeName').value = data.storeName || '';
            document.getElementById('taxRate').value = data.taxRate !== undefined ? data.taxRate : 10;
            document.getElementById('serviceChargeRate').value = data.serviceChargeRate !== undefined ? data.serviceChargeRate : 0;
            document.getElementById('cutOffTime').value = data.cutOffTime || '04:00';

            // --- キャスト設定 ---
            document.getElementById('defaultCastRank').value = data.defaultCastRank || 'レギュラー';

            // --- 在庫設定 ---
            document.getElementById('inventoryEnabled').checked = !!data.inventoryEnabled;
            document.getElementById('lowStockThreshold').value = data.lowStockThreshold !== undefined ? data.lowStockThreshold : 5;

            // --- (★新規★) シャンパンコール設定 ---
            if (data.champagneCallBorders) {
                // DBに保存されている円単位の金額を、UI表示用に万円単位 (10000で割る) に変換
                currentCallBorders = data.champagneCallBorders.map(rule => ({
                    ...rule,
                    borderAmount: rule.borderAmount / 10000 // 円 -> 万円
                }));
                // 金額の低い順にソート (UI表示用)
                currentCallBorders.sort((a, b) => a.borderAmount - b.borderAmount);
            } else {
                currentCallBorders = [];
            }
            renderCallBorders();

        } else {
            console.log("No settings document found. Using defaults.");
            // 初期デフォルト値を設定（新規ストア向け）
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
};

// 設定の保存（一般、キャスト、在庫）
const saveSettings = async (event, section) => {
    event.preventDefault();
    const statusDisplay = document.getElementById(`${section}-settings-status`);
    statusDisplay.textContent = '保存中...';
    statusDisplay.className = 'mt-3 text-info';

    try {
        let dataToSave = {};
        
        if (section === 'general') {
            const storeName = document.getElementById('storeName').value.trim();
            const taxRate = parseFloat(document.getElementById('taxRate').value);
            const serviceChargeRate = parseFloat(document.getElementById('serviceChargeRate').value);
            const cutOffTime = document.getElementById('cutOffTime').value;

            dataToSave = {
                storeName,
                taxRate,
                serviceChargeRate,
                cutOffTime
            };
        } else if (section === 'cast') {
            const defaultCastRank = document.getElementById('defaultCastRank').value.trim();
            dataToSave = {
                defaultCastRank
            };
        } else if (section === 'inventory') {
            const inventoryEnabled = document.getElementById('inventoryEnabled').checked;
            const lowStockThreshold = parseInt(document.getElementById('lowStockThreshold').value);

            dataToSave = {
                inventoryEnabled,
                lowStockThreshold: isNaN(lowStockThreshold) ? 5 : lowStockThreshold // デフォルト値
            };
        }

        // settingsドキュメントにマージで更新
        await setDoc(settingsRef, dataToSave, { merge: true });

        statusDisplay.textContent = '設定が保存されました。';
        statusDisplay.className = 'mt-3 text-success';
    } catch (error) {
        console.error(`Error saving ${section} settings:`, error);
        statusDisplay.textContent = `保存に失敗しました: ${error.message}`;
        statusDisplay.className = 'mt-3 text-danger';
    }
};

// (★新規★) コールルールリストのレンダリング
const renderCallBorders = () => {
    const listBody = document.getElementById('call-border-list');
    listBody.innerHTML = '';
    
    if (currentCallBorders.length === 0) {
        document.getElementById('call-list-empty-message').style.display = 'block';
        return;
    }
    document.getElementById('call-list-empty-message').style.display = 'none';

    // 金額の低い順にソートして表示
    currentCallBorders.sort((a, b) => a.borderAmount - b.borderAmount);

    currentCallBorders.forEach((rule, index) => {
        const row = listBody.insertRow();
        
        // 金額ボーダー (万円)
        // toLocaleStringで3桁区切りにする
        row.insertCell().textContent = rule.borderAmount.toLocaleString(); 
        
        // コール名
        row.insertCell().textContent = rule.callName;
        
        // 操作ボタン
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.dataset.index = index;
        deleteBtn.addEventListener('click', removeCallBorder);
        actionCell.appendChild(deleteBtn);
    });
};

// (★新規★) 新しいコールルールを追加
const addCallBorder = (event) => {
    event.preventDefault();
    const callNameInput = document.getElementById('newCallName');
    const callBorderInput = document.getElementById('newCallBorder');
    const errorDisplay = document.getElementById('call-settings-error');
    
    errorDisplay.style.display = 'none';

    const callName = callNameInput.value.trim();
    // 小数点も許可するためparseFloatを使用
    const borderAmount = parseFloat(callBorderInput.value); 

    if (!callName || isNaN(borderAmount) || borderAmount <= 0) {
        errorDisplay.textContent = 'コール名と有効な金額ボーダー（0より大きい数値）を入力してください。';
        errorDisplay.style.display = 'block';
        return;
    }
    
    // 既に同じ金額ボーダーが存在しないかチェック
    if (currentCallBorders.some(rule => rule.borderAmount === borderAmount)) {
        errorDisplay.textContent = `既に${borderAmount.toLocaleString()}万円以上のボーダーが設定されています。`;
        errorDisplay.style.display = 'block';
        return;
    }

    currentCallBorders.push({
        callName: callName,
        borderAmount: borderAmount // 万円単位
    });

    // フォームをクリア
    callNameInput.value = '';
    callBorderInput.value = '';
    
    renderCallBorders();
};

// (★新規★) コールルールを削除
const removeCallBorder = (event) => {
    const indexToRemove = parseInt(event.target.dataset.index);
    if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < currentCallBorders.length) {
        currentCallBorders.splice(indexToRemove, 1);
        renderCallBorders();
    }
};

// (★新規★) シャンパンコール設定をFirestoreに保存
const saveCallBorders = async () => {
    const statusDisplay = document.getElementById('champagne-call-settings-status');
    statusDisplay.textContent = '保存中...';
    statusDisplay.className = 'mt-3 text-info';

    try {
        // Firestoreに保存する前に、万円 -> 円 (10000倍) に戻す
        const dataToSave = currentCallBorders.map(rule => ({
            callName: rule.callName,
            borderAmount: Math.round(rule.borderAmount * 10000) // 万円 -> 円 (丸め処理)
        }));
        
        // 金額の低い順にソートして保存する
        dataToSave.sort((a, b) => a.borderAmount - b.borderAmount);

        // settingsドキュメントにマージで更新
        await setDoc(settingsRef, {
            champagneCallBorders: dataToSave
        }, { merge: true });

        statusDisplay.textContent = 'シャンパンコール設定が保存されました。';
        statusDisplay.className = 'mt-3 text-success';
        
        // 保存後に念のためロードし直す（今回はrenderCallBordersで対応可能だが、ロジックとして堅牢にする）
        loadSettings();

    } catch (error) {
        console.error("Error saving champagne call settings:", error);
        statusDisplay.textContent = `保存に失敗しました: ${error.message}`;
        statusDisplay.className = 'mt-3 text-danger';
    }
};


// 招待リンク生成機能 (既存)
// （Firestoreから招待リンクを発行し、キャストに送信するためのもの）
const generateInviteLink = async () => {
    const linkArea = document.getElementById('inviteLinkArea');
    const linkInput = document.getElementById('inviteLinkInput');
    const expirySpan = document.getElementById('inviteLinkExpiry');
    
    try {
        const docRef = await addDoc(invitesCollectionRef, {
            storeId: currentStoreId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後に期限切れ
            used: false
        });

        const inviteId = docRef.id;
        const inviteLink = `${window.location.origin}/signup.html?inviteId=${inviteId}`;
        
        linkInput.value = inviteLink;
        expirySpan.textContent = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('ja-JP');
        linkArea.style.display = 'block';

    } catch (error) {
        console.error("Error generating invite link:", error);
        alert('招待リンクの生成に失敗しました。');
    }
};

// 招待リンクコピー機能 (既存)
function copyInviteLink() {
    const linkInput = document.getElementById('inviteLinkInput');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Mobile compatibility
    document.execCommand("copy");
    alert("招待リンクがクリップボードにコピーされました！");
}

// ログアウト機能 (既存)
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout failed:", error);
        alert("ログアウトに失敗しました。");
    }
});

// UI helper function (既存)
function updateStatus(elementId, message, isError = false) {
    const statusElement = document.getElementById(elementId);
    statusElement.textContent = message;
    statusElement.className = isError ? 'mt-3 text-danger' : 'mt-3 text-success';
}

// グローバルスコープに関数を公開 (settings.htmlから参照するため)
window.copyInviteLink = copyInviteLink;