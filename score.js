// ============================================================
// 跳び箱AI採点システム
// score.js Ver6.0
// ============================================================
// 今回の改良ポイント
// ★ 踏切判定だけを改良
//
// ・膝、腰、着手、着地の基本ロジックは維持
// ・踏切周辺を複数フレームで評価
// ・一瞬の骨格検出ズレを軽減
// ・左右足の離地タイミングを比較
// ・踏切実測値を表示
// ・既存の phase.js / app.js / feedback.js と互換
// ============================================================


// ============================================================
// メイン採点
// ============================================================

function calculateDScore(frames, phase) {

    console.log("================================");
    console.log("score.js Ver6.0 採点開始");
    console.log("================================");


    // --------------------------------------------------------
    // データ確認
    // --------------------------------------------------------

    if (!frames || frames.length < 10) {

        console.error(
            "score.js：フレーム不足",
            frames ? frames.length : 0
        );

        return null;
    }


    if (!phase) {

        console.error(
            "score.js：phaseがありません"
        );

        return null;
    }


    // ========================================================
    // ① 膝
    // ========================================================

    let kneeResult =
        calculateKnee(frames, phase);


    // ========================================================
    // ② 腰
    // ========================================================

    let hipResult =
        calculateHip(frames, phase);


    // ========================================================
    // ③ 着手
    // ========================================================

    let handResult =
        calculateHand(frames, phase);


    // ========================================================
    // ④ 踏切
    // ★ 今回ここだけ大幅改良
    // ========================================================

    let takeOffResult =
        calculateTakeOffImproved(
            frames,
            phase
        );


    // ========================================================
    // ⑤ 着地
    // ========================================================

    let landingResult =
        calculateLanding(frames, phase);


    // ========================================================
    // 合計
    // ========================================================

    const totalScore =
        Number(kneeResult.score || 0) +
        Number(hipResult.score || 0) +
        Number(handResult.score || 0) +
        Number(takeOffResult.score || 0) +
        Number(landingResult.score || 0);


    // ========================================================
    // 結果
    // ========================================================

    const result = {

        score: totalScore,

        details: {

            knee: kneeResult,

            hip: hipResult,

            hand: handResult,

            takeOff: takeOffResult,

            landing: landingResult

        }

    };


    console.log(
        "--------------------------------"
    );

    console.log(
        "膝:",
        kneeResult.score
    );

    console.log(
        "腰:",
        hipResult.score
    );

    console.log(
        "着手:",
        handResult.score
    );

    console.log(
        "踏切:",
        takeOffResult.score
    );

    console.log(
        "着地:",
        landingResult.score
    );

    console.log(
        "Dスコア:",
        totalScore
    );

    console.log(
        "================================"
    );


    return result;
}



// ============================================================
// ① 膝
// ============================================================

function calculateKnee(frames, phase) {

    let values = [];


    const start =
        Math.max(
            0,
            Number(phase.takeOff || 0)
        );


    const end =
        Math.min(
            frames.length - 1,
            start + 20
        );


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            frames[i];

        if (!frame) continue;


        const left =
            getAngle(
                frame,
                23,
                25,
                27
            );


        const right =
            getAngle(
                frame,
                24,
                26,
                28
            );


        if (
            Number.isFinite(left) &&
            Number.isFinite(right)
        ) {

            values.push(
                (left + right) / 2
            );

        }

    }


    if (!values.length) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "膝の角度を取得できませんでした。"

        };

    }


    const measured =
        Math.max(...values);


    let score = 0;

    let text = "";


    if (measured >= 165) {

        score = 2;

        text =
            "膝がよく伸びています。";

    }

    else if (measured >= 145) {

        score = 1;

        text =
            "膝をもう少し伸ばすことを意識しましょう。";

    }

    else {

        score = 0;

        text =
            "膝の伸びを意識しましょう。";

    }


    return {

        score: score,

        value: measured,

        measured:
            measured.toFixed(1) + "°",

        text: text

    };

}



// ============================================================
// ② 腰
// ============================================================

