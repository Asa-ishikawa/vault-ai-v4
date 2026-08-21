// ============================================================
// 跳び箱AI採点システム
// phase.js 改良版
//
// 目的
// ・踏切直後の誤着手を減らす
// ・「着手＝最高点」の不自然な判定を減らす
// ・着手候補の中から、本当に着手らしい1フレームを選ぶ
// ・29フレーム程度の短い動画にも対応
// ・診断情報を画面に表示
// ============================================================


// ============================================================
// 共通
// ============================================================

let lastPhaseResult = null;


// ============================================================
// フレームの腰中心
// ============================================================

function getHipCenter(frame) {

    if (!frame) {
        return null;
    }

    const landmarks =
        frame.landmarks ||
        frame.poseLandmarks ||
        frame;

    if (!landmarks || landmarks.length < 25) {
        return null;
    }

    const left =
        landmarks[23];

    const right =
        landmarks[24];

    if (!left || !right) {
        return null;
    }

    if (
        typeof left.x !== "number" ||
        typeof left.y !== "number" ||
        typeof right.x !== "number" ||
        typeof right.y !== "number"
    ) {
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

    if (!frame) {
        return null;
    }

    const landmarks =
        frame.landmarks ||
        frame.poseLandmarks ||
        frame;

    if (!landmarks || landmarks.length < 17) {
        return null;
    }

    const left =
        landmarks[15];

    const right =
        landmarks[16];

    if (!left || !right) {
        return null;
    }

    if (
        typeof left.x !== "number" ||
        typeof left.y !== "number" ||
        typeof right.x !== "number" ||
        typeof right.y !== "number"
    ) {
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

    if (!frame) {
        return null;
    }

    const landmarks =
        frame.landmarks ||
        frame.poseLandmarks ||
        frame;

    if (!landmarks || landmarks.length < 29) {
        return null;
    }

    const left =
        landmarks[27];

    const right =
        landmarks[28];

    if (!left || !right) {
        return null;
    }

    if (
        typeof left.x !== "number" ||
        typeof left.y !== "number" ||
        typeof right.x !== "number" ||
        typeof right.y !== "number"
    ) {
        return null;
    }

    return {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2
    };
}


// ============================================================
// データ取得
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
// 値を0～1に制限
// ============================================================

function clamp01(value) {

    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(1, value)
    );
}


// ============================================================
// フレーム間距離
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
// 着手候補の実測値
//
// 手と腰の距離を利用
// 小さいほど「手が腰に近い」ではなく、
// 跳び箱に手をつく動作との関係を見るための補助値
// ============================================================

function calculateHandHipValue(frame) {

    const hip =
        getHipCenter(frame);

    const wrist =
        getWristCenter(frame);

    if (!hip || !wrist) {
        return null;
    }

    return distance(
        hip,
        wrist
    );
}


// ============================================================
// 動作の変化量を計算
// ============================================================

function getMotionValues(frames) {

    const values = [];

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

        values.push({

            index: i,

            hipY:
                hip
                ? hip.y
                : null,

            wristX:
                wrist
                ? wrist.x
                : null,

            wristY:
                wrist
                ? wrist.y
                : null,

            ankleY:
                ankle
                ? ankle.y
                : null

        });

    }

    return values;
}


// ============================================================
// 踏切候補
//
// 最初の約30%以内から、足の動きが大きくなる地点を探す
// ============================================================

function detectTakeOff(
    frames,
    motion
) {

    const length =
        frames.length;

    if (length < 5) {
        return 0;
    }

    const limit =
        Math.max(
            3,
            Math.floor(
                length * 0.35
            )
        );

    let bestIndex = 0;
    let bestScore = -Infinity;

    for (
        let i = 1;
        i < limit;
        i++
    ) {

        const prev =
            motion[i - 1];

        const curr =
            motion[i];

        if (
            prev.ankleY == null ||
            curr.ankleY == null
        ) {
            continue;
        }

        const ankleMove =
            Math.abs(
                curr.ankleY -
                prev.ankleY
            );

        const hipMove =
            (
                prev.hipY != null &&
                curr.hipY != null
            )
                ? Math.abs(
                    curr.hipY -
                    prev.hipY
                )
                : 0;

        const score =
            ankleMove * 0.7 +
            hipMove * 0.3;

        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            bestIndex =
                i;

        }

    }

    return bestIndex;
}


