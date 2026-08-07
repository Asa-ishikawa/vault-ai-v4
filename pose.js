// ===============================
// 跳び箱AI採点システム Ver5.3.2
// pose.js 完成版
// ===============================

let pose = null;

let poseFrames = [];
let frameCount = 0;

// ----------------------------
// AI開始
// ----------------------------

async function startPose(video, canvas, ctx) {

    clearPoseFrames();

    if (!pose) {

        pose = new Pose({

            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

        });

        pose.setOptions({

            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6

        });

        pose.onResults((results) => {

            onResults(
                results,
                video,
                canvas,
                ctx
            );

        });

    }

    async function analyze() {

        if (video.ended) {

            return;

        }

        if (video.paused) {

            requestAnimationFrame(analyze);
            return;

        }

        await pose.send({

            image: video

        });

        requestAnimationFrame(analyze);

    }

    analyze();

}

// ----------------------------
// 骨格結果
// ----------------------------

function onResults(
    results,
    video,
    canvas,
    ctx
) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (!results.poseLandmarks) {

        return;

    }

    // ----------------------------
    // 骨格描画
    // ----------------------------

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

    // ----------------------------
    // 骨格データ保存
    // ----------------------------

    poseFrames.push({

        frame: frameCount,

        time: video.currentTime,

        landmarks:
            results.poseLandmarks.map(
                landmark => ({

                    x: landmark.x,
                    y: landmark.y,
                    z: landmark.z,
                    visibility:
                        landmark.visibility

                })
            )

    });

    frameCount++;

}

// ----------------------------
// フレーム取得
// ----------------------------

function getPoseFrames() {

    return poseFrames;

}

// ----------------------------
// フレームリセット
// ----------------------------

function clearPoseFrames() {

    poseFrames = [];
    frameCount = 0;

}

// ----------------------------
// 公開
// ----------------------------

window.startPose = startPose;

window.getPoseFrames =
    getPoseFrames;

window.clearPoseFrames =
    clearPoseFrames;