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

// (★NFC対応★) NDEFReader インスタンス
let ndefReader = null;
let isNfcInitialized = false;

// ===== DOM要素 =====
let castHeaderName, pageTitle,
    currentBusinessDate, currentTime, attendanceLoading,
    // (★NFC対応★) NFC用UI
    nfcProcessingContainer, nfcFeedback, nfcIcon,
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
            return { text: '未提出', color: 'slate' }; // (★修正★) 「未出勤」から「未提出」へ文言変更 (UI統一)
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

// --- (★NFC対応★) 勤怠ロジック (Web NFC APIベースに変更) ---

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
 * (★NFC対応★) Web NFC リーダーを初期化し、スキャンを開始する
 */
const initializeNfcReader = async () => {
    if (isNfcInitialized || !('NDEFReader' in window)) {
        // (★NFC対応★) NFC非対応ブラウザの場合、手動ボタンをフォールバック表示
        if (!('NDEFReader' in window)) {
            console.warn("Web NFC is not supported on this browser.");
            if (nfcProcessingContainer) nfcProcessingContainer.classList.add('hidden');
            if (attendanceActions) attendanceActions.classList.remove('hidden');
            if (absentActions) absentActions.classList.remove('hidden');
        }
        return;
    }
    
    // (★NFC対応★) NFC対応ブラウザの場合、NFC UIを表示
    isNfcInitialized = true;
    if (nfcProcessingContainer) nfcProcessingContainer.classList.remove('hidden');
    if (nfcFeedback) nfcFeedback.textContent = "NFCスキャン準備中...";
    if (attendanceActions) attendanceActions.classList.add('hidden');
    if (absentActions) absentActions.classList.add('hidden');

    try {
        ndefReader = new NDEFReader();
        await ndefReader.scan();
        console.log("NFC Reader started.");
        nfcFeedback.textContent = "NFCタグをかざしてください";
        nfcIcon.classList.add('fa-spin'); // スキャン中アニメーション

        ndefReader.addEventListener("readingerror", () => {
            console.error("NFC reading error.");
            nfcFeedback.textContent = "NFCの読み取りに失敗しました";
            nfcIcon.classList.remove('fa-spin');
        });

        ndefReader.addEventListener("reading", ({ serialNumber }) => {
            console.log(`NFC tag detected: ${serialNumber}`);
            handleNfcReading(serialNumber);
        });

    } catch (error) {
        console.error("NFC scan initialization failed: ", error);
        nfcFeedback.textContent = "NFCの起動に失敗しました";
        nfcIcon.classList.remove('fa-spin');
        // (★NFC対応★) NFC起動失敗時は手動ボタンをフォールバック表示
        if (attendanceActions) attendanceActions.classList.remove('hidden');
        if (absentActions) absentActions.classList.remove('hidden');
    }
};

/**
 * (★NFC対応★) 読み取ったNFCシリアル番号を処理する
 * @param {string} serialNumber
 */
const handleNfcReading = (serialNumber) => {
    if (!settings || !settings.nfcTagIds) {
        nfcFeedback.textContent = "店舗設定(NFC)が未ロードです";
        return;
    }
    
    const { clockIn, clockOut } = settings.nfcTagIds;
    
    if (serialNumber === clockIn) {
        // --- 出勤タグ ---
        console.log("Clock-In tag matched.");
        if (todaysAttendanceData.status === 'unsubmitted') {
            handleClockIn('nfc');
        } else if (todaysAttendanceData.status === 'clocked_in' || todaysAttendanceData.status === 'late') {
            nfcFeedback.textContent = "既に出勤済みです";
        } else {
            nfcFeedback.textContent = "出勤できません (退勤/欠勤)";
        }
    } 
    else if (serialNumber === clockOut) {
        // --- 退勤タグ ---
        console.log("Clock-Out tag matched.");
        if (todaysAttendanceData.status === 'clocked_in' || todaysAttendanceData.status === 'late') {
            handleClockOut('nfc');
        } else if (todaysAttendanceData.status === 'clocked_out') {
            nfcFeedback.textContent = "既に退勤済みです";
        } else {
            nfcFeedback.textContent = "先に出勤してください";
        }
    } 
    else {
        // --- 不明なタグ ---
        console.warn(`Unknown NFC tag: ${serialNumber}`);
        nfcFeedback.textContent = "不明なNFCタグです";
    }
    
    // フィードバックメッセージを3秒後にリセット
    setTimeout(() => {
        if (nfcFeedback.textContent !== "NFCタグをかざしてください") {
             nfcFeedback.textContent = "NFCタグをかざしてください";
        }
    }, 3000);
};


/**
 * (★NFC対応★) 今日の勤怠ステータスに基づいてUIを更新する
 */
