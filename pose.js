
// ============================================================
// 跳び箱AI採点システム
// pose.js Ver7.1
// 完全置き換え版
//
// 改善点
// ・動画終了時のPose処理完了を待つ
// ・処理フレーム数と骨格取得数を分けて表示
// ・非同期処理の重複を防止
// ・既存app.jsとの互換性を維持
// ============================================================

let pose = null;
let poseFrames = [];
let frameCount = 0;
let processedFrameCount = 0;
let analysisToken = 0;
let analysisPromise = Promise.resolve();
let resolveAnalysis = null;
let analysisRunning = false;

// ============================================================
// 診断表示
// ============================================================

function getPoseDiagnosticElement() {
    let element = document.getElementById("poseDiagnostic");

    if (element) return element;

    element = document.createElement("div");
    element.id = "poseDiagnostic";

    element.style.cssText = `
        margin-top:10px;
        padding:10px;
        background:#f5f5f5;
        border-radius:8px;
        font-size:14px;
        line-height:1.7;
    `;

    const container = document.getElementById("videoContainer");

    if (container && container.parentElement) {
        container.parentElement.insertBefore(
            element,
            container.nextSibling
        );
    } else {
        document.body.appendChild(element);
    }

    return element;
}

// ============================================================
// 診断表示更新
// ============================================================

function updatePoseDiagnostic(video) {
    const diagnostic = getPoseDiagnosticElement();

    const currentTime = Number(video.currentTime);
    const duration = Number(video.duration);

    diagnostic.innerHTML = `
        <strong>骨格検出診断 Ver7.1</strong><br>

        処理フレーム数：
        <strong>${processedFrameCount}</strong><br>

        骨格取得フレーム数：
        <strong>${poseFrames.length}</strong><br>

        現在の動画時間：
        <strong>
            ${Number.isFinite(currentTime)
                ? currentTime.toFixed(3)
                : "-"} 秒
        </strong><br>

        動画全体：
        ${Number.isFinite(duration)
            ? duration.toFixed(3)
            : "-"} 秒

        <hr>

        <div id="selectedHandDiagnostic">
            選択着手フレーム：未指定
        </div>
    `;
}

// ============================================================
// 選択着手フレームの表示
// ============================================================

function showSelectedHandFrameTime(selectedFrame) {
    getPoseDiagnosticElement();

    const frameNumber = Number(selectedFrame);

    if (!Number.isFinite(frameNumber)) return;

    const targetFrame = poseFrames.find(
        frame => Number(frame.frame) === frameNumber
    );

    const targetElement = document.getElementById(
        "selectedHandDiagnostic"
    );

    if (!targetElement) return;

    if (!targetFrame) {
        targetElement.innerHTML = `
            <strong>選択着手フレーム：${frameNumber}</strong><br>
            該当データを取得できませんでした。
        `;
        return;
    }

    const hand = targetFrame.handPosition;

    targetElement.innerHTML = `
        <strong>選択着手フレーム：${frameNumber}</strong><br>
        動画時間：
        <strong>${Number(targetFrame.time).toFixed(3)} 秒</strong><br>
        手首中央座標：
        ${
            hand
                ? `x=${hand.x.toFixed(3)}, y=${hand.y.toFixed(3)}`
                : "取得できません"
        }
    `;
}

// ============================================================
// フレーム情報取得
// ============================================================

function getPoseFrameInfo(frameNumber) {
    const number = Number(frameNumber);

    if (!Number.isFinite(number)) return null;

    return poseFrames.find(
        item => Number(item.frame) === number
    ) || null;
}

// ============================================================
// 解析完了待機
// ============================================================

function waitForPoseComplete() {
    return analysisPromise;
}

// ============================================================
// 解析開始
// ============================================================

