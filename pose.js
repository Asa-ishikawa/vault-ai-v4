
// ============================================================
// 跳び箱AI採点システム
// pose.js Ver7.5
// Frame 3～8画像確認機能付き・完全置き換え版
//
// Ver7.3 修正点
// ・解析フレームを専用Canvasに固定
// ・MediaPipeと跳び箱検出に同一画像を使用
// ・動画時間もフレームごとに固定して保存
// ・解析中の動画時間差による座標ずれを防止
// ・2回目以降の解析に対応
// ・前回の解析ループを無効化
// ・既存app.jsとの互換性を維持
// ・Frame 3～8の解析画像を保存して診断欄に表示
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

// Ver7.3：解析画像を固定するCanvas
let activeFrameCanvas = null;
let activeFrameCtx = null;

// Ver7.3：解析中のフレーム情報
let activeFrameTime = 0;
let activeVaultBoxResult = null;

// Ver7.5：確認用Frame 3～8画像
// キーは診断表と同じframe番号（0始まり）
let diagnosticFrameImages = {};

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
        <strong>骨格検出診断 Ver7.3</strong><br>

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

        <hr>

        <strong>Frame 3～8 画像確認</strong><br>
        <div style="font-size:13px;color:#555;">
            診断表と同じフレーム番号です。画像は解析時に固定した映像です。
        </div>
        ${
            [3, 4, 5, 6, 7, 8].map(frameNumber => {
                const item = diagnosticFrameImages[frameNumber];
                return item
                    ? `
                        <div style="margin-top:12px;padding:8px;background:#fff;border:1px solid #bbb;border-radius:6px;">
                            <strong>Frame ${frameNumber}</strong>
                            <div>動画時間：${Number(item.time).toFixed(3)} 秒</div>
                            <img
                                src="${item.image}"
                                alt="解析Frame ${frameNumber}"
                                style="display:block;max-width:100%;height:auto;margin-top:8px;border:1px solid #999;border-radius:6px;"
                            >
                        </div>
                    `
                    : `<div style="margin-top:6px;">Frame ${frameNumber}：まだ画像がありません。</div>`;
            }).join("")
        }
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

    // 常に現在の解析対象を参照する
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
// Ver7.3：解析用Canvasの準備
// ============================================================

function createFrameCanvas(video) {
    const width = Number(video.videoWidth);
    const height = Number(video.videoHeight);

    if (!width || !height) {
        throw new Error(
            "動画の画像サイズを取得できません。"
        );
    }

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    if (!ctx) {
        throw new Error(
            "解析用Canvasを作成できません。"
        );
    }

    return {
        canvas,
        ctx
    };
}

// ============================================================
// Ver7.3：解析フレームを固定
// ============================================================

