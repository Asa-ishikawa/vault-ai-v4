// ===============================
// 跳び箱AI採点システム Ver4.0
// score.js
// ===============================

// ----------------------------
// 角度計算
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

    const dot = ab.x * cb.x + ab.y * cb.y;

    const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
    const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);

    if (magAB === 0 || magCB === 0) {
        return 0;
    }

    let cos = dot / (magAB * magCB);

    // 誤差対策
    cos = Math.max(-1, Math.min(1, cos));

    const angle = Math.acos(cos);

    return angle * 180 / Math.PI;
}

// ----------------------------
// Dスコア計算
// ----------------------------
function calculateDScore(landmarks) {

    if (!landmarks || landmarks.length === 0) {
        return 0;
    }

    // 左肘
    const leftElbow = getAngle(
        landmarks[11], // 左肩
        landmarks[13], // 左肘
        landmarks[15]  // 左手首
    );

    // 右肘
    const rightElbow = getAngle(
        landmarks[12], // 右肩
        landmarks[14], // 右肘
        landmarks[16]  // 右手首
    );

    console.log(
        `左肘:${leftElbow.toFixed(1)}°　右肘:${rightElbow.toFixed(1)}°`
    );

    // ----------------------------
    // 仮採点（Ver4）
    // 満点5.0
    // ----------------------------
    let score = 5.0;

    // 両腕が十分伸びていれば加点
    if (leftElbow >= 160 && rightElbow >= 160) {
        score += 1.0;
    }

    // 最大6.0
    score = Math.min(score, 6.0);

    return Number(score.toFixed(1));
}

// ----------------------------
// グローバル公開
// ----------------------------
window.getAngle = getAngle;
window.calculateDScore = calculateDScore;