// ===============================
// 跳び箱AI採点システム Ver5.3
// score.js
// ===============================

// ----------------------------
// Dスコア計算
// ----------------------------
function calculateDScore(frames, phase) {

    if (!frames || !phase) {

        return {

            score: 0,

            details: {}

        };

    }

    const result = {

        score: 0,

        details: {}

    };

    let score = 5.0;

    // ==========================
    // 膝の伸び（最高点）
    // ==========================

    const hipFrame = frames[phase.highestHip];

    const kneeAngle = getAverageKneeAngle(hipFrame);

    let kneeScore = 0;
    let kneeText = "";

    if (kneeAngle >= 170) {

        kneeScore = 2;
        kneeText = "膝がしっかり伸びています。";
        score += 1.0;

    } else if (kneeAngle >= 155) {

        kneeScore = 1;
        kneeText = "もう少し膝を伸ばしましょう。";
        score += 0.5;

    } else {

        kneeScore = 0;
        kneeText = "空中で膝が曲がっています。";

    }

    // ==========================
    // 腰の高さ
    // ==========================

    const hip = getHipCenter(hipFrame);

    let hipScore = 0;
    let hipText = "";

    if (hip.y < 0.35) {

        hipScore = 2;
        hipText = "腰が十分高く上がっています。";
        score += 1.0;

    } else if (hip.y < 0.45) {

        hipScore = 1;
        hipText = "もう少し腰を高く上げましょう。";
        score += 0.5;

    } else {

        hipScore = 0;
        hipText = "腰が低くなっています。";

    }

    // ==========================
    // 着手位置
    // ==========================

    const handFrame = frames[phase.handContact];

    const handWidth = getHandWidth(handFrame);

    let handScore = 0;
    let handText = "";

    if (handWidth >= 0.25 && handWidth <= 0.45) {

        handScore = 2;
        handText = "適切な位置に着手できています。";
        score += 1.0;

    } else if (handWidth >= 0.18) {

        handScore = 1;
        handText = "手幅を少し調整しましょう。";
        score += 0.5;

    } else {

        handScore = 0;
        handText = "着手位置が狭すぎます。";

    }

    // ==========================
    // 両足踏切
    // ==========================

    const takeFrame = frames[phase.takeOff];

    const footWidth = getFootWidth(takeFrame);

    let takeScore = 0;
    let takeText = "";

    if (footWidth >= 0.15) {

        takeScore = 2;
        takeText = "両足でしっかり踏み切れています。";
        score += 1.0;

    } else {

        takeScore = 1;
        takeText = "踏切のタイミングを合わせましょう。";
        score += 0.5;

    }

    // ==========================
    // 着地
    // ==========================

    const landFrame = frames[phase.landing];

    const landKnee = getAverageKneeAngle(landFrame);

    let landScore = 0;
    let landText = "";

    if (landKnee >= 160) {

        landScore = 2;
        landText = "安定した着地です。";
        score += 1.0;

    } else if (landKnee >= 145) {

        landScore = 1;
        landText = "着地は安定していますが改善できます。";
        score += 0.5;

    } else {

        landScore = 0;
        landText = "着地で姿勢が崩れています。";

    }

    // ==========================
    // 合計
    // ==========================

    result.score = Number(score.toFixed(1));

    result.details = {

        knee: {

            score: kneeScore,
            text: kneeText

        },

        hip: {

            score: hipScore,
            text: hipText

        },

        hand: {

            score: handScore,
            text: handText

        },

        takeOff: {

            score: takeScore,
            text: takeText

        },

        landing: {

            score: landScore,
            text: landText

        }

    };

    return result;

}

// ----------------------------
// 公開
// ----------------------------

window.calculateDScore = calculateDScore;