function captureAnalysisFrame(video) {
    if (!activeFrameCanvas || !activeFrameCtx) {
        throw new Error(
            "解析用Canvasが準備されていません。"
        );
    }

    const width = Number(video.videoWidth);
    const height = Number(video.videoHeight);

    if (
        !width ||
        !height ||
        width !== activeFrameCanvas.width ||
        height !== activeFrameCanvas.height
    ) {
        throw new Error(
            "動画の画像サイズが変化しました。"
        );
    }

    // この瞬間の動画時間を保存
    const capturedTime = Number(video.currentTime);

    // 動画の現在フレームをCanvasに固定
    activeFrameCtx.drawImage(
        video,
        0,
        0,
        width,
        height
    );

    return {
        time: capturedTime,
        canvas: activeFrameCanvas
    };
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

    // 動画サイズ確認
    if (!video.videoWidth || !video.videoHeight) {
        throw new Error(
            "動画の読み込みが完了していません。"
        );
    }

    // Ver7.3：解析用Canvasを作成
    const frameCanvasInfo = createFrameCanvas(video);

    activeFrameCanvas = frameCanvasInfo.canvas;
    activeFrameCtx = frameCanvasInfo.ctx;

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

            // ------------------------------------
            // STEP 1
            // 解析する瞬間の映像を固定する
            // ------------------------------------

            const captured = captureAnalysisFrame(video);

            activeFrameTime = captured.time;

            // ------------------------------------
            // STEP 2
            // 固定した同一画像から跳び箱を検出
            // ------------------------------------

            activeVaultBoxResult = null;

            if (
                typeof window.detectVaultBox === "function"
            ) {
                activeVaultBoxResult =
                    window.detectVaultBox(captured.canvas);
            }

            // ------------------------------------
            // STEP 3
            // 同じ固定画像をMediaPipeに渡す
            // ------------------------------------

            await pose.send({
                image: captured.canvas
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

    // ========================================
    // Ver7.3：同一画像から取得した跳び箱情報
    // ========================================

    const vaultBoxResult = activeVaultBoxResult;

    const diagnostic =
        document.getElementById("vaultDiagnostic");

    if (
        vaultBoxResult &&
        vaultBoxResult.detected === true
    ) {

        if (diagnostic) {
            diagnostic.textContent =
                "跳び箱検出：成功（同一フレームから取得）";
        }

        if (
            typeof window.drawVaultBoxDetection === "function"
        ) {
            window.drawVaultBoxDetection(
                canvas,
                vaultBoxResult
            );
        }

    } else {

        if (diagnostic) {
            diagnostic.textContent =
                "跳び箱検出：候補なし";
        }
    }

    // 人物の骨格検出
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

    // ========================================
    // Ver7.5：Frame 3～8の画像を保存
    // frameCountは0から始まり、診断表の番号と一致
    // ========================================

    if (
        frameCount >= 3 &&
        frameCount <= 8 &&
        activeFrameCanvas
    ) {
        try {
            diagnosticFrameImages[frameCount] = {
                image: activeFrameCanvas.toDataURL("image/jpeg", 0.85),
                time: Number(activeFrameTime)
            };
        } catch (error) {
            console.error(`Frame ${frameCount}画像の保存に失敗:`, error);
            delete diagnosticFrameImages[frameCount];
        }
    }

    // ========================================
    // 座標を保存
    // ========================================

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

    // ========================================
    // 手首と跳び箱の相対位置を計算
    // ========================================

    let handPositionRelativeToVault = null;
    let leftHandPositionRelativeToVault = null;
    let rightHandPositionRelativeToVault = null;

    if (
        vaultBoxResult &&
        vaultBoxResult.detected &&
        vaultBoxResult.normalized &&
        vaultBoxResult.normalized.width > 0 &&
        vaultBoxResult.normalized.height > 0
    ) {

        const box = vaultBoxResult.normalized;

        if (isValidPoint(leftWrist)) {
            leftHandPositionRelativeToVault = {
                x: (leftWrist.x - box.x) / box.width,
                y: (leftWrist.y - box.y) / box.height
            };
        }

        if (isValidPoint(rightWrist)) {
            rightHandPositionRelativeToVault = {
                x: (rightWrist.x - box.x) / box.width,
                y: (rightWrist.y - box.y) / box.height
            };
        }

        if (
            leftHandPositionRelativeToVault &&
            rightHandPositionRelativeToVault
        ) {
            handPositionRelativeToVault = {
                x: (
                    leftHandPositionRelativeToVault.x +
                    rightHandPositionRelativeToVault.x
                ) / 2,

                y: (
                    leftHandPositionRelativeToVault.y +
                    rightHandPositionRelativeToVault.y
                ) / 2
            };
        }
    }

    // ========================================
    // フレーム情報を保存
    // ========================================

    const frameData = {

        frame: frameCount,

        // Ver7.3：動画時間も固定画像の取得時刻
        time: Number(activeFrameTime),

        // 跳び箱の天板位置
        vaultBox: (
            vaultBoxResult &&
            vaultBoxResult.detected
        ) ? {
            x: vaultBoxResult.normalized.x,
            y: vaultBoxResult.normalized.y,
            width: vaultBoxResult.normalized.width,
            height: vaultBoxResult.normalized.height,
            confidence: vaultBoxResult.confidence
        } : null,

        leftHandPositionRelativeToVault:
            leftHandPositionRelativeToVault,

        rightHandPositionRelativeToVault:
            rightHandPositionRelativeToVault,

        handPositionRelativeToVault:
            handPositionRelativeToVault,

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

    // Ver7.3：解析Canvas情報も解除
    activeFrameCanvas = null;
    activeFrameCtx = null;

    activeFrameTime = 0;
    activeVaultBoxResult = null;

    // Ver7.5：前回のFrame 3～8画像を消去
    diagnosticFrameImages = {};

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

console.log("pose.js Ver7.5 読み込み成功");