// ============================================================
// 着手候補を作る
//
// 改良ポイント
//
// ① 踏切直後すぎるフレームを除外
// ② 動画後半すぎるフレームを除外
// ③ 手の前進
// ④ 腰の上昇
// ⑤ 手の高さ
//
// ただし条件を厳しくしすぎない
// ============================================================

function findHandContactCandidates(
    frames,
    motion,
    takeOff
) {

    const candidates = [];

    const length =
        frames.length;


    // --------------------------------------------------------
    // 着手候補開始
    //
    // 最低でも踏切から2フレーム後
    // --------------------------------------------------------

    const start =
        Math.min(
            length - 1,
            Math.max(
                takeOff + 2,
                Math.floor(
                    length * 0.10
                )
            )
        );


    // --------------------------------------------------------
    // 着手候補終了
    //
    // 最後の着地直前まで
    // --------------------------------------------------------

    const end =
        Math.min(
            length - 3,
            Math.max(
                start,
                Math.floor(
                    length * 0.85
                )
            )
        );


    // --------------------------------------------------------
    // 前後の動きを比較
    // --------------------------------------------------------

    for (
        let i = start;
        i <= end;
        i++
    ) {

        const current =
            motion[i];

        if (!current) {
            continue;
        }


        // ----------------------------------------
        // 前後フレーム
        // ----------------------------------------

        const before =
            motion[
                Math.max(
                    0,
                    i - 2
                )
            ];

        const after =
            motion[
                Math.min(
                    length - 1,
                    i + 2
                )
            ];


        if (
            !before ||
            !after
        ) {
            continue;
        }


        // ----------------------------------------
        // 手の前進量
        //
        // x方向だけに依存しすぎない
        // ----------------------------------------

        let handForward = 0;

        if (
            current.wristX != null &&
            before.wristX != null
        ) {

            handForward =
                Math.abs(
                    current.wristX -
                    before.wristX
                );

        }


        // ----------------------------------------
        // 手の下降量
        //
        // 着手前は手が下がる動きが出やすい
        // ----------------------------------------

        let handDown = 0;

        if (
            current.wristY != null &&
            before.wristY != null
        ) {

            handDown =
                current.wristY -
                before.wristY;

        }


        // ----------------------------------------
        // 腰の上昇
        //
        // yが小さくなる＝上昇
        // ----------------------------------------

        let hipRise = 0;

        if (
            before.hipY != null &&
            current.hipY != null
        ) {

            hipRise =
                before.hipY -
                current.hipY;

        }


        // ----------------------------------------
        // 着手後の腰上昇
        // ----------------------------------------

        let afterHipRise = 0;

        if (
            current.hipY != null &&
            after.hipY != null
        ) {

            afterHipRise =
                current.hipY -
                after.hipY;

        }


        // ----------------------------------------
        // 手と腰の距離
        // ----------------------------------------

        const handHip =
            calculateHandHipValue(
                frames[i]
            );


        // ----------------------------------------
        // スコア
        // ----------------------------------------

        let score = 0;


        // 手の前進
        if (
            handForward >
            0.015
        ) {

            score += 2;

        } else if (
            handForward >
            0.007
        ) {

            score += 1;

        }


        // 手の下降
        if (
            handDown >
            0.008
        ) {

            score += 2;

        } else if (
            handDown >
            0.003
        ) {

            score += 1;

        }


        // 腰の上昇
        if (
            hipRise >
            0.008
        ) {

            score += 2;

        } else if (
            hipRise >
            0.003
        ) {

            score += 1;

        }


        // 着手後に腰が上がる
        if (
            afterHipRise >
            0.005
        ) {

            score += 2;

        }


        // 手と腰の距離が取得できている
        if (
            handHip != null
        ) {

            score += 1;

        }


        // ----------------------------------------
        // 候補採用
        //
        // 最低2点
        // ----------------------------------------

        if (
            score >= 2
        ) {

            candidates.push({

                frame:
                    i,

                score:
                    score,

                measured:
                    handHip,

                handForward:
                    handForward,

                handDown:
                    handDown,

                hipRise:
                    hipRise,

                afterHipRise:
                    afterHipRise

            });

        }

    }

    return candidates;
}


