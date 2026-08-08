// ===============================
// 跳び箱AI採点システム Ver5.3.2
// utils.js
// 共通計算・座標取得
// ===============================


// ----------------------------
// ランドマーク取得
// ----------------------------

function getPoint(frame, index) {

    if (!frame || !frame.landmarks) {
        return null;
    }

    const point =
        frame.landmarks[index];

    if (!point) {
        return null;
    }

    return point;

}


// ----------------------------
// 腰の中心
// ----------------------------

function getHipCenter(frame) {

    const left =
        getPoint(frame, 23);

    const right =
        getPoint(frame, 24);

    if (!left || !right) {
        return null;
    }

    return {

        x: (left.x + right.x) / 2,

        y: (left.y + right.y) / 2,

        z: (left.z + right.z) / 2

    };

}


// ----------------------------
// 3点から角度を計算
// ----------------------------

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


// ----------------------------
// 平均膝角度
// ----------------------------

function getAverageKneeAngle(frame) {

    if (!frame) {
        return 0;
    }

    const leftHip =
        getPoint(frame, 23);

    const leftKnee =
        getPoint(frame, 25);

    const leftAnkle =
        getPoint(frame, 27);

    const rightHip =
        getPoint(frame, 24);

    const rightKnee =
        getPoint(frame, 26);

    const rightAnkle =
        getPoint(frame, 28);

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


// ----------------------------
// 手の位置・幅
// ----------------------------

function getHandWidth(frame) {

    const left =
        getPoint(frame, 15);

    const right =
        getPoint(frame, 16);

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


// ----------------------------
// 足の位置・幅
// ----------------------------

function getFootWidth(frame) {

    const left =
        getPoint(frame, 27);

    const right =
        getPoint(frame, 28);

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


// ----------------------------
// 公開
// ----------------------------

window.getPoint =
    getPoint;

window.getHipCenter =
    getHipCenter;

window.getAngle =
    getAngle;

window.getAverageKneeAngle =
    getAverageKneeAngle;

window.getHandWidth =
    getHandWidth;

window.getFootWidth =
    getFootWidth;

console.log(
    "utils.js 読み込み成功"
);