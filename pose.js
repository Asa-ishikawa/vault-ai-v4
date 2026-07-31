// ===============================
// 跳び箱AI採点システム Ver4.0
// pose.js
// ===============================

// MediaPipe Pose
let pose = null;

// app.jsから受け取る
let videoElement = null;
let canvasElement = null;
let canvasCtx = null;

// ----------------------------
// Pose開始
// ----------------------------
async function startPose(video, canvas, ctx) {

    videoElement = video;
    canvasElement = canvas;
    canvasCtx = ctx;

    // 初回のみ初期化
    if (!pose) {

        pose = new Pose({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onResults);
    }

    analyze();
}

// ----------------------------
// 動画解析
// ----------------------------
async function analyze() {

    if (videoElement.paused || videoElement.ended) {
        return;
    }

    await pose.send({
        image: videoElement
    });

    requestAnimationFrame(analyze);
}

// ----------------------------
// Pose結果
// ----------------------------
function onResults(results) {

    // キャンバスを消去
    canvasCtx.clearRect(
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

    // 骨格が検出できない
    if (!results.poseLandmarks) {
        return;
    }

    // 骨格線
    drawConnectors(
        canvasCtx,
        results.poseLandmarks,
        POSE_CONNECTIONS,
        {
            color: "#00ff00",
            lineWidth: 4
        }
    );

    // 関節
    drawLandmarks(
        canvasCtx,
        results.poseLandmarks,
        {
            color: "#ff0000",
            radius: 5
        }
    );

    // Dスコア計算
    const d = calculateDScore(results.poseLandmarks);

    // 表示更新
    dScore.textContent = d.toFixed(1);
}

// ----------------------------
// グローバル公開
// ----------------------------
window.startPose = startPose;