async function startPose(video, canvas, ctx) {
    clearPoseFrames();

    const myToken = analysisToken;

    if (!pose) {
        pose = new Pose({
            locateFile: file =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        pose.onResults(results => {
            if (myToken !== analysisToken) return;

            onResults(results, video, canvas, ctx);
        });
    }

    getPoseDiagnosticElement();

    analysisRunning = true;

    analysisPromise = new Promise(resolve => {
        resolveAnalysis = resolve;
    });

    let sending = false;

    async function analyze() {
        if (myToken !== analysisToken) return;

        if (video.ended) {
            finishPoseLoop(myToken, video);
            return;
        }

        if (video.paused) {
            updatePoseDiagnostic(video);
            requestAnimationFrame(analyze);
            return;
        }

        // 同時に複数のPose処理を実行しない
        if (sending) {
            requestAnimationFrame(analyze);
            return;
        }

        sending = true;

        try {
            await pose.send({ image: video });
        } catch (error) {
            console.error("Pose解析エラー:", error);
        } finally {
            sending = false;
        }

        if (myToken !== analysisToken) return;

        updatePoseDiagnostic(video);

        if (video.ended) {
            finishPoseLoop(myToken, video);
            return;
        }

        requestAnimationFrame(analyze);
    }

    requestAnimationFrame(analyze);
}

// ============================================================
// 解析ループ終了
// ============================================================

function finishPoseLoop(token, video) {
    if (token !== analysisToken) return;

    if (!analysisRunning) return;

    analysisRunning = false;

    updatePoseDiagnostic(video);

    if (resolveAnalysis) {
        resolveAnalysis();
        resolveAnalysis = null;
    }

    console.log("Pose解析ループ終了", {
        processedFrameCount,
        detectedFrameCount: poseFrames.length
    });
}

// ============================================================
// 骨格結果保存
// ============================================================

function onResults(results, video, canvas, ctx) {
    processedFrameCount++;

    if (!ctx || !canvas) {
        updatePoseDiagnostic(video);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) {
        updatePoseDiagnostic(video);
        return;
    }

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

    const landmarks = results.poseLandmarks.map(point => ({
        x: Number(point.x),
        y: Number(point.y),
        z: Number(point.z),
        visibility: Number(point.visibility ?? 1)
    }));

    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    let handPosition = null;

    if (
        isValidPoint(leftWrist) &&
        isValidPoint(rightWrist)
    ) {
        handPosition = {
            x: (leftWrist.x + rightWrist.x) / 2,
            y: (leftWrist.y + rightWrist.y) / 2
        };
    }

    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];

    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    const frameData = {
        frame: frameCount,
        time: Number(video.currentTime),

        landmarks: landmarks,

        handPosition: handPosition,

        leftWrist: copyPoint(leftWrist),
        rightWrist: copyPoint(rightWrist),

        leftElbow: copyPoint(leftElbow),
        rightElbow: copyPoint(rightElbow),

        leftHip: copyPoint(leftHip),
        rightHip: copyPoint(rightHip),

        leftKnee: copyPoint(leftKnee),
        rightKnee: copyPoint(rightKnee),

        leftAnkle: copyPoint(leftAnkle),
        rightAnkle: copyPoint(rightAnkle),

        visibility: {
            leftWrist: getVisibility(leftWrist),
            rightWrist: getVisibility(rightWrist),
            leftKnee: getVisibility(leftKnee),
            rightKnee: getVisibility(rightKnee),
            leftAnkle: getVisibility(leftAnkle),
            rightAnkle: getVisibility(rightAnkle)
        }
    };

    poseFrames.push(frameData);

    frameCount++;

    updatePoseDiagnostic(video);
}

// ============================================================
// 座標の有効性確認
// ============================================================

function isValidPoint(point) {
    return !!(
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
    );
}

function copyPoint(point) {
    if (!isValidPoint(point)) return null;

    return {
        x: point.x,
        y: point.y,
        z: point.z,
        visibility: point.visibility
    };
}

function getVisibility(point) {
    if (!point) return 0;

    const value = Number(point.visibility);

    return Number.isFinite(value) ? value : 0;
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
    analysisToken++;

    if (resolveAnalysis) {
        resolveAnalysis();
        resolveAnalysis = null;
    }

    analysisRunning = false;
    analysisPromise = Promise.resolve();

    poseFrames = [];
    frameCount = 0;
    processedFrameCount = 0;
}

// ============================================================
// 公開関数
// ============================================================

window.startPose = startPose;
window.getPoseFrames = getPoseFrames;
window.clearPoseFrames = clearPoseFrames;
window.getPoseFrameInfo = getPoseFrameInfo;
window.showSelectedHandFrameTime = showSelectedHandFrameTime;
window.waitForPoseComplete = waitForPoseComplete;

console.log("pose.js Ver7.1 読み込み成功");