// ============================================================
// 着手候補から本当の着手を選択
//
// 改良ポイント
//
// 「最初の候補」をそのまま採用しない
//
// ・踏切直後すぎない
// ・動作スコア
// ・手の動き
// ・腰の上昇
// ・候補の連続性
//
// を総合して選ぶ
// ============================================================

function selectBestHandContact(
    candidates,
    frames,
    takeOff
) {

    if (
        !candidates ||
        candidates.length === 0
    ) {

        return null;

    }


    let best =
        null;

    let bestScore =
        -Infinity;


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const candidate =
            candidates[i];

        let score =
            candidate.score;


        // ----------------------------------------
        // 踏切直後すぎる候補を減点
        // ----------------------------------------

        const distanceFromTakeOff =
            candidate.frame -
            takeOff;

        if (
            distanceFromTakeOff < 3
        ) {

            score -= 4;

        }

        else if (
            distanceFromTakeOff === 3
        ) {

            score -= 1;

        }


        // ----------------------------------------
        // 早すぎるフレームを軽く減点
        // ----------------------------------------

        const ratio =
            candidate.frame /
            Math.max(
                1,
                frames.length - 1
            );

        if (
            ratio < 0.15
        ) {

            score -= 2;

        }


        // ----------------------------------------
        // 腰上昇＋手の動きの組み合わせを加点
        // ----------------------------------------

        if (
            candidate.handForward >
            0.01 &&
            candidate.hipRise >
            0.003
        ) {

            score += 3;

        }


        // ----------------------------------------
        // 候補の連続性
        // ----------------------------------------

        let neighborCount = 0;

        for (
            let j = 0;
            j < candidates.length;
            j++
        ) {

            if (i === j) {
                continue;
            }

            if (
                Math.abs(
                    candidates[j].frame -
                    candidate.frame
                ) <= 2
            ) {

                neighborCount++;

            }

        }

        if (
            neighborCount >= 2
        ) {

            score += 2;

        }

        else if (
            neighborCount === 1
        ) {

            score += 1;

        }


        // ----------------------------------------
        // 最終比較
        // ----------------------------------------

        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            best = {

                ...candidate,

                selectionScore:
                    score

            };

        }

    }


    return best;
}


