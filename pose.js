// ===============================
// 跳び箱AI採点システム
// pose.js 着手フレーム診断版
//
// 変更点
// ・骨格解析の基本処理は維持
// ・現在の解析フレーム番号を表示
// ・動画時間を表示
// ・解析済みフレーム数を表示
// ・各pose frameにtimeを保存
// ===============================

let pose = null;

let poseFrames = [];
let frameCount = 0;


// ============================================================
// 診断表示エリア
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
        document.createElement(
            "div"
        );


    element.id =
        "poseDiagnostic";


    element.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 9999;

        background: rgba(0,0,0,0.75);
        color: #ffffff;

        padding: 10px 14px;

        border-radius: 8px;

        font-size: 16px;
        line-height: 1.6;

        font-family:
            Arial,
            "Noto Sans JP",
            sans-serif;

        pointer-events: none;
    `;


    // canvasの親要素を基準に表示
    const canvas =
        document.getElementById(
            "outputCanvas"
        );


    if (
        canvas &&
        canvas.parentElement
    ) {

        const parent =
            canvas.parentElement;


        if (
            getComputedStyle(
                parent
            ).position ===
            "static"
        ) {

            parent.style.position =
                "relative";

        }


        parent.appendChild(
            element
        );

    }

    else {

        document.body.appendChild(
            element
        );

    }


    return element;

}


// ============================================================
// 診断情報を表示
// ============================================================

function updatePoseDiagnostic(
    video
) {

    const diagnostic =
        getPoseDiagnosticElement();


    if (!diagnostic) {

        return;

    }


    const currentTime =
        Number(
            video.currentTime
        );


    const duration =
        Number(
            video.duration
        );


    diagnostic.innerHTML = `

        <strong>
            🟢 着手フレーム診断
        </strong>

        <br>

        現在フレーム：
        <strong>
            ${frameCount}
        </strong>

        <br>

        動画時間：
        <strong>
            ${
                Number.isFinite(
                    currentTime
                )
                    ? currentTime.toFixed(3)
                    : "-"
            }
            秒
        </strong>

        <br>

        動画全体：
        ${
            Number.isFinite(
                duration
            )
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

    `;

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


    // --------------------------------------------------------
    // 診断表示を作成
    // --------------------------------------------------------

    getPoseDiagnosticElement();


    async function analyze() {

        if (
            video.ended
        ) {

            updatePoseDiagnostic(
                video
            );

            return;

        }


        if (
            video.paused
        ) {

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


    // --------------------------------------------------------
    // 骨格が取得できなかった場合
    // --------------------------------------------------------

    if (
        !results.poseLandmarks
    ) {

        updatePoseDiagnostic(
            video
        );

        return;

    }


    // ========================================================
    // 骨格描画
    // ========================================================

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


    // ========================================================
    // 骨格データ保存
    // ========================================================

    poseFrames.push({

        // ----------------------------------------------------
        // 解析フレーム番号
        // ----------------------------------------------------

        frame:
            frameCount,


        // ----------------------------------------------------
        // 動画時間
        // ----------------------------------------------------

        time:
            Number(
                video.currentTime
            ),


        // ----------------------------------------------------
        // ランドマーク
        // ----------------------------------------------------

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


    // --------------------------------------------------------
    // フレーム番号を1つ進める
    // --------------------------------------------------------

    frameCount++;


    // --------------------------------------------------------
    // 診断表示更新
    // --------------------------------------------------------

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


    const diagnostic =
        document.getElementById(
            "poseDiagnostic"
        );


    if (diagnostic) {

        diagnostic.innerHTML = `
            🟢 着手フレーム診断
            <br>
            現在フレーム：0
            <br>
            動画時間：-
            <br>
            取得済み：0フレーム
        `;

    }

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