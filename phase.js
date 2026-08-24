// ============================================================
// 跳び箱AI採点システム
// phase.js 改良版
//
// 目的：
// 「着手候補の山」の中から、本当の着手タイミングを1フレーム選ぶ
//
// 改良ポイント
// ① 候補ゾーンの中央を単純に選ばない
// ② 着手らしさのピークを重視
// ③ ピーク前後の手の動きを確認
// ④ 腰の上昇開始を確認
// ⑤ 踏切直後すぎる候補を避ける
// ⑥ 実測値だけでは着手を決めない
// ⑦ 候補が0でも解析を止めない
// ============================================================


let lastPhaseResult = null;


// ============================================================
// ランドマーク取得
// ============================================================

function getLandmarks(frame) {

    if (!frame) {
        return null;
    }

    return (
        frame.landmarks ||
        frame.poseLandmarks ||
        frame
    );
}


// ============================================================
// 腰中心
// ============================================================

function getHipCenter(frame) {

    const lm = getLandmarks(frame);

    if (!lm || lm.length < 25) {
        return null;
    }

    const left = lm[23];
    const right = lm[24];

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ============================================================
// 手首中心
// ============================================================

function getWristCenter(frame) {

    const lm = getLandmarks(frame);

    if (!lm || lm.length < 17) {
        return null;
    }

    const left = lm[15];
    const right = lm[16];

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ============================================================
// 足首中心
// ============================================================

function getAnkleCenter(frame) {

    const lm = getLandmarks(frame);

    if (!lm || lm.length < 29) {
        return null;
    }

    const left = lm[27];
    const right = lm[28];

    if (!left || !right) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ============================================================
// 距離
// ============================================================

function distance(a, b) {

    if (!a || !b) {
        return 0;
    }

    return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2)
    );
}


// ============================================================
// 着手位置実測値
// ============================================================

function calculateHandHipValue(frame) {

    const hip = getHipCenter(frame);
    const wrist = getWristCenter(frame);

    if (!hip || !wrist) {
        return null;
    }

    return distance(
        hip,
        wrist
    );
}


// ============================================================
// 差分
// ============================================================

function difference(a, b) {

    if (
        a == null ||
        b == null
    ) {
        return 0;
    }

    return b - a;
}


// ============================================================
// 動作データ作成
// ============================================================

function buildMotionData(frames) {

    const motion = [];

    for (
        let i = 0;
        i < frames.length;
        i++
    ) {

        const hip =
            getHipCenter(frames[i]);

        const wrist =
            getWristCenter(frames[i]);

        const ankle =
            getAnkleCenter(frames[i]);

        motion.push({

            frame: i,

            hipX:
                hip ? hip.x : null,

            hipY:
                hip ? hip.y : null,

            wristX:
                wrist ? wrist.x : null,

            wristY:
                wrist ? wrist.y : null,

            ankleX:
                ankle ? ankle.x : null,

            ankleY:
                ankle ? ankle.y : null,

            handHip:
                calculateHandHipValue(
                    frames[i]
                )

        });

    }

    return motion;
}


// ============================================================
// 踏切検出
// ============================================================

function detectTakeOff(motion) {

    if (
        !motion ||
        motion.length < 5
    ) {
        return 0;
    }

    const end =
        Math.max(
            3,
            Math.floor(
                motion.length * 0.35
            )
        );

    let bestFrame = 0;
    let bestScore = -Infinity;

    for (
        let i = 1;
        i < end;
        i++
    ) {

        const before =
            motion[i - 1];

        const current =
            motion[i];

        let score = 0;

        const ankleMove =
            Math.abs(
                difference(
                    before.ankleY,
                    current.ankleY
                )
            );

        const hipMove =
            Math.abs(
                difference(
                    before.hipY,
                    current.hipY
                )
            );

        score +=
            ankleMove * 5;

        score +=
            hipMove * 2;

        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            bestFrame =
                i;

        }

    }

    return bestFrame;
}


// ============================================================
// 着手候補作成
//
// ここでは「候補を作る」だけ。
// 最終的な着手フレームは別の関数で決定する。
// ============================================================

