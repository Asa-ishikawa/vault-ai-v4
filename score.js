// ===============================
// 跳び箱AI採点システム Ver5.4
// score.js
// 開脚跳び・評価安定化版
// ===============================

function calculateDScore(frames, phase) {

    if (!frames || frames.length < 20) {
        return {
            score: 0,
            details: {}
        };
    }

    if (!phase) {
        return {
            score: 0,
            details: {}
        };
    }

    // ----------------------------
    // 平滑化
    // ----------------------------

    const data =
        prepareFrames(frames);

    if (!data || data.length < 20) {

        return {
            score: 0,
            details: {}
        };

    }

    // ----------------------------
    // フェーズ番号 → 配列位置
    // ----------------------------

    function findFrame(frameNumber) {

        let best = 0;
        let difference = Infinity;

        data.forEach((frame, index) => {

            const d =
                Math.abs(
                    frame.frame -
                    frameNumber
                );

            if (d < difference) {

                difference = d;
                best = index;

            }

        });

        return best;

    }

    const takeOffIndex =
        findFrame(phase.takeOff);

    const handIndex =
        findFrame(phase.handContact);

    const hipIndex =
        findFrame(phase.highestHip);

    const landingIndex =
        findFrame(phase.landing);

    // ----------------------------
    // ① 膝の伸び
    // ----------------------------

    const kneeSamples = [];

    const kneeStart =
        Math.max(
            0,
            hipIndex - 5
        );

    const kneeEnd =
        Math.min(
            data.length - 1,
            hipIndex + 5
        );

    for (
        let i = kneeStart;
        i <= kneeEnd;
        i++
    ) {

        const angle =
            getAverageKneeAngle(
                data[i]
            );

        if (angle > 0) {

            kneeSamples.push(angle);

        }

    }

    const kneeAngle =
        kneeSamples.length > 0
            ? kneeSamples.reduce(
                (a, b) => a + b,
                0
            ) / kneeSamples.length
            : 0;

    let kneeScore = 0;
    let kneeText = "";

    if (kneeAngle >= 165) {

        kneeScore = 2;
        kneeText =
            "膝がしっかり伸びています。";

    }

    else if (kneeAngle >= 150) {

        kneeScore = 1;
        kneeText =
            "膝は伸びていますが、もう少し伸ばせます。";

    }

    else {

        kneeScore = 0;
        kneeText =
            "膝の伸びを意識しましょう。";

    }

    // ----------------------------
    // ② 腰の高さ
    // 身体サイズで正規化
    // ----------------------------

    const hipSamples = [];

    const hipStart =
        Math.max(
            0,
            handIndex - 3
        );

    const hipEnd =
        Math.min(
            data.length - 1,
            hipIndex + 3
        );

    for (
        let i = hipStart;
        i <= hipEnd;
        i++
    ) {

        const hip =
            getHipCenter(
                data[i]
            );

        const shoulder =
            getShoulderCenter(
                data[i]
            );

        if (!hip || !shoulder) {
            continue;
        }

        const bodyScale =
            getBodyScale(
                data[i]
            );

        if (bodyScale <= 0) {
            continue;
        }

        const normalizedHeight =
            (
                shoulder.y -
                hip.y
            ) / bodyScale;

        hipSamples.push(
            normalizedHeight
        );

    }

    const hipHeight =
        hipSamples.length > 0
            ? Math.max(...hipSamples)
            : 0;

    let hipScore = 0;
    let hipText = "";

    if (hipHeight >= 1.2) {

        hipScore = 2;
        hipText =
            "腰が高く、跳び越す姿勢ができています。";

    }

    else if (hipHeight >= 0.9) {

        hipScore = 1;
        hipText =
            "腰は上がっています。もう少し高くすると安定します。";

    }

    else {

        hipScore = 0;
        hipText =
            "腰を高く保つことを意識しましょう。";

    }

    // ----------------------------
    // ③ 着手
    // ----------------------------

    const handSamples = [];

    const handStart =
        Math.max(
            0,
            handIndex - 4
        );

    const handEnd =
        Math.min(
            data.length - 1,
            handIndex + 4
        );

    for (
        let i = handStart;
        i <= handEnd;
        i++
    ) {

        const left =
            getPoint(
                data[i],
                15
            );

        const right =
            getPoint(
                data[i],
                16
            );

        if (!left || !right) {
            continue;
        }

        const hip =
            getHipCenter(
                data[i]
            );

        if (!hip) {
            continue;
        }

        const handX =
            (
                left.x +
                right.x
            ) / 2;

        const normalized =
            Math.abs(
                handX - hip.x
            ) /
            getBodyScale(
                data[i]
            );

        handSamples.push(
            normalized
        );

    }

    const handPosition =
        handSamples.length > 0
            ? Math.max(...handSamples)
            : 0;

    let handScore = 0;
    let handText = "";

    if (handPosition >= 1.0) {

        handScore = 2;
        handText =
            "着手位置が安定しています。";

    }

    else if (handPosition >= 0.55) {

        handScore = 1;
        handText =
            "着手できています。もう少し前方への着手を意識しましょう。";

    }

    else {

        handScore = 0;
        handText =
            "跳び箱に対して十分な位置に手をつくことを意識しましょう。";

    }

    // ----------------------------
    // ④ 両足踏切
    // ----------------------------

    const takeOffSamples = [];

    const takeStart =
        Math.max(
            0,
            takeOffIndex - 3
        );

    const takeEnd =
        Math.min(
            data.length - 1,
            takeOffIndex + 3
        );

    for (
        let i = takeStart;
        i <= takeEnd;
        i++
    ) {

        const left =
            getPoint(
                data[i],
                27
            );

        const right =
            getPoint(
                data[i],
                28
            );

        if (!left || !right) {
            continue;
        }

        const difference =
            Math.abs(
                left.y -
                right.y
            );

        takeOffSamples.push(
            difference
        );

    }

    const footDifference =
        takeOffSamples.length > 0
            ? takeOffSamples.reduce(
                (a, b) => a + b,
                0
            ) /
            takeOffSamples.length
            : 1;

    let takeOffScore = 0;
    let takeOffText = "";

    if (footDifference < 0.045) {

        takeOffScore = 2;
        takeOffText =
            "両足をそろえて踏み切れています。";

    }

    else if (footDifference < 0.08) {

        takeOffScore = 1;
        takeOffText =
            "両足踏切はできています。左右のタイミングをそろえましょう。";

    }

    else {

        takeOffScore = 0;
        takeOffText =
            "両足をそろえて踏み切ることを意識しましょう。";

    }

    // ----------------------------
    // ⑤ 着地
    // ----------------------------

    const landingSamples = [];

    const landingStart =
        Math.max(
            0,
            landingIndex - 5
        );

    const landingEnd =
        Math.min(
            data.length - 1,
            landingIndex + 5
        );

    for (
        let i = landingStart;
        i <= landingEnd;
        i++
    ) {

        const left =
            getPoint(
                data[i],
                27
            );

        const right =
            getPoint(
                data[i],
                28
            );

        if (!left || !right) {
            continue;
        }

        const difference =
            Math.abs(
                left.y -
                right.y
            );

        landingSamples.push(
            difference
        );

    }

    const landingDifference =
        landingSamples.length > 0
            ? landingSamples.reduce(
                (a, b) => a + b,
                0
            ) /
            landingSamples.length
            : 1;

    let landingScore = 0;
    let landingText = "";

    if (landingDifference < 0.05) {

        landingScore = 2;
        landingText =
            "着地が安定しています。";

    }

    else if (landingDifference < 0.1) {

        landingScore = 1;
        landingText =
            "着地できています。左右の足をそろえるとさらに安定します。";

    }

    else {

        landingScore = 0;
        landingText =
            "両足で安定して着地することを意識しましょう。";

    }

    // ----------------------------
    // 合計
    // ----------------------------

    const total =
        kneeScore +
        hipScore +
        handScore +
        takeOffScore +
        landingScore;

    // ----------------------------
    // Dスコア
    // 5項目 × 2点 = 10点
    // ----------------------------

    const score =
        total;

    const result = {

        score: score,

        details: {

            knee: {

                score: kneeScore,

                text: kneeText,

                value: kneeAngle

            },

            hip: {

                score: hipScore,

                text: hipText,

                value: hipHeight

            },

            hand: {

                score: handScore,

                text: handText,

                value: handPosition

            },

            takeOff: {

                score: takeOffScore,

                text: takeOffText,

                value: footDifference

            },

            landing: {

                score: landingScore,

                text: landingText,

                value: landingDifference

            }

        }

    };

    console.log(
        "========== Ver5.4 SCORE =========="
    );

    console.log(
        "膝:",
        kneeScore,
        kneeAngle
    );

    console.log(
        "腰:",
        hipScore,
        hipHeight
    );

    console.log(
        "着手:",
        handScore,
        handPosition
    );

    console.log(
        "踏切:",
        takeOffScore,
        footDifference
    );

    console.log(
        "着地:",
        landingScore,
        landingDifference
    );

    console.log(
        "Dスコア:",
        score
    );

    return result;

}


// ----------------------------
// 公開
// ----------------------------

window.calculateDScore =
    calculateDScore;

console.log(
    "score.js Ver5.4 読み込み成功"
);