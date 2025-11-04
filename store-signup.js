// (★新規★) firebase-init.js から必要なモジュールをインポート
import { 
    db, 
    auth, 
    createUserWithEmailAndPassword, 
    doc, 
    collection, 
    setDoc, 
    addDoc 
} from './firebase-init.js';

// ===== グローバル定数・変数 =====

/**
 * UUIDを生成する (menu.js などからコピー)
 * @returns {string} UUID
 */
const getUUID = () => {
    return crypto.randomUUID();
};

/**
 * (★新規★) デフォルトの店舗設定を生成する
 * (settings.js の getDefaultSettings をベースに、引数を受け取れるよう変更)
 * @param {string} storeName - フォームで入力された店舗名
 * @returns {object}
 */
const getDefaultSettings = (storeName) => {
    return {
        slipTagsMaster: [
            { id: getUUID(), name: '指名' }, { id: getUUID(), name: '初指名' },
            { id: getUUID(), name: '初回' }, { id: getUUID(), name: '枝' },
        ],
        tables: [
            { id: 'T1', status: 'available' }, { id: 'T2', status: 'available' },
            { id: 'V1', status: 'available' }, { id: 'V2', status: 'available' },
        ],
        storeInfo: {
            name: storeName, // (★変更★)
            address: "（未設定）",
            tel: "（未設定）",
            zip: "" 
        },
        rates: { tax: 0.10, service: 0.20 },
        dayChangeTime: "05:00",
        performanceSettings: {
            castPriceCategoryId: null, // (★変更★) menu.js側で設定される
            menuItems: {},
            serviceCharge: { salesType: 'percentage', salesValue: 0 },
            tax: { salesType: 'percentage', salesValue: 0 },
            sideCustomer: { salesValue: 100, countNomination: true }
        },
        ranking: { period: 'monthly', type: 'nominations' }
    };
};

/**
 * (★新規★) デフォルトのメニューを生成する
 * (menu.js の getDefaultMenu をベース)
 * @returns {object}
 */
const getDefaultMenu = () => {
    const catSetId = getUUID();
    const catDrinkId = getUUID();
    const catCastId = getUUID(); 
    
    return {
        categories: [
            { id: catSetId, name: 'セット料金', isSetCategory: true, isCastCategory: false },
            { id: catDrinkId, name: 'ドリンク', isSetCategory: false, isCastCategory: false },
            { id: catCastId, name: 'キャスト料金', isSetCategory: false, isCastCategory: true }, 
        ],
        items: [
            { id: getUUID(), categoryId: catSetId, name: '基本セット (指名)', price: 10000, duration: 60 },
            { id: getUUID(), categoryId: catSetId, name: '基本セット (フリー)', price: 8000, duration: 60 },
            { id: getUUID(), categoryId: catDrinkId, name: 'キャストドリンク', price: 1500, duration: null },
            { id: getUUID(), categoryId: catCastId, name: '本指名料', price: 3000, duration: null }, 
        ],
        currentActiveMenuCategoryId: catSetId,
    };
};


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    
    // DOM要素の取得
    const signupForm = document.getElementById('store-signup-form');
    const storeNameInput = document.getElementById('store-name');
    const adminEmailInput = document.getElementById('admin-email');
    const adminPasswordInput = document.getElementById('admin-password');
    const signupBtn = document.getElementById('signup-btn');
    const signupError = document.getElementById('signup-error');
    const successContainer = document.getElementById('success-container');

    // (★新規★) 店舗登録フォームの送信イベント
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const storeName = storeNameInput.value.trim();
            const email = adminEmailInput.value;
            const password = adminPasswordInput.value;

            if (storeName === "") {
                signupError.textContent = "店舗名を入力してください。";
                return;
            }
            if (password.length < 8) {
                signupError.textContent = "パスワードは8文字以上で設定してください。";
                return;
            }

            // (★新規★) 読み込み中の表示
            signupBtn.disabled = true;
            signupBtn.textContent = '店舗を作成中...';
            signupError.textContent = '';

            try {
                // 1. Firebase Auth で管理者アカウント作成
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const authUid = user.uid;

                // 2. Firestore に 'stores' ドキュメントを新規作成 (IDは自動生成)
                const storeCollectionRef = collection(db, "stores");
                const storeDocRef = await addDoc(storeCollectionRef, {
                    name: storeName,
                    ownerAuthUid: authUid,
                    createdAt: new Date().toISOString()
                });
                const newStoreId = storeDocRef.id;

                // 3. 'userProfiles' に Auth UID と storeId を紐づける
                const userProfileRef = doc(db, "userProfiles", authUid);
                await setDoc(userProfileRef, {
                    storeId: newStoreId,
                    role: "admin"
                });

                // 4. (★重要★) 新しい店舗に必要な初期データを書き込む (プロビジョニング)
                const settingsRef = doc(db, "stores", newStoreId, "settings", "data");
                const menuRef = doc(db, "stores", newStoreId, "menu", "data");
                const slipCounterRef = doc(db, "stores", newStoreId, "counters", "slip");

                // デフォルトデータを生成
                const defaultSettings = getDefaultSettings(storeName);
                const defaultMenu = getDefaultMenu();
                
                // (★新規★) デフォルトメニューの「キャスト料金」カテゴリIDを、settingsに保存
                const castCategory = defaultMenu.categories.find(c => c.isCastCategory === true);
                if (castCategory) {
                    defaultSettings.performanceSettings.castPriceCategoryId = castCategory.id;
                }

                // Firestoreに書き込み
                await Promise.all([
                    setDoc(settingsRef, defaultSettings),
                    setDoc(menuRef, defaultMenu),
                    setDoc(slipCounterRef, { count: 0 })
                ]);

                // 5. 成功画面を表示
                console.log(`New store created. StoreID: ${newStoreId}, AdminUID: ${authUid}`);
                signupForm.classList.add('hidden');
                successContainer.classList.remove('hidden');
                
                // 3秒後に管理者ダッシュボードへ
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 3000);

            } catch (error) {
                // (★新規★) エラーハンドリング
                console.error("Store signup error: ", error.code, error.message);
                if (error.code === 'auth/email-already-in-use') {
                    signupError.textContent = "このメールアドレスは既に使用されています。";
                } else if (error.code === 'auth/weak-password') {
                    signupError.textContent = "パスワードが弱すぎます。8文字以上で設定してください。";
                } else if (error.code === 'auth/invalid-email') {
                    signupError.textContent = "有効なメールアドレスを入力してください。";
                } else {
                    signupError.textContent = `登録に失敗しました。 (${error.code})`;
                }
                
                signupBtn.disabled = false;
                signupBtn.textContent = '店舗を登録する';
            }
        });
    }
});