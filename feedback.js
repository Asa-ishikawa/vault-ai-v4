// ===============================
// 跳び箱AI採点システム Ver5.8
// feedback.js
// 実測値表示・安定版
// ===============================

function showFeedback(result) {

    const feedback =
        document.getElementById("feedback");

    if (!feedback) {

        console.error(
            "feedback要素が見つかりません"
        );

        return;
    }

    if (
        !result ||
        !result.details
    ) {

        feedback.innerHTML =
            "評価結果を取得できませんでした。";

        return;
    }


    // ===============================
    // 各評価データ
    // ===============================

    const knee =
        result.details.knee || {};

    const hip =
        result.details.hip || {};

    const hand =
        result.details.hand || {};

    const takeOff =
        result.details.takeOff || {};

    const landing =
        result.details.landing || {};


    // ===============================
    // 実測値を安全に表示
    // ===============================

    function valueText(value) {

        if (
            value === undefined ||
            value === null
        ) {

            return "取得できませんでした";

        }

        return String(value);

    }


    // ===============================
    // 腰の実測値
    // ===============================

    const hipMeasured =
        hip.measured !== undefined
            ? hip.measured
            : hip.value !== undefined
                ? Number(hip.value).toFixed(3)
                : "取得できませんでした";


    // ===============================
    // 膝の実測値
    // ===============================

    const kneeMeasured =
        knee.measured !== undefined
            ? knee.measured
            : knee.value !== undefined
                ? Number(knee.value).toFixed(1) + "°"
                : "取得できませんでした";


    // ===============================
    // 着手の実測値
    // ===============================

    const handMeasured =
        hand.measured !== undefined
            ? hand.measured
            : hand.value !== undefined
                ? Number(hand.value).toFixed(3)
                : "取得できませんでした";


    // ===============================
    // 踏切の実測値
    // ===============================

    const takeOffMeasured =
        takeOff.measured !== undefined
            ? takeOff.measured
            : takeOff.value !== undefined
                ? Number(takeOff.value).toFixed(3)
                : "取得できませんでした";


    // ===============================
    // 着地の実測値
    // ===============================

    const landingMeasured =
        landing.measured !== undefined
            ? landing.measured
            : landing.value !== undefined
                ? Number(landing.value).toFixed(3)
                : "取得できませんでした";


    // ===============================
    // HTML生成
    // ===============================

    feedback.innerHTML = `

        <h3>AI評価結果</h3>

        <h2>
            Dスコア：
            ${Number(result.score).toFixed(1)}点
        </h2>


        <!-- ================= -->
        <!-- ① 膝 -->
        <!-- ================= -->

        <h3>① 膝の伸び</h3>

        <p>
            ${valueText(knee.text)}
        </p>

        <p>
            評価：
            <strong>
                ${Number(knee.score) || 0}/2点
            </strong>
        </p>

        <p>
            <strong>膝角度（実測値）：</strong>
            ${kneeMeasured}
        </p>


        <!-- ================= -->
        <!-- ② 腰 -->
        <!-- ================= -->

        <h3>② 腰の位置</h3>

        <p>
            ${valueText(hip.text)}
        </p>

        <p>
            評価：
            <strong>
                ${Number(hip.score) || 0}/2点
            </strong>
        </p>

        <p>
            <strong>
                腰上昇量（実測値）：
            </strong>
            ${hipMeasured}
        </p>

        <p>
            <strong>現在の判定基準</strong><br>

            0点：
            ${valueText(hip.threshold0)}
            <br>

            1点：
            ${valueText(hip.threshold1)}
            <br>

            2点：
            ${valueText(hip.threshold2)}
        </p>


        <!-- ================= -->
        <!-- ③ 着手 -->
        <!-- ================= -->

        <h3>③ 着手位置</h3>

        <p>
            ${valueText(hand.text)}
        </p>

        <p>
            評価：
            <strong>
                ${Number(hand.score) || 0}/2点
            </strong>
        </p>

        <p>
            <strong>
                着手位置（実測値）：
            </strong>
            ${handMeasured}
        </p>


        <!-- ================= -->
        <!-- ④ 踏切 -->
        <!-- ================= -->

        <h3>④ 両足踏切</h3>

        <p>
            ${valueText(takeOff.text)}
        </p>

        <p>
            評価：
            <strong>
                ${Number(takeOff.score) || 0}/2点
            </strong>
        </p>

        <p>
            <strong>
                踏切（実測値）：
            </strong>
            ${takeOffMeasured}
        </p>


        <!-- ================= -->
        <!-- ⑤ 着地 -->
        <!-- ================= -->

        <h3>⑤ 着地の安定</h3>

        <p>
            ${valueText(landing.text)}
        </p>

        <p>
            評価：
            <strong>
                ${Number(landing.score) || 0}/2点
            </strong>
        </p>

        <p>
            <strong>
                着地（実測値）：
            </strong>
            ${landingMeasured}
        </p>


        <!-- ================= -->
        <!-- 総合コメント -->
        <!-- ================= -->

        <h3>総合コメント</h3>

        <p>
            ${createTotalComment(result)}
        </p>

    `;


    // ===============================
    // コンソール確認
    // ===============================

    console.log(
        "========== FEEDBACK Ver5.8 =========="
    );

    console.log(
        "Dスコア:",
        result.score
    );

    console.log(
        "膝実測値:",
        kneeMeasured
    );

    console.log(
        "腰実測値:",
        hipMeasured
    );

    console.log(
        "着手実測値:",
        handMeasured
    );

    console.log(
        "踏切実測値:",
        takeOffMeasured
    );

    console.log(
        "着地実測値:",
        landingMeasured
    );

}


// ===============================
// 総合コメント
// ===============================

function createTotalComment(result) {

    const score =
        Number(result.score);


    if (score >= 9) {

        return "とてもすばらしい動きです。各動作が安定しています。";

    }


    if (score >= 7) {

        return "すばらしい動きです。できている部分を維持しながら、さらに安定させましょう。";

    }


    if (score >= 5) {

        return "基本的な動きができています。苦手な部分を意識して練習しましょう。";

    }


    return "一つずつポイントを意識して、丁寧に練習しましょう。";

}


// ===============================
// 公開
// ===============================

window.showFeedback =
    showFeedback;


console.log(
    "feedback.js Ver5.8 読み込み成功"
);