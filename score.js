// ===============================
// 跳び箱AI採点システム Ver5.3.2
// score.js（前半）
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

    let score = 5.0;

    const details = {};

    // ----------------------------
    // ① 膝の伸び
    // ----------------------------

    const kneeFrame =
        frames[phase.highestHip];

    const kneeAngle =
        getAverageKneeAngle(kneeFrame);

    let kneeScore = 0;
    let kneeText = "";

    if (kneeAngle >= 170) {

        kneeScore = 2;
        kneeText = "膝が十分に伸びています。";
        score += 1.0;

    }

    else if (kneeAngle >= 155) {

        kneeScore = 1;
        kneeText = "もう少し膝を伸ばしましょう。";
        score += 0.5;

    }

    else {

        kneeScore = 0;
        kneeText = "空中で膝が曲がっています。";

    }

    details.knee = {

        score: kneeScore,
        text: kneeText

    };

    // ----------------------------
    // ② 腰の高さ
    // ----------------------------

    const hip =
        getHipCenter(kneeFrame);

    let hipScore = 0;
    let hipText = "";

    if (hip.y <= 0.33) {

        hipScore = 2;
        hipText = "腰が高く上がっています。";
        score += 1.0;

    }

    else if (hip.y <= 0.43) {

        hipScore = 1;
        hipText = "あと少し腰を上げましょう。";
        score += 0.5;

    }

    else {

        hipScore = 0;
        hipText = "腰が低くなっています。";

    }

    details.hip = {

        score: hipScore,
        text: hipText

    };

    // ----------------------------
    // ③ 着手位置
    // ----------------------------

    const handFrame =
        frames[phase.handContact];

    const handWidth =
        getHandWidth(handFrame);

    let handScore = 0;
    let handText = "";

    if (handWidth >= 0.24 &&
        handWidth <= 0.42) {

        handScore = 2;
        handText = "適切な位置へ着手できています。";
        score += 1.0;

    }

    else if (handWidth >= 0.18) {

        handScore = 1;
        handText = "手幅を少し調整しましょう。";
        score += 0.5;

    }

    else {

        handScore = 0;
        handText = "着手位置が狭くなっています。";

    }

    details.hand = {

        score: handScore,
        text: handText

    };
        // ----------------------------
    // ④ 両足踏切
    // ----------------------------

    const takeFrame =
        frames[phase.takeOff];

    const footWidth =
        getFootWidth(takeFrame);

    let takeScore = 0;
    let takeText = "";

    if (footWidth >= 0.15) {

        takeScore = 2;
        takeText = "両足でしっかり踏み切れています。";
        score += 1.0;

    }

    else {

        takeScore = 1;
        takeText = "踏切をもう少し強く行いましょう。";
        score += 0.5;

    }

    details.takeOff = {

        score: takeScore,
        text: takeText

    };

    // ----------------------------
    // ⑤ 着地
    // ----------------------------

    const landingFrame =
        frames[phase.landing];

    const landingKnee =
        getAverageKneeAngle(landingFrame);

    let landingScore = 0;
    let landingText = "";

    if (landingKnee >= 160) {

        landingScore = 2;
        landingText = "安定した着地です。";
        score += 1.0;

    }

    else if (landingKnee >= 145) {

        landingScore = 1;
        landingText = "もう少し安定した着地を目指しましょう。";
        score += 0.5;

    }

    else {

        landingScore = 0;
        landingText = "着地でバランスを崩しています。";

    }

    details.landing = {

        score: landingScore,
        text: landingText

    };

    // ----------------------------
    // 結果
    // ----------------------------

    return {

        score: Number(score.toFixed(1)),
        details: details

    };

}

// ----------------------------
// 公開
// ----------------------------

window.calculateDScore =
    calculateDScore;