// ===============================
// 跳び箱AI採点システム Ver5.3.1
// phase.js
// 動作フェーズ検出（精度向上版）
// ===============================

let phaseResult = null;

// ----------------------------
// フェーズ検出
// ----------------------------
function detectPhases(frames) {

    if (!frames || frames.length < 20) {
        return null;
    }

    let takeOff = 0;
    let handContact = 0;
    let highestHip = 0;
    let landing = frames.length - 1;

    // =====================================
    // ① 腰の最高点
    // =====================================

    let minHipY = 999;

    frames.forEach((frame, index) => {

        const hip = getHipCenter(frame);

        if (!hip) return;

        if (hip.y < minHipY) {

            minHipY = hip.y;
            highestHip = index;

        }

    });

    // =====================================
    // ② 着手
    // 手首が最も前に出た瞬間
    // =====================================

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

    // =====================================
    // ③ 踏切
    // 両足が床から離れ始める瞬間
    // =====================================

    let lastFootY = null;

    for (let i = 1; i < handContact; i++) {

        const leftAnkle = getPoint(frames[i], 27);
        const rightAnkle = getPoint(frames[i], 28);

        if (!leftAnkle || !rightAnkle) continue;

        const footY = (leftAnkle.y + rightAnkle.y) / 2;

        if (lastFootY !== null) {

            // 足首が急激に上昇し始めた瞬間
            if ((lastFootY - footY) > 0.012) {

                takeOff = i;
                break;

            }

        }

        lastFootY = footY;

    }

    // 見つからなかった場合
    if (takeOff === 0) {

        takeOff = Math.max(0, handContact - 10);

    }

    // =====================================
    // ④ 着地
    // 足首の高さが安定した最初の瞬間
    // =====================================

    let lastLandingY = null;

    for (let i = highestHip; i < frames.length; i++) {

        const leftAnkle = getPoint(frames[i], 27);
        const rightAnkle = getPoint(frames[i], 28);

        if (!leftAnkle || !rightAnkle) continue;

        const footY = (leftAnkle.y + rightAnkle.y) / 2;

        if (lastLandingY !== null) {

            if (Math.abs(footY - lastLandingY) < 0.003) {

                landing = i;
                break;

            }

        }

        lastLandingY = footY;

    }

    // =====================================
    // 保存
    // =====================================

    phaseResult = {

        takeOff,
        handContact,
        highestHip,
        landing

    };

    console.log("========== Phase ==========");
    console.log("踏切:", takeOff);
    console.log("着手:", handContact);
    console.log("最高点:", highestHip);
    console.log("着地:", landing);

    return phaseResult;

}

// ----------------------------
// 取得
// ----------------------------

function getPhaseResult() {

const phaseInfo = document.getElementById("phaseInfo");

if (phaseInfo) {

    phaseInfo.innerHTML = `
        <strong>踏切：</strong> ${takeOff}<br>
        <strong>着手：</strong> ${handContact}<br>
        <strong>最高点：</strong> ${highestHip}<br>
        <strong>着地：</strong> ${landing}
    `;

}
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