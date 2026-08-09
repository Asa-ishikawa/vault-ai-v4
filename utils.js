// ===============================
// 跳び箱AI採点システム Ver5.5
// utils.js
// 採点精度向上・フレーム安定化版
// ===============================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


// ----------------------------
// 数値チェック
// ----------------------------

function isValidNumber(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}


// ----------------------------
// 点の取得
// ----------------------------

function getPoint(frame, index) {

    if (!frame) return null;

    let point = null;

    if (Array.isArray(frame)) {
        point = frame[index];
    }

    else if (frame.landmarks) {
        point = frame.landmarks[index];
    }

    else if (frame.poseLandmarks) {
        point = frame.poseLandmarks[index];
    }

    if (!point) return null;

    if (
        !isValidNumber(point.x) ||
        !isValidNumber(point.y)
    ) {
        return null;
    }

    return point;
}


// ----------------------------
// 左右平均
// ----------------------------

function getAveragePoint(frame, leftIndex, rightIndex) {

    const left =
        getPoint(frame, leftIndex);

    const right =
        getPoint(frame, rightIndex);

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ----------------------------
// 肩中心
// ----------------------------

function getShoulderCenter(frame) {

    return getAveragePoint(
        frame,
        11,
        12
    );
}


// ----------------------------
// 腰中心
// ----------------------------

function getHipCenter(frame) {

    return getAveragePoint(
        frame,
        23,
        24
    );
}


// ----------------------------
// 身体サイズ
// 肩幅＋胴体長を利用
// ----------------------------

function getBodyScale(frame) {

    const shoulder =
        getShoulderCenter(frame);

    const hip =
        getHipCenter(frame);

    if (!shoulder || !hip) {
        return 0;
    }

    const dx =
        shoulder.x - hip.x;

    const dy =
        shoulder.y - hip.y;

    const torsoLength =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    const leftShoulder =
        getPoint(frame, 11);

    const rightShoulder =
        getPoint(frame, 12);

    let shoulderWidth = 0;

    if (
        leftShoulder &&
        rightShoulder
    ) {

        const sx =
            leftShoulder.x -
            rightShoulder.x;

        const sy =
            leftShoulder.y -
            rightShoulder.y;

        shoulderWidth =
            Math.sqrt(
                sx * sx +
                sy * sy
            );

    }

    return Math.max(
        torsoLength,
        shoulderWidth,
        0.001
    );
}


// ----------------------------
// 角度計算
// ----------------------------

function getAngle(a, b, c) {

    if (!a || !b || !c) {
        return 0;
    }

    const abx = a.x - b.x;
    const aby = a.y - b.y;

    const cbx = c.x - b.x;
    const cby = c.y - b.y;

    const dot =
        abx * cbx +
        aby * cby;

    const ab =
        Math.sqrt(
            abx * abx +
            aby * aby
        );

    const cb =
        Math.sqrt(
            cbx * cbx +
            cby * cby
        );

    if (
        ab === 0 ||
        cb === 0
    ) {
        return 0;
    }

    const cos =
        clamp(
            dot / (ab * cb),
            -1,
            1
        );

    return (
        Math.acos(cos) *
        180 /
        Math.PI
    );
}


// ----------------------------
// 膝角度
// ----------------------------

function getLeftKneeAngle(frame) {

    return getAngle(
        getPoint(frame, 23),
        getPoint(frame, 25),
        getPoint(frame, 27)
    );
}


function getRightKneeAngle(frame) {

    return getAngle(
        getPoint(frame, 24),
        getPoint(frame, 26),
        getPoint(frame, 28)
    );
}


function getAverageKneeAngle(frame) {

    const left =
        getLeftKneeAngle(frame);

    const right =
        getRightKneeAngle(frame);

    if (
        left <= 0 &&
        right <= 0
    ) {
        return 0;
    }

    if (left <= 0) {
        return right;
    }

    if (right <= 0) {
        return left;
    }

    return (
        left + right
    ) / 2;
}


// ----------------------------
// フレーム番号を取得
// ----------------------------

function getFrameNumber(frame, index) {

    if (
        frame &&
        isValidNumber(frame.frame)
    ) {
        return frame.frame;
    }

    return index;
}


// ----------------------------
// 骨格信頼度
// ----------------------------

function getLandmarkVisibility(
    frame,
    index
) {

    const point =
        getPoint(frame, index);

    if (!point) {
        return 0;
    }

    if (
        isValidNumber(
            point.visibility
        )
    ) {
        return point.visibility;
    }

    return 1;
}


// ----------------------------
// フレーム品質
// ----------------------------

function getFrameQuality(frame) {

    const importantPoints = [
        11, 12,
        23, 24,
        25, 26,
        27, 28
    ];

    let total = 0;
    let count = 0;

    importantPoints.forEach(
        index => {

            const visibility =
                getLandmarkVisibility(
                    frame,
                    index
                );

            if (visibility > 0) {

                total += visibility;
                count++;

            }

        }
    );

    if (count === 0) {
        return 0;
    }

    return total / count;
}


// ----------------------------
// 移動平均
// ----------------------------

function movingAverage(
    values,
    windowSize = 5
) {

    if (!values.length) {
        return [];
    }

    const result = [];

    const half =
        Math.floor(
            windowSize / 2
        );

    for (
        let i = 0;
        i < values.length;
        i++
    ) {

        let sum = 0;
        let count = 0;

        for (
            let j =
                Math.max(0, i - half);
            j <=
                Math.min(
                    values.length - 1,
                    i + half
                );
            j++
        ) {

            if (
                isValidNumber(
                    values[j]
                )
            ) {

                sum += values[j];
                count++;

            }

        }

        result.push(
            count > 0
                ? sum / count
                : values[i]
        );

    }

    return result;
}


// ----------------------------
// フレーム平滑化
// 重要ランドマークのみ軽く平滑化
// ----------------------------

function prepareFrames(frames) {

    if (
        !Array.isArray(frames) ||
        frames.length === 0
    ) {
        return [];
    }

    const validFrames =
        frames.filter(
            frame =>
                frame &&
                getFrameQuality(frame) > 0
        );

    if (validFrames.length === 0) {
        return [];
    }

    const indices = [
        11, 12,
        15, 16,
        23, 24,
        25, 26,
        27, 28
    ];

    const result =
        validFrames.map(
            (frame, index) => {

                let source;

                if (Array.isArray(frame)) {
                    source = frame;
                }
                else if (
                    frame.landmarks
                ) {
                    source =
                        frame.landmarks;
                }
                else if (
                    frame.poseLandmarks
                ) {
                    source =
                        frame.poseLandmarks;
                }
                else {
                    source = [];
                }

                const copied =
                    source.map(
                        point => {

                            if (!point) {
                                return point;
                            }

                            return {
                                ...point
                            };

                        }
                    );

                return {
                    ...frame,
                    landmarks: copied,
                    frame:
                        getFrameNumber(
                            frame,
                            index
                        )
                };

            }
        );

    // ----------------------------
    // x / y を平滑化
    // ----------------------------

    indices.forEach(
        landmarkIndex => {

            const xs =
                result.map(
                    frame => {

                        const p =
                            getPoint(
                                frame,
                                landmarkIndex
                            );

                        return p
                            ? p.x
                            : NaN;

                    }
                );

            const ys =
                result.map(
                    frame => {

                        const p =
                            getPoint(
                                frame,
                                landmarkIndex
                            );

                        return p
                            ? p.y
                            : NaN;

                    }
                );

            const smoothX =
                movingAverage(
                    xs,
                    5
                );

            const smoothY =
                movingAverage(
                    ys,
                    5
                );

            result.forEach(
                (frame, index) => {

                    const p =
                        getPoint(
                            frame,
                            landmarkIndex
                        );

                    if (!p) return;

                    p.x =
                        smoothX[index];

                    p.y =
                        smoothY[index];

                }
            );

        }
    );

    return result;
}


// ----------------------------
// 公開
// ----------------------------

window.clamp =
    clamp;

window.getPoint =
    getPoint;

window.getAveragePoint =
    getAveragePoint;

window.getShoulderCenter =
    getShoulderCenter;

window.getHipCenter =
    getHipCenter;

window.getBodyScale =
    getBodyScale;

window.getAngle =
    getAngle;

window.getLeftKneeAngle =
    getLeftKneeAngle;

window.getRightKneeAngle =
    getRightKneeAngle;

window.getAverageKneeAngle =
    getAverageKneeAngle;

window.getFrameQuality =
    getFrameQuality;

window.movingAverage =
    movingAverage;

window.prepareFrames =
    prepareFrames;

console.log(
    "utils.js Ver5.5 読み込み成功"
);