function calculateHip(frames, phase) {

    const takeOff =
        Number(phase.takeOff || 0);


    const highest =
        Number(phase.highestHip || takeOff);


    let takeValue =
        getHipCenterY(
            frames[takeOff]
        );


    let highValue =
        getHipCenterY(
            frames[highest]
        );


    if (
        !Number.isFinite(takeValue) ||
        !Number.isFinite(highValue)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を取得できませんでした。",

            threshold0: "0.20未満",

            threshold1: "0.20～0.349",

            threshold2: "0.350以上"

        };

    }


    const measured =
        takeValue - highValue;


    let score = 0;

    let text = "";


    if (measured >= 0.35) {

        score = 2;

        text =
            "腰がしっかり上がっています。";

    }

    else if (measured >= 0.20) {

        score = 1;

        text =
            "腰が上がっています。さらに高く上げることを意識しましょう。";

    }

    else {

        score = 0;

        text =
            "腰を高く上げることを意識しましょう。";

    }


    return {

        score: score,

        value: measured,

        measured:
            measured.toFixed(3),

        text: text,

        threshold0: "0.20未満",

        threshold1: "0.20～0.349",

        threshold2: "0.350以上"

    };

}



// ============================================================
// ③ 着手
// ============================================================

function calculateHand(frames, phase) {

    const index =
        Number(
            phase.handContact || 0
        );


    const frame =
        frames[index];


    if (!frame) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着手位置を取得できませんでした。"

        };

    }


    const value =
        calculateHandValue(frame);


    if (!Number.isFinite(value)) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着手位置を取得できませんでした。"

        };

    }


    let score = 0;

    let text = "";


    // 現在の着手判定を大きく変更しない
    if (value >= 0.35) {

        score = 2;

        text =
            "適切な位置に着手できています。";

    }

    else if (value >= 0.20) {

        score = 1;

        text =
            "着手位置をもう少し意識しましょう。";

    }

    else {

        score = 0;

        text =
            "着手位置を意識しましょう。";

    }


    return {

        score: score,

        value: value,

        measured:
            value.toFixed(3),

        text: text

    };

}



// ============================================================
// ★★★ ④ 踏切判定・改良版 ★★★
// ============================================================
//
// 今回の中心部分
//
// 「phase.takeOff の1フレームだけ」を見るのではなく、
// 踏切前後の複数フレームを調べる。
// ============================================================

