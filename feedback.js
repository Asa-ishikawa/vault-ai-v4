// ===============================
// 跳び箱AI採点システム Ver5.7
// feedback.js 完成版
// 実測値表示対応
// ===============================


function showFeedback(result) {

    const feedback =
        document.getElementById(
            "feedback"
        );


    if (!feedback) {

        console.warn(
            "feedback要素が見つかりません"
        );

        return;

    }


    if (
        !result ||
        !result.details
    ) {

        feedback.innerHTML =
            "<p>評価結果を取得できませんでした。</p>";

        return;

    }


    const details =
        result.details;


    // ==================================================
    // 安全取得
    // ==================================================

    const knee =
        details.knee || {};

    const hip =
        details.hip || {};

    const hand =
        details.hand || {};

    const takeOff =
        details.takeOff || {};

    const landing =
        details.landing || {};



    // ==================================================
    // 表示用関数
    // ==================================================

    function scoreText(
        score
    ) {

        return (
            Number.isFinite(
                Number(score)
            )
                ? Number(score)
                : 0
        );

    }


    function measuredText(
        value,
        fallback = "-"
    ) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {

            return fallback;

        }

        return value;

    }



    // ==================================================
    // 腰の実測値表示
    // ==================================================

    let hipMeasurement = "";


    if (
        hip.measured !== undefined
    ) {

        hipMeasurement = `
            <div class="ai-measurement">
                <strong>腰上昇量（実測値）</strong>
                <span>${measuredText(hip.measured)}</span>
            </div>

            <div class="ai-threshold">
                <div>0点：${measuredText(hip.threshold0)}</div>
                <div>1点：${measuredText(hip.threshold1)}</div>
                <div>2点：${measuredText(hip.threshold2)}</div>
            </div>
        `;

    }



    // ==================================================
    // 各項目の実測値
    // ==================================================

    const kneeMeasurement =

        knee.measured !== undefined

            ? `
                <div class="ai-measurement">
                    <strong>膝角度（実測値）</strong>
                    <span>${measuredText(knee.measured)}</span>
                </div>
              `
            : "";


    const handMeasurement =

        hand.measured !== undefined

            ? `
                <div class="ai-measurement">
                    <strong>着手位置（実測値）</strong>
                    <span>${measuredText(hand.measured)}</span>
                </div>
              `
            : "";


    const takeOffMeasurement =

        takeOff.measured !== undefined

            ? `
                <div class="ai-measurement">
                    <strong>踏切（実測値）</strong>
                    <span>${measuredText(takeOff.measured)}</span>
                </div>
              `
            : "";


    const landingMeasurement =

        landing.measured !== undefined

            ? `
                <div class="ai-measurement">
                    <strong>着地（実測値）</strong>
                    <span>${measuredText(landing.measured)}</span>
                </div>
              `
            : "";



    // ==================================================
    // HTML生成
    // ==================================================

    feedback.innerHTML = `

        <div class="ai-result">

            <h3>
                AI評価結果
            </h3>


            <h2>
                Dスコア：
                ${Number(result.score).toFixed(1)}点
            </h2>


            <!-- ========================== -->
            <!-- ① 膝 -->
            <!-- ========================== -->

            <div class="ai-item">

                <h3>
                    ① 膝の伸び
                </h3>

                <p>
                    ${knee.text || ""}
                </p>

                <p>
                    評価：
                    <strong>
                        ${scoreText(knee.score)}/2点
                    </strong>
                </p>

                ${kneeMeasurement}

            </div>



            <!-- ========================== -->
            <!-- ② 腰 -->
            <!-- ========================== -->

            <div class="ai-item">

                <h3>
                    ② 腰の位置
                </h3>

                <p>
                    ${hip.text || ""}
                </p>

                <p>
                    評価：
                    <strong>
                        ${scoreText(hip.score)}/2点
                    </strong>
                </p>

                ${hipMeasurement}

            </div>



            <!-- ========================== -->
            <!-- ③ 着手 -->
            <!-- ========================== -->

            <div class="ai-item">

                <h3>
                    ③ 着手位置
                </h3>

                <p>
                    ${hand.text || ""}
                </p>

                <p>
                    評価：
                    <strong>
                        ${scoreText(hand.score)}/2点
                    </strong>
                </p>

                ${handMeasurement}

            </div>



            <!-- ========================== -->
            <!-- ④ 両足踏切 -->
            <!-- ========================== -->

            <div class="ai-item">

                <h3>
                    ④ 両足踏切
                </h3>

                <p>
                    ${takeOff.text || ""}
                </p>

                <p>
                    評価：
                    <strong>
                        ${scoreText(takeOff.score)}/2点
                    </strong>
                </p>

                ${takeOffMeasurement}

            </div>



            <!-- ========================== -->
            <!-- ⑤ 着地 -->
            <!-- ========================== -->

            <div class="ai-item">

                <h3>
                    ⑤ 着地の安定
                </h3>

                <p>
                    ${landing.text || ""}
                </p>

                <p>
                    評価：
                    <strong>
                        ${scoreText(landing.score)}/2点
                    </strong>
                </p>

                ${landingMeasurement}

            </div>



            <!-- ========================== -->
            <!-- 総合コメント -->
            <!-- ========================== -->

            <div class="ai-total-comment">

                <h3>
                    総合コメント
                </h3>

                <p>
                    ${createTotalComment(result)}
                </p>

            </div>

        </div>

    `;

}



// ==================================================
// 総合コメント
// ==================================================

function createTotalComment(result) {

    const score =
        Number(result.score);


    if (
        score >= 9
    ) {

        return "とてもすばらしい動きです。各動作が安定しています。";

    }


    if (
        score >= 7
    ) {

        return "すばらしい動きです。できている部分を維持しながら、さらに安定させましょう。";

    }


    if (
        score >= 5
    ) {

        return "基本的な動きができています。苦手な部分を意識して練習しましょう。";

    }


    return "一つずつポイントを意識して、丁寧に練習しましょう。";

}



// ==================================================
// 公開
// ==================================================

window.showFeedback =
    showFeedback;


console.log(
    "feedback.js Ver5.7 読み込み成功"
);