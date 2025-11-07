// (★新規★) サイドバーコンポーネントをインポート
import { renderSidebar } from './sidebar.js';

// (★新規★) firebase-init.js から必要なモジュールをインポート
import { 
    db, 
    auth, 
    onSnapshot, 
    setDoc, 
    doc,
    collection,
    query,
    where,
    getDocs
} from './firebase-init.js';

// ===== グローバル定数・変数 =====
let settings = null;
let casts = [];
let attendances = []; // (★新規★) 勤怠データ
let currentStoreId = null;
let selectedDate = new Date(); // (★新規★) 選択中の日付

// (★新規★) 参照(Ref)はグローバル変数として保持
let settingsRef, castsCollectionRef, attendancesCollectionRef;


// ===== DOM要素 =====
let pageTitle,
    attendanceDatePicker,
    summaryOnTime, summaryLate, summaryAbsentUnexcused, summaryAbsentExcused,
    attendanceListContainer, attendanceListLoading,
    
    // 編集モーダル
    attendanceEditModal, attendanceEditModalTitle, attendanceEditForm,
    editAttendanceId, editCastId, editDate,
    editCastName, editStatusSelect,
    editClockInTime, editClockOutTime,
    editMemoInput, attendanceEditError, saveAttendanceBtn,
    
    modalCloseBtns;


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
 * ISO文字列またはDateオブジェクトを 'YYYY-MM-DDTHH:MM' 形式の文字列に変換する
 * @param {string | Date} dateInput 
 * @returns {string}
 */
const formatDateTimeLocal = (dateInput) => {
    if (!dateInput) return "";
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return "";
        
        const YYYY = date.getFullYear();
        const MM = String(date.getMonth() + 1).padStart(2, '0');
        const DD = String(date.getDate()).padStart(2, '0');
        const HH = String(date.getHours()).padStart(2, '0');
        const MIN = String(date.getMinutes()).padStart(2, '0');
        return `${YYYY}-${MM}-${DD}T${HH}:${MIN}`;
    } catch (e) {
        return "";
    }
};

/**
 * 営業日付の開始時刻を取得する (dashboard.js から移植)
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
 * (★新規★) ステータスに応じたスタイルを返す
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
 * モーダルを開く
 * @param {HTMLElement} modalElement 
 */
const openModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.add('active');
    }
};

/**
 * モーダルを閉じる
 * @param {HTMLElement} modalElement 
 */
const closeModal = (modalElement) => {
    if (modalElement) {
        modalElement.classList.remove('active');
    }
};

// --- (★新規★) 勤怠管理ロジック ---

/**
 * (★新規★) 勤怠サマリーカードを描画する
 * @param {Array} displayList - renderAttendanceListで生成された表示用リスト
 */
const renderSummaryCards = (displayList) => {
    let onTimeCount = 0;
    let lateCount = 0;
    let absentUnexcusedCount = 0;
    let absentExcusedCount = 0;

    displayList.forEach(item => {
        switch (item.status) {
            case 'clocked_in':
                onTimeCount++;
                break;
            case 'late':
                lateCount++;
                break;
            case 'absent_unexcused':
                absentUnexcusedCount++;
                break;
            case 'absent_excused':
            case 'paid_leave':
                absentExcusedCount++;
                break;
        }
    });

    if (summaryOnTime) summaryOnTime.innerHTML = `${onTimeCount} <span class="text-lg font-medium">名</span>`;
    if (summaryLate) summaryLate.innerHTML = `${lateCount} <span class="text-lg font-medium">名</span>`;
    if (summaryAbsentUnexcused) summaryAbsentUnexcused.innerHTML = `${absentUnexcusedCount} <span class="text-lg font-medium">名</span>`;
    if (summaryAbsentExcused) summaryAbsentExcused.innerHTML = `${absentExcusedCount} <span class="text-lg font-medium">名</span>`;
};

/**
 * (★新規★) 勤怠一覧テーブルを描画する
 */