function findHandCandidates(
    motion,
    takeOff
) {

    const candidates = [];

    if (
        !motion ||
        motion.length < 8
    ) {
        return candidates;
    }

    const start =
        Math.min(
            motion.length - 3,
            takeOff + 2
        );

    const end =
        Math.min(
            motion.length - 3,
            Math.floor(
                motion.length * 0.85
            )
        );

    for (
        let i = start;
        i <= end;
        i++
    ) {

        const p2 =
            motion[
                Math.max(
                    0,
                    i - 2
                )
            ];

        const p1 =
            motion[
                Math.max(
                    0,
                    i - 1
                )
            ];

        const current =
            motion[i];

        const n1 =
            motion[
                Math.min(
                    motion.length - 1,
                    i + 1
                )
            ];

        const n2 =
            motion[
                Math.min(
                    motion.length - 1,
                    i + 2
                )
            ];


        // ----------------------------------------------------
        // 手の移動
        // ----------------------------------------------------

        const handBefore =
            Math.abs(
                difference(
                    p2.wristX,
                    current.wristX
                )
            ) +
            Math.abs(
                difference(
                    p2.wristY,
                    current.wristY
                )
            );

        const handAfter =
            Math.abs(
                difference(
                    current.wristX,
                    n2.wristX
                )
            ) +
            Math.abs(
                difference(
                    current.wristY,
                    n2.wristY
                )
            );


        // ----------------------------------------------------
        // 手の下降
        // ----------------------------------------------------

        const handDown =
            difference(
                p1.wristY,
                current.wristY
            );


        // ----------------------------------------------------
        // 腰の上昇
        // ----------------------------------------------------

        const hipRiseBefore =
            -difference(
                p1.hipY,
                current.hipY
            );

        const hipRiseAfter =
            -difference(
                current.hipY,
                n2.hipY
            );


        // ----------------------------------------------------
        // 着手らしさ
        // ----------------------------------------------------

        let score = 0;


        if (
            handBefore > 0.008
        ) {
            score += 2;
        }

        if (
            handBefore > 0.018
        ) {
            score += 1;
        }


        if (
            handDown > 0.003
        ) {
            score += 2;
        }

        if (
            handDown > 0.008
        ) {
            score += 1;
        }


        if (
            hipRiseBefore > 0.003
        ) {
            score += 2;
        }


        if (
            hipRiseAfter > 0.003
        ) {
            score += 2;
        }


        // ----------------------------------------------------
        // 前後の動きが大きく変化する場所
        // ----------------------------------------------------

        if (
            handBefore >
            handAfter * 1.15
        ) {

            score += 2;

        }


        // ----------------------------------------------------
        // 候補採用
        // ----------------------------------------------------

        if (
            score >= 3
        ) {

            candidates.push({

                frame: i,

                score: score,

                measured:
                    current.handHip,

                handBefore:
                    handBefore,

                handAfter:
                    handAfter,

                handDown:
                    handDown,

                hipRiseBefore:
                    hipRiseBefore,

                hipRiseAfter:
                    hipRiseAfter

            });

        }

    }

    return candidates;
}


// ============================================================
// 候補を連続グループにする
// ============================================================

function makeCandidateGroups(
    candidates
) {

    if (
        !candidates ||
        candidates.length === 0
    ) {
        return [];
    }

    const sorted =
        [...candidates].sort(
            (a, b) =>
                a.frame - b.frame
        );

    const groups = [];

    let group = [];

    for (
        let i = 0;
        i < sorted.length;
        i++
    ) {

        const current =
            sorted[i];

        if (
            group.length === 0
        ) {

            group.push(current);

            continue;

        }

        const previous =
            group[
                group.length - 1
            ];

        if (
            current.frame -
            previous.frame <= 2
        ) {

            group.push(current);

        } else {

            groups.push(group);

            group = [current];

        }

    }

    if (
        group.length > 0
    ) {

        groups.push(group);

    }

    return groups;
}


// ============================================================
// ★着手らしさの「山」を探す
//
// 中央ではなく、山の頂点を探す。
// ============================================================

function findPeakCandidates(
    group
) {

    if (
        !group ||
        group.length === 0
    ) {
        return [];
    }

    let maxScore =
        Math.max(
            ...group.map(
                c => c.score
            )
        );

    return group.filter(
        c =>
            c.score >=
            maxScore - 2
    );
}


// ============================================================
// ★本当の着手フレーム選択
//
// 「候補ゾーンの中央」ではなく、
// 「着手らしさの山＋動作変化」を使う。
// ============================================================

