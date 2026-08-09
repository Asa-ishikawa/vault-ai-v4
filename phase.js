// ===============================
// 跳び箱AI採点システム Ver5.3.4
// phase.js 完成版
// 着地判定・改良版
//
// 改良内容
// ① 本当に踏切して空中に入ったかを確認
// ② 両足が十分に床から離れたことを確認
// ③ その後、両足が踏切時の床高さまで戻ったことを確認
// ④ 着地後に複数フレーム安定していることを確認
// ⑤ 「跳び箱の上に座って終了」を着地と判定しにくくする
// ⑥ 動画終了＝着地とはしない
// ===============================

let phaseResult = null;


// ==================================================
// 共通：ランドマーク取得
// ==================================================

function phaseGetPoint(frame, index) {

    if (!frame) return null;

    const landmarks =
        frame.landmarks ||
        frame.poseLandmarks ||
        frame;

    if (!landmarks || !landmarks[index]) {
        return null;
    }

    const p = landmarks[index];

    if (
        typeof p.x !== "number" ||
        typeof p.y !== "number"
    ) {
        return null;
    }

    return p;
}


// ==================================================
// 腰中心
// ==================================================

function phaseGetHipCenter(frame) {

    const left =
        phaseGetPoint(frame, 23);

    const right =
        phaseGetPoint(frame, 24);

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ==================================================
// 足首中心
// ==================================================

function phaseGetFootCenter(frame) {

    const left =
        phaseGetPoint(frame, 27);

    const right =
        phaseGetPoint(frame, 28);

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ==================================================
// 踏切前の床高さを取得
// ==================================================

function getTakeOffFootBaseline(frames, takeOff) {

    const values = [];

    const start =
        Math.max(0, takeOff - 8);

    const end =
        Math.max(start, takeOff - 1);

    for (let i = start; i <= end; i++) {

        const foot =
            phaseGetFootCenter(frames[i]);

        if (!foot) continue;

        values.push(foot.y);
    }

    if (values.length === 0) {
        return null;
    }

    return (
        values.reduce(
            (sum, value) => sum + value,
            0
        ) / values.length
    );
}


// ==================================================
// フェーズ検出
// ==================================================

function detectPhases(frames) {

    if (!frames || frames.length < 20) {

        console.warn(
            "フェーズ解析：フレーム不足"
        );

        return null;
    }


    // ------------------------------------------
    // 初期値
    // ------------------------------------------

    let takeOff = -1;
    let handContact = -1;
    let highestHip = -1;
    let landing = -1;


    // ==================================================
    // ① 腰の最高点
    // ==================================================

    let minHipY = Infinity;

    for (let i = 0; i < frames.length; i++) {

        const hip =
            phaseGetHipCenter(frames[i]);

        if (!hip) continue;

        if (hip.y < minHipY) {

            minHipY = hip.y;
            highestHip = i;

        }
    }


    // ==================================================
    // ② 着手位置
    // 手首が最も前に出た位置
    // ==================================================

    let maxHandX = -Infinity;

    for (let i = 0; i < frames.length; i++) {

        const left =
            phaseGetPoint(frames[i], 15);

        const right =
            phaseGetPoint(frames[i], 16);

        if (!left || !right) continue;

        const handX =
            (left.x + right.x) / 2;

        if (handX > maxHandX) {

            maxHandX = handX;
            handContact = i;

        }
    }


    // ==================================================
    // ③ 踏切判定
    //
    // 重要：
    // 「足首が少し動いた」だけでは踏切にしない。
    //
    // 踏切前の足の高さを基準にして、
    // 両足が十分に上昇した状態を確認する。
    // ==================================================

    let baselineCandidates = [];

    const baselineEnd =
        handContact > 0
            ? Math.min(
                handContact - 1,
                15
            )
            : 15;

    for (
        let i = 0;
        i <= baselineEnd && i < frames.length;
        i++
    ) {

        const foot =
            phaseGetFootCenter(frames[i]);

        if (!foot) continue;

        baselineCandidates.push(foot.y);

    }

    let initialFootY = null;

    if (baselineCandidates.length > 0) {

        initialFootY =
            baselineCandidates.reduce(
                (sum, value) => sum + value,
                0
            ) /
            baselineCandidates.length;

    }


    // --------------------------------------------------
    // 両足が十分に上がった最初のフレームを探す
    // --------------------------------------------------

    if (initialFootY !== null) {

        for (
            let i = 2;
            i < frames.length - 4;
            i++
        ) {

            const f0 =
                phaseGetFootCenter(frames[i]);

            const f1 =
                phaseGetFootCenter(frames[i + 1]);

            const f2 =
                phaseGetFootCenter(frames[i + 2]);

            const f3 =
                phaseGetFootCenter(frames[i + 3]);

            if (
                !f0 ||
                !f1 ||
                !f2 ||
                !f3
            ) {
                continue;
            }


            // 足が床から十分に離れたか
            const lift0 =
                initialFootY - f0.y;

            const lift1 =
                initialFootY - f1.y;

            const lift2 =
                initialFootY - f2.y;


            // 3フレーム以上連続して
            // 床から約5%以上離れている
            const airborne =
                lift0 > 0.05 &&
                lift1 > 0.05 &&
                lift2 > 0.05;


            if (airborne) {

                takeOff = i;

                break;
            }
        }
    }


    // --------------------------------------------------
    // 踏切が確認できなかった場合
    // --------------------------------------------------

    if (takeOff < 0) {

        console.warn(
            "フェーズ解析：明確な踏切を確認できませんでした"
        );

    }


    // ==================================================
    // ④ 最高点
    // ==================================================

    if (highestHip < 0) {

        highestHip =
            Math.floor(frames.length / 2);

    }


    // ==================================================
    // ⑤ 着地判定
    //
    // 今回の改良の中心。
    //
    // 必須条件：
    //
    // A：明確な踏切がある
    // B：空中に入っている
    // C：最高点を通過している
    // D：両足が床高さまで戻る
    // E：着地後に複数フレーム安定
    //
    // 「跳び箱の上に座る」だけでは
    // 着地にならない。
    // ==================================================

    if (takeOff >= 0 && highestHip >= 0) {

        const floorY =
            getTakeOffFootBaseline(
                frames,
                takeOff
            );


        if (floorY !== null) {

            // ------------------------------------------
            // 空中に入ったことを再確認
            // ------------------------------------------

            let airborneConfirmed = false;

            const airborneStart =
                Math.max(
                    takeOff,
                    0
                );

            const airborneEnd =
                Math.min(
                    highestHip + 10,
                    frames.length - 1
                );

            for (
                let i = airborneStart;
                i <= airborneEnd;
                i++
            ) {

                const foot =
                    phaseGetFootCenter(frames[i]);

                if (!foot) continue;

                const lift =
                    floorY - foot.y;

                if (lift > 0.06) {

                    airborneConfirmed = true;

                    break;
                }
            }


            // ------------------------------------------
            // 空中動作が確認できた場合だけ
            // 着地探索を行う
            // ------------------------------------------

            if (airborneConfirmed) {

                const searchStart =
                    Math.max(
                        highestHip + 2,
                        takeOff + 5
                    );


                for (
                    let i = searchStart;
                    i < frames.length - 8;
                    i++
                ) {

                    const current =
                        phaseGetFootCenter(
                            frames[i]
                        );

                    const next =
                        phaseGetFootCenter(
                            frames[i + 1]
                        );

                    const next2 =
                        phaseGetFootCenter(
                            frames[i + 2]
                        );

                    const next3 =
                        phaseGetFootCenter(
                            frames[i + 3]
                        );

                    const next4 =
                        phaseGetFootCenter(
                            frames[i + 4]
                        );

                    const next5 =
                        phaseGetFootCenter(
                            frames[i + 5]
                        );

                    if (
                        !current ||
                        !next ||
                        !next2 ||
                        !next3 ||
                        !next4 ||
                        !next5
                    ) {
                        continue;
                    }


                    // ----------------------------------
                    // A
                    // 踏切時の床高さに戻ったか
                    // ----------------------------------

                    const currentDifference =
                        Math.abs(
                            current.y - floorY
                        );

                    const nearFloor =
                        currentDifference < 0.07;


                    // ----------------------------------
                    // B
                    // 下降後に止まったか
                    // ----------------------------------

                    const movement1 =
                        Math.abs(
                            next.y - current.y
                        );

                    const movement2 =
                        Math.abs(
                            next2.y - next.y
                        );

                    const movement3 =
                        Math.abs(
                            next3.y - next2.y
                        );

                    const movement4 =
                        Math.abs(
                            next4.y - next3.y
                        );

                    const movement5 =
                        Math.abs(
                            next5.y - next4.y
                        );


                    const stable =
                        movement1 < 0.015 &&
                        movement2 < 0.015 &&
                        movement3 < 0.015 &&
                        movement4 < 0.015 &&
                        movement5 < 0.015;


                    // ----------------------------------
                    // C
                    // 両足が近い高さにあるか
                    // ----------------------------------

                    const left =
                        phaseGetPoint(
                            frames[i],
                            27
                        );

                    const right =
                        phaseGetPoint(
                            frames[i],
                            28
                        );

                    if (!left || !right) {
                        continue;
                    }


                    const feetDifference =
                        Math.abs(
                            left.y - right.y
                        );


                    const feetTogether =
                        feetDifference < 0.12;


                    // ----------------------------------
                    // D
                    // 着地直前に下降しているか
                    // ----------------------------------

                    const previous =
                        phaseGetFootCenter(
                            frames[i - 1]
                        );

                    let descending = true;

                    if (previous) {

                        // yが大きくなる＝下方向
                        descending =
                            current.y >=
                            previous.y - 0.01;

                    }


                    // ----------------------------------
                    // E
                    // 着地条件
                    // ----------------------------------

                    if (
                        nearFloor &&
                        stable &&
                        feetTogether &&
                        descending
                    ) {

                        landing = i;

                        break;
                    }
                }
            }
        }
    }


    // ==================================================
    // ⑥ 着地なし
    // ==================================================

    if (landing < 0) {

        console.log(
            "着地判定：着地なし"
        );

    } else {

        console.log(
            "着地判定：着地あり",
            landing
        );
    }


    // ==================================================
    // ⑦ 結果保存
    // ==================================================

    phaseResult = {

        takeOff,
        handContact,
        highestHip,
        landing

    };


    // ==================================================
    // デバッグ表示
    // ==================================================

    console.log(
        "================================"
    );

    console.log(
        "Phase Ver5.3.4"
    );

    console.log(
        "踏切：",
        takeOff
    );

    console.log(
        "着手：",
        handContact
    );

    console.log(
        "最高点：",
        highestHip
    );

    console.log(
        "着地：",
        landing >= 0
            ? landing
            : "着地なし"
    );

    console.log(
        "================================"
    );


    // ==================================================
    // 画面更新
    // ==================================================

    updatePhaseDisplay();


    return phaseResult;
}


// ==================================================
// フェーズ結果取得
// ==================================================

function getPhaseResult() {

    return phaseResult;

}


// ==================================================
// フェーズ表示
// ==================================================

function updatePhaseDisplay() {

    const phaseInfo =
        document.getElementById(
            "phaseInfo"
        );

    if (!phaseInfo) {
        return;
    }


    if (!phaseResult) {

        phaseInfo.textContent =
            "未解析";

        return;
    }


    const landingText =
        phaseResult.landing >= 0
            ? phaseResult.landing
            : "着地なし";


    phaseInfo.innerHTML = `
        <strong>踏切：</strong>
        ${phaseResult.takeOff >= 0
            ? phaseResult.takeOff
            : "未検出"}<br>

        <strong>着手：</strong>
        ${phaseResult.handContact >= 0
            ? phaseResult.handContact
            : "未検出"}<br>

        <strong>最高点：</strong>
        ${phaseResult.highestHip >= 0
            ? phaseResult.highestHip
            : "未検出"}<br>

        <strong>着地：</strong>
        ${landingText}
    `;
}


// ==================================================
// フェーズリセット
// ==================================================

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


// ==================================================
// 公開
// ==================================================

window.detectPhases =
    detectPhases;

window.getPhaseResult =
    getPhaseResult;

window.updatePhaseDisplay =
    updatePhaseDisplay;

window.clearPhase =
    clearPhase;