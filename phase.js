// ===============================
// 跳び箱AI採点システム Ver5.3.2
// phase.js（前半）
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

    // ----------------------------
    // ① 腰の最高点
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
    // ② 着手検出
    // 手首速度＋前方位置を利用
    // ----------------------------

    let maxScore = -999;

    for (let i = 1; i < frames.length; i++) {

        const leftNow = getPoint(frames[i], 15);
        const rightNow = getPoint(frames[i], 16);

        const leftPrev = getPoint(frames[i - 1], 15);
        const rightPrev = getPoint(frames[i - 1], 16);

        if (!leftNow || !rightNow) continue;
        if (!leftPrev || !rightPrev) continue;

        const handX =
            (leftNow.x + rightNow.x) / 2;

        const speed =

            Math.abs(leftNow.x - leftPrev.x) +
            Math.abs(rightNow.x - rightPrev.x);

        const score =

            handX + speed * 3;

        if (score > maxScore) {

            maxScore = score;
            handContact = i;

        }

    }

    // ----------------------------
    // ③ 踏切
    // ----------------------------

    let lastFootY = null;

    for (let i = 1; i < handContact; i++) {

        const left = getPoint(frames[i], 27);
        const right = getPoint(frames[i], 28);

        if (!left || !right) continue;

        const footY =
            (left.y + right.y) / 2;

        if (lastFootY !== null) {

            if ((lastFootY - footY) > 0.012) {

                takeOff = i;
                break;

            }

        }

        lastFootY = footY;

    }

    if (takeOff === 0) {

        takeOff =
            Math.max(0, handContact - 8);

    }
        // ----------------------------
    // ④ 着地
    // ----------------------------

    let lastLandingY = null;

    for (let i = highestHip; i < frames.length; i++) {

        const left = getPoint(frames[i], 27);
        const right = getPoint(frames[i], 28);

        if (!left || !right) continue;

        const footY =
            (left.y + right.y) / 2;

        if (lastLandingY !== null) {

            if (Math.abs(footY - lastLandingY) < 0.003) {

                landing = i;
                break;

            }

        }

        lastLandingY = footY;

    }

    // ----------------------------
    // 結果保存
    // ----------------------------

    phaseResult = {

        takeOff,
        handContact,
        highestHip,
        landing

    };

    // ----------------------------
    // 画面表示
    // ----------------------------

    const phaseInfo =
        document.getElementById("phaseInfo");

    if (phaseInfo) {

        phaseInfo.innerHTML = `
            <strong>踏切：</strong> ${takeOff}<br>
            <strong>着手：</strong> ${handContact}<br>
            <strong>最高点：</strong> ${highestHip}<br>
            <strong>着地：</strong> ${landing}
        `;

    }

    console.log("========== Phase ==========");
    console.log(phaseResult);

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

    const phaseInfo =
        document.getElementById("phaseInfo");

    if (phaseInfo) {

        phaseInfo.innerHTML = "未解析";

    }

}

// ----------------------------
// 公開
// ----------------------------

window.detectPhases = detectPhases;
window.getPhaseResult = getPhaseResult;
window.clearPhase = clearPhase;