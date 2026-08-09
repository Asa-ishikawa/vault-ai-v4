// ===============================
// 跳び箱AI採点システム Ver5.5
// feedback.js
// 評価コメント・評価ランク安定化版
// ===============================

function showFeedback(result) {

    const area =
        document.getElementById("feedback");

    if (!area) {

        console.error(
            "feedback要素が見つかりません"
        );

        return;

    }

    if (!result) {

        area.innerHTML =
            "評価データがありません。";

        return;

    }

    const details =
        result.details || {};

    const score =
        Number(result.score);


    // ============================
    // 評価ランク
    // ============================

    let rank = "";
    let summary = "";

    if (score >= 9) {

        rank = "とてもすばらしい";

        summary =
            "動きがとても安定しています。今の動きを大切にしましょう。";

    }

    else if (score >= 7) {

        rank = "すばらしい";

        summary =
            "基本的な動きができています。さらに安定させると、よりよい跳び方になります。";

    }

    else {

        rank = "もうすこし";

        summary =
            "基本のポイントを一つずつ意識して練習しましょう。";

    }


    // ============================
    // HTML開始
    // ============================

    let html = "";

    html += `
        <div class="ai-feedback">

            <h3>AI評価結果</h3>

            <p>
                <strong>
                    Dスコア：${score.toFixed(1)}点
                </strong>
            </p>

            <p>
                <strong>
                    総合評価：${rank}
                </strong>
            </p>

            <hr>
    `;


    // ============================
    // 膝の伸び
    // ============================

    if (details.knee) {

        html += `
            <div class="feedback-item">

                <h4>① 膝の伸び</h4>

                <p>
                    ${details.knee.text}
                </p>

                <p>
                    評価：
                    <strong>
                        ${details.knee.score}/2点
                    </strong>
                </p>

            </div>
        `;

    }


    // ============================
    // 腰の位置
    // ============================

    if (details.hip) {

        html += `
            <div class="feedback-item">

                <h4>② 腰の位置</h4>

                <p>
                    ${details.hip.text}
                </p>

                <p>
                    評価：
                    <strong>
                        ${details.hip.score}/2点
                    </strong>
                </p>

            </div>
        `;

    }


    // ============================
    // 着手位置
    // ============================

    if (details.hand) {

        html += `
            <div class="feedback-item">

                <h4>③ 着手位置</h4>

                <p>
                    ${details.hand.text}
                </p>

                <p>
                    評価：
                    <strong>
                        ${details.hand.score}/2点
                    </strong>
                </p>

            </div>
        `;

    }


    // ============================
    // 両足踏切
    // ============================

    if (details.takeOff) {

        html += `
            <div class="feedback-item">

                <h4>④ 両足踏切</h4>

                <p>
                    ${details.takeOff.text}
                </p>

                <p>
                    評価：
                    <strong>
                        ${details.takeOff.score}/2点
                    </strong>
                </p>

            </div>
        `;

    }


    // ============================
    // 着地
    // ============================

    if (details.landing) {

        html += `
            <div class="feedback-item">

                <h4>⑤ 着地の安定</h4>

                <p>
                    ${details.landing.text}
                </p>

                <p>
                    評価：
                    <strong>
                        ${details.landing.score}/2点
                    </strong>
                </p>

            </div>
        `;

    }


    // ============================
    // 総合コメント
    // ============================

    html += `

            <hr>

            <div class="feedback-summary">

                <h4>総合コメント</h4>

                <p>
                    ${summary}
                </p>

            </div>

        </div>
    `;


    // ============================
    // 表示
    // ============================

    area.innerHTML = html;


    console.log(
        "feedback.js Ver5.5：表示完了"
    );

}


// ===============================
// 公開
// ===============================

window.showFeedback =
    showFeedback;


console.log(
    "feedback.js Ver5.5 読み込み成功"
);