function selectTrueHandContact(
    candidates,
    motion,
    takeOff
) {

    if (
        !candidates ||
        candidates.length === 0
    ) {

        return null;

    }


    const groups =
        makeCandidateGroups(
            candidates
        );


    console.log(
        "着手候補グループ数:",
        groups.length
    );


    // ========================================================
    // 各グループを評価
    // ========================================================

    const groupResults = [];


    for (
        let g = 0;
        g < groups.length;
        g++
    ) {

        const group =
            groups[g];

        const peaks =
            findPeakCandidates(
                group
            );


        let groupMax =
            Math.max(
                ...group.map(
                    c => c.score
                )
            );


        let groupAverage =
            group.reduce(
                (sum, c) =>
                    sum + c.score,
                0
            ) /
            group.length;


        const firstFrame =
            group[0].frame;

        const lastFrame =
            group[
                group.length - 1
            ].frame;


        // 踏切からの距離
        const distanceFromTakeOff =
            firstFrame -
            takeOff;


        let groupScore = 0;


        // 山の高さ
        groupScore +=
            groupMax * 3;


        // 平均的な着手らしさ
        groupScore +=
            groupAverage * 1.5;


        // 連続している候補
        groupScore +=
            Math.min(
                group.length,
                10
            ) * 0.5;


        // 踏切直後すぎる場合は減点
        if (
            distanceFromTakeOff <= 2
        ) {

            groupScore -= 8;

        }

        else if (
            distanceFromTakeOff === 3
        ) {

            groupScore -= 3;

        }


        // あまりにも後半なら減点
        if (
            firstFrame >
            motion.length * 0.75
        ) {

            groupScore -= 4;

        }


        groupResults.push({

            group:
                group,

            peaks:
                peaks,

            score:
                groupScore

        });

    }


    // ========================================================
    // 一番着手らしいグループ
    // ========================================================

    groupResults.sort(
        (a, b) =>
            b.score -
            a.score
    );


    const bestGroup =
        groupResults[0];


    if (!bestGroup) {
        return null;
    }


    console.log(
        "選択候補グループ:",
        bestGroup.group[0].frame,
        "～",
        bestGroup.group[
            bestGroup.group.length - 1
        ].frame
    );


    // ========================================================
    // グループ内のピーク
    // ========================================================

    const peaks =
        bestGroup.peaks;


    let best =
        null;

    let bestFinalScore =
        -Infinity;


    for (
        let i = 0;
        i < peaks.length;
        i++
    ) {

        const candidate =
            peaks[i];

        const frame =
            candidate.frame;


        let finalScore =
            candidate.score * 4;


        // ----------------------------------------------------
        // 前後フレーム
        // ----------------------------------------------------

        const before =
            motion[
                Math.max(
                    0,
                    frame - 1
                )
            ];

        const current =
            motion[frame];

        const after =
            motion[
                Math.min(
                    motion.length - 1,
                    frame + 1
                )
            ];

        const before2 =
            motion[
                Math.max(
                    0,
                    frame - 2
                )
            ];

        const after2 =
            motion[
                Math.min(
                    motion.length - 1,
                    frame + 2
                )
            ];


        if (
            before &&
            current &&
            after
        ) {

            // ------------------------------------------------
            // 手の速度
            // ------------------------------------------------

            const beforeMove =
                Math.abs(
                    difference(
                        before.wristX,
                        current.wristX
                    )
                ) +
                Math.abs(
                    difference(
                        before.wristY,
                        current.wristY
                    )
                );


            const afterMove =
                Math.abs(
                    difference(
                        current.wristX,
                        after.wristX
                    )
                ) +
                Math.abs(
                    difference(
                        current.wristY,
                        after.wristY
                    )
                );


            // 動きのピーク
            if (
                beforeMove >
                0.008
            ) {

                finalScore += 2;

            }


            if (
                beforeMove >
                afterMove * 1.10
            ) {

                finalScore += 4;

            }


            // ------------------------------------------------
            // 腰の上昇開始
            // ------------------------------------------------

            const hipBefore =
                -difference(
                    before.hipY,
                    current.hipY
                );

            const hipAfter =
                -difference(
                    current.hipY,
                    after.hipY
                );


            if (
                hipBefore >= 0 &&
                hipAfter > 0
            ) {

                finalScore += 4;

            }


            if (
                hipAfter >
                hipBefore
            ) {

                finalScore += 2;

            }

        }


        // ----------------------------------------------------
        // 2フレーム前後の動作変化
        // ----------------------------------------------------

        if (
            before2 &&
            after2
        ) {

            const moveBefore2 =
                Math.abs(
                    difference(
                        before2.wristX,
                        current.wristX
                    )
                ) +
                Math.abs(
                    difference(
                        before2.wristY,
                        current.wristY
                    )
                );


            const moveAfter2 =
                Math.abs(
                    difference(
                        current.wristX,
                        after2.wristX
                    )
                ) +
                Math.abs(
                    difference(
                        current.wristY,
                        after2.wristY
                    )
                );


            if (
                moveBefore2 >
                moveAfter2 * 1.15
            ) {

                finalScore += 3;

            }

        }


        // ----------------------------------------------------
        // 踏切直後すぎる候補を避ける
        // ----------------------------------------------------

        const fromTakeOff =
            frame -
            takeOff;


        if (
            fromTakeOff <= 2
        ) {

            finalScore -= 10;

        }

        else if (
            fromTakeOff === 3
        ) {

            finalScore -= 4;

        }


        // ----------------------------------------------------
        // 実測値は「補助情報」にする
        //
        // 小さいほど良い、とは決めない。
        // ----------------------------------------------------

        if (
            Number.isFinite(
                candidate.measured
            )
        ) {

            // 極端に異常な値だけ少し減点
            if (
                candidate.measured >
                1.5
            ) {

                finalScore -= 3;

            }

        }


        // ----------------------------------------------------
        // 最終決定
        // ----------------------------------------------------

        if (
            finalScore >
            bestFinalScore
        ) {

            bestFinalScore =
                finalScore;

            best = {

                ...candidate,

                selectionScore:
                    Number(
                        finalScore.toFixed(3)
                    )

            };

        }

    }


    return best;
}


