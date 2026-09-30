// ===============================
// 跳び箱AI採点システム
// pose.js 着手フレーム時間診断版
// ===============================

let pose = null;

let poseFrames = [];
let frameCount = 0;


// ============================================================
// 診断表示
// ============================================================

function getPoseDiagnosticElement() {

    let element =
        document.getElementById(
            "poseDiagnostic"
        );

    if (element) {
        return element;
    }

    element =
        document.createElement("div");

    element.id =
        "poseDiagnostic";

    element.style.cssText = `
        margin-top:10px;
        padding:10px;
        background:#f5f5f5;
        border-radius:8px;
        font-size:14px;
        line-height:1.7;
    `;

    const videoContainer =
        document.getElementById(
            "videoContainer"
        );

    if (videoContainer) {

        videoContainer.parentElement
            .insertBefore(
                element,
                videoContainer.nextSibling
            );

    } else {

        document.body.appendChild(
            element
        );

    }

    return element;
}


// ============================================================
// 現在の解析状況を表示
// ============================================================

function updatePoseDiagnostic(
    video
) {

    const diagnostic =
        getPoseDiagnosticElement();

    const currentTime =
        Number(video.currentTime);

    const duration =
        Number(video.duration);

    diagnostic.innerHTML = `

        <strong>🟢 着手フレーム診断</strong>

        <br>

        現在解析フレーム：
        <strong>
            ${frameCount}
        </strong>

        <br>

        現在動画時間：
        <strong>
            ${
                Number.isFinite(currentTime)
                    ? currentTime.toFixed(3)
                    : "-"
            }
            秒
        </strong>

        <br>

        動画全体：
        ${
            Number.isFinite(duration)
                ? duration.toFixed(3)
                : "-"
        }
        秒

        <br>

        取得済み：
        <strong>
            ${poseFrames.length}
        </strong>
        フレーム

        <hr>

        <div id="selectedHandDiagnostic">
            選択着手フレーム：
            まだ指定されていません
        </div>

    `;
}


// ============================================================
// 選択された着手フレームの時間を表示
//
// score.jsから呼び出せる
// window.showSelectedHandFrameTime(フレーム番号)
// ============================================================

function showSelectedHandFrameTime(
    selectedFrame
) {

    const diagnostic =
        getPoseDiagnosticElement();

    const frameNumber =
        Number(selectedFrame);


    if (
        !Number.isFinite(frameNumber)
    ) {

        return;

    }


    // --------------------------------------------------------
    // 該当フレームを検索
    // --------------------------------------------------------

    const targetFrame =
        poseFrames.find(
            frame =>
                Number(frame.frame) ===
                frameNumber
        );


    const targetElement =
        document.getElementById(
            "selectedHandDiagnostic"
        );


    if (!targetElement) {

        return;

    }


    // --------------------------------------------------------
    // 該当フレームが見つからない
    // --------------------------------------------------------

    if (!targetFrame) {

        targetElement.innerHTML = `

            <strong>
                選択着手フレーム：
                ${frameNumber}
            </strong>

            <br>

            着手動画時間：
            <span style="color:#c62828;">
                取得できませんでした
            </span>

        `;

        return;

    }


    const time =
        Number(
            targetFrame.time
        );


    targetElement.innerHTML = `

        <strong>
            選択着手フレーム：
            ${frameNumber}
        </strong>

        <br>

        着手動画時間：
        <strong style="color:#1565c0;">
            ${
                Number.isFinite(time)
                    ? time.toFixed(3)
                    : "-"
            }
            秒
        </strong>

        <br>

        この時間の動画を確認すると、
        実際の着手瞬間と
        比較できます。

    `;

}


// ============================================================
// 特定フレームの情報を取得
// ============================================================

function getPoseFrameInfo(
    frameNumber
) {

    const number =
        Number(frameNumber);

    if (
        !Number.isFinite(number)
    ) {

        return null;

    }


    const frame =
        poseFrames.find(
            item =>
                Number(item.frame) ===
                number
        );


    if (!frame) {

        return null;

    }


    return {

        frame:
            frame.frame,

        time:
            frame.time,

        landmarks:
            frame.landmarks

    };

}


// ============================================================
// AI開始
// ============================================================

async function startPose(
    video,
    canvas,
    ctx
) {

    clearPoseFrames();


    if (!pose) {

        pose =
            new Pose({

                locateFile:
                    (file) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

            });


        pose.setOptions({

            modelComplexity: 1,

            smoothLandmarks: true,

            enableSegmentation: false,

            minDetectionConfidence: 0.6,

            minTrackingConfidence: 0.6

        });


        pose.onResults(
            (results) => {

                onResults(
                    results,
                    video,
                    canvas,
                    ctx
                );

            }
        );

    }


    getPoseDiagnosticElement();


    async function analyze() {

        if (video.ended) {

            updatePoseDiagnostic(
                video
            );

            return;

        }


        if (video.paused) {

            updatePoseDiagnostic(
                video
            );

            requestAnimationFrame(
                analyze
            );

            return;

        }


        await pose.send({

            image: video

        });


        updatePoseDiagnostic(
            video
        );


        requestAnimationFrame(
            analyze
        );

    }


    analyze();

}


// ============================================================
// 骨格結果
// ============================================================

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

        updatePoseDiagnostic(
            video
        );

        return;

    }


    // --------------------------------------------------------
    // 骨格描画
    // --------------------------------------------------------

    drawConnectors(

        ctx,

        results.poseLandmarks,

        POSE_CONNECTIONS,

        {

            color:
                "#00ff00",

            lineWidth:
                4

        }

    );


    drawLandmarks(

        ctx,

        results.poseLandmarks,

        {

            color:
                "#ff0000",

            radius:
                5

        }

    );


    // --------------------------------------------------------
    // 骨格データ保存
    // --------------------------------------------------------

    poseFrames.push({

        frame:
            frameCount,

        time:
            Number(
                video.currentTime
            ),

        landmarks:
            results.poseLandmarks.map(
                landmark => ({

                    x:
                        landmark.x,

                    y:
                        landmark.y,

                    z:
                        landmark.z,

                    visibility:
                        landmark.visibility

                })
            )

    });


    frameCount++;


    updatePoseDiagnostic(
        video
    );

}


// ============================================================
// フレーム取得
// ============================================================

function getPoseFrames() {

    return poseFrames;

}


// ============================================================
// フレームリセット
// ============================================================

function clearPoseFrames() {

    poseFrames = [];

    frameCount = 0;

}


// ============================================================
// 公開
// ============================================================

window.startPose =
    startPose;


window.getPoseFrames =
    getPoseFrames;


window.clearPoseFrames =
    clearPoseFrames;


window.getPoseFrameInfo =
    getPoseFrameInfo;


window.showSelectedHandFrameTime =
    showSelectedHandFrameTime;