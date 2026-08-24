// ============================================================
// 跳び箱AI採点システム
// phase.js
// 「着手候補の山」から本当の着手タイミングを選ぶ改良版
// ============================================================

let lastPhaseResult = null;


// ============================================================
// 基本データ取得
// ============================================================

function getLandmarks(frame) {

    if (!frame) return null;

    return (
        frame.landmarks ||
        frame.poseLandmarks ||
        frame
    );
}


function getHipCenter(frame) {

    const lm = getLandmarks(frame);

    if (!lm || lm.length < 25) {
        return null;
    }

    const l = lm[23];
    const r = lm[24];

    if (!l || !r) return null;

    return {
        x: (l.x + r.x) / 2,
        y: (l.y + r.y) / 2
    };
}


function getWristCenter(frame) {

    const lm = getLandmarks(frame);

    if (!lm || lm.length < 17) {
        return null;
    }

    const l = lm[15];
    const r = lm[16];

    if (!l || !r) return null;

    return {
        x: (l.x + r.x) / 2,
        y: (l.y + r.y) / 2
    };
}


function getAnkleCenter(frame) {

    const lm = getLandmarks(frame);

    if (!lm || lm.length < 29) {
        return null;
    }

    const l = lm[27];
    const r = lm[28];

    if (!l || !r) return null;

    return {
        x: (l.x + r.x) / 2,
        y: (l.y + r.y) / 2
    };
}


function distance(a, b) {

    if (!a || !b) return 0;

    return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2)
    );
}


// ============================================================
// 着手位置の実測値
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
// フレームごとの動作データ
// ============================================================