// ============================================================
// 最高点
// ============================================================

function detectHighestHip(
    frames,
    handContact
) {

    const start =
        Math.min(
            frames.length - 1,
            handContact + 1
        );

    let highest =
        start;

    let minY =
        Infinity;


    for (
        let i = start;
        i < frames.length;
        i++
    ) {

        const hip =
            getHipCenter(
                frames[i]
            );

        if (!hip) {
            continue;
        }

        if (
            hip.y <
            minY
        ) {

            minY =
                hip.y;

            highest =
                i;

        }

    }


    return highest;
}


// ============================================================
// 着地
// ============================================================

function detectLanding(
    frames,
    highestHip
) {

    const start =
        Math.max(
            highestHip + 2,
            Math.floor(
                frames.length * 0.65
            )
        );


    if (
        start >= frames.length
    ) {

        return frames.length - 1;

    }


    let landing =
        frames.length - 1;


    for (
        let i = start;
        i < frames.length - 1;
        i++
    ) {

        const a =
            getAnkleCenter(
                frames[i]
            );

        const b =
            getAnkleCenter(
                frames[i + 1]
            );


        if (
            !a ||
            !b
        ) {
            continue;
        }


        const move =
            distance(
                a,
                b
            );


        if (
            move < 0.025
        ) {

            landing =
                i;

            break;

        }

    }


    return landing;
}


// ============================================================
// 診断情報表示
// ============================================================

function showPhaseDiagnostic(
    result
) {

    let el =
        document.getElementById(
            "phaseDiagnostic"
        );


    if (!el) {

        el =
            document.createElement(
                "div"
            );

        el.id =
            "phaseDiagnostic";

        el.style.marginTop =
            "10px";

        el.style.padding =
            "10px";

        el.style.background =
            "#fff8e1";

        el.style.border =
            "1px solid #e0b000";

        el.style.borderRadius =
            "8px";

        const phaseInfo =
            document.getElementById(
                "phaseInfo"
            );


        if (
            phaseInfo &&
            phaseInfo.parentElement
        ) {

            phaseInfo.parentElement.appendChild(
                el
            );

        } else {

            document.body.appendChild(
                el
            );

        }

    }


    const candidates =
        result.handCandidates ||
        [];


    let html = "";


    const displayCount =
        Math.min(
            candidates.length,
            20
        );


    for (
        let i = 0;
        i < displayCount;
        i++
    ) {

        const c =
            candidates[i];


        html += `
            候補${i + 1}：
            ${c.frame}
            フレーム　
            実測値
            ${
                Number.isFinite(
                    c.measured
                )
                    ? c.measured.toFixed(3)
                    : "-"
            }
            　
            着手らしさ
            ${c.score}
            <br>
        `;

    }


    if (
        candidates.length >
        displayCount
    ) {

        html +=
            `…（残り ${
                candidates.length -
                displayCount
            }候補）`;

    }


    el.innerHTML = `

        <strong>
            着手判定診断
        </strong>

        <br><br>

        着手候補数：
        ${candidates.length}

        <br>

        選択着手フレーム：
        ${
            result.handContact ??
            "-"
        }

        <br>

        着手位置（実測値）：
        ${
            Number.isFinite(
                result.handMeasured
            )
                ? result.handMeasured.toFixed(3)
                : "-"
        }

        <br>

        選択スコア：
        ${
            result.selectionScore ??
            "-"
        }

        <hr>

        <strong>
            着手候補
        </strong>

        <br>

        ${html}

    `;

}


