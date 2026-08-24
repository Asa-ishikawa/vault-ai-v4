// ============================================================
// 跳び箱AI採点システム
// feedback.js 改良版
//
// score.js 改良版対応
// 「評価結果を取得できませんでした」修正版
// ============================================================


function showFeedback(result) {

    const feedback =
        document.getElementById("feedback");


    if (!feedback) {

        console.error(
            "feedback要素が見つかりません"
        );

        return;

    }


    // ========================================================
    // result確認
    // ========================================================

    if (!result) {

        feedback.innerHTML =
            "評価結果を取得できませんでした。";

        console.error(
            "feedback.js：resultがありません"
        );

        return;

    }


    console.log(
        "feedback.js 受信result:",
        result
    );


    // ========================================================
    // 安全取得関数
    // ========================================================

    function safeScore(value) {

        const n =
            Number(value);

        if (
            !Number.isFinite(n)
        ) {

            return 0;

        }

        return n;

    }


    function safeValue(
        value,
        digits = 3
    ) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {

            return "取得できませんでした";

        }


        const n =
            Number(value);


        if (
            Number.isFinite(n)
        ) {

            return n.toFixed(digits);

        }


        return String(value);

    }


    function safeText(
        value,
        defaultText
    ) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {

            return defaultText;

        }


        return String(value);

    }


    // ========================================================
    // Dスコア
    // ========================================================

    const dScore =
        safeScore(
            result.score
        );


    // ========================================================
    // 各項目
    //
    // score.js 改良版では
    //
    // takeOffScore
    // handScore
    // hipScore
    // kneeScore
    // landingScore
    //
    // となっている。
    // ========================================================

    const takeOffScore =
        safeScore(
            result.takeOffScore
        );


    const handScore =
        safeScore(
            result.handScore
        );


    const hipScore =
        safeScore(
            result.hipScore
        );


    const kneeScore =
        safeScore(
            result.kneeScore
        );


    const landingScore =
        safeScore(
            result.landingScore
        );


    // ========================================================
    // 実測値
    // ========================================================

    const handMeasured =
        safeValue(
            result.handMeasured,
            3
        );


    const hipMeasured =
        safeValue(
            result.hipMeasured,
            3
        );


    const kneeMeasured =
        safeValue(
            result.kneeMeasured,
            1
        );


    const landingMeasured =
        safeValue(
            result.landingMeasured,
            3
        );


    const takeOffMeasured =
        safeValue(
            result.takeOffMeasured,
            3
        );


    // ========================================================
    // コメント
    // ========================================================

    const takeOffText =
        safeText(
            result.takeOffText,
            "踏切の状態を確認しましょう。"
        );


    const handText =
        safeText(
            result.handText,
            "着手位置を確認しましょう。"
        );


    const hipText =
        safeText(
            result.hipText,
            "腰の位置を確認しましょう。"
        );


    const kneeText =
        safeText(
            result.kneeText,
            "膝の伸びを確認しましょう。"
        );


    const landingText =
        safeText(
            result.landingText,
            "着地の安定を確認しましょう。"
        );


    // ========================================================
    // 着手フレーム情報
    // ========================================================

    const handContactFrame =
        Number.isFinite(
            Number(
                result.handContactFrame
            )
        )
            ? result.handContactFrame
            : "-";


    const candidateCount =
        Number.isFinite(
            Number(
                result.candidateCount
            )
        )
            ? result.candidateCount
            : 0;


    // ========================================================
    // HTML表示
    // ========================================================

    feedback.innerHTML = `

        <h3>AI評価結果</h3>

        <h2>
            Dスコア：
            ${dScore.toFixed(1)}点
        </h2>


        <!-- ================================================ -->
        <!-- ① 膝 -->
        <!-- ================================================ -->

        <h3>① 膝の伸び</h3>

        <p>
            ${kneeText}
        </p>

        <p>
            評価：
            <strong>
                ${kneeScore}/2点
            </strong>
        </p>

        <p>
            <strong>
                膝角度（実測値）：
            </strong>

            ${kneeMeasured}°
        </p>


        <!-- ================================================ -->
        <!-- ② 腰 -->
        <!-- ================================================ -->

        <h3>② 腰の位置</h3>

        <p>
            ${hipText}
        </p>

        <p>
            評価：
            <strong>
                ${hipScore}/2点
            </strong>
        </p>

        <p>
            <strong>
                腰位置（実測値）：
            </strong>

            ${hipMeasured}
        </p>


        <!-- ================================================ -->
        <!-- ③ 着手 -->
        <!-- ================================================ -->

        <h3>③ 着手位置</h3>

        <p>
            ${handText}
        </p>

        <p>
            評価：
            <strong>
                ${handScore}/2点
            </strong>
        </p>

        <p>
            <strong>
                着手位置（実測値）：
            </strong>

            ${handMeasured}
        </p>

        <p>
            <strong>
                着手候補数：
            </strong>

            ${candidateCount}
        </p>

        <p>
            <strong>
                選択着手フレーム：
            </strong>

            ${handContactFrame}
        </p>


        <!-- ================================================ -->
        <!-- ④ 両足踏切 -->
        <!-- ================================================ -->

        <h3>④ 両足踏切</h3>

        <p>
            ${takeOffText}
        </p>

        <p>
            評価：
            <strong>
                ${takeOffScore}/2点
            </strong>
        </p>

        <p>
            <strong>
                踏切（実測値）：
            </strong>

            ${takeOffMeasured}
        </p>


        <!-- ================================================ -->
        <!-- ⑤ 着地 -->
        <!-- ================================================ -->

        <h3>⑤ 着地の安定</h3>

        <p>
            ${landingText}
        </p>

        <p>
            評価：
            <strong>
                ${landingScore}/2点
            </strong>
        </p>

        <p>
            <strong>
                着地（実測値）：
            </strong>

            ${landingMeasured}
        </p>


        <!-- ================================================ -->
        <!-- 総合コメント -->
        <!-- ================================================ -->

        <h3>総合コメント</h3>

        <p>
            ${createTotalComment(result)}
        </p>

    `;


    // ========================================================
    // コンソール
    // ========================================================

    console.log(
        "======================================"
    );

    console.log(
        "FEEDBACK 改良版"
    );

    console.log(
        "Dスコア：",
        dScore
    );

    console.log(
        "踏切：",
        takeOffScore
    );

    console.log(
        "着手：",
        handScore,
        "実測値：",
        result.handMeasured
    );

    console.log(
        "腰：",
        hipScore,
        "実測値：",
        result.hipMeasured
    );

    console.log(
        "膝：",
        kneeScore,
        "実測値：",
        result.kneeMeasured
    );

    console.log(
        "着地：",
        landingScore,
        "実測値：",
        result.landingMeasured
    );

    console.log(
        "着手候補数：",
        candidateCount
    );

    console.log(
        "選択着手フレーム：",
        handContactFrame
    );

    console.log(
        "======================================"
    );

}


// ============================================================
// 総合コメント
// ============================================================

function createTotalComment(
    result
) {

    const score =
        Number(result.score);


    if (
        !Number.isFinite(score)
    ) {

        return "評価結果を確認してください。";

    }


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


// ============================================================
// 公開
// ============================================================

window.showFeedback =
    showFeedback;

window.createTotalComment =
    createTotalComment;


// ============================================================
// 読み込み確認
// ============================================================

console.log(
    "feedback.js 改良版 読み込み成功"
);