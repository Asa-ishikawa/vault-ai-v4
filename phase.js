// ===============================
// 跳び箱AI採点システム Ver5.5
// phase.js
// 動作フェーズ検出・安定化版
// ===============================

let phaseResult = null;


// ===============================
// フェーズ検出
// ===============================

function detectPhases(frames) {

    if (
        !Array.isArray(frames) ||
        frames.length < 20
    ) {
        return null;
    }

    const data =
        prepareFrames(frames);

    if (
        !data ||
        data.length < 20
    ) {
        return null;
    }

    let takeOff = 0;
    let handContact = 0;
    let highestHip = 0;
    let landing = data.length - 1;


    // ============================
    // ① 腰の高さ
    // ============================

    const hipY = [];

    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const hip =
            getHipCenter(data[i]);

        if (!hip) {

            hipY.push(NaN);

            continue;

        }

        hipY.push(hip.y);

    }

    const smoothHipY =
        movingAverage(
            hipY,
            7
        );


    let minHipY = Infinity;

    for (
        let i = 0;
        i < smoothHipY.length;
        i++
    ) {

        if (
            !Number.isFinite(
                smoothHipY[i]
            )
        ) {
            continue;
        }

        if (
            smoothHipY[i] < minHipY
        ) {

            minHipY =
                smoothHipY[i];

            highestHip = i;

        }

    }


    // ============================
    // ② 着手
    // 手首の前方位置
    // ============================

    const handX = [];

    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const left =
            getPoint(data[i], 15);

        const right =
            getPoint(data[i], 16);

        if (!left || !right) {

            handX.push(NaN);

            continue;

        }

        handX.push(
            (
                left.x +
                right.x
            ) / 2
        );

    }

    const smoothHandX =
        movingAverage(
            handX,
            7
        );


    let maxHandX = -Infinity;

    for (
        let i = 0;
        i < smoothHandX.length;
        i++
    ) {

        if (
            !Number.isFinite(
                smoothHandX[i]
            )
        ) {
            continue;
        }

        // 踏切より後、
        // 最高点より前を優先
        if (
            i < highestHip
        ) {

            if (
                smoothHandX[i] >
                maxHandX
            ) {

                maxHandX =
                    smoothHandX[i];

                handContact = i;

            }

        }

    }


    // 見つからなかった場合

    if (
        handContact === 0
    ) {

        for (
            let i = 0;
            i < smoothHandX.length;
            i++
        ) {

            if (
                !Number.isFinite(
                    smoothHandX[i]
                )
            ) {
                continue;
            }

            if (
                smoothHandX[i] >
                maxHandX
            ) {

                maxHandX =
                    smoothHandX[i];

                handContact = i;

            }

        }

    }


    // ============================
    // ③ 踏切
    // 足首の上昇開始
    // ============================

    const ankleY = [];

    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const left =
            getPoint(data[i], 27);

        const right =
            getPoint(data[i], 28);

        if (!left || !right) {

            ankleY.push(NaN);

            continue;

        }

        ankleY.push(
            (
                left.y +
                right.y
            ) / 2
        );

    }

    const smoothAnkleY =
        movingAverage(
            ankleY,
            5
        );


    let bestRise = 0;
    let bestTakeOff = 0;


    for (
        let i = 3;
        i < handContact;
        i++
    ) {

        if (
            !Number.isFinite(
                smoothAnkleY[i - 3]
            ) ||
            !Number.isFinite(
                smoothAnkleY[i]
            )
        ) {
            continue;
        }

        const rise =
            smoothAnkleY[i - 3] -
            smoothAnkleY[i];

        if (
            rise > bestRise
        ) {

            bestRise = rise;
            bestTakeOff = i;

        }

    }


    if (
        bestTakeOff > 0
    ) {

        takeOff =
            bestTakeOff;

    }

    else {

        takeOff =
            Math.max(
                0,
                handContact - 10
            );

    }


    // ============================
    // ④ 着地
    // 足首が安定する区間
    // ============================

    const landingStart =
        Math.max(
            highestHip + 5,
            handContact + 5
        );


    for (
        let i = landingStart;
        i < data.length - 3;
        i++
    ) {

        if (
            !Number.isFinite(
                smoothAnkleY[i - 2]
            ) ||
            !Number.isFinite(
                smoothAnkleY[i]
            ) ||
            !Number.isFinite(
                smoothAnkleY[i + 2]
            )
        ) {
            continue;
        }

        const movement =
            Math.abs(
                smoothAnkleY[i - 2] -
                smoothAnkleY[i]
            ) +
            Math.abs(
                smoothAnkleY[i] -
                smoothAnkleY[i + 2]
            );


        if (
            movement < 0.012
        ) {

            landing = i;

            break;

        }

    }


    // ============================
    // フェーズ順序を保証
    // ============================

    takeOff =
        clamp(
            takeOff,
            0,
            data.length - 1
        );


    handContact =
        clamp(
            handContact,
            takeOff + 1,
            data.length - 1
        );


    highestHip =
        clamp(
            highestHip,
            handContact,
            data.length - 1
        );


    landing =
        clamp(
            landing,
            highestHip + 1,
            data.length - 1
        );


    // ============================
    // 元フレーム番号へ変換
    // ============================

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


    // ============================
    // デバッグ
    // ============================

    console.log(
        "========== Ver5.5 Phase =========="
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


// ===============================
// フェーズ取得
// ===============================

function getPhaseResult() {

    return phaseResult;

}


// ===============================
// リセット
// ===============================

function clearPhase() {

    phaseResult = null;

    const phaseInfo =
        document.getElementById(
            "phaseInfo"
        );

    if (phaseInfo) {

        phaseInfo.textContent =
            "未解析";

    }

}


// ===============================
// 公開
// ===============================

window.detectPhases =
    detectPhases;

window.getPhaseResult =
    getPhaseResult;

window.clearPhase =
    clearPhase;


console.log(
    "phase.js Ver5.5 読み込み成功"
);