// ============================================================
// メイン
// ============================================================

function detectPhases(frames) {

    console.log(
        "======================================"
    );

    console.log(
        "phase.js 改良版 読み込み・解析開始"
    );

    console.log(
        "取得フレーム数:",
        frames
            ? frames.length
            : 0
    );


    if (
        !frames ||
        frames.length < 5
    ) {

        console.warn(
            "フレーム不足"
        );

        return null;

    }


    // ========================================================
    // 動作データ
    // ========================================================

    const motion =
        buildMotionData(
            frames
        );


    // ========================================================
    // 踏切
    // ========================================================

    const takeOff =
        detectTakeOff(
            motion
        );


    // ========================================================
    // 着手候補
    // ========================================================

    const candidates =
        findHandCandidates(
            motion,
            takeOff
        );


    console.log(
        "着手候補数:",
        candidates.length
    );


    // ========================================================
    // 本当の着手を選ぶ
    // ========================================================

    const selected =
        selectTrueHandContact(
            candidates,
            motion,
            takeOff
        );


    // ========================================================
    // 候補がない場合
    // ========================================================

    if (!selected) {

        console.warn(
            "着手候補なし"
        );


        const fallbackFrame =
            Math.min(
                motion.length - 2,
                Math.max(
                    takeOff + 3,
                    Math.floor(
                        motion.length * 0.4
                    )
                )
            );


        const fallbackMeasured =
            calculateHandHipValue(
                frames[
                    fallbackFrame
                ]
            );


        const highest =
            detectHighestHip(
                frames,
                fallbackFrame
            );


        const landing =
            detectLanding(
                frames,
                highest
            );


        const result = {

            takeOff:
                takeOff,

            handContact:
                fallbackFrame,

            highestHip:
                highest,

            landing:
                landing,

            handMeasured:
                fallbackMeasured,

            selectionScore:
                0,

            handCandidates:
                candidates,

            fallback:
                true

        };


        lastPhaseResult =
            result;


        showPhaseDiagnostic(
            result
        );


        return result;

    }


    // ========================================================
    // 最高点
    // ========================================================

    const highestHip =
        detectHighestHip(
            frames,
            selected.frame
        );


    // ========================================================
    // 着地
    // ========================================================

    const landing =
        detectLanding(
            frames,
            highestHip
        );


    // ========================================================
    // 最終結果
    // ========================================================

    const result = {

        takeOff:
            takeOff,

        handContact:
            selected.frame,

        highestHip:
            highestHip,

        landing:
            landing,

        handMeasured:
            selected.measured,

        selectionScore:
            selected.selectionScore,

        handCandidates:
            candidates,

        fallback:
            false

    };


    lastPhaseResult =
        result;


    // ========================================================
    // ログ
    // ========================================================

    console.log(
        "========== phase結果 =========="
    );

    console.log(
        "踏切:",
        result.takeOff
    );

    console.log(
        "着手:",
        result.handContact
    );

    console.log(
        "最高点:",
        result.highestHip
    );

    console.log(
        "着地:",
        result.landing
    );

    console.log(
        "候補数:",
        candidates.length
    );

    console.log(
        "選択着手フレーム:",
        result.handContact
    );

    console.log(
        "着手実測値:",
        result.handMeasured
    );

    console.log(
        "選択スコア:",
        result.selectionScore
    );

    console.log(
        "======================================"
    );


    // ========================================================
    // 画面表示
    // ========================================================

    showPhaseDiagnostic(
        result
    );


    return result;
}


// ============================================================
// 解析リセット
// ============================================================

function clearPhase() {

    lastPhaseResult =
        null;


    const phaseInfo =
        document.getElementById(
            "phaseInfo"
        );


    if (phaseInfo) {

        phaseInfo.innerHTML =
            "未解析";

    }


    const diagnostic =
        document.getElementById(
            "phaseDiagnostic"
        );


    if (diagnostic) {

        diagnostic.remove();

    }

}


// ============================================================
// 外部公開
// ============================================================

window.detectPhases =
    detectPhases;

window.clearPhase =
    clearPhase;

window.getLastPhaseResult =
    function () {

        return lastPhaseResult;

    };


// ============================================================
// 読み込み確認
// ============================================================

console.log(
    "phase.js 改良版「着手タイミング選択」読み込み成功"
);