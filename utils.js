// ===============================
// 跳び箱AI採点システム Ver5.4
// utils.js
// 共通計算・座標取得・平滑化・正規化
// ===============================


// =====================================
// ① ランドマーク取得
// =====================================

function getPoint(frame, index) {

    if (!frame || !frame.landmarks) {
        return null;
    }

    const point = frame.landmarks[index];

    if (!point) {
        return null;
    }

    return point;
}


// =====================================
// ② 腰の中心
// =====================================

function getHipCenter(frame) {

    const left = getPoint(frame, 23);
    const right = getPoint(frame, 24);

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
        z: (left.z + right.z) / 2
    };
}


// =====================================
// ③ 肩の中心
// =====================================

function getShoulderCenter(frame) {

    const left = getPoint(frame, 11);
    const right = getPoint(frame, 12);

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
        z: (left.z + right.z) / 2
    };
}


// =====================================
// ④ 身体サイズ
// 肩幅＋腰幅を基準にする
// =====================================

function getBodyScale(frame) {

    const leftShoulder = getPoint(frame, 11);
    const rightShoulder = getPoint(frame, 12);

    const leftHip = getPoint(frame, 23);
    const rightHip = getPoint(frame, 24);

    if (
        !leftShoulder ||
        !rightShoulder ||
        !leftHip ||
        !rightHip
    ) {
        return 1;
    }

    const shoulderWidth = Math.sqrt(

        Math.pow(
            leftShoulder.x - rightShoulder.x,
            2
        )

        +

        Math.pow(
            leftShoulder.y - rightShoulder.y,
            2
        )

    );

    const hipWidth = Math.sqrt(

        Math.pow(
            leftHip.x - rightHip.x,
            2
        )

        +

        Math.pow(
            leftHip.y - rightHip.y,
            2
        )

    );

    const scale =
        (shoulderWidth + hipWidth) / 2;

    if (
        !Number.isFinite(scale) ||
        scale <= 0.001
    ) {
        return 1;
    }

    return scale;
}


// =====================================
// ⑤ 3点から角度を計算
// =====================================

function getAngle(a, b, c) {

    if (!a || !b || !c) {
        return 0;
    }

    const ab = {
        x: a.x - b.x,
        y: a.y - b.y
    };

    const cb = {
        x: c.x - b.x,
        y: c.y - b.y
    };

    const dot =
        ab.x * cb.x +
        ab.y * cb.y;

    const abLength =
        Math.sqrt(
            ab.x * ab.x +
            ab.y * ab.y
        );

    const cbLength =
        Math.sqrt(
            cb.x * cb.x +
            cb.y * cb.y
        );

    if (
        abLength === 0 ||
        cbLength === 0
    ) {
        return 0;
    }

    let cosine =
        dot /
        (abLength * cbLength);

    cosine =
        Math.max(
            -1,
            Math.min(1, cosine)
        );

    return (
        Math.acos(cosine) *
        180 /
        Math.PI
    );
}


// =====================================
// ⑥ 平均膝角度
// =====================================

function getAverageKneeAngle(frame) {

    if (!frame) {
        return 0;
    }

    const leftHip = getPoint(frame, 23);
    const leftKnee = getPoint(frame, 25);
    const leftAnkle = getPoint(frame, 27);

    const rightHip = getPoint(frame, 24);
    const rightKnee = getPoint(frame, 26);
    const rightAnkle = getPoint(frame, 28);

    const leftAngle =
        getAngle(
            leftHip,
            leftKnee,
            leftAnkle
        );

    const rightAngle =
        getAngle(
            rightHip,
            rightKnee,
            rightAnkle
        );

    if (
        leftAngle === 0 &&
        rightAngle === 0
    ) {
        return 0;
    }

    if (leftAngle === 0) {
        return rightAngle;
    }

    if (rightAngle === 0) {
        return leftAngle;
    }

    return (
        leftAngle +
        rightAngle
    ) / 2;
}


// =====================================
// ⑦ 手の幅
// =====================================

