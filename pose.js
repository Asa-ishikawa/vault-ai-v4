
// ============================================================
// 跳び箱AI採点システム
// pose.js Ver7.2
// 完全置き換え版
//
// 修正点
// ・2回目以降の解析でも骨格結果を受け取れるように修正
// ・Poseの結果受信関数が古いanalysisTokenを保持する問題を解消
// ・解析ごとの動画・Canvas情報を管理
// ・前回の解析ループを無効化
// ・解析完了待機に対応
// ・既存app.jsとの互換性を維持
// ============================================================

let pose = null;
let poseFrames = [];

let frameCount = 0;
let processedFrameCount = 0;

let analysisToken = 0;
let activeToken = 0;

let analysisPromise = Promise.resolve();
let resolveAnalysis = null;

let analysisRunning = false;

// 現在の解析対象
let activeVideo = null;
let activeCanvas = null;
let activeCtx = null;

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

    if (!video) return;

    const currentTime = Number(video.currentTime);
    const duration = Number(video.duration);

    diagnostic.innerHTML = `
        <strong>骨格検出診断 Ver7.2</strong><br>

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
// Poseの準備
// ============================================================

function initializePose() {
    if (pose) return;

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

    // 重要：
    // ここでは特定の解析のtokenを記憶しない。
    // 常に現在の解析対象を参照する。
    pose.onResults(results => {

        if (!analysisRunning) return;

        if (activeToken !== analysisToken) return;

        if (!activeVideo || !activeCanvas || !activeCtx) {
            return;
        }

        onResults(
            results,
            activeVideo,
            activeCanvas,
            activeCtx
        );
    });

    console.log("MediaPipe Pose 初期化完了");
}

// ============================================================
// 解析開始
// ============================================================

async function startPose(video, canvas, ctx) {

    // 前回のデータを初期化
    clearPoseFrames();

    const myToken = analysisToken;

    // 今回の解析対象を登録
    activeToken = myToken;
    activeVideo = video;
    activeCanvas = canvas;
    activeCtx = ctx;

    // Canvas確認
    if (!video || !canvas || !ctx) {
        throw new Error(
            "動画またはCanvasの情報を取得できません。"
        );
    }

    // Poseの準備
    initializePose();

    getPoseDiagnosticElement();

    analysisRunning = true;

    // 今回の解析完了待機を作成
    analysisPromise = new Promise(resolve => {
        resolveAnalysis = resolve;
    });

    let sending = false;

    async function analyze() {

        // 古い解析ループなら終了
        if (myToken !== analysisToken) return;

        if (!analysisRunning) return;

        // 動画終了
        if (video.ended) {
            finishPoseLoop(myToken, video);
            return;
        }

        // 一時停止中
        if (video.paused) {
            updatePoseDiagnostic(video);
            requestAnimationFrame(analyze);
            return;
        }

        // Pose処理の重複を防止
        if (sending) {
            requestAnimationFrame(analyze);
            return;
        }

        sending = true;

        try {
            await pose.send({
                image: video
            });

        } catch (error) {
            console.error("Pose解析エラー:", error);

        } finally {
            sending = false;
        }

        // 解析中に別の解析へ切り替わった場合
        if (myToken !== analysisToken) return;

        if (!analysisRunning) return;

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

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (!results.poseLandmarks) {
        updatePoseDiagnostic(video);
        return;
    }

    // 骨格の線を描画
    drawConnectors(
        ctx,
        results.poseLandmarks,
        POSE_CONNECTIONS,
        {
            color: "#00ff00",
            lineWidth: 4
        }
    );

    // 骨格の点を描画
    drawLandmarks(
        ctx,
        results.poseLandmarks,
        {
            color: "#ff0000",
            radius: 5
        }
    );

    // 座標を保存
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

    // 古い解析ループを無効化
    analysisToken++;

    // 前回の完了待機を解除
    if (resolveAnalysis) {
        resolveAnalysis();
        resolveAnalysis = null;
    }

    analysisRunning = false;

    // 現在の解析対象を解除
    activeVideo = null;
    activeCanvas = null;
    activeCtx = null;

    activeToken = analysisToken;

    // 解析待機を初期化
    analysisPromise = Promise.resolve();

    // データを初期化
    poseFrames = [];

    frameCount = 0;
    processedFrameCount = 0;

    console.log("Poseデータをリセットしました", {
        analysisToken
    });
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

console.log("pose.js Ver7.2 読み込み成功");
