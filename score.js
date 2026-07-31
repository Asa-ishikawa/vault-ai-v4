// ===============================
// 跳び箱AI採点システム Ver4.0
// score.js
// ===============================

// ----------------------------
// Dスコア計算
// ----------------------------
function calculateDScore(landmarks) {

    // 左腕
    const leftElbow = getAngle(

        landmarks[11], // 左肩
        landmarks[13], // 左肘
        landmarks[15]  // 左手首

    );

    // 右腕
    const rightElbow = getAngle(

        landmarks[12],
        landmarks[14],
        landmarks[16]

    );

 status.textContent =
    "左肘:" + leftElbow.toFixed(0) +
    "° 右肘:" + rightElbow.toFixed(0) + "°";   


    let score = 5.0;

    // 両腕がほぼ伸びている

    if (leftElbow > 160 && rightElbow > 160) {

        score += 1.0;

    }

    return score;

}

window.calculateDScore = calculateDScore;
window.getAngle = getAngle;