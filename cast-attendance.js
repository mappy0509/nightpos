// (変更) db, auth, onSnapshot などを 'firebase-init.js' から直接インポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc,
    collection,
    getDoc, // (★新規★)
    signOut // (★新規★)
} from './firebase-init.js';

// ===== グローバル定数・変数 =====
let settings = null;
let castsCollectionRef = null;
let attendancesCollectionRef = null;

let currentCastId = null; 
let currentCastName = "キャスト";

// (★新規★) 今日の勤怠データ
let todaysAttendanceDocRef = null;
let todaysAttendanceData = null;
let businessDayStart = null;
let clockInterval = null;

// ===== DOM要素 =====
let castHeaderName, pageTitle,
    currentBusinessDate, currentTime, attendanceLoading,
    // (★NFC対応★) NFC用UI
    nfcProcessingContainer, nfcFeedback,
    attendanceActions, clockInBtn, clockOutBtn,
    attendanceStatus, statusText, statusClockIn, statusClockOut,
    absentActions, reportAbsenceBtn, absenceFeedback,
    logoutButtonHeader;


// --- (★新規★) ヘルパー関数 ---

/**
 * Dateオブジェクトを 'YYYY-MM-DD' 形式の文字列に変換する
 * @param {Date} date 
 * @returns {string}
 */
const formatDateISO = (date) => {
    return date.toISOString().split('T')[0];
};

/**
 * 営業日付の開始時刻を取得する (attendance.js からコピー)
 * @param {Date} date 対象の日付
 * @returns {Date} 営業開始日時
 */
const getBusinessDayStart = (date) => {
    if (!settings || !settings.dayChangeTime) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }
    
    const [hours, minutes] = settings.dayChangeTime.split(':').map(Number);
    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);
    
    if (date.getTime() < startDate.getTime()) {
        startDate.setDate(startDate.getDate() - 1);
    }
    
    return startDate;
};

/**
 * ステータスに応じたスタイルを返す (attendance.js からコピー)
 * @param {string} status 
 * @returns {object} { text: string, color: string }
 */
const getStatusStyle = (status) => {
    switch (status) {
        case 'clocked_in':
            return { text: '出勤中', color: 'green' };
        case 'clocked_out':
            return { text: '退勤済み', color: 'gray' };
        case 'late':
            return { text: '遅刻', color: 'yellow' };
        case 'absent_unexcused':
            return { text: '欠勤 (無断)', color: 'red' };
        case 'absent_excused':
            return { text: '欠勤 (届出)', color: 'blue' };
        case 'paid_leave':
            return { text: '有給休暇', color: 'purple' };
        case 'unsubmitted':
        default:
            return { text: '未提出', color: 'slate' };
    }
};

/**
 * (★新規★) 現在時刻を --:--:-- 形式で更新する
 */
