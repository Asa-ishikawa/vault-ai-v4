// ===============================
// 跳び箱AI採点システム Ver5.4
// phase.js
// 動作フェーズ検出・安定化版
// ===============================

let phaseResult = null;

// ----------------------------
// フェーズ検出
// ----------------------------

function detectPhases(frames) {

    if (!frames || frames.length < 20) {
        return null;
    }

    // ----------------------------
    // 骨格データを平滑化
    // ----------------------------

    const data =
        prepareFrames(frames);

    if (!data || data.length < 20) {
        return null;
    }

    let takeOff = 0;
    let handContact = 0;
    let highestHip = 0;
    let landing = data.length - 1;

    // ----------------------------
    // ① 腰の最高点
    // ----------------------------

    let minHipY = Infinity;

    for (let i = 0; i < data.length; i++) {

        const hip =
            getHipCenter(data[i]);

        if (!hip) continue;

        if (hip.y < minHipY) {

            minHipY = hip.y;
            highestHip = i;

        }

    }

    // ----------------------------
    // ② 着手位置
    // 手首の前方移動が最大になる付近
    // ----------------------------

    let maxHandX = -Infinity;

    for (let i = 0; i < data.length; i++) {

        const left =
            getPoint(data[i], 15);

        const right =
            getPoint(data[i], 16);

        if (!left || !right) continue;

        const handX =
            (left.x + right.x) / 2;

        if (handX > maxHandX) {

            maxHandX = handX;
            handContact = i;

        }

    }

    // ----------------------------
    // ③ 踏切
    // 足首の上昇開始を検出
    // ----------------------------

    let bestTakeOff = 0;
    let bestRise = 0;

    for (
        let i = 3;
        i < handContact;
        i++
    ) {

        const prev =
            getPoint(data[i - 3], 27);

        const current =
            getPoint(data[i], 27);

        if (!prev || !current) continue;

        const rise =
            prev.y - current.y;

        if (rise > bestRise) {

            bestRise = rise;
            bestTakeOff = i;

        }

    }

    takeOff = bestTakeOff;

    if (takeOff === 0) {

        takeOff =
            Math.max(
                0,
                handContact - 10
            );

    }

    // ----------------------------
    // ④ 着地
    // 最高点以降で足首の動きが
    // 小さくなった場所を探す
    // ----------------------------

    for (
        let i = highestHip + 3;
        i < data.length - 2;
        i++
    ) {

        const a =
            getPoint(data[i - 2], 27);

        const b =
            getPoint(data[i], 27);

        const c =
            getPoint(data[i + 2], 27);

        if (!a || !b || !c) continue;

        const movement =
            Math.abs(a.y - b.y) +
            Math.abs(b.y - c.y);

        if (movement < 0.012) {

            landing = i;
            break;

        }

    }

    // ----------------------------
    // フェーズの順番を保証
    // ----------------------------

    takeOff =
        Math.max(
            0,
            Math.min(
                takeOff,
                data.length - 1
            )
        );

    handContact =
        Math.max(
            takeOff + 1,
            Math.min(
                handContact,
                data.length - 1
            )
        );

    highestHip =
        Math.max(
            handContact,
            Math.min(
                highestHip,
                data.length - 1
            )
        );

    landing =
        Math.max(
            highestHip + 1,
            Math.min(
                landing,
                data.length - 1
            )
        );

    // ----------------------------
    // 元データのフレーム番号へ変換
    // ----------------------------

    phaseResult = {

        takeOff:
            data[takeOff].frame,

        handContact:
            data[handContact].frame,

        highestHip:
            data[highestHip].frame,

        landing:
            data[landing].frame

    };

    console.log(
        "========== Ver5.4 Phase =========="
    );

    console.log(
        "踏切:",
        phaseResult.takeOff
    );

    console.log(
        "着手:",
        phaseResult.handContact
    );

    console.log(
        "最高点:",
        phaseResult.highestHip
    );

    console.log(
        "着地:",
        phaseResult.landing
    );

    return phaseResult;

}


// ----------------------------
// フェーズ取得
// ----------------------------

function getPhaseResult() {

    return phaseResult;

}


// ----------------------------
// リセット
// ----------------------------

function clearPhase() {

    phaseResult = null;

    const phaseInfo =
        document.getElementById(
            "phaseInfo"
        );

    if (phaseInfo) {

        phaseInfo.innerHTML =
            "未解析";

    }

}


// ----------------------------
// 公開
// ----------------------------

window.detectPhases =
    detectPhases;

window.getPhaseResult =
    getPhaseResult;

window.clearPhase =
    clearPhase;

console.log(
    "phase.js Ver5.4 読み込み成功"
);