const updateUI = () => {
    if (!todaysAttendanceData || !businessDayStart) {
        if(attendanceLoading) attendanceLoading.textContent = "勤怠データの取得に失敗しました。";
        return;
    }
    
    // 日付とローディング表示
    currentBusinessDate.textContent = businessDayStart.toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
    attendanceLoading.classList.add('hidden');
    
    const { status, clockIn, clockOut, memo } = todaysAttendanceData;
    const style = getStatusStyle(status);

    // (★★★ 修正点 1 ★★★)
    // 1. ステータス表示欄 (常時表示する)
    attendanceStatus.classList.remove('hidden'); // <-- 常に表示
    statusText.textContent = style.text;
    statusText.className = `text-lg font-bold text-${style.color}-600`;
    statusClockIn.textContent = clockIn ? new Date(clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    statusClockOut.textContent = clockOut ? new Date(clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    
    // (★NFC対応★) NFCが初期化されているかチェック
    if (isNfcInitialized) {
        // NFCモード: 手動ボタンは隠し、NFCとステータスを表示
        attendanceActions.classList.add('hidden');
        absentActions.classList.add('hidden'); // 欠勤連絡も隠す (NFC運用と仮定)
        nfcProcessingContainer.classList.remove('hidden');
        return; // NFCモードではここで終了
    }

    // (★NFC対応★) 以下はNFC非対応ブラウザのフォールバック
    attendanceActions.classList.remove('hidden');
    absentActions.classList.remove('hidden');
    
    clockInBtn.classList.add('hidden');
    clockOutBtn.classList.add('hidden');

    switch (status) {
        case 'unsubmitted':
            // 未提出 -> 出勤ボタンと欠勤連絡を表示
            clockInBtn.classList.remove('hidden');
            // (★★★ 修正点 2 ★★★) 
            // 以前はここでステータス欄を隠していたが、その行を削除
            // attendanceStatus.classList.add('hidden'); // <-- この行を削除
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
 * (★NFC対応★) 今日の営業日の勤怠データを読み込む
 */
const loadTodaysAttendance = async () => {
    if (!settings || !attendancesCollectionRef) {
        console.warn("Cannot load attendance data: Settings or Ref missing.");
        // (★★★ 修正点 3 ★★★)
        // settings がない場合もローディングを停止
        if (attendanceLoading) {
            attendanceLoading.textContent = "店舗設定の読み込みに失敗しました。";
            attendanceLoading.classList.add("text-red-500");
        }
        return; 
    }
    
    // (★★★ 修正点 4 ★★★)
    // currentCastId がない (管理者など) 場合は、エラー表示して停止
    if (!currentCastId) {
        console.error("No currentCastId found. This page is for casts only.");
        if (attendanceLoading) {
            attendanceLoading.textContent = "このページはキャスト専用です。";
            attendanceLoading.classList.add("text-red-500");
        }
        // NFCや手動ボタンも隠す
        if (nfcProcessingContainer) nfcProcessingContainer.classList.add('hidden');
        if (attendanceActions) attendanceActions.classList.add('hidden');
        if (absentActions) absentActions.classList.add('hidden');
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
        
        // 5. (★NFC対応★) 勤怠データ取得後、NFCリーダーを初期化
        initializeNfcReader();
        
    } catch (error) {
        console.error("Error fetching today's attendance: ", error);
        attendanceLoading.textContent = "勤怠データの取得に失敗しました。";
    }
};

/**
 * (★NFC対応★) URLチェック(handleNfcPunch)を削除
 */
// const handleNfcPunch = async () => { ... };


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
        if (nfcIcon) nfcIcon.classList.add('fa-spin');
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
            if (nfcFeedback) nfcFeedback.textContent = "出勤打刻が完了しました";
            if (nfcIcon) nfcIcon.classList.remove('fa-spin');
        }
        
    } catch (error) {
        console.error("Error clocking in: ", error);
        if (source === 'manual') {
            alert("出勤打刻に失敗しました。");
            clockInBtn.disabled = false;
            clockInBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-3"></i> 出勤';
        } else {
            if (nfcFeedback) nfcFeedback.textContent = "エラー: 出勤打刻に失敗";
            if (nfcIcon) nfcIcon.classList.remove('fa-spin');
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
        if (nfcIcon) nfcIcon.classList.add('fa-spin');
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
            if (nfcFeedback) nfcFeedback.textContent = "退勤打刻が完了しました";
            if (nfcIcon) nfcIcon.classList.remove('fa-spin');
        }

    } catch (error) {
        console.error("Error clocking out: ", error);
        if (source === 'manual') {
            alert("退勤打刻に失敗しました。");
            clockOutBtn.disabled = false;
            clockOutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket mr-3"></i> 退勤';
        } else {
            if (nfcFeedback) nfcFeedback.textContent = "エラー: 退勤打刻に失敗";
            if (nfcIcon) nfcIcon.classList.remove('fa-spin');
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
    // (★修正★) currentCastId が存在する場合のみ実行
    if (currentCastId) {
        await loadCastInfo();
    }

    // Settings の onSnapshot を設定
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found. Using fallback.");
            settings = { 
                dayChangeTime: "05:00", 
                nfcTagIds: { clockIn: null, clockOut: null } // (★NFC対応★)
            };
        }
        
        // Settings (特に dayChangeTime) 取得後に、勤怠データをロード
        // (★NFC対応★) loadTodaysAttendance の中で initializeNfcReader が呼ばれる
        await loadTodaysAttendance();
        
    }, (error) => {
        console.error("Error listening to settings: ", error);
        // エラーでもフォールバック設定で勤怠ロードを試みる
        settings = { 
            dayChangeTime: "05:00",
            nfcTagIds: { clockIn: null, clockOut: null } // (★NFC対応★)
        };
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
    nfcIcon = document.getElementById('nfc-icon'); // (★NFC対応★)
    
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
    
    // (★新規★) 出勤ボタン (NFC非対応時のフォールバック)
    if (clockInBtn) {
        clockInBtn.addEventListener('click', () => handleClockIn('manual'));
    }
    
    // (★新規★) 退勤ボタン (NFC非対応時のフォールバック)
    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', () => handleClockOut('manual'));
    }
    
    // (★新規★) 欠勤連絡ボタン (NFC非対応時のフォールバック)
    if (reportAbsenceBtn) {
        reportAbsenceBtn.addEventListener('click', handleReportAbsence);
    }

});