function calculateTakeOffImproved(frames, phase) {

    const center =
        Number(
            phase.takeOff || 0
        );


    console.log(
        "========== 踏切判定 Ver6.0 =========="
    );

    console.log(
        "phase.takeOff:",
        center
    );


    // --------------------------------------------------------
    // 踏切周辺を見る
    // --------------------------------------------------------

    const start =
        Math.max(
            0,
            center - 5
        );


    const end =
        Math.min(
            frames.length - 1,
            center + 7
        );


    let measurements = [];


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            frames[i];

        if (!frame) continue;


        const result =
            analyzeTakeOffFrame(
                frame
            );


        if (!result) continue;


        result.frame = i;


        measurements.push(
            result
        );

    }


    console.log(
        "踏切評価フレーム数:",
        measurements.length
    );


    // --------------------------------------------------------
    // データ不足
    // --------------------------------------------------------

    if (measurements.length < 2) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "踏切の骨格データが不足しています。",

            debug:
                "踏切データ不足"

        };

    }


    // --------------------------------------------------------
    // 各フレームを表示
    // --------------------------------------------------------

    measurements.forEach(
        item => {

            console.log(
                "踏切フレーム:",
                item.frame,
                "足の差:",
                item.footDifference,
                "左右差:",
                item.syncDifference,
                "信頼度:",
                item.confidence
            );

        }
    );


    // ========================================================
    // 最も「両足踏切らしい」区間を探す
    // ========================================================

    let best =
        null;


    for (
        let i = 0;
        i < measurements.length;
        i++
    ) {

        const item =
            measurements[i];


        let score =
            Number(item.confidence || 0);


        // ----------------------------------------------------
        // 両足の高さが近い
        // ----------------------------------------------------

        if (
            item.syncDifference < 0.03
        ) {

            score += 3;

        }

        else if (
            item.syncDifference < 0.06
        ) {

            score += 2;

        }

        else if (
            item.syncDifference < 0.10
        ) {

            score += 1;

        }


        // ----------------------------------------------------
        // 踏切直前～踏切付近を優先
        // ----------------------------------------------------

        const distance =
            Math.abs(
                item.frame - center
            );


        if (distance === 0) {

            score += 3;

        }

        else if (distance <= 2) {

            score += 2;

        }

        else if (distance <= 4) {

            score += 1;

        }


        // ----------------------------------------------------
        // 前後の動きが連続している場合に加点
        // ----------------------------------------------------

        const previous =
            measurements[i - 1];


        const next =
            measurements[i + 1];


        if (
            previous &&
            next
        ) {

            if (
                previous.syncDifference <
                0.10 &&
                next.syncDifference <
                0.10
            ) {

                score += 2;

            }

        }


        item.finalScore =
            score;


        if (
            !best ||
            score > best.finalScore
        ) {

            best =
                item;

        }

    }


    // ========================================================
    // 最終判定
    // ========================================================

    if (!best) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "踏切を判定できませんでした。"

        };

    }


    const measured =
        best.syncDifference;


    // ========================================================
    // 判定
    // ========================================================
    //
    // 重要：
    // 「一瞬だけ左右差が小さい」だけで2点にしない。
    //
    // best周辺にも安定したデータがあるか確認する。
    // ========================================================

    let nearbyGood =
        0;


    measurements.forEach(
        item => {

            if (
                Math.abs(
                    item.frame -
                    best.frame
                ) <= 2
            ) {

                if (
                    item.syncDifference <
                    0.10
                ) {

                    nearbyGood++;

                }

            }

        }
    );


    let score = 0;

    let text = "";


    // --------------------------------------------------------
    // 2点
    // --------------------------------------------------------

    if (
        measured < 0.055 &&
        nearbyGood >= 2
    ) {

        score = 2;

        text =
            "両足をそろえて安定した踏切ができています。";

    }


    // --------------------------------------------------------
    // 1点
    // --------------------------------------------------------

    else if (
        measured < 0.11 &&
        nearbyGood >= 1
    ) {

        score = 1;

        text =
            "両足で踏み切れています。両足をそろえるとさらに安定します。";

    }


    // --------------------------------------------------------
    // 0点
    // --------------------------------------------------------

    else {

        score = 0;

        text =
            "両足をそろえて踏み切ることを意識しましょう。";

    }


    console.log(
        "選択踏切フレーム:",
        best.frame
    );

    console.log(
        "踏切実測値:",
        measured
    );

    console.log(
        "踏切スコア:",
        score
    );


    return {

        score: score,

        value: measured,

        measured:
            measured.toFixed(3),

        text: text,

        frame: best.frame,

        confidence:
            best.confidence,

        nearbyGood:
            nearbyGood,

        debug:
            "踏切周辺複数フレーム判定"

    };

}



// ============================================================
// 踏切1フレームの解析
// ============================================================

function analyzeTakeOffFrame(frame) {

    if (!frame) return null;


    const left =
        getLandmark(
            frame,
            27
        );


    const right =
        getLandmark(
            frame,
            28
        );


    if (!left || !right) {

        return null;

    }


    // --------------------------------------------------------
    // 左右足首のY座標差
    // --------------------------------------------------------

    const syncDifference =
        Math.abs(
            Number(left.y) -
            Number(right.y)
        );


    // --------------------------------------------------------
    // 左右足首のX座標差
    //
    // 真横撮影なので、こちらは補助情報
    // --------------------------------------------------------

    const footDifference =
        Math.abs(
            Number(left.x) -
            Number(right.x)
        );


    // --------------------------------------------------------
    // Visibility
    // --------------------------------------------------------

    const leftVisibility =
        Number.isFinite(
            left.visibility
        )
            ? left.visibility
            : 1;


    const rightVisibility =
        Number.isFinite(
            right.visibility
        )
            ? right.visibility
            : 1;


    const visibility =
        (
            leftVisibility +
            rightVisibility
        ) / 2;


    // --------------------------------------------------------
    // 信頼度
    // --------------------------------------------------------

    let confidence =
        0;


    if (
        visibility >= 0.8
    ) {

        confidence += 4;

    }

    else if (
        visibility >= 0.6
    ) {

        confidence += 3;

    }

    else if (
        visibility >= 0.4
    ) {

        confidence += 1;

    }


    // 両足の高さが近い
    if (
        syncDifference < 0.05
    ) {

        confidence += 3;

    }

    else if (
        syncDifference < 0.10
    ) {

        confidence += 2;

    }

    else if (
        syncDifference < 0.15
    ) {

        confidence += 1;

    }


    return {

        syncDifference:
            syncDifference,

        footDifference:
            footDifference,

        visibility:
            visibility,

        confidence:
            confidence

    };

}



