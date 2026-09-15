// ===============================
// 跳び箱AI採点システム Ver6.6
// pose.js
//
// 改良内容
// ・骨格取得は従来通り
// ・跳び箱のおおよその上面位置を画像から推定
// ・左右の手首と跳び箱上面の位置関係を取得
// ・handMeasured をフレームに保存
// ・既存の phase.js / score.js との互換性を維持
//
// ※「着手位置」のための情報だけを追加
// ===============================

let pose = null;

let poseFrames = [];
let frameCount = 0;


// ========================================
// 基本設定
// ========================================

// 跳び箱探索範囲
// 真横撮影を想定
const BOX_SEARCH = {
    xMin: 0.15,
    xMax: 0.90,
    yMin: 0.30,
    yMax: 0.85
};

// 画像の明るさ差を調べる間隔
const BOX_SCAN_STEP = 4;

// 手首と跳び箱上面の許容距離
const HAND_BOX_Y_TOLERANCE = 0.12;


// ========================================
// startPose
// ========================================

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
            onResults(results, video, canvas, ctx);
        });
    }

    async function analyze() {

        if (video.ended) return;

        if (video.paused) {
            requestAnimationFrame(analyze);
            return;
        }

        try {
            await pose.send({
                image: video
            });
        } catch (error) {
            console.error("Pose解析エラー:", error);
        }

        requestAnimationFrame(analyze);
    }

    analyze();
}


// ========================================
// onResults
// ========================================

function onResults(results, video, canvas, ctx) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (!results.poseLandmarks) {
        return;
    }


    // ====================================
    // 骨格描画
    // ====================================

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


    // ====================================
    // 跳び箱位置を推定
    // ====================================

    const boxInfo = detectVaultingBox(
        results.image,
        results.poseLandmarks
    );


    // ====================================
    // 手首位置
    // ====================================

    const handInfo = calculateHandBoxPosition(
        results.poseLandmarks,
        boxInfo
    );


    // ====================================
    // 跳び箱の推定位置を描画
    // ====================================

    drawVaultingBoxGuide(
        ctx,
        boxInfo,
        canvas
    );


    // ====================================
    // フレーム保存
    // ====================================

    poseFrames.push({

        frame: frameCount,

        time: video.currentTime,

        landmarks: results.poseLandmarks.map(
            landmark => ({
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
                visibility: landmark.visibility
            })
        ),

        // ----------------------------
        // 跳び箱情報
        // ----------------------------

        vaultingBox: boxInfo,

        boxX: boxInfo ? boxInfo.x : NaN,

        boxRight: boxInfo
            ? boxInfo.right
            : NaN,

        boxTopY: boxInfo
            ? boxInfo.topY
            : NaN,

        boxWidth: boxInfo
            ? boxInfo.width
            : NaN,

        // ----------------------------
        // 着手位置情報
        // ----------------------------

        handMeasured: handInfo.handMeasured,

        handBoxDistance: handInfo.handBoxDistance,

        handX: handInfo.handX,

        handY: handInfo.handY,

        handContactLike: handInfo.contactLike,

        // 左右の手首
        leftHandBoxDistance:
            handInfo.leftHandBoxDistance,

        rightHandBoxDistance:
            handInfo.rightHandBoxDistance
    });

    frameCount++;
}


// ========================================
// 跳び箱検出
// ========================================

