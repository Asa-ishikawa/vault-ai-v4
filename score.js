// ============================================================
// 跳び箱AI採点システム Ver6.4
// score.js
// 採点基準「見える化」診断版
//
// 目的
// ・5項目の実測値を必ず保持
// ・各項目の0/1/2点判定を明示
// ・判定に使った基準値を画面表示
// ・判定理由を表示
// ・phase.js の着手データを壊さない
// ・feedback.js が利用できるデータ構造を維持
// ============================================================


// ============================================================
// メイン採点
// ============================================================

function calculateDScore(frames, phase) {

    console.log("=================================");
    console.log("score.js Ver6.4 診断版");
    console.log("=================================");


    // --------------------------------------------------------
    // データ確認
    // --------------------------------------------------------

    if (!frames || frames.length < 5) {

        console.warn("フレーム数不足");

        return createEmptyResult(
            "フレームデータが不足しています。"
        );
    }


    // phase が無くても採点を止めない
    if (!phase) {

        console.warn(
            "phaseデータなし → 利用可能なデータで採点"
        );

        phase = {};
    }


    // ========================================================
    // ① 膝
    // ========================================================

    const kneeResult =
        calculateKnee(frames, phase);


    // ========================================================
    // ② 腰
    // ========================================================

    const hipResult =
        calculateHip(frames, phase);


    // ========================================================
    // ③ 着手
    // ========================================================

    const handResult =
        calculateHand(frames, phase);


    // ========================================================
    // ④ 踏切
    // ========================================================

    const takeOffResult =
        calculateTakeOff(frames, phase);


    // ========================================================
    // ⑤ 着地
    // ========================================================

    const landingResult =
        calculateLanding(frames, phase);


    // ========================================================
    // 合計
    // ========================================================

    const totalScore =
        kneeResult.score +
        hipResult.score +
        handResult.score +
        takeOffResult.score +
        landingResult.score;


    // ========================================================
    // 結果
    // ========================================================

    const result = {

        score: totalScore,

        details: {

            knee: kneeResult,

            hip: hipResult,

            hand: handResult,

            takeOff: takeOffResult,

            landing: landingResult

        },

        diagnostic: {

            frameCount: frames.length,

            phase: phase

        }

    };


    // ========================================================
    // コンソール
    // ========================================================

    console.log(
        "========== 採点結果 =========="
    );

    console.log(
        "Dスコア:",
        totalScore
    );

    console.log(
        "膝:",
        kneeResult
    );

    console.log(
        "腰:",
        hipResult
    );

    console.log(
        "着手:",
        handResult
    );

    console.log(
        "踏切:",
        takeOffResult
    );

    console.log(
        "着地:",
        landingResult
    );


    return result;
}


// ============================================================
// ① 膝の判定
// ============================================================

function calculateKnee(frames, phase) {

    let bestAngle = null;


    // 膝角度を取得
    for (let i = 0; i < frames.length; i++) {

        const frame = frames[i];

        const angle =
            getKneeAngle(frame);

        if (
            angle !== null &&
            isFinite(angle)
        ) {

            // 最大角度を採用
            if (
                bestAngle === null ||
                angle > bestAngle
            ) {

                bestAngle = angle;

            }

        }

    }


    // データなし
    if (bestAngle === null) {

        return {

            score: 0,

            value: null,

            measured: "取得できませんでした",

            text: "膝角度を取得できませんでした。",

            threshold0: "データなし",

            threshold1: "データなし",

            threshold2: "データなし",

            reason: "膝角度データが取得できませんでした。"

        };

    }


    // --------------------------------------------------------
    // 暫定基準
    //
    // 現在の3本の動画だけで過学習しないよう、
    // 大きく変更せず診断用として使用
    // --------------------------------------------------------

    let score = 0;

    let reason = "";


    if (bestAngle >= 160) {

        score = 2;

        reason =
            "膝角度が160°以上のため2点";

    }
    else if (bestAngle >= 145) {

        score = 1;

        reason =
            "膝角度が145°以上160°未満のため1点";

    }
    else {

        score = 0;

        reason =
            "膝角度が145°未満のため0点";

    }


    return {

        score: score,

        value: bestAngle,

        measured:
            Number(bestAngle).toFixed(1) + "°",

        text:
            "膝の伸びを確認しましょう。",

        threshold0:
            "145°未満",

        threshold1:
            "145°以上160°未満",

        threshold2:
            "160°以上",

        reason: reason

    };

}