// ============================================================
// 最高点検出
//
// 着手より後だけを見る
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


    if (
        start >=
        frames.length
    ) {

        return handContact;

    }


    let highest =
        start;

    let minY =
        Infinity;


    for (
        let i = start;
        i < frames.length; i++
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
// 着地検出
//
// 後半の足の安定位置を利用
// ============================================================

function detectLanding(
    frames,
    highestHip
) {

    const start =
        Math.min(
            frames.length - 1,
            Math.max(
                highestHip + 2,
                Math.floor(
                    frames.length * 0.65
                )
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


    let previousAnkle =
        null;


    for (
        let i = start;
        i < frames.length;
        i++
    ) {

        const ankle =
            getAnkleCenter(
                frames[i]
            );

        if (!ankle) {
            continue;
        }


        if (
            previousAnkle
        ) {

            const movement =
                distance(
                    ankle,
                    previousAnkle
                );


            if (
                movement <
                0.03
            ) {

                landing =
                    i;

                break;

            }

        }


        previousAnkle =
            ankle;

    }


    return landing;
}


// ============================================================
// 診断表示
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


    let candidateText =
        "";


    const maxDisplay =
        Math.min(
            candidates.length,
            15
        );


    for (
        let i = 0;
        i < maxDisplay;
        i++
    ) {

        const c =
            candidates[i];


        candidateText +=
            `
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
            }<br>
            `;

    }


    if (
        candidates.length >
        maxDisplay
    ) {

        candidateText +=
            `
            …（残り
            ${
                candidates.length -
                maxDisplay
            }候補）
            `;

    }


    el.innerHTML = `

        <strong>
            着手判定診断
        </strong>

        <br>

        着手候補数：
        ${candidates.length}

        <br>

        選択着手フレーム：
        ${
            result.handContact
            ?? "-"
        }

        <br>

        選択スコア：
        ${
            result.selectionScore
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

        <hr>

        <strong>
            着手候補
        </strong>

        <br>

        ${candidateText}

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
        "phase.js 改良版"
    );

    console.log(
        "取得フレーム数:",
        frames
        ? frames.length
        : 0
    );

    console.log(
        "================================"
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


    // ----------------------------------------
    // 動作データ
    // ----------------------------------------

    const motion =
        getMotionValues(
            frames
        );


    // ----------------------------------------
    // 踏切
    // ----------------------------------------

    const takeOff =
        detectTakeOff(
            frames,
            motion
        );


    console.log(
        "踏切:",
        takeOff
    );


    // ----------------------------------------
    // 着手候補
    // ----------------------------------------

    const candidates =
        findHandContactCandidates(
            frames,
            motion,
            takeOff
        );


    console.log(
        "着手候補数:",
        candidates.length
    );


    // ----------------------------------------
    // 着手選択
    // ----------------------------------------

    let selected =
        selectBestHandContact(
            candidates,
            frames,
            takeOff
        );


    // ----------------------------------------
    // 候補がない場合
    //
    // 完全失敗にはしない
    //
    // 腰・手の動きが一番大きい場所を
    // フォールバックとして利用
    // ----------------------------------------

    if (!selected) {

        console.warn(
            "着手候補なし → フォールバック"
        );


        let bestFrame =
            Math.min(
                frames.length - 2,
                Math.max(
                    takeOff + 3,
                    Math.floor(
                        frames.length * 0.35
                    )
                )
            );


        let bestValue =
            -Infinity;


        for (
            let i =
                Math.max(
                    takeOff + 3,
                    1
                );
            i <
                Math.min(
                    frames.length - 2,
                    Math.floor(
                        frames.length * 0.75
                    )
                );
            i++
        ) {

            const before =
                motion[i - 1];

            const current =
                motion[i];

            if (
                !before ||
                !current
            ) {

                continue;

            }


            let value = 0;


            if (
                before.wristX != null &&
                current.wristX != null
            ) {

                value +=
                    Math.abs(
                        current.wristX -
                        before.wristX
                    ) * 5;

            }


            if (
                before.wristY != null &&
                current.wristY != null
            ) {

                value +=
                    Math.abs(
                        current.wristY -
                        before.wristY
                    ) * 5;

            }


            if (
                before.hipY != null &&
                current.hipY != null
            ) {

                value +=
                    Math.abs(
                        current.hipY -
                        before.hipY
                    ) * 5;

            }


            if (
                value >
                bestValue
            ) {

                bestValue =
                    value;

                bestFrame =
                    i;

            }

        }


        const measured =
            calculateHandHipValue(
                frames[bestFrame]
            );


        selected = {

            frame:
                bestFrame,

            score:
                0,

            selectionScore:
                0,

            measured:
                measured,

            handForward:
                0,

            handDown:
                0,

            hipRise:
                0,

            afterHipRise:
                0,

            fallback:
                true

        };

    }


    // ----------------------------------------
    // 最高点
    // ----------------------------------------

    const highestHip =
        detectHighestHip(
            frames,
            selected.frame
        );


    // ----------------------------------------
    // 着地
    // ----------------------------------------

    const landing =
        detectLanding(
            frames,
            highestHip
        );


    // ----------------------------------------
    // 結果
    // ----------------------------------------

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
            selected.fallback || false

    };


    lastPhaseResult =
        result;


    // ----------------------------------------
    // ログ
    // ----------------------------------------

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
        "着手候補数:",
        candidates.length
    );

    console.log(
        "着手実測値:",
        result.handMeasured
    );

    console.log(
        "================================"
    );


    // ----------------------------------------
    // 画面診断
    // ----------------------------------------

    showPhaseDiagnostic(
        result
    );


    return result;
}


// ============================================================
// phase情報クリア
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
    "phase.js 改良版 読み込み成功"
);