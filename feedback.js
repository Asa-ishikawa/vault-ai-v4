// ============================================================
// 跳び箱AI採点システム Ver6.2
// feedback.js
// 完全版・一発貼り付け
//
// 目的：
// ・score.jsの判定ロジックを変更しない
// ・result.details の実測値を確実に画面へ表示
// ・measured / value / raw の複数形式に対応
// ・0という実測値も正しく表示
// ・着手候補数、選択着手フレームも表示
// ・一部の実測値が取得できなくても他項目を表示
// ============================================================


// ============================================================
// 値を安全に取得する
// ============================================================

function getMeasuredValue(detail) {

    if (!detail) {
        return null;
    }

    // --------------------------------------------------------
    // ① measured
    // --------------------------------------------------------

    if (
        detail.measured !== undefined &&
        detail.measured !== null &&
        detail.measured !== ""
    ) {

        return detail.measured;

    }


    // --------------------------------------------------------
    // ② value
    // --------------------------------------------------------

    if (
        detail.value !== undefined &&
        detail.value !== null &&
        detail.value !== ""
    ) {

        return detail.value;

    }


    // --------------------------------------------------------
    // ③ raw
    // --------------------------------------------------------

    if (
        detail.raw !== undefined &&
        detail.raw !== null &&
        detail.raw !== ""
    ) {

        return detail.raw;

    }


    // --------------------------------------------------------
    // ④ measuredValue
    // --------------------------------------------------------

    if (
        detail.measuredValue !== undefined &&
        detail.measuredValue !== null &&
        detail.measuredValue !== ""
    ) {

        return detail.measuredValue;

    }


    return null;

}


// ============================================================
// 表示用の数値変換
// ============================================================

function formatMeasured(value, digits = 3) {

    // --------------------------------------------------------
    // null / undefined
    // --------------------------------------------------------

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "取得できませんでした";

    }


    // --------------------------------------------------------
    // 数値
    // --------------------------------------------------------

    const num =
        Number(value);


    if (
        Number.isFinite(num)
    ) {

        return num.toFixed(digits);

    }


    // --------------------------------------------------------
    // 数値化できない場合
    // --------------------------------------------------------

    return String(value);

}


// ============================================================
// スコア安全取得
// ============================================================

function getScore(detail) {

    if (!detail) {
        return 0;
    }

    const score =
        Number(detail.score);

    if (
        Number.isFinite(score)
    ) {

        return score;

    }

    return 0;

}


// ============================================================
// テキスト安全取得
// ============================================================

function getText(detail, defaultText) {

    if (
        detail &&
        detail.text !== undefined &&
        detail.text !== null &&
        detail.text !== ""
    ) {

        return String(detail.text);

    }

    return defaultText;

}


// ============================================================
// 着手候補情報を取得
// ============================================================

function getHandCandidateInfo(result) {

    let candidateCount = null;
    let selectedFrame = null;


    // ========================================================
    // result本体
    // ========================================================

    if (result) {

        if (
            result.candidateCount !== undefined &&
            result.candidateCount !== null
        ) {

            candidateCount =
                result.candidateCount;

        }

        if (
            result.selectedFrame !== undefined &&
            result.selectedFrame !== null
        ) {

            selectedFrame =
                result.selectedFrame;

        }

    }


    // ========================================================
    // hand
    // ========================================================

    if (
        result &&
        result.details &&
        result.details.hand
    ) {

        const hand =
            result.details.hand;


        if (
            candidateCount === null &&
            hand.candidateCount !== undefined &&
            hand.candidateCount !== null
        ) {

            candidateCount =
                hand.candidateCount;

        }


        if (
            selectedFrame === null &&
            hand.selectedFrame !== undefined &&
            hand.selectedFrame !== null
        ) {

            selectedFrame =
                hand.selectedFrame;

        }

    }


    // ========================================================
    // phase
    // ========================================================

    if (
        result &&
        result.phase
    ) {

        if (
            selectedFrame === null &&
            result.phase.handContact !== undefined &&
            result.phase.handContact !== null
        ) {

            selectedFrame =
                result.phase.handContact;

        }

    }


    return {

        candidateCount:
            candidateCount,

        selectedFrame:
            selectedFrame

    };

}


// ============================================================
// メイン
// ============================================================