// ============================================================
// 膝角度取得
// ============================================================

function getKneeAngle(frame) {

    if (!frame) {
        return null;
    }


    const left =
        calculateAngle(
            frame.leftHip,
            frame.leftKnee,
            frame.leftAnkle
        );


    const right =
        calculateAngle(
            frame.rightHip,
            frame.rightKnee,
            frame.rightAnkle
        );


    const values = [];


    if (
        left !== null &&
        isFinite(left)
    ) {

        values.push(left);

    }


    if (
        right !== null &&
        isFinite(right)
    ) {

        values.push(right);

    }


    if (values.length === 0) {

        return null;

    }


    return Math.max(...values);

}


// ============================================================
// ② 腰の判定
// ============================================================

function calculateHip(frames, phase) {

    let value = null;


    // phase.js が計算した値を優先
    if (
        phase &&
        phase.hipRise !== undefined
    ) {

        value =
            Number(phase.hipRise);

    }


    // 別名称にも対応
    if (
        value === null ||
        !isFinite(value)
    ) {

        if (
            phase &&
            phase.highestHipValue !== undefined
        ) {

            value =
                Number(
                    phase.highestHipValue
                );

        }

    }


    // フレームから計算
    if (
        value === null ||
        !isFinite(value)
    ) {

        value =
            calculateHipRise(frames);

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を確認しましょう。",

            threshold0:
                "取得できません",

            threshold1:
                "0.30以上",

            threshold2:
                "0.60以上",

            reason:
                "腰位置の実測値が取得できませんでした。"

        };

    }


    // --------------------------------------------------------
    // 暫定基準
    // --------------------------------------------------------

    let score = 0;

    let reason = "";


    if (value >= 0.60) {

        score = 2;

        reason =
            "腰の上昇量が0.60以上のため2点";

    }
    else if (value >= 0.30) {

        score = 1;

        reason =
            "腰の上昇量が0.30以上0.60未満のため1点";

    }
    else {

        score = 0;

        reason =
            "腰の上昇量が0.30未満のため0点";

    }


    return {

        score: score,

        value: value,

        measured:
            Number(value).toFixed(3),

        text:
            "腰の位置を確認しましょう。",

        threshold0:
            "0.30未満",

        threshold1:
            "0.30以上0.60未満",

        threshold2:
            "0.60以上",

        reason: reason

    };

}


// ============================================================
// 腰上昇量
// ============================================================

function calculateHipRise(frames) {

    const values = [];


    for (
        let i = 0;
        i < frames.length;
        i++
    ) {

        const hip =
            getHipCenter(frames[i]);


        if (
            hip &&
            isFinite(hip.y)
        ) {

            values.push(hip.y);

        }

    }


    if (values.length < 2) {

        return null;

    }


    const start =
        values[0];


    const min =
        Math.min(...values);


    const rise =
        start - min;


    return Math.max(
        0,
        rise
    );

}


// ============================================================
// 腰中心
// ============================================================

function getHipCenter(frame) {

    if (!frame) {
        return null;
    }


    if (
        frame.leftHip &&
        frame.rightHip
    ) {

        return {

            x:
                (
                    frame.leftHip.x +
                    frame.rightHip.x
                ) / 2,

            y:
                (
                    frame.leftHip.y +
                    frame.rightHip.y
                ) / 2

        };

    }


    return null;

}


// ============================================================
// ③ 着手
// ============================================================

function calculateHand(frames, phase) {

    let value = null;


    // --------------------------------------------------------
    // phase.js の選択結果を最優先
    // --------------------------------------------------------

    if (
        phase &&
        phase.handValue !== undefined
    ) {

        value =
            Number(
                phase.handValue
            );

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        if (
            phase &&
            phase.handMeasured !== undefined
        ) {

            value =
                Number(
                    phase.handMeasured
                );

        }

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        if (
            phase &&
            phase.handPosition !== undefined
        ) {

            value =
                Number(
                    phase.handPosition
                );

        }

    }


    // 最終的にフレームから探す
    if (
        value === null ||
        !isFinite(value)
    ) {

        value =
            calculateHandFromFrames(
                frames,
                phase
            );

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着手位置を確認しましょう。",

            threshold0:
                "取得できません",

            threshold1:
                "0.20以上",

            threshold2:
                "0.40以上",

            reason:
                "着手位置の実測値が取得できませんでした。"

        };

    }


    // --------------------------------------------------------
    // 着手判定
    //
    // 注意：
    // 現段階では診断用の暫定基準
    // --------------------------------------------------------

    let score = 0;

    let reason = "";


    if (value >= 0.40) {

        score = 2;

        reason =
            "着手位置が0.40以上のため2点";

    }
    else if (value >= 0.20) {

        score = 1;

        reason =
            "着手位置が0.20以上0.40未満のため1点";

    }
    else {

        score = 0;

        reason =
            "着手位置が0.20未満のため0点";

    }


    return {

        score: score,

        value: value,

        measured:
            Number(value).toFixed(3),

        text:
            "着手位置を確認しましょう。",

        threshold0:
            "0.20未満",

        threshold1:
            "0.20以上0.40未満",

        threshold2:
            "0.40以上",

        reason: reason,

        candidateCount:
            phase &&
            phase.handCandidates
                ? phase.handCandidates.length
                : 0,

        selectedFrame:
            phase &&
            phase.handContact !== undefined
                ? phase.handContact
                : "-"

    };

}