function detectVaultingBox(image, landmarks) {

    if (!image) {
        return null;
    }


    // ------------------------------------
    // Canvasを使って画像を縮小
    // ------------------------------------

    const width = 320;
    const height = 180;

    let tempCanvas =
        document.getElementById("boxDetectCanvas");

    if (!tempCanvas) {

        tempCanvas =
            document.createElement("canvas");

        tempCanvas.id = "boxDetectCanvas";

        tempCanvas.width = width;
        tempCanvas.height = height;

        tempCanvas.style.display = "none";

        document.body.appendChild(tempCanvas);
    }

    const tempCtx =
        tempCanvas.getContext("2d", {
            willReadFrequently: true
        });

    try {

        tempCtx.drawImage(
            image,
            0,
            0,
            width,
            height
        );

    } catch (error) {

        return null;
    }


    const imageData =
        tempCtx.getImageData(
            0,
            0,
            width,
            height
        );

    const data = imageData.data;


    // ------------------------------------
    // 横方向のエッジを探す
    //
    // 跳び箱の上面は
    // 比較的長い横方向の境界を持つ
    // ------------------------------------

    let bestY = -1;
    let bestScore = 0;


    const startY =
        Math.floor(height * BOX_SEARCH.yMin);

    const endY =
        Math.floor(height * BOX_SEARCH.yMax);


    const startX =
        Math.floor(width * BOX_SEARCH.xMin);

    const endX =
        Math.floor(width * BOX_SEARCH.xMax);


    for (
        let y = startY;
        y < endY;
        y += BOX_SCAN_STEP
    ) {

        let score = 0;

        for (
            let x = startX;
            x < endX - 2;
            x += 2
        ) {

            const p1 =
                ((y * width) + x) * 4;

            const p2 =
                ((y + 2) * width + x) * 4;


            const r1 = data[p1];
            const g1 = data[p1 + 1];
            const b1 = data[p1 + 2];

            const r2 = data[p2];
            const g2 = data[p2 + 1];
            const b2 = data[p2 + 2];


            const brightness1 =
                (r1 + g1 + b1) / 3;

            const brightness2 =
                (r2 + g2 + b2) / 3;


            const difference =
                Math.abs(
                    brightness2 -
                    brightness1
                );


            if (difference > 25) {
                score++;
            }
        }


        if (score > bestScore) {

            bestScore = score;
            bestY = y;
        }
    }


    // ------------------------------------
    // エッジが弱い場合
    // ------------------------------------

    if (
        bestY < 0 ||
        bestScore < 8
    ) {

        return null;
    }


    // ------------------------------------
    // 上面Y座標
    // ------------------------------------

    const topY =
        bestY / height;


    // ------------------------------------
    // X方向の範囲を推定
    // ------------------------------------

    let left = endX;
    let right = startX;


    for (
        let x = startX;
        x < endX;
        x += 2
    ) {

        let verticalScore = 0;

        for (
            let y = Math.max(startY, bestY - 8);
            y < Math.min(endY, bestY + 8);
            y += 2
        ) {

            const p =
                ((y * width) + x) * 4;

            const p2 =
                (((y + 2) * width) + x) * 4;


            if (
                p2 + 2 >= data.length
            ) {
                continue;
            }


            const b1 =
                (
                    data[p] +
                    data[p + 1] +
                    data[p + 2]
                ) / 3;


            const b2 =
                (
                    data[p2] +
                    data[p2 + 1] +
                    data[p2 + 2]
                ) / 3;


            if (
                Math.abs(b2 - b1) > 18
            ) {

                verticalScore++;
            }
        }


        if (verticalScore >= 2) {

            left =
                Math.min(left, x);

            right =
                Math.max(right, x);
        }
    }


    // ------------------------------------
    // X範囲が取得できない場合
    // ------------------------------------

    if (
        right <= left ||
        right - left < 20
    ) {

        return {
            x: startX / width,
            right: endX / width,
            topY: topY,
            width:
                (endX - startX) / width,
            confidence: 0.2
        };
    }


    const boxX =
        left / width;

    const boxRight =
        right / width;

    const boxWidth =
        boxRight - boxX;


    // ------------------------------------
    // 信頼度
    // ------------------------------------

    let confidence =
        Math.min(
            1,
            bestScore / 40
        );


    return {

        x: boxX,

        right: boxRight,

        topY: topY,

        width: boxWidth,

        confidence: confidence
    };
}


// ========================================
// 手と跳び箱の位置関係
// ========================================

function calculateHandBoxPosition(
    landmarks,
    boxInfo
) {

    if (
        !landmarks ||
        landmarks.length < 17
    ) {

        return emptyHandResult();
    }


    const leftWrist =
        landmarks[15];

    const rightWrist =
        landmarks[16];


    if (
        !leftWrist &&
        !rightWrist
    ) {

        return emptyHandResult();
    }


    let leftDistance = NaN;
    let rightDistance = NaN;


    // ------------------------------------
    // 左手
    // ------------------------------------

    if (
        leftWrist &&
        Number.isFinite(Number(leftWrist.x)) &&
        Number.isFinite(Number(leftWrist.y))
    ) {

        leftDistance =
            calculateSingleHandDistance(
                leftWrist,
                boxInfo
            );
    }


    // ------------------------------------
    // 右手
    // ------------------------------------

    if (
        rightWrist &&
        Number.isFinite(Number(rightWrist.x)) &&
        Number.isFinite(Number(rightWrist.y))
    ) {

        rightDistance =
            calculateSingleHandDistance(
                rightWrist,
                boxInfo
            );
    }


    // ------------------------------------
    // 有効な手だけ使う
    // ------------------------------------

    const values = [];

    if (Number.isFinite(leftDistance)) {
        values.push({
            value: leftDistance,
            x: leftWrist.x,
            y: leftWrist.y
        });
    }

    if (Number.isFinite(rightDistance)) {
        values.push({
            value: rightDistance,
            x: rightWrist.x,
            y: rightWrist.y
        });
    }


    if (values.length === 0) {
        return emptyHandResult();
    }


    // ------------------------------------
    // 最も跳び箱に近い手を採用
    // ------------------------------------

    values.sort(
        (a, b) =>
            a.value - b.value
    );


    const best =
        values[0];


    return {

        handMeasured:
            Math.abs(best.value),

        handBoxDistance:
            Math.abs(best.value),

        handX:
            best.x,

        handY:
            best.y,

        contactLike:
            Math.abs(best.value)
            <= HAND_BOX_Y_TOLERANCE,

        leftHandBoxDistance:
            Number.isFinite(leftDistance)
                ? Math.abs(leftDistance)
                : NaN,

        rightHandBoxDistance:
            Number.isFinite(rightDistance)
                ? Math.abs(rightDistance)
                : NaN
    };
}


