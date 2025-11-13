/*
 * (★新規★) Gemini API サービス
 * * このファイルは、Gemini APIとの通信をすべて管理します。
 * * 使い方:
 * 1. Gemini SDKをHTMLファイルでインポートします。
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm"></script>
 * 2. このファイルを <script type="module"> でインポートします。
 * 3. 必要な関数 (例: getUpsellSuggestion) をインポートして使用します。
 */

// Gemini SDKからクライアントをインポート
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm";

// (★重要★) 
// (★修正★) Google AI Studio ( https://aistudio.google.com/ ) で取得した
// (★修正★) APIキーを以下の "YOUR_API_KEY_HERE" と置き換えてください。
const API_KEY = ""; 

// --- 初期設定 ---
let genAI;
let flashModel;
let proModel;
let isInitialized = false;

// 安全設定: コンテンツブロックのしきい値を調整（必要に応じて）
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

/**
 * AIクライアントを初期化する
 */
const initializeAI = () => {
    if (isInitialized) return;
    
    // (★修正★) APIキーがダミーのままでないかチェック
    if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE" || API_KEY === "ここにAPIキーを入力しましょう") {
        console.error("APIキーが ai-service.js に設定されていません。");
        // (★修正★) エラーメッセージをスローして、呼び出し元で検知できるようにする
        throw new Error("APIキーが ai-service.js に設定されていません。");
    }
    
    try {
        genAI = new GoogleGenerativeAI(API_KEY);
        
        // 高速モデル (Flash) の設定
        flashModel = genAI.getGenerativeModel({ 
            model: "gemini-pro", // (★エラー修正★) "models/" プレフィックスを削除
            safetySettings,
            // systemInstruction: "あなたはキャバクラの優秀なボーイ（ウェイター）です。簡潔に、しかし丁寧に応答してください。"
        });
        
        // (★修正★) 高性能モデル (Pro) の設定
        proModel = genAI.getGenerativeModel({ 
            model: "gemini-pro", // (★エラー修正★) "models/" プレフィックスを削除
            safetySettings,
            // systemInstruction: "あなたは優秀な経営コンサルタントです。ナイトレジャー業界のデータに基づいて、具体的で実行可能なアドバイスをください。"
        });
        
        isInitialized = true;
        console.log("AI Service Initialized.");
    } catch (error) {
        console.error("AI Service Initialization Failed: ", error);
        // (★修正★) 初期化失敗時もエラーをスロー
        throw new Error(`AI Service Initialization Failed: ${error.message}`);
    }
};

/**
 * AIモデルにプロンプトを送信する共通関数
 * @param {'flash' | 'pro'} modelType 
 * @param {string} prompt 
 * @returns {Promise<string>} AIからの応答テキスト
 */
const generateText = async (modelType, prompt) => {
    // (★修正★) 初期化処理を try-catch で囲む
    try {
        if (!isInitialized) initializeAI();
    } catch (initError) {
        console.error(initError);
        return initError.message; // "APIキーが設定されていません。" などのエラーを返す
    }
    
    if (!isInitialized) return "AIの初期化に失敗しました。";

    const model = (modelType === 'pro') ? proModel : flashModel;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error(`Error generating ${modelType} content:`, error);
        
        // (★修正★) より具体的なエラーハンドリング
        if (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID')) {
            return "AI APIキーが無効です。ai-service.js を確認してください。";
        }
        if (error.message.includes('quota')) {
            return "AI APIの利用上限に達しました。";
        }
        if (error.message.includes('Safety rating')) {
            return "AIの安全設定により応答がブロックされました。";
        }
        
        return "AIの応答中にエラーが発生しました。";
    }
};

// ===================================
// エクスポートするAI機能
// ===================================

/**
 * (★新規★) オーダー時のアップセル・クロスセル提案を取得
 * @param {object} slipData - 現在の伝票データ
 * @param {object|null} customer - 顧客データ (存在する場合)
 * @param {Array} customerSlips - 該当顧客の過去の伝票
 * @returns {Promise<string|null>} 提案メッセージ (提案がない場合は null)
 */
export const getUpsellSuggestion = async (slipData, customer, customerSlips) => {
    if (!slipData || slipData.items.length === 0) return null;

    const currentItems = slipData.items.map(item => `${item.name} (数量: ${item.qty})`).join(', ');
    const customerName = customer ? customer.name : '新規のお客様';
    
    let history = "なし";
    if (customerSlips && customerSlips.length > 0) {
        history = customerSlips
            .slice(0, 3) // 直近3回分
            .map(slip => 
                slip.items.map(item => item.name).join(', ')
            )
            .join(' / ');
    }

    const prompt = `
あなたはキャバクラの優秀なボーイです。
お客様の現在の注文と過去の注文履歴に基づき、最適なアップセルまたはクロスセルの提案を「1つだけ」「20文字程度で」提案してください。
提案が不要な場合は "null" とだけ返答してください。

# 状況
- お客様: ${customerName}
- 現在の注文: ${currentItems}
- 過去の注文履歴 (直近3回): ${history}

# 指示
提案 (例: 「〇〇もいかがですか？」) または "null"
`;

    try {
        const suggestion = await generateText('flash', prompt);
        
        if (suggestion.toLowerCase().includes('null') || suggestion.trim() === "" || suggestion.includes('APIキー')) {
            return null;
        }
        return suggestion.trim();
    } catch (e) {
        console.error(e);
        return null; // エラー時は何も表示しない
    }
};


/**
 * (★新規★) 顧客へのフォローアップアドバイスを取得
 * @param {object} customer - 顧客データ
 * @param {object} stats - 顧客の統計データ (getLastVisitDateなどで使用)
 * @returns {Promise<string>} アドバイスメッセージ
 */
export const getCustomerFollowUpAdvice = async (customer, stats) => {
    const prompt = `
あなたはプロのキャバクラキャストです。
以下の顧客データに基づき、キャスト（あなた）が今すぐ取るべきアクションを「40文字程度で簡潔に」アドバイスしてください。

# 顧客データ
- 名前: ${customer.name}
- 指名キャスト: ${customer.nominatedCastId ? 'あなた' : 'フリー'}
- 最終来店日: ${stats.lastVisit ? stats.lastVisit.toLocaleDateString('ja-JP') : '履歴なし'}
- 来店回数: ${stats.visitCount} 回
- 総利用額: ${stats.totalSpend.toLocaleString()} 円
- メモ: ${customer.memo || 'なし'}

# 指示
(例: 「そろそろ追いLINEをしましょう」「感謝の連絡を」「次回の誕生日イベントを告知」など)
`;
    // (★修正★) エラー時も考慮
    try {
        const advice = await generateText('flash', prompt);
        if (advice.includes('APIキー') || advice.includes('エラー')) {
            return "AIアドバイスの取得に失敗しました。";
        }
        return advice;
    } catch (e) {
        console.error(e);
        return "AIアドバイスの取得中にエラーが発生しました。";
    }
};


/**
 * (★新規★) AIによる売上分析レポートを生成
 * @param {Array} paidSlips - 期間内の会計済み伝票
 * @param {object} menu - メニューデータ
 * @param {string} periodText - 期間 (例: "日次 (11/11)")
 * @returns {Promise<string>} マークダウン形式のレポート
 */
export const getSalesReport = async (paidSlips, menu, periodText) => {
    // データをAIが読みやすい形式に要約
    const slipSummary = paidSlips.map(slip => ({
        total: slip.paidAmount,
        items: slip.items.map(item => item.name)
    }));
    
    const menuSummary = (menu.items || []).map(item => ({
        name: item.name,
        price: item.price
    }));

    const prompt = `
あなたは優秀なナイトレジャー専門の経営コンサルタントです。
以下の期間中の売上データ（会計済み伝票）とメニューリストを分析し、経営者向けの「エグゼクティブ・サマリー」を作成してください。

# 分析対象期間
${periodText}

# データ
- 会計済み伝票 (要約): ${JSON.stringify(slipSummary)}
- メニューリスト (要約): ${JSON.stringify(menuSummary)}

# 指示
以下の形式で、マークダウン形式のレポートを作成してください。

## 1. 総評
(売上と客単価の傾向について簡潔にコメント)

## 2. 良かった点 (Good)
(データに基づき、好調な点や売れ筋商品を具体的に指摘)

## 3. 課題とネクストアクション (Bad & Next Action)
(データに基づき、課題点（例: 特定のメニューが出ていない、客単価が低いなど）と、それに対する具体的な改善策を提案)
`;

    return await generateText('pro', prompt); // 長文分析なので Pro を使用
};


/**
 * (★新規★) AIによる発注サジェストを生成
 * @param {Array} inventoryItems - 現在の在庫リスト
 * @param {Array} recentSlips - 直近の売上伝票
 * @returns {Promise<string>} マークダウン形式の発注リスト
 */
export const getRestockSuggestion = async (inventoryItems, recentSlips) => {
    // データをAIが読みやすい形式に要約
    const stockSummary = inventoryItems.map(item => ({
        name: item.name,
        stock: item.currentStock,
        unit: item.unit
    }));
    
    // 直近の消費量を計算
    const consumptionMap = new Map();
    recentSlips.forEach(slip => {
        slip.items.forEach(item => {
            consumptionMap.set(item.name, (consumptionMap.get(item.name) || 0) + item.qty);
        });
    });
    const consumptionSummary = Object.fromEntries(consumptionMap);

    const prompt = `
あなたはベテランの店舗マネージャーです。
現在の在庫状況と、直近の消費傾向（伝票データ）を分析し、発注すべき商品のリストを提案してください。

# データ
- 現在の在庫: ${JSON.stringify(stockSummary)}
- 直近の消費傾向 (商品名: 個数): ${JSON.stringify(consumptionSummary)}

# 指示
在庫が少ない、または消費が激しい品目を特定し、発注すべきリストをマークダウンの箇条書きで提案してください。
(例: "- [ ] 焼酎A (在庫: 2本 / 消費: 5本) → 1ケース発注推奨")
`;

    return await generateText('flash', prompt);
};