// ============================================================
// 着手値をフレームから探す
// ============================================================

function calculateHandFromFrames(
    frames,
    phase
) {

    let index = 0;


    if (
        phase &&
        phase.handContact !== undefined
    ) {

        index =
            Number(
                phase.handContact
            );

    }


    index =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                index
            )
        );


    const frame =
        frames[index];


    if (!frame) {
        return null;
    }


    // 手首
    const wrist =
        frame.rightWrist ||
        frame.leftWrist;


    // 肩
    const shoulder =
        frame.rightShoulder ||
        frame.leftShoulder;


    if (
        !wrist ||
        !shoulder
    ) {

        return null;

    }


    const value =
        Math.abs(
            wrist.x -
            shoulder.x
        );


    return value;

}


// ============================================================
// ④ 踏切
// ============================================================

function calculateTakeOff(
    frames,
    phase
) {

    let value = null;


    // phase.js の値を優先
    if (
        phase &&
        phase.takeOffValue !== undefined
    ) {

        value =
            Number(
                phase.takeOffValue
            );

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        if (
            phase &&
            phase.takeOffMeasured !== undefined
        ) {

            value =
                Number(
                    phase.takeOffMeasured
                );

        }

    }


    // フレームから計算
    if (
        value === null ||
        !isFinite(value)
    ) {

        value =
            calculateTakeOffValue(
                frames,
                phase
            );

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "踏切の状態を確認しましょう。",

            threshold0:
                "取得できません",

            threshold1:
                "0.02以上",

            threshold2:
                "0.015未満",

            reason:
                "踏切の実測値が取得できませんでした。"

        };

    }


    // --------------------------------------------------------
    // 踏切判定
    //
    // 小さいほど両足踏切に近い
    // --------------------------------------------------------

    let score = 0;

    let reason = "";


    if (value < 0.015) {

        score = 2;

        reason =
            "踏切実測値が0.015未満のため2点";

    }
    else if (value < 0.030) {

        score = 1;

        reason =
            "踏切実測値が0.015以上0.030未満のため1点";

    }
    else {

        score = 0;

        reason =
            "踏切実測値が0.030以上のため0点";

    }


    return {

        score: score,

        value: value,

        measured:
            Number(value).toFixed(3),

        text:
            "踏切の状態を確認しましょう。",

        threshold0:
            "0.030以上",

        threshold1:
            "0.015以上0.030未満",

        threshold2:
            "0.015未満",

        reason: reason

    };

}


// ============================================================
// 踏切実測値
// ============================================================

function calculateTakeOffValue(
    frames,
    phase
) {

    let index = 0;


    if (
        phase &&
        phase.takeOff !== undefined
    ) {

        index =
            Number(
                phase.takeOff
            );

    }


    index =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                index
            )
        );


    const frame =
        frames[index];


    if (!frame) {
        return null;
    }


    if (
        frame.leftAnkle &&
        frame.rightAnkle
    ) {

        return Math.abs(
            frame.leftAnkle.x -
            frame.rightAnkle.x
        );

    }


    return null;

}


// ============================================================
// ⑤ 着地
// ============================================================