// ========================================
// 片手と跳び箱の距離
// ========================================

function calculateSingleHandDistance(
    wrist,
    boxInfo
) {

    if (!boxInfo) {
        return NaN;
    }


    const handX =
        Number(wrist.x);

    const handY =
        Number(wrist.y);


    if (
        !Number.isFinite(handX) ||
        !Number.isFinite(handY)
    ) {

        return NaN;
    }


    // ------------------------------------
    // 手が跳び箱の横方向に入っているか
    // ------------------------------------

    const insideX =
        handX >= boxInfo.x &&
        handX <= boxInfo.right;


    // ------------------------------------
    // 跳び箱上面とのY距離
    // ------------------------------------

    const verticalDistance =
        Math.abs(
            handY - boxInfo.topY
        );


    // ------------------------------------
    // 跳び箱の外側にいる場合
    //
    // X方向の距離も加える
    // ------------------------------------

    let horizontalDistance = 0;


    if (handX < boxInfo.x) {

        horizontalDistance =
            boxInfo.x - handX;

    } else if (
        handX > boxInfo.right
    ) {

        horizontalDistance =
            handX - boxInfo.right;
    }


    // ------------------------------------
    // 跳び箱幅で正規化
    // ------------------------------------

    const normalizedHorizontal =
        boxInfo.width > 0
            ? horizontalDistance /
              boxInfo.width
            : horizontalDistance;


    // ------------------------------------
    // 総合距離
    // ------------------------------------

    let distance;


    if (insideX) {

        // 上面の上に手がある場合
        distance =
            verticalDistance;

    } else {

        // 横方向にも離れている場合
        distance =
            Math.sqrt(
                verticalDistance *
                verticalDistance +
                normalizedHorizontal *
                normalizedHorizontal
            );
    }


    return distance;
}


// ========================================
// 空の結果
// ========================================

function emptyHandResult() {

    return {

        handMeasured: NaN,

        handBoxDistance: NaN,

        handX: NaN,

        handY: NaN,

        contactLike: false,

        leftHandBoxDistance: NaN,

        rightHandBoxDistance: NaN
    };
}


// ========================================
// 跳び箱ガイド描画
// ========================================

function drawVaultingBoxGuide(
    ctx,
    boxInfo,
    canvas
) {

    if (!boxInfo) {
        return;
    }


    const x =
        boxInfo.x *
        canvas.width;

    const right =
        boxInfo.right *
        canvas.width;

    const y =
        boxInfo.topY *
        canvas.height;


    // ------------------------------------
    // 跳び箱上面の基準線
    // ------------------------------------

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
        x,
        y
    );

    ctx.lineTo(
        right,
        y
    );

    ctx.strokeStyle =
        "rgba(0,255,255,0.8)";

    ctx.lineWidth = 3;

    ctx.stroke();


    // ------------------------------------
    // 左端
    // ------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x,
        y - 10
    );

    ctx.lineTo(
        x,
        y + 10
    );

    ctx.stroke();


    // ------------------------------------
    // 右端
    // ------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        right,
        y - 10
    );

    ctx.lineTo(
        right,
        y + 10
    );

    ctx.stroke();


    ctx.restore();
}


// ========================================
// データ取得
// ========================================

function getPoseFrames() {

    return poseFrames;
}


function clearPoseFrames() {

    poseFrames = [];

    frameCount = 0;
}


// ========================================
// グローバル公開
// ========================================

window.startPose =
    startPose;

window.getPoseFrames =
    getPoseFrames;

window.clearPoseFrames =
    clearPoseFrames;