function getHandWidth(frame) {

    const left = getPoint(frame, 15);
    const right = getPoint(frame, 16);

    if (!left || !right) {
        return 0;
    }

    return Math.sqrt(

        Math.pow(
            left.x - right.x,
            2
        )

        +

        Math.pow(
            left.y - right.y,
            2
        )

    );
}


// =====================================
// ⑧ 身体サイズで正規化した手幅
// =====================================

function getNormalizedHandWidth(frame) {

    const handWidth =
        getHandWidth(frame);

    const scale =
        getBodyScale(frame);

    if (scale <= 0) {
        return 0;
    }

    return handWidth / scale;
}


// =====================================
// ⑨ 足幅
// =====================================

function getFootWidth(frame) {

    const left = getPoint(frame, 27);
    const right = getPoint(frame, 28);

    if (!left || !right) {
        return 0;
    }

    return Math.sqrt(

        Math.pow(
            left.x - right.x,
            2
        )

        +

        Math.pow(
            left.y - right.y,
            2
        )

    );
}


// =====================================
// ⑩ 身体サイズで正規化した足幅
// =====================================

function getNormalizedFootWidth(frame) {

    const footWidth =
        getFootWidth(frame);

    const scale =
        getBodyScale(frame);

    if (scale <= 0) {
        return 0;
    }

    return footWidth / scale;
}


// =====================================
// ⑪ 2点間距離
// =====================================

function getDistance(a, b) {

    if (!a || !b) {
        return 0;
    }

    return Math.sqrt(

        Math.pow(a.x - b.x, 2)

        +

        Math.pow(a.y - b.y, 2)

        +

        Math.pow(
            (a.z || 0) - (b.z || 0),
            2
        )

    );
}


// =====================================
// ⑫ フレーム間の移動量
// =====================================

function getMovement(a, b, index) {

    const pointA =
        getPoint(a, index);

    const pointB =
        getPoint(b, index);

    if (!pointA || !pointB) {
        return 0;
    }

    return getDistance(
        pointA,
        pointB
    );
}


// =====================================
// ⑬ 2点間の平均値
// =====================================

function average(a, b) {

    if (
        !Number.isFinite(a) &&
        !Number.isFinite(b)
    ) {
        return 0;
    }

    if (!Number.isFinite(a)) {
        return b;
    }

    if (!Number.isFinite(b)) {
        return a;
    }

    return (a + b) / 2;
}


// =====================================
// ⑭ 値を範囲内に収める
// =====================================

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


// =====================================
// ⑮ 3フレーム移動平均
// =====================================

function smoothFrames(frames) {

    if (!frames || frames.length < 3) {
        return frames;
    }

    const result = [];

    for (let i = 0; i < frames.length; i++) {

        const previous =
            frames[Math.max(0, i - 1)];

        const current =
            frames[i];

        const next =
            frames[
                Math.min(
                    frames.length - 1,
                    i + 1
                )
            ];

        if (
            !current ||
            !current.landmarks
        ) {
            result.push(current);
            continue;
        }

        const landmarks =
            current.landmarks.map(
                (point, index) => {

                    const p =
                        previous.landmarks[index];

                    const c =
                        current.landmarks[index];

                    const n =
                        next.landmarks[index];

                    if (!p || !c || !n) {
                        return c;
                    }

                    return {

                        x:
                            (
                                p.x +
                                c.x +
                                n.x
                            ) / 3,

                        y:
                            (
                                p.y +
                                c.y +
                                n.y
                            ) / 3,

                        z:
                            (
                                (p.z || 0) +
                                (c.z || 0) +
                                (n.z || 0)
                            ) / 3,

                        visibility:
                            (
                                (p.visibility || 0) +
                                (c.visibility || 0) +
                                (n.visibility || 0)
                            ) / 3

                    };

                }
            );

        result.push({

            frame: current.frame,

            time: current.time,

            landmarks: landmarks

        });

    }

    return result;
}


// =====================================
// ⑯ 5フレーム移動平均
// =====================================