function calculateLanding(
    frames,
    phase
) {

    let value = null;


    // phase.js の値を優先
    if (
        phase &&
        phase.landingValue !== undefined
    ) {

        value =
            Number(
                phase.landingValue
            );

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        if (
            phase &&
            phase.landingMeasured !== undefined
        ) {

            value =
                Number(
                    phase.landingMeasured
                );

        }

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        value =
            calculateLandingValue(
                frames,
                phase
            );

    }


    if (
        value === null ||
        !isFinite(value)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着地の安定を確認しましょう。",

            threshold0:
                "取得できません",

            threshold1:
                "0.05以上0.10未満",

            threshold2:
                "0.05未満",

            reason:
                "着地の実測値が取得できませんでした。"

        };

    }


    // --------------------------------------------------------
    // 着地判定
    // 小さいほど安定
    // --------------------------------------------------------

    let score = 0;

    let reason = "";


    if (value < 0.05) {

        score = 2;

        reason =
            "着地実測値が0.05未満のため2点";

    }
    else if (value < 0.10) {

        score = 1;

        reason =
            "着地実測値が0.05以上0.10未満のため1点";

    }
    else {

        score = 0;

        reason =
            "着地実測値が0.10以上のため0点";

    }


    return {

        score: score,

        value: value,

        measured:
            Number(value).toFixed(3),

        text:
            "着地の安定を確認しましょう。",

        threshold0:
            "0.10以上",

        threshold1:
            "0.05以上0.10未満",

        threshold2:
            "0.05未満",

        reason: reason

    };

}


// ============================================================
// 着地実測値
// ============================================================

function calculateLandingValue(
    frames,
    phase
) {

    let start =
        frames.length - 5;


    if (
        phase &&
        phase.landing !== undefined
    ) {

        start =
            Number(
                phase.landing
            );

    }


    start =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                start
            )
        );


    const values = [];


    for (
        let i = start;
        i < frames.length;
        i++
    ) {

        const frame =
            frames[i];


        if (
            frame &&
            frame.leftAnkle &&
            frame.rightAnkle
        ) {

            values.push(
                Math.abs(
                    frame.leftAnkle.x -
                    frame.rightAnkle.x
                )
            );

        }

    }


    if (values.length === 0) {

        return null;

    }


    return average(values);

}


// ============================================================
// 平均
// ============================================================

function average(values) {

    if (
        !values ||
        values.length === 0
    ) {

        return null;

    }


    const total =
        values.reduce(
            (sum, value) =>
                sum + Number(value),
            0
        );


    return total / values.length;

}


// ============================================================
// 角度計算
// ============================================================

function calculateAngle(
    a,
    b,
    c
) {

    if (
        !a ||
        !b ||
        !c
    ) {

        return null;

    }


    const ab = {

        x: a.x - b.x,

        y: a.y - b.y

    };


    const cb = {

        x: c.x - b.x,

        y: c.y - b.y

    };


    const dot =
        ab.x * cb.x +
        ab.y * cb.y;


    const magAB =
        Math.sqrt(
            ab.x * ab.x +
            ab.y * ab.y
        );


    const magCB =
        Math.sqrt(
            cb.x * cb.x +
            cb.y * cb.y
        );


    if (
        magAB === 0 ||
        magCB === 0
    ) {

        return null;

    }


    let cosine =
        dot /
        (magAB * magCB);


    cosine =
        Math.max(
            -1,
            Math.min(
                1,
                cosine
            )
        );


    return (
        Math.acos(cosine) *
        180 /
        Math.PI
    );

}


// ============================================================
// データなし結果
// ============================================================

function createEmptyResult(
    message
) {

    return {

        score: 0,

        details: {

            knee: {

                score: 0,

                value: null,

                measured:
                    "取得できませんでした",

                text:
                    message,

                reason:
                    message

            },

            hip: {

                score: 0,

                value: null,

                measured:
                    "取得できませんでした",

                text:
                    message,

                reason:
                    message

            },

            hand: {

                score: 0,

                value: null,

                measured:
                    "取得できませんでした",

                text:
                    message,

                reason:
                    message

            },

            takeOff: {

                score: 0,

                value: null,

                measured:
                    "取得できませんでした",

                text:
                    message,

                reason:
                    message

            },

            landing: {

                score: 0,

                value: null,

                measured:
                    "取得できませんでした",

                text:
                    message,

                reason:
                    message

            }

        }

    };

}


// ============================================================
// グローバル公開
// ============================================================

window.calculateDScore =
    calculateDScore;


// ============================================================
// 読み込み確認
// ============================================================

console.log(
    "================================="
);

console.log(
    "score.js Ver6.4 診断版 読み込み成功"
);

console.log(
    "5項目の採点基準を見える化します"
);

console.log(
    "================================="
);