const updateClock = () => {
    if (!currentTime) return;
    const now = new Date();
    currentTime.textContent = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// --- (★新規★) 勤怠ロジック ---

/**
 * (★新規★) ログインキャストの情報を取得してグローバル変数にセット
 */
const loadCastInfo = async () => {
    if (!currentCastId || !castsCollectionRef) {
        console.warn("Cast ID or collection ref not ready.");
        return;
    }
    
    try {
        const castRef = doc(castsCollectionRef, currentCastId);
        const castSnap = await getDoc(castRef);

        if (castSnap.exists()) {
            currentCastName = castSnap.data().name || "キャスト";
        } else {
            console.warn("Cast document not found in Firestore.");
        }
    } catch (error) {
        console.error("Error fetching cast data: ", error);
    }
    
    // UI（ヘッダー名）に反映
    if (castHeaderName) castHeaderName.textContent = currentCastName;
};

/**
 * (★NFC対応★) 今日の勤怠ステータスに基づいてUIを更新する
 */
const updateUI = () => {
    if (!todaysAttendanceData || !businessDayStart) {
        attendanceLoading.textContent = "勤怠データの取得に失敗しました。";
        return;
    }
    
    // 日付とローディング表示
    currentBusinessDate.textContent = businessDayStart.toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
    attendanceLoading.classList.add('hidden');
    
    const { status, clockIn, clockOut, memo } = todaysAttendanceData;
    const style = getStatusStyle(status);

    // 1. ステータス表示欄
    statusText.textContent = style.text;
    statusText.className = `text-lg font-bold text-${style.color}-600`;
    statusClockIn.textContent = clockIn ? new Date(clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    statusClockOut.textContent = clockOut ? new Date(clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    
    // (★NFC対応★) NFC処理中は手動ボタンを非表示
    if (nfcProcessingContainer && !nfcProcessingContainer.classList.contains('hidden')) {
        attendanceActions.classList.add('hidden');
        attendanceStatus.classList.remove('hidden'); // ステータスは表示
        absentActions.classList.add('hidden');
        return;
    }

    // 2. ボタンとセクションの表示切り替え
    attendanceActions.classList.remove('hidden');
    attendanceStatus.classList.remove('hidden');
    absentActions.classList.remove('hidden');
    
    clockInBtn.classList.add('hidden');
    clockOutBtn.classList.add('hidden');

    switch (status) {
        case 'unsubmitted':
            // 未提出 -> 出勤ボタンと欠勤連絡を表示
            clockInBtn.classList.remove('hidden');
            attendanceStatus.classList.add('hidden'); // ステータス欄は隠す
            break;
            
        case 'clocked_in':
        case 'late':
            // 出勤中/遅刻 -> 退勤ボタンのみ表示
            clockOutBtn.classList.remove('hidden');
            absentActions.classList.add('hidden'); // 欠勤連絡は隠す
            break;
            
        case 'clocked_out':
        case 'absent_unexcused':
        case 'absent_excused':
        case 'paid_leave':
            // 退勤済み/欠勤/休暇 -> ボタンは両方非表示
            absentActions.classList.add('hidden'); // 欠勤連絡は隠す
            break;
    }
};

/**
 * (★新規★) 今日の営業日の勤怠データを読み込む
 */
const loadTodaysAttendance = async () => {
    if (!settings || !currentCastId || !attendancesCollectionRef) {
        console.warn("Cannot load attendance data: Settings or CastID or Ref missing.");
        return;
    }

    // 1. 今日の営業日を計算
    businessDayStart = getBusinessDayStart(new Date());
    const businessDayStr = formatDateISO(businessDayStart);
    
    // 2. 今日の勤怠ドキュメントIDを特定
    const attendanceId = `${businessDayStr}_${currentCastId}`;
    todaysAttendanceDocRef = doc(attendancesCollectionRef, attendanceId);

    // 3. ドキュメントを取得
    try {
        const docSnap = await getDoc(todaysAttendanceDocRef);
        
        if (docSnap.exists()) {
            todaysAttendanceData = docSnap.data();
        } else {
            // データが存在しない ＝ 未提出
            todaysAttendanceData = {
                id: attendanceId,
                castId: currentCastId,
                date: businessDayStr,
                status: 'unsubmitted',
                clockIn: null,
                clockOut: null,
                memo: null
            };
        }
        
        // 4. UIを更新
        updateUI();
        
    } catch (error) {
        console.error("Error fetching today's attendance: ", error);
        attendanceLoading.textContent = "勤怠データの取得に失敗しました。";
    }
};

/**
 * (★NFC対応★) URLをチェックして自動打刻を実行
 */
const handleNfcPunch = async () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('source') || params.get('source') !== 'nfc') {
        // NFC経由でない場合は何もしない
        return;
    }

    // NFC経由の場合
    console.log("NFC punch detected!");

    // 1. UIをNFC処理中モードに変更
    if (attendanceLoading) attendanceLoading.classList.add('hidden');
    if (nfcProcessingContainer) nfcProcessingContainer.classList.remove('hidden');
    if (nfcFeedback) nfcFeedback.textContent = "NFC打刻を処理中...";
    
    // 手動ボタン・欠勤連絡を非表示
    if (attendanceActions) attendanceActions.classList.add('hidden');
    if (absentActions) absentActions.classList.add('hidden');

    // 2. 勤怠データをチェック (todaysAttendanceData は loadTodaysAttendance でセット済み)
    if (!todaysAttendanceData) {
        if (nfcFeedback) nfcFeedback.textContent = "エラー: 勤怠データを取得できませんでした。";
        return;
    }

    // 3. ステータスに応じて処理を振り分け
    const status = todaysAttendanceData.status;

    if (status === 'unsubmitted') {
        // --- 出勤処理 ---
        await handleClockIn('nfc'); // NFC用の処理を呼び出す
    } 
    else if (status === 'clocked_in' || status === 'late') {
        // --- 退勤処理 ---
        await handleClockOut('nfc'); // NFC用の処理を呼び出す
    } 
    else if (status === 'clocked_out') {
        // --- 退勤済み ---
        if (nfcFeedback) nfcFeedback.textContent = "既に退勤済みです。";
    } 
    else {
        // --- 欠勤など ---
        if (nfcFeedback) nfcFeedback.textContent = "本日は欠勤（または休暇）連絡済みです。";
    }
    
    // 4. ステータス欄は表示する
    if (attendanceStatus) attendanceStatus.classList.remove('hidden');
};


/**
 * (★NFC対応★) 出勤打刻処理
 * @param {'manual' | 'nfc'} source 呼び出し元
 */
const handleClockIn = async (source = 'manual') => {
    if (!todaysAttendanceDocRef) return;
    
    if (source === 'manual') {
        clockInBtn.disabled = true;
        clockInBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 処理中...';
    } else {
        if (nfcFeedback) nfcFeedback.textContent = "出勤処理中...";
    }
    
    const now = new Date();
    
    // (※ 本来は「予定出勤時刻 (settings.shiftStartTime)」と比較して
    // (※ `status` を 'clocked_in' か 'late' に振り分けるロジックが必要)
    
    const newStatus = 'clocked_in'; // (★簡易実装★)
    
    const attendanceData = {
        castId: currentCastId,
        date: formatDateISO(businessDayStart),
        status: newStatus,
        clockIn: now.toISOString(),
        clockOut: null,
        memo: source === 'nfc' ? "NFC打刻 (出勤)" : "キャストアプリから打刻",
        updatedAt: now.toISOString()
    };
    
    try {
        await setDoc(todaysAttendanceDocRef, attendanceData, { merge: true });
        // 成功
        todaysAttendanceData = attendanceData; // ローカルを更新
        updateUI(); // UIを更新
        
        if (source === 'nfc') {
            if (nfcFeedback) nfcFeedback.textContent = "出勤打刻が完了しました。";
        }
        
    } catch (error) {
        console.error("Error clocking in: ", error);
        if (source === 'manual') {
            alert("出勤打刻に失敗しました。");
            clockInBtn.disabled = false;
            clockInBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-3"></i> 出勤';
        } else {
            if (nfcFeedback) nfcFeedback.textContent = "エラー: 出勤打刻に失敗しました。";
        }
    }
};

/**
 * (★NFC対応★) 退勤打刻処理
 * @param {'manual' | 'nfc'} source 呼び出し元
 */
const handleClockOut = async (source = 'manual') => {
    if (!todaysAttendanceDocRef) return;
    
    if (source === 'manual') {
        if (!confirm("退勤しますか？\n(※ 退勤後は注文操作などができなくなります)")) {
            return;
        }
        clockOutBtn.disabled = true;
        clockOutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 処理中...';
    } else {
        if (nfcFeedback) nfcFeedback.textContent = "退勤処理中...";
    }
    
    const now = new Date();
    
    const attendanceData = {
        status: 'clocked_out',
        clockOut: now.toISOString(),
        updatedAt: now.toISOString()
    };
    
    try {
        await setDoc(todaysAttendanceDocRef, attendanceData, { merge: true });
        // 成功
        todaysAttendanceData = { ...todaysAttendanceData, ...attendanceData }; // ローカルを更新
        updateUI(); // UIを更新
        
        if (source === 'nfc') {
            if (nfcFeedback) nfcFeedback.textContent = "退勤打刻が完了しました。";
        }

    } catch (error) {
        console.error("Error clocking out: ", error);
        if (source === 'manual') {
            alert("退勤打刻に失敗しました。");
            clockOutBtn.disabled = false;
            clockOutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket mr-3"></i> 退勤';
        } else {
            if (nfcFeedback) nfcFeedback.textContent = "エラー: 退勤打刻に失敗しました。";
        }
    }
};

/**
 * (★新規★) 欠勤連絡処理
 */
const handleReportAbsence = async () => {
    if (!todaysAttendanceDocRef) return;
    
    const reason = prompt("欠勤理由（病欠、私用など）を入力してください。", "私用のため");
    if (reason === null) return; // キャンセル

    reportAbsenceBtn.disabled = true;
    absenceFeedback.textContent = "送信中...";
    absenceFeedback.className = "text-sm text-center text-slate-500";
    
    const now = new Date();
    
    const attendanceData = {
        castId: currentCastId,
        date: formatDateISO(businessDayStart),
        status: 'absent_excused', // 届出欠勤
        clockIn: null,
        clockOut: null,
        memo: reason || "理由未入力 (キャストアプリから連絡)",
        updatedAt: now.toISOString()
    };
    
    try {
        await setDoc(todaysAttendanceDocRef, attendanceData, { merge: true });
        // 成功
        todaysAttendanceData = attendanceData; // ローカルを更新
        updateUI();
        absenceFeedback.textContent = "欠勤連絡を送信しました。";
        absenceFeedback.className = "text-sm text-center text-green-600";
        
    } catch (error) {
        console.error("Error reporting absence: ", error);
        absenceFeedback.textContent = "欠勤連絡に失敗しました。";
        absenceFeedback.className = "text-sm text-center text-red-600";
        reportAbsenceBtn.disabled = false;
    }
};

/**
 * (★新規★) ログアウト処理
 */
const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    
    try {
        await signOut(auth);
        console.log("User signed out.");
        // firebase-init.js が自動で login.html にリダイレクト
    } catch (error) {
        console.error("Sign out error: ", error);
        alert("ログアウトに失敗しました。");
    }
};