function smoothFramesStrong(frames) {

    if (!frames || frames.length < 5) {
        return smoothFrames(frames);
    }

    const result = [];

    for (let i = 0; i < frames.length; i++) {

        const start =
            Math.max(0, i - 2);

        const end =
            Math.min(
                frames.length - 1,
                i + 2
            );

        const source =
            frames[i];

        if (
            !source ||
            !source.landmarks
        ) {
            result.push(source);
            continue;
        }

        const landmarks =
            source.landmarks.map(
                (point, index) => {

                    let sumX = 0;
                    let sumY = 0;
                    let sumZ = 0;
                    let sumVisibility = 0;
                    let count = 0;

                    for (
                        let j = start;
                        j <= end;
                        j++
                    ) {

                        const p =
                            frames[j].landmarks[index];

                        if (!p) continue;

                        sumX += p.x;
                        sumY += p.y;
                        sumZ += p.z || 0;
                        sumVisibility +=
                            p.visibility || 0;

                        count++;

                    }

                    if (count === 0) {
                        return point;
                    }

                    return {

                        x: sumX / count,

                        y: sumY / count,

                        z: sumZ / count,

                        visibility:
                            sumVisibility / count

                    };

                }
            );

        result.push({

            frame: source.frame,

            time: source.time,

            landmarks: landmarks

        });

    }

    return result;
}


// =====================================
// ⑰ 信頼度確認
// =====================================

function isReliablePoint(
    frame,
    index,
    threshold = 0.5
) {

    const point =
        getPoint(frame, index);

    if (!point) {
        return false;
    }

    if (
        typeof point.visibility !==
        "number"
    ) {
        return true;
    }

    return point.visibility >= threshold;

}


// =====================================
// ⑱ フレーム信頼度
// =====================================

function getFrameReliability(frame) {

    if (!frame || !frame.landmarks) {
        return 0;
    }

    const importantPoints = [

        11, 12,
        15, 16,
        23, 24,
        25, 26,
        27, 28

    ];

    let total = 0;
    let count = 0;

    importantPoints.forEach(index => {

        const point =
            getPoint(frame, index);

        if (!point) return;

        total +=
            typeof point.visibility ===
            "number"
                ? point.visibility
                : 1;

        count++;

    });

    if (count === 0) {
        return 0;
    }

    return total / count;
}


// =====================================
// ⑲ 信頼度の低いフレームを除外
// =====================================

function filterReliableFrames(
    frames,
    threshold = 0.45
) {

    if (!frames) {
        return [];
    }

    return frames.filter(frame => {

        return (
            getFrameReliability(frame)
            >= threshold
        );

    });

}


// =====================================
// ⑳ 平滑化＋信頼度確認
// =====================================

function prepareFrames(frames) {

    if (!frames || frames.length === 0) {
        return [];
    }

    const reliable =
        filterReliableFrames(
            frames,
            0.35
        );

    if (reliable.length < 20) {

        return smoothFrames(frames);

    }

    return smoothFrames(reliable);

}


// =====================================
// 公開
// =====================================

window.getPoint =
    getPoint;

window.getHipCenter =
    getHipCenter;

window.getShoulderCenter =
    getShoulderCenter;

window.getBodyScale =
    getBodyScale;

window.getAngle =
    getAngle;

window.getAverageKneeAngle =
    getAverageKneeAngle;

window.getHandWidth =
    getHandWidth;

window.getNormalizedHandWidth =
    getNormalizedHandWidth;

window.getFootWidth =
    getFootWidth;

window.getNormalizedFootWidth =
    getNormalizedFootWidth;

window.getDistance =
    getDistance;

window.getMovement =
    getMovement;

window.average =
    average;

window.clamp =
    clamp;

window.smoothFrames =
    smoothFrames;

window.smoothFramesStrong =
    smoothFramesStrong;

window.isReliablePoint =
    isReliablePoint;

window.getFrameReliability =
    getFrameReliability;

window.filterReliableFrames =
    filterReliableFrames;

window.prepareFrames =
    prepareFrames;


console.log(
    "utils.js Ver5.4 読み込み成功"
);