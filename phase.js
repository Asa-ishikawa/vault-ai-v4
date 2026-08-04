// ===============================
// 跳び箱AI採点システム Ver5.3
// phase.js
// 動作フェーズ検出
// ===============================

let phaseResult = null;

// ----------------------------
// フェーズ検出
// ----------------------------
function detectPhases(frames) {

    if (!frames || frames.length < 10) {

        return null;

    }

    let takeOff = 0;
    let handContact = 0;
    let highestHip = 0;
    let landing = frames.length - 1;

    // ----------------------------
    // 腰が最も高いフレーム
    // ----------------------------

    let minHipY = 999;

    frames.forEach((frame, index) => {

        const hip = getHipCenter(frame);

        if (!hip) return;

        if (hip.y < minHipY) {

            minHipY = hip.y;
            highestHip = index;

        }

    });

    // ----------------------------
    // 手が最も前に出たフレーム
    // （着手候補）
    // ----------------------------

    let maxHandX = -999;

    frames.forEach((frame, index) => {

        const left = getPoint(frame, 15);
        const right = getPoint(frame, 16);

        if (!left || !right) return;

        const handX = (left.x + right.x) / 2;

        if (handX > maxHandX) {

            maxHandX = handX;
            handContact = index;

        }

    });

    // ----------------------------
    // 踏切
    // 着手より前で腰が一番低い
    // ----------------------------

    let maxHipY = -999;

    for (let i = 0; i < handContact; i++) {

        const hip = getHipCenter(frames[i]);

        if (!hip) continue;

        if (hip.y > maxHipY) {

            maxHipY = hip.y;
            takeOff = i;

        }

    }

    // ----------------------------
    // 着地
    // 最高点以降で腰が一番低い
    // ----------------------------

    maxHipY = -999;

    for (let i = highestHip; i < frames.length; i++) {

        const hip = getHipCenter(frames[i]);

        if (!hip) continue;

        if (hip.y > maxHipY) {

            maxHipY = hip.y;
            landing = i;

        }

    }

    phaseResult = {

        takeOff,
        handContact,
        highestHip,
        landing

    };

    console.log("===== フェーズ検出 =====");
    console.log("踏切", takeOff);
    console.log("着手", handContact);
    console.log("最高点", highestHip);
    console.log("着地", landing);

    return phaseResult;

}

// ----------------------------
// 取得
// ----------------------------

function getPhaseResult() {

    return phaseResult;

}

// ----------------------------
// リセット
// ----------------------------

function clearPhase() {

    phaseResult = null;

}

// ----------------------------
// 公開
// ----------------------------

window.detectPhases = detectPhases;
window.getPhaseResult = getPhaseResult;
window.clearPhase = clearPhase;