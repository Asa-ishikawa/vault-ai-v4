// ===============================
// 跳び箱AI採点システム Ver4.0
// score.js
// ===============================

// ----------------------------
// Dスコア計算
// ----------------------------

function calculateDScore(landmarks) {

    // 仮採点
    // 将来ここをAI判定に置き換える

    let score = 5.0;

    return score;

}

// ----------------------------
// 肘の角度
// ----------------------------

function getAngle(a, b, c) {

    const ab = {
        x: a.x - b.x,
        y: a.y - b.y
    };

    const cb = {
        x: c.x - b.x,
        y: c.y - b.y
    };

    const dot =
        ab.x * cb.x +
        ab.y * cb.y;

    const mag1 =
        Math.sqrt(ab.x * ab.x + ab.y * ab.y);

    const mag2 =
        Math.sqrt(cb.x * cb.x + cb.y * cb.y);

    const angle =
        Math.acos(dot / (mag1 * mag2));

    return angle * 180 / Math.PI;

}

window.calculateDScore = calculateDScore;
window.getAngle = getAngle;