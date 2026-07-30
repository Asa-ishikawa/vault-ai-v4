// ===============================
// 跳び箱AI採点システム Ver4.0
// pose.js
// ===============================

let pose = null;

async function startPose(video, canvas, ctx) {

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

    async function analyze() {

        if (video.paused || video.ended) {

            finishAnalysis(5.0);   // 仮のDスコア
            return;

        }

        await pose.send({ image: video });

        requestAnimationFrame(analyze);

    }

    analyze();

}

function onResults(results) {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) return;

    drawConnectors(
        ctx,
        results.poseLandmarks,
        POSE_CONNECTIONS,
        {
            color: "#00ff00",
            lineWidth: 4
        }
    );

    drawLandmarks(
        ctx,
        results.poseLandmarks,
        {
            color: "#ff0000",
            radius: 5
        }
    );

}