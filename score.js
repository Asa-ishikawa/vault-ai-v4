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

     console.log("左肘:", leftElbow.toFixed(1));
    console.log("右肘:", rightElbow.toFixed(1));
 

    let score = 5.0;

    // 両腕がほぼ伸びている

    if (leftElbow > 160 && rightElbow > 160) {

        score += 1.0;

    }

    return score;

}

window.calculateDScore = calculateDScore;
window.getAngle = getAngle;
// =============================== // 跳び箱AI採点システム Ver4.0 // pose.js // =============================== let pose = null; async function startPose(video, canvas, ctx) { // 初回のみ初期化 if (!pose) { pose = new Pose({ locateFile: (file) => https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file} }); pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }); pose.onResults(onResults); } async function analyze() { if (video.paused || video.ended) { finishAnalysis(5.0); // 仮のDスコア return; } await pose.send({ image: video }); requestAnimationFrame(analyze); } analyze(); } function onResults(results) { ctx.clearRect(0, 0, canvas.width, canvas.height); if (!results.poseLandmarks) return; drawConnectors( ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#00ff00", lineWidth: 4 } ); drawLandmarks( ctx, results.poseLandmarks, { color: "#ff0000", radius: 5 } ); } const d = calculateDScore(results.poseLandmarks); dScore.textContent = d.toFixed(1);