// ============================================================
// ⑤ 着地
// ============================================================

function calculateLanding(frames, phase) {

    const index =
        Number(
            phase.landing ||
            frames.length - 1
        );


    const start =
        Math.max(
            0,
            index - 4
        );


    const end =
        Math.min(
            frames.length - 1,
            index + 2
        );


    let values = [];


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            frames[i];

        if (!frame) continue;


        const left =
            getLandmark(
                frame,
                27
            );


        const right =
            getLandmark(
                frame,
                28
            );


        if (!left || !right)
            continue;


        const diff =
            Math.abs(
                Number(left.x) -
                Number(right.x)
            );


        if (
            Number.isFinite(diff)
        ) {

            values.push(
                diff
            );

        }

    }


    if (!values.length) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着地を確認できませんでした。"

        };

    }


    const measured =
        values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;


    let score = 0;

    let text = "";


    if (
        measured < 0.05
    ) {

        score = 2;

        text =
            "両足をそろえて安定して着地できています。";

    }

    else if (
        measured < 0.10
    ) {

        score = 1;

        text =
            "着地できています。両足をそろえると、さらに安定します。";

    }

    else {

        score = 0;

        text =
            "着地では両足を安定させることを意識しましょう。";

    }


    return {

        score: score,

        value: measured,

        measured:
            measured.toFixed(3),

        text: text

    };

}



// ============================================================
// 共通：ランドマーク取得
// ============================================================

function getLandmark(frame, index) {

    if (!frame) return null;


    // landmarks形式
    if (
        Array.isArray(frame)
    ) {

        return frame[index] || null;

    }


    // poseLandmarks形式
    if (
        frame.poseLandmarks
    ) {

        return (
            frame.poseLandmarks[index]
            || null
        );

    }


    // landmarks形式
    if (
        frame.landmarks
    ) {

        return (
            frame.landmarks[index]
            || null
        );

    }


    return null;

}



// ============================================================
// 共通：角度
// ============================================================

function getAngle(
    frame,
    a,
    b,
    c
) {

    const p1 =
        getLandmark(
            frame,
            a
        );

    const p2 =
        getLandmark(
            frame,
            b
        );

    const p3 =
        getLandmark(
            frame,
            c
        );


    if (
        !p1 ||
        !p2 ||
        !p3
    ) {

        return NaN;

    }


    const v1x =
        p1.x - p2.x;

    const v1y =
        p1.y - p2.y;

    const v2x =
        p3.x - p2.x;

    const v2y =
        p3.y - p2.y;


    const dot =
        v1x * v2x +
        v1y * v2y;


    const len1 =
        Math.sqrt(
            v1x * v1x +
            v1y * v1y
        );


    const len2 =
        Math.sqrt(
            v2x * v2x +
            v2y * v2y
        );


    if (
        len1 === 0 ||
        len2 === 0
    ) {

        return NaN;

    }


    let cos =
        dot /
        (len1 * len2);


    cos =
        Math.max(
            -1,
            Math.min(
                1,
                cos
            )
        );


    return (
        Math.acos(cos) *
        180 /
        Math.PI
    );

}



// ============================================================
// 共通：腰Y座標
// ============================================================

function getHipCenterY(frame) {

    const left =
        getLandmark(
            frame,
            23
        );


    const right =
        getLandmark(
            frame,
            24
        );


    if (
        !left ||
        !right
    ) {

        return NaN;

    }


    return (
        Number(left.y) +
        Number(right.y)
    ) / 2;

}



// ============================================================
// 共通：着手位置
// ============================================================

function calculateHandValue(frame) {

    const left =
        getLandmark(
            frame,
            15
        );


    const right =
        getLandmark(
            frame,
            16
        );


    if (
        !left ||
        !right
    ) {

        return NaN;

    }


    // 手首の高さを使用
    const value =
        Math.abs(
            Number(left.y) -
            Number(right.y)
        );


    return value;

}



// ============================================================
// 公開
// ============================================================

window.calculateDScore =
    calculateDScore;


console.log(
    "score.js Ver6.0 読み込み成功"
);