const renderAttendanceList = () => {
    if (!attendanceListContainer || !casts || !attendances || !settings) {
        return;
    }

    // 1. 選択日の営業日 (YYYY-MM-DD) を取得
    const businessDayStart = getBusinessDayStart(selectedDate);
    const businessDayStr = formatDateISO(businessDayStart);
    
    // 2. キャスト全員のリスト (displayList) を作成
    const displayList = casts.map(cast => {
        // 3. 該当キャストの、該当日の勤怠データを検索
        // (ドキュメントID "YYYY-MM-DD_CAST-ID" で検索)
        const attendanceId = `${businessDayStr}_${cast.id}`;
        const attendanceData = attendances.find(a => a.id === attendanceId);
        
        if (attendanceData) {
            // 勤怠データあり
            return {
                ...attendanceData, // status, clockIn, clockOut, memo...
                castName: cast.name,
                castId: cast.id,
                date: businessDayStr,
                id: attendanceId
            };
        } else {
            // 勤怠データなし (＝未提出)
            return {
                id: attendanceId,
                castId: cast.id,
                castName: cast.name,
                date: businessDayStr,
                status: 'unsubmitted',
                clockIn: null,
                clockOut: null,
                memo: null
            };
        }
    });
    
    // 4. UIを描画
    if (attendanceListLoading) attendanceListLoading.style.display = 'none';
    attendanceListContainer.innerHTML = '';
    
    if (displayList.length === 0) {
        attendanceListContainer.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">
            キャストが登録されていません。「キャスト設定」からキャストを登録してください。
        </td></tr>`;
        return;
    }
    
    displayList.sort((a,b) => a.castName.localeCompare(b.castName));

    displayList.forEach(item => {
        const style = getStatusStyle(item.status);
        
        const clockInStr = item.clockIn ? new Date(item.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-';
        const clockOutStr = item.clockOut ? new Date(item.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-';

        const itemHTML = `
            <tr class="border-b">
                <td class="p-4 font-semibold">${item.castName}</td>
                <td class="p-4">
                    <span class="text-xs font-semibold px-2 py-1 bg-${style.color}-100 text-${style.color}-700 border border-${style.color}-300 rounded-full">${style.text}</span>
                </td>
                <td class="p-4">${clockInStr}</td>
                <td class="p-4">${clockOutStr}</td>
                <td class="p-4 text-xs text-slate-600">${item.memo || ''}</td>
                <td class="p-4 text-right">
                    <button class="attendance-edit-btn text-blue-600 hover:text-blue-800" 
                            data-attendance-id="${item.id}"
                            data-cast-id="${item.castId}"
                            data-cast-name="${item.castName}"
                            data-date="${item.date}"
                            title="編集">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </td>
            </tr>
        `;
        attendanceListContainer.innerHTML += itemHTML;
    });
    
    // 5. サマリーカードを更新
    renderSummaryCards(displayList);
};

/**
 * (★新規★) 勤怠編集モーダルを開く
 * @param {HTMLElement} button - クリックされた編集ボタン
 */
const openAttendanceEditModal = (button) => {
    const { attendanceId, castId, castName, date } = button.dataset;

    // 既存のデータを取得 (なければデフォルト)
    const attendanceData = attendances.find(a => a.id === attendanceId) || {
        status: 'unsubmitted',
        clockIn: null,
        clockOut: null,
        memo: null
    };

    // フォームに値を設定
    if (editAttendanceId) editAttendanceId.value = attendanceId;
    if (editCastId) editCastId.value = castId;
    if (editDate) editDate.value = date;
    
    if (editCastName) editCastName.textContent = castName;
    if (editStatusSelect) editStatusSelect.value = attendanceData.status;
    
    // (★変更★) ISO文字列から datetime-local の値に変換
    if (editClockInTime) editClockInTime.value = formatDateTimeLocal(attendanceData.clockIn);
    if (editClockOutTime) editClockOutTime.value = formatDateTimeLocal(attendanceData.clockOut);
    
    if (editMemoInput) editMemoInput.value = attendanceData.memo || '';
    if (attendanceEditError) attendanceEditError.textContent = '';
    
    openModal(attendanceEditModal);
};

/**
 * (★新規★) 勤怠情報を保存する
 */
const saveAttendance = async () => {
    if (!attendanceEditForm || !attendancesCollectionRef) return;
    
    const attendanceId = editAttendanceId.value; // "YYYY-MM-DD_CAST-ID"
    const castId = editCastId.value;
    const date = editDate.value;
    
    const status = editStatusSelect.value;
    const clockInValue = editClockInTime.value ? new Date(editClockInTime.value).toISOString() : null;
    const clockOutValue = editClockOutTime.value ? new Date(editClockOutTime.value).toISOString() : null;
    const memo = editMemoInput.value.trim();

    if (!attendanceId || !castId || !date) {
        attendanceEditError.textContent = "必須データ（ID, 日付）がありません。";
        return;
    }
    
    const attendanceData = {
        castId: castId,
        date: date,
        status: status,
        clockIn: clockInValue,
        clockOut: clockOutValue,
        memo: memo,
        updatedAt: new Date().toISOString()
    };
    
    try {
        // ドキュメントID (attendanceId) を指定して保存 (新規作成または上書き)
        const docRef = doc(attendancesCollectionRef, attendanceId);
        await setDoc(docRef, attendanceData, { merge: true });
        
        closeModal(attendanceEditModal);
        
    } catch (e) {
        console.error("Error saving attendance: ", e);
        attendanceEditError.textContent = "勤怠データの保存に失敗しました。";
    }
};


// (★新規★) --- Firestore リアルタイムリスナー ---
document.addEventListener('firebaseReady', (e) => {
    
    const { 
        currentStoreId: sId,
        settingsRef: sRef, 
        castsCollectionRef: cRef, 
        attendancesCollectionRef: aRef // (★新規★)
    } = e.detail;

    // グローバル変数に参照をセット
    currentStoreId = sId;
    settingsRef = sRef;
    castsCollectionRef = cRef;
    attendancesCollectionRef = aRef;

    let settingsLoaded = false;
    let castsLoaded = false;
    let attendancesLoaded = false;

    const checkAndRenderAll = () => {
        if (settingsLoaded && castsLoaded && attendancesLoaded) {
            console.log("All data loaded. Rendering UI for attendance.js");
            renderAttendanceList();
        }
    };

    // 1. Settings
    onSnapshot(settingsRef, async (docSnap) => {
        if (docSnap.exists()) {
            settings = docSnap.data();
        } else {
            console.warn("No settings document found.");
            // デフォルト設定
            settings = { dayChangeTime: "05:00" };
        }
        settingsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to settings: ", error));

    // 2. Casts
    onSnapshot(castsCollectionRef, (querySnapshot) => {
        casts = [];
        querySnapshot.forEach((doc) => {
            casts.push({ ...doc.data(), id: doc.id });
        });
        console.log("Casts loaded: ", casts.length);
        castsLoaded = true;
        checkAndRenderAll();
    }, (error) => console.error("Error listening to casts: ", error));

    // 3. Attendances (★新規★)
    // (★注意★) 本来は日付などで絞り込むべきだが、一旦すべて取得
    onSnapshot(attendancesCollectionRef, (querySnapshot) => {
        attendances = [];
        querySnapshot.forEach((doc) => {
            attendances.push({ ...doc.data(), id: doc.id }); 
        });
        console.log("Attendances loaded: ", attendances.length);
        attendancesLoaded = true;
        checkAndRenderAll();
    }, (error) => {
        console.error("Error listening to attendances: ", error);
        attendancesLoaded = true; // エラーでも続行
        checkAndRenderAll();
    });
});


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // (★新規★) サイドバーを描画
    renderSidebar('sidebar-container', 'attendance.html');

    // ===== DOM要素の取得 =====
    pageTitle = document.getElementById('page-title');
    attendanceDatePicker = document.getElementById('attendance-date-picker');
    
    summaryOnTime = document.getElementById('summary-on-time');
    summaryLate = document.getElementById('summary-late');
    summaryAbsentUnexcused = document.getElementById('summary-absent-unexcused');
    summaryAbsentExcused = document.getElementById('summary-absent-excused');
    
    attendanceListContainer = document.getElementById('attendance-list-container');
    attendanceListLoading = document.getElementById('attendance-list-loading');
    
    attendanceEditModal = document.getElementById('attendance-edit-modal');
    attendanceEditModalTitle = document.getElementById('attendance-edit-modal-title');
    attendanceEditForm = document.getElementById('attendance-edit-form');
    
    editAttendanceId = document.getElementById('edit-attendance-id');
    editCastId = document.getElementById('edit-cast-id');
    editDate = document.getElementById('edit-date');
    editCastName = document.getElementById('edit-cast-name');
    editStatusSelect = document.getElementById('edit-status-select');
    editClockInTime = document.getElementById('edit-clock-in-time');
    editClockOutTime = document.getElementById('edit-clock-out-time');
    editMemoInput = document.getElementById('edit-memo-input');
    attendanceEditError = document.getElementById('attendance-edit-error');
    saveAttendanceBtn = document.getElementById('save-attendance-btn');
    
    modalCloseBtns = document.querySelectorAll('.modal-close-btn');

    // ===== 初期化処理 =====
    if (attendanceDatePicker) {
        selectedDate = new Date();
        attendanceDatePicker.value = formatDateISO(selectedDate);
    }
    
    // ===== イベントリスナーの設定 =====

    // (★新規★) 日付ピッカー変更
    if (attendanceDatePicker) {
        attendanceDatePicker.addEventListener('change', (e) => {
            selectedDate = new Date(e.target.value);
            renderAttendanceList();
        });
    }

    // (★新規★) 勤怠一覧のイベント委任 (編集ボタン)
    if (attendanceListContainer) {
        attendanceListContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.attendance-edit-btn');
            if (editBtn) {
                openAttendanceEditModal(editBtn);
            }
        });
    }

    // (★新規★) 編集モーダル保存
    if (attendanceEditForm) {
        attendanceEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveAttendance();
        });
    }

    // (★新規★) モーダルを閉じるボタン (共通)
    if (modalCloseBtns) {
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-backdrop');
                if (modal) {
                    closeModal(modal);
                }
            });
        });
    }
});