// (★変更★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', async (e) => {
    
    const { 
        currentCastId: cId,
        settingsRef: sRef, 
        castsCollectionRef: cRef, 
        attendancesCollectionRef: aRef // (★新規★)
    } = e.detail;
    
    // グローバル変数にセット
    currentCastId = cId;
    settingsRef = sRef;
    castsCollectionRef = cRef;
    attendancesCollectionRef = aRef;

    // 認証直後にまずキャスト名を取得
    await loadCastInfo();

    // Settings の onSnapshot を設定
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found. Using fallback.");
            settings = { dayChangeTime: "05:00" };
        }
        
        // Settings (特に dayChangeTime) 取得後に、勤怠データをロード
        await loadTodaysAttendance();
        
        // (★NFC対応★) 勤怠データロード後にNFC処理を試みる
        await handleNfcPunch();
        
    }, (error) => {
        console.error("Error listening to settings: ", error);
        // エラーでもフォールバック設定で勤怠ロードを試みる
        settings = { dayChangeTime: "05:00" };
        loadTodaysAttendance();
    });
    
    // (★削除★) 他の onSnapshot はこのページでは不要
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // ===== DOM要素の取得 =====
    castHeaderName = document.getElementById('cast-header-name');
    pageTitle = document.getElementById('page-title');
    currentBusinessDate = document.getElementById('current-business-date');
    currentTime = document.getElementById('current-time');
    attendanceLoading = document.getElementById('attendance-loading');
    
    // (★NFC対応★)
    nfcProcessingContainer = document.getElementById('nfc-processing-container');
    nfcFeedback = document.getElementById('nfc-feedback');
    
    attendanceActions = document.getElementById('attendance-actions');
    clockInBtn = document.getElementById('clock-in-btn');
    clockOutBtn = document.getElementById('clock-out-btn');
    attendanceStatus = document.getElementById('attendance-status');
    statusText = document.getElementById('status-text');
    statusClockIn = document.getElementById('status-clock-in');
    statusClockOut = document.getElementById('status-clock-out');
    absentActions = document.getElementById('absent-actions');
    reportAbsenceBtn = document.getElementById('report-absence-btn');
    absenceFeedback = document.getElementById('absence-feedback');
    
    logoutButtonHeader = document.querySelector('header #cast-header-name + button');
    
    // ===== 初期化処理 =====
    updateClock(); // リアルタイム時計を即時実行
    clockInterval = setInterval(updateClock, 1000); // 1秒ごとに更新
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) ログアウトボタン
    if (logoutButtonHeader) {
        logoutButtonHeader.addEventListener('click', handleLogout);
    }
    
    // (★新規★) 出勤ボタン
    if (clockInBtn) {
        clockInBtn.addEventListener('click', () => handleClockIn('manual'));
    }
    
    // (★新規★) 退勤ボタン
    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', () => handleClockOut('manual'));
    }
    
    // (★新規★) 欠勤連絡ボタン
    if (reportAbsenceBtn) {
        reportAbsenceBtn.addEventListener('click', handleReportAbsence);
    }

});