function showFeedback(result) {

    const feedback =
        document.getElementById("feedback");


    // ========================================================
    // feedback要素確認
    // ========================================================

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

        feedback.innerHTML = `
            <p>
                評価結果を取得できませんでした。
            </p>
        `;

        console.error(
            "resultがありません"
        );

        return;

    }


    // ========================================================
    // details確認
    // ========================================================

    const details =
        result.details || {};


    // ========================================================
    // 各項目
    // ========================================================

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


    // ========================================================
    // 実測値取得
    // ========================================================

    const kneeMeasuredRaw =
        getMeasuredValue(knee);

    const hipMeasuredRaw =
        getMeasuredValue(hip);

    const handMeasuredRaw =
        getMeasuredValue(hand);

    const takeOffMeasuredRaw =
        getMeasuredValue(takeOff);

    const landingMeasuredRaw =
        getMeasuredValue(landing);


    // ========================================================
    // 表示値
    // ========================================================

    const kneeMeasured =
        formatMeasured(
            kneeMeasuredRaw,
            1
        );

    const hipMeasured =
        formatMeasured(
            hipMeasuredRaw,
            3
        );

    const handMeasured =
        formatMeasured(
            handMeasuredRaw,
            3
        );

    const takeOffMeasured =
        formatMeasured(
            takeOffMeasuredRaw,
            3
        );

    const landingMeasured =
        formatMeasured(
            landingMeasuredRaw,
            3
        );


    // ========================================================
    // スコア
    // ========================================================

    const kneeScore =
        getScore(knee);

    const hipScore =
        getScore(hip);

    const handScore =
        getScore(hand);

    const takeOffScore =
        getScore(takeOff);

    const landingScore =
        getScore(landing);


    // ========================================================
    // Dスコア
    // ========================================================

    const totalScore =
        Number(result.score);


    const safeTotalScore =
        Number.isFinite(totalScore)
            ? totalScore.toFixed(1)
            : "-";


    // ========================================================
    // 着手候補情報
    // ========================================================

    const handInfo =
        getHandCandidateInfo(result);


    const candidateText =
        handInfo.candidateCount !== null
            ? String(handInfo.candidateCount)
            : "-";


    const selectedFrameText =
        handInfo.selectedFrame !== null
            ? String(handInfo.selectedFrame)
            : "-";


    // ========================================================
    // 実測値診断
    // ========================================================

    console.log(
        "========== 実測値診断 Ver6.2 =========="
    );

    console.log(
        "result:",
        result
    );

    console.log(
        "details:",
        details
    );

    console.log(
        "膝:",
        knee
    );

    console.log(
        "腰:",
        hip
    );

    console.log(
        "着手:",
        hand
    );

    console.log(
        "踏切:",
        takeOff
    );

    console.log(
        "着地:",
        landing
    );

    console.log(
        "膝実測値:",
        kneeMeasuredRaw
    );

    console.log(
        "腰実測値:",
        hipMeasuredRaw
    );

    console.log(
        "着手実測値:",
        handMeasuredRaw
    );

    console.log(
        "踏切実測値:",
        takeOffMeasuredRaw
    );

    console.log(
        "着地実測値:",
        landingMeasuredRaw
    );

    console.log(
        "着手候補数:",
        candidateText
    );

    console.log(
        "選択着手フレーム:",
        selectedFrameText
    );


    // ========================================================
    // HTML
    // ========================================================

    feedback.innerHTML = `

        <h3>AI評価結果</h3>

        <h2>
            Dスコア：
            ${safeTotalScore}点
        </h2>


        <!-- ================================================= -->
        <!-- ① 膝 -->
        <!-- ================================================= -->

        <h3>① 膝の伸び</h3>

        <p>
            ${getText(
                knee,
                "膝の伸びを確認しましょう。"
            )}
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


        <!-- ================================================= -->
        <!-- ② 腰 -->
        <!-- ================================================= -->

        <h3>② 腰の位置</h3>

        <p>
            ${getText(
                hip,
                "腰の位置を確認しましょう。"
            )}
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


        <!-- ================================================= -->
        <!-- ③ 着手 -->
        <!-- ================================================= -->

        <h3>③ 着手位置</h3>

        <p>
            ${getText(
                hand,
                "着手位置を確認しましょう。"
            )}
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
            ${candidateText}
        </p>

        <p>
            <strong>
                選択着手フレーム：
            </strong>
            ${selectedFrameText}
        </p>


        <!-- ================================================= -->
        <!-- ④ 踏切 -->
        <!-- ================================================= -->

        <h3>④ 両足踏切</h3>

        <p>
            ${getText(
                takeOff,
                "踏切の状態を確認しましょう。"
            )}
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


        <!-- ================================================= -->
        <!-- ⑤ 着地 -->
        <!-- ================================================= -->

        <h3>⑤ 着地の安定</h3>

        <p>
            ${getText(
                landing,
                "着地の安定を確認しましょう。"
            )}
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


        <!-- ================================================= -->
        <!-- 総合コメント -->
        <!-- ================================================= -->

        <h3>総合コメント</h3>

        <p>
            ${createTotalComment(result)}
        </p>

    `;

}


// ============================================================
// 総合コメント
// ============================================================

function createTotalComment(result) {

    const score =
        Number(result && result.score);


    if (
        Number.isFinite(score) &&
        score >= 9
    ) {

        return (
            "とてもすばらしい動きです。各動作が安定しています。"
        );

    }


    if (
        Number.isFinite(score) &&
        score >= 7
    ) {

        return (
            "すばらしい動きです。できている部分を維持しながら、さらに安定させましょう。"
        );

    }


    if (
        Number.isFinite(score) &&
        score >= 5
    ) {

        return (
            "基本的な動きができています。苦手な部分を意識して練習しましょう。"
        );

    }


    return (
        "一つずつポイントを意識して、丁寧に練習しましょう。"
    );

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
    "===================================="
);

console.log(
    "feedback.js Ver6.2 読み込み成功"
);

console.log(
    "実測値表示強化版"
);

console.log(
    "===================================="
);