function buildMotionData(frames) {

    const data = [];

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

        data.push({

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

    return data;
}


// ============================================================
// 差分
// ============================================================

function diff(a, b) {

    if (
        a == null ||
        b == null
    ) {
        return 0;
    }

    return b - a;
}


// ============================================================
// 踏切検出
// ============================================================

function detectTakeOff(
    motion
) {

    const length =
        motion.length;

    if (length < 5) {
        return 0;
    }

    const searchEnd =
        Math.max(
            3,
            Math.floor(
                length * 0.35
            )
        );

    let bestFrame = 0;
    let bestScore = -Infinity;

    for (
        let i = 1;
        i < searchEnd;
        i++
    ) {

        const p =
            motion[i - 1];

        const c =
            motion[i];

        let score = 0;

        const ankleMove =
            Math.abs(
                diff(
                    p.ankleY,
                    c.ankleY
                )
            );

        const hipMove =
            Math.abs(
                diff(
                    p.hipY,
                    c.hipY
                )
            );

        score +=
            ankleMove * 4;

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
// 「候補を増やす」のではなく、
// 着手らしい動作が存在する区間を探す。
// ============================================================

function findHandCandidates(
    motion,
    takeOff
) {

    const candidates = [];

    const length =
        motion.length;

    const start =
        Math.min(
            length - 2,
            takeOff + 2
        );

    const end =
        Math.min(
            length - 3,
            Math.floor(
                length * 0.85
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

        const c =
            motion[i];

        const n1 =
            motion[
                Math.min(
                    length - 1,
                    i + 1
                )
            ];

        const n2 =
            motion[
                Math.min(
                    length - 1,
                    i + 2
                )
            ];


        // ----------------------------------------------------
        // 手の移動
        // ----------------------------------------------------

        const handMoveBefore =
            Math.abs(
                diff(
                    p2.wristX,
                    c.wristX
                )
            ) +
            Math.abs(
                diff(
                    p2.wristY,
                    c.wristY
                )
            );

        const handMoveAfter =
            Math.abs(
                diff(
                    c.wristX,
                    n2.wristX
                )
            ) +
            Math.abs(
                diff(
                    c.wristY,
                    n2.wristY
                )
            );


        // ----------------------------------------------------
        // 手の下降
        //
        // yが増える＝画面下方向
        // ----------------------------------------------------

        const handDown =
            diff(
                p1.wristY,
                c.wristY
            );


        // ----------------------------------------------------
        // 着手後の手の動き
        // ----------------------------------------------------

        const handChange =
            Math.abs(
                diff(
                    c.wristY,
                    n1.wristY
                )
            );


        // ----------------------------------------------------
        // 腰の上昇
        //
        // yが減る＝上昇
        // ----------------------------------------------------

        const hipRiseBefore =
            -diff(
                p1.hipY,
                c.hipY
            );

        const hipRiseAfter =
            -diff(
                c.hipY,
                n2.hipY
            );


        // ----------------------------------------------------
        // 手と腰の距離
        // ----------------------------------------------------

        const measured =
            c.handHip;


        // ----------------------------------------------------
        // 着手らしさ
        // ----------------------------------------------------

        let score = 0;


        // 手が動いている
        if (
            handMoveBefore >
            0.01
        ) {

            score += 2;

        }

        if (
            handMoveBefore >
            0.02
        ) {

            score += 1;

        }


        // 手が下降
        if (
            handDown >
            0.003
        ) {

            score += 2;

        }

        if (
            handDown >
            0.008
        ) {

            score += 1;

        }


        // 腰が上昇
        if (
            hipRiseBefore >
            0.003
        ) {

            score += 2;

        }


        // 着手後も腰が上がる
        if (
            hipRiseAfter >
            0.003
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

                frame:
                    i,

                score:
                    score,

                measured:
                    measured,

                handMoveBefore:
                    handMoveBefore,

                handMoveAfter:
                    handMoveAfter,

                handDown:
                    handDown,

                handChange:
                    handChange,

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
// ★★★ 本当に着手らしい1フレームを選択 ★★★
//
// ポイント
//
// ・候補の最初を選ばない
// ・実測値の最小値だけでも選ばない
// ・候補が連続している場所を「着手ゾーン」とする
// ・そのゾーンの中央付近を調べる
// ・動作の切り替わりを評価
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


    // --------------------------------------------------------
    // 候補をフレーム順に並べる
    // --------------------------------------------------------

    const sorted =
        [...candidates]
            .sort(
                (a, b) =>
                    a.frame -
                    b.frame
            );


    // --------------------------------------------------------
    // 連続候補グループを作る
    // --------------------------------------------------------

    const groups = [];

    let currentGroup = [];


    for (
        let i = 0;
        i < sorted.length;
        i++
    ) {

        const current =
            sorted[i];

        if (
            currentGroup.length === 0
        ) {

            currentGroup.push(
                current
            );

            continue;
        }


        const previous =
            currentGroup[
                currentGroup.length - 1
            ];


        if (
            current.frame -
            previous.frame <= 2
        ) {

            currentGroup.push(
                current
            );

        } else {

            groups.push(
                currentGroup
            );

            currentGroup = [
                current
            ];

        }

    }


    if (
        currentGroup.length > 0
    ) {

        groups.push(
            currentGroup
        );

    }


    console.log(
        "着手候補グループ数:",
        groups.length
    );


    // --------------------------------------------------------
    // 最も「着手らしい」グループを選ぶ
    // --------------------------------------------------------

    let bestGroup =
        null;

    let bestGroupScore =
        -Infinity;


    for (
        let i = 0;
        i < groups.length;
        i++
    ) {

        const group =
            groups[i];


        const first =
            group[0];

        const last =
            group[
                group.length - 1
            ];


        // 踏切から近すぎるグループは減点
        const fromTakeOff =
            first.frame -
            takeOff;


        let groupScore =
            group.length * 2;


        if (
            fromTakeOff < 3
        ) {

            groupScore -= 5;

        }

        else if (
            fromTakeOff < 5
        ) {

            groupScore -= 1;

        }


        // グループ内の最大スコア
        const maxScore =
            Math.max(
                ...group.map(
                    c => c.score
                )
            );


        groupScore +=
            maxScore * 2;


        // グループがある程度続いている
        if (
            group.length >= 3
        ) {

            groupScore += 3;

        }


        if (
            groupScore >
            bestGroupScore
        ) {

            bestGroupScore =
                groupScore;

            bestGroup =
                group;

        }

    }


    if (!bestGroup) {
        return null;
    }


    console.log(
        "選択した着手ゾーン:",
        bestGroup[0].frame,
        "～",
        bestGroup[
            bestGroup.length - 1
        ].frame
    );


    // --------------------------------------------------------
    // グループ内から1フレームを選ぶ
    //
    // 「動作の切り替わり」が強い場所を探す
    // --------------------------------------------------------

    let best =
        null;

    let bestScore =
        -Infinity;


    for (
        let i = 0;
        i < bestGroup.length;
        i++
    ) {

        const candidate =
            bestGroup[i];

        const frame =
            candidate.frame;


        let score =
            candidate.score * 2;


        // ----------------------------------------------------
        // 前後の手の動き
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


        if (
            before &&
            current &&
            after
        ) {

            const beforeHand =
                Math.abs(
                    diff(
                        before.wristX,
                        current.wristX
                    )
                ) +
                Math.abs(
                    diff(
                        before.wristY,
                        current.wristY
                    )
                );

            const afterHand =
                Math.abs(
                    diff(
                        current.wristX,
                        after.wristX
                    )
                ) +
                Math.abs(
                    diff(
                        current.wristY,
                        after.wristY
                    )
                );


            // ------------------------------------------------
            // 動きのピーク
            // ------------------------------------------------

            if (
                beforeHand >=
                0.005 &&
                beforeHand >=
                afterHand
            ) {

                score += 4;

            }


            // ------------------------------------------------
            // 腰の上昇開始
            // ------------------------------------------------

            const beforeHip =
                -diff(
                    before.hipY,
                    current.hipY
                );

            const afterHip =
                -diff(
                    current.hipY,
                    after.hipY
                );


            if (
                beforeHip >= 0 &&
                afterHip > 0
            ) {

                score += 3;

            }

        }


        // ----------------------------------------------------
        // 踏切直後すぎる候補を避ける
        // ----------------------------------------------------

        const delta =
            frame -
            takeOff;


        if (
            delta <= 2
        ) {

            score -= 8;

        }

        else if (
            delta === 3
        ) {

            score -= 3;

        }


        // ----------------------------------------------------
        // グループの端より中央を少し優先
        // ----------------------------------------------------

        const centerIndex =
            (
                bestGroup[0].frame +
                bestGroup[
                    bestGroup.length - 1
                ].frame
            ) / 2;


        const centerDistance =
            Math.abs(
                frame -
                centerIndex
            );


        score -=
            centerDistance *
            0.15;


        // ----------------------------------------------------
        // 最終選択
        // ----------------------------------------------------

        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            best = {

                ...candidate,

                selectionScore:
                    Number(
                        score.toFixed(3)
                    )

            };

        }

    }


    return best;
}


// ============================================================
// 最高点
//
// 必ず「着手より後」を調べる
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
        start >=
        frames.length
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


        if (!a || !b) {
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
// 画面診断
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
            result.handContact
            ?? "-"
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
            result.selectionScore
            ?? "-"
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
        "================================"
    );

    console.log(
        "phase.js 着手タイミング改良版"
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


    // --------------------------------------------------------
    // 動作データ
    // --------------------------------------------------------

    const motion =
        buildMotionData(
            frames
        );


    // --------------------------------------------------------
    // 踏切
    // --------------------------------------------------------

    const takeOff =
        detectTakeOff(
            motion
        );


    // --------------------------------------------------------
    // 着手候補
    // --------------------------------------------------------

    const candidates =
        findHandCandidates(
            motion,
            takeOff
        );


    console.log(
        "着手候補数:",
        candidates.length
    );


    // --------------------------------------------------------
    // ★候補の山から本当の着手を選択
    // --------------------------------------------------------

    const selected =
        selectTrueHandContact(
            candidates,
            motion,
            takeOff
        );


    // --------------------------------------------------------
    // 候補なしの場合
    // --------------------------------------------------------

    if (!selected) {

        console.warn(
            "着手候補から選択できませんでした"
        );


        // 最低限のフォールバック
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


        const fallback = {

            frame:
                fallbackFrame,

            score:
                0,

            measured:
                fallbackMeasured,

            selectionScore:
                0,

            fallback:
                true

        };


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


    // --------------------------------------------------------
    // 最高点
    // --------------------------------------------------------

    const highestHip =
        detectHighestHip(
            frames,
            selected.frame
        );


    // --------------------------------------------------------
    // 着地
    // --------------------------------------------------------

    const landing =
        detectLanding(
            frames,
            highestHip
        );


    // --------------------------------------------------------
    // 最終結果
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // ログ
    // --------------------------------------------------------

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
        "選択フレーム:",
        result.handContact
    );

    console.log(
        "実測値:",
        result.handMeasured
    );

    console.log(
        "================================"
    );


    // --------------------------------------------------------
    // 画面表示
    // --------------------------------------------------------

    showPhaseDiagnostic(
        result
    );


    return result;
}


// ============================================================
// クリア
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