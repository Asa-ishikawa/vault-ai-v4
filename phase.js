// ===============================
// 跳び箱AI採点システム Ver5.3.3
// phase.js
// 動作フェーズ検出
// 着地判定 改良版
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
    // 両足が上昇し始める瞬間
    // =====================================

    let lastFootY = null;

    for (let i = 1; i < handContact; i++) {

        const leftAnkle = getPoint(frames[i], 27);
        const rightAnkle = getPoint(frames[i], 28);

        if (!leftAnkle || !rightAnkle) continue;

        const footY =
            (leftAnkle.y + rightAnkle.y) / 2;

        if (lastFootY !== null) {

            // 足首が明確に上昇した瞬間
            if ((lastFootY - footY) > 0.012) {

                takeOff = i;
                break;

            }

        }

        lastFootY = footY;

    }

    // 見つからなかった場合
    if (takeOff === 0) {

        takeOff =
            Math.max(0, handContact - 10);

    }

    // =====================================
    // ④ 踏切時の「床の高さ」を記録
    //
    // 着地判定では、
    // 「足首が安定した」だけではなく
    // 「踏切時の床の高さまで足が戻った」
    // ことを確認する。
    // =====================================

    let takeOffFootY = null;

    const takeOffStart =
        Math.max(0, takeOff - 3);

    const takeOffEnd =
        Math.min(frames.length - 1, takeOff + 2);

    let takeOffFootValues = [];

    for (
        let i = takeOffStart;
        i <= takeOffEnd;
        i++
    ) {

        const leftAnkle =
            getPoint(frames[i], 27);

        const rightAnkle =
            getPoint(frames[i], 28);

        if (!leftAnkle || !rightAnkle) {
            continue;
        }

        const footY =
            (leftAnkle.y + rightAnkle.y) / 2;

        takeOffFootValues.push(footY);

    }

    if (takeOffFootValues.length > 0) {

        takeOffFootY =
            takeOffFootValues.reduce(
                (sum, value) => sum + value,
                0
            ) / takeOffFootValues.length;

    }

    // =====================================
    // ⑤ 着地判定 改良版
    //
    // 条件
    //
    // ① 最高点を過ぎている
    // ② 足首が下降している
    // ③ 踏切時の床の高さ付近まで戻っている
    // ④ 両足の高さが安定している
    //
    // これにより
    //
    // 「跳び箱の上に座って停止」
    //
    // を着地と誤判定しにくくする。
    // =====================================

    let landingFound = false;

    if (takeOffFootY !== null) {

        for (
            let i = highestHip + 3;
            i < frames.length - 3;
            i++
        ) {

            const currentLeft =
                getPoint(frames[i], 27);

            const currentRight =
                getPoint(frames[i], 28);

            const nextLeft =
                getPoint(frames[i + 1], 27);

            const nextRight =
                getPoint(frames[i + 1], 28);

            const next2Left =
                getPoint(frames[i + 2], 27);

            const next2Right =
                getPoint(frames[i + 2], 28);

            if (
                !currentLeft ||
                !currentRight ||
                !nextLeft ||
                !nextRight ||
                !next2Left ||
                !next2Right
            ) {
                continue;
            }

            const footY =
                (currentLeft.y + currentRight.y) / 2;

            const nextFootY =
                (nextLeft.y + nextRight.y) / 2;

            const next2FootY =
                (next2Left.y + next2Right.y) / 2;

            // ---------------------------------
            // 条件A
            // 足が床の高さ付近まで戻っている
            // ---------------------------------

            const floorDifference =
                Math.abs(
                    footY - takeOffFootY
                );

            const nearFloor =
                floorDifference < 0.08;

            // ---------------------------------
            // 条件B
            // 足が下降した後に安定している
            // ---------------------------------

            const descending =
                footY > nextFootY - 0.002;

            const stable =
                Math.abs(nextFootY - footY) < 0.012 &&
                Math.abs(next2FootY - nextFootY) < 0.012;

            // ---------------------------------
            // 条件C
            // 両足の高さが大きく離れていない
            // ---------------------------------

            const footDifference =
                Math.abs(
                    currentLeft.y -
                    currentRight.y
                );

            const feetTogether =
                footDifference < 0.10;

            // ---------------------------------
            // 総合判定
            // ---------------------------------

            if (
                nearFloor &&
                descending &&
                stable &&
                feetTogether
            ) {

                landing = i;
                landingFound = true;

                break;

            }

        }

    }

    // =====================================
    // 着地が見つからなかった場合
    //
    // 「動画終了＝着地」としない
    // =====================================

    if (!landingFound) {

        landing = -1;

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

    // =====================================
    // デバッグ表示
    // =====================================

    console.log(
        "========== Phase Ver5.3.3 =========="
    );

    console.log(
        "踏切:",
        takeOff
    );

    console.log(
        "着手:",
        handContact
    );

    console.log(
        "最高点:",
        highestHip
    );

    console.log(
        "踏切時の床高さ:",
        takeOffFootY
    );

    console.log(
        "着地:",
        landing
    );

    console.log(
        "着地判定:",
        landingFound
            ? "着地あり"
            : "着地なし"
    );

    return phaseResult;

}

// ----------------------------
// フェーズ結果取得
// ----------------------------

function getPhaseResult() {

    return phaseResult;

}

// ----------------------------
// 画面表示
// ----------------------------

function updatePhaseDisplay() {

    const phaseInfo =
        document.getElementById("phaseInfo");

    if (!phaseInfo) return;

    if (!phaseResult) {

        phaseInfo.textContent =
            "未解析";

        return;

    }

    phaseInfo.innerHTML = `
        <strong>踏切：</strong>
        ${phaseResult.takeOff}<br>

        <strong>着手：</strong>
        ${phaseResult.handContact}<br>

        <strong>最高点：</strong>
        ${phaseResult.highestHip}<br>

        <strong>着地：</strong>
        ${
            phaseResult.landing >= 0
                ? phaseResult.landing
                : "着地なし"
        }
    `;

}

// ----------------------------
// リセット
// ----------------------------

function clearPhase() {

    phaseResult = null;

    const phaseInfo =
        document.getElementById("phaseInfo");

    if (phaseInfo) {

        phaseInfo.textContent =
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

window.updatePhaseDisplay =
    updatePhaseDisplay;

window.clearPhase =
    clearPhase;