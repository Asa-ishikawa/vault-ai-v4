// ===============================
// 跳び箱AI採点システム Ver5.4
// feedback.js
// 評価理由表示・安定化版
// ===============================

function showFeedback(result) {

    const area =
        document.getElementById("feedback");

    if (!area) {

        console.error(
            "feedback表示エリアがありません"
        );

        return;

    }

    if (!result) {

        area.innerHTML =
            "評価データがありません";

        return;

    }

    const details =
        result.details || {};

    let html = "";

    // ----------------------------
    // 総合評価
    // ----------------------------

    html += `
        <h3>🏃 AI評価結果</h3>

        <h2>
            Dスコア：
            ${Number(result.score).toFixed(1)}
        </h2>
    `;

    // ----------------------------
    // 膝
    // ----------------------------

    if (details.knee) {

        html += `
        <div class="feedback-item">

            <h4>🦵 膝の伸び</h4>

            <p>
                ${details.knee.text}
            </p>

            <strong>
                ${details.knee.score}/2点
            </strong>

        </div>
        `;

    }

    // ----------------------------
    // 腰
    // ----------------------------

    if (details.hip) {

        html += `
        <div class="feedback-item">

            <h4>⬆️ 腰の高さ</h4>

            <p>
                ${details.hip.text}
            </p>

            <strong>
                ${details.hip.score}/2点
            </strong>

        </div>
        `;

    }

    // ----------------------------
    // 着手
    // ----------------------------

    if (details.hand) {

        html += `
        <div class="feedback-item">

            <h4>👐 着手位置</h4>

            <p>
                ${details.hand.text}
            </p>

            <strong>
                ${details.hand.score}/2点
            </strong>

        </div>
        `;

    }

    // ----------------------------
    // 踏切
    // ----------------------------

    if (details.takeOff) {

        html += `
        <div class="feedback-item">

            <h4>🚀 両足踏切</h4>

            <p>
                ${details.takeOff.text}
            </p>

            <strong>
                ${details.takeOff.score}/2点
            </strong>

        </div>
        `;

    }

    // ----------------------------
    // 着地
    // ----------------------------

    if (details.landing) {

        html += `
        <div class="feedback-item">

            <h4>🧍 着地</h4>

            <p>
                ${details.landing.text}
            </p>

            <strong>
                ${details.landing.score}/2点
            </strong>

        </div>
        `;

    }

    // ----------------------------
    // 評価のまとめ
    // ----------------------------

    const score =
        Number(result.score);

    let summary = "";

    if (score >= 9) {

        summary =
            "とてもすばらしい動きです！";

    }

    else if (score >= 7) {

        summary =
            "すばらしい動きです。さらに安定させましょう。";

    }

    else if (score >= 5) {

        summary =
            "基本的な動きができています。もうすこし改善できます。";

    }

    else {

        summary =
            "それぞれのポイントを意識して練習しましょう。";

    }

    html += `
        <div class="feedback-summary">

            <h4>📋