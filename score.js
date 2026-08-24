// ============================================================
// 跳び箱AI採点システム
// score.js 改良版
//
// 開脚跳び Dスコア
//
// 評価項目
// ① 両足踏切
// ② 着手位置
// ③ 腰の位置
// ④ 膝の伸び
// ⑤ 着地の安定
//
// 各項目 0～2点
// 合計 0～10点
//
// phase.js 改良版との連携対応
// ============================================================


// ============================================================
// 基本関数
// ============================================================

function getScoreLandmarks(frame) {

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
// 座標取得
// ============================================================

function getPoint(frame, index) {

    const lm =
        getScoreLandmarks(frame);

    if (
        !lm ||
        !lm[index]
    ) {
        return null;
    }

    return {
        x: Number(lm[index].x),
        y: Number(lm[index].y),
        visibility:
            lm[index].visibility == null
                ? 1
                : Number(lm[index].visibility)
    };
}


// ============================================================
// 距離
// ============================================================

function scoreDistance(a, b) {

    if (!a || !b) {
        return null;
    }

    return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2)
    );
}


// ============================================================
// 角度
// ============================================================

function scoreAngle(a, b, c) {

    if (!a || !b || !c) {
        return null;
    }

    const abx =
        a.x - b.x;

    const aby =
        a.y - b.y;

    const cbx =
        c.x - b.x;

    const cby =
        c.y - b.y;

    const dot =
        abx * cbx +
        aby * cby;

    const mag1 =
        Math.sqrt(
            abx * abx +
            aby * aby
        );

    const mag2 =
        Math.sqrt(
            cbx * cbx +
            cby * cby
        );

    if (
        mag1 === 0 ||
        mag2 === 0
    ) {
        return null;
    }

    let cos =
        dot / (mag1 * mag2);

    cos =
        Math.max(
            -1,
            Math.min(1, cos)
        );

    return (
        Math.acos(cos) *
        180 /
        Math.PI
    );
}


// ============================================================
// 腰中心
// ============================================================

function getScoreHip(frame) {

    const left =
        getPoint(frame, 23);

    const right =
        getPoint(frame, 24);

    if (!left || !right) {
        return null;
    }

    return {
        x:
            (left.x + right.x) / 2,

        y:
            (left.y + right.y) / 2
    };
}


// ============================================================
// 肩中心
// ============================================================

function getScoreShoulder(frame) {

    const left =
        getPoint(frame, 11);

    const right =
        getPoint(frame, 12);

    if (!left || !right) {
        return null;
    }

    return {
        x:
            (left.x + right.x) / 2,

        y:
            (left.y + right.y) / 2
    };
}


// ============================================================
// 足首中心
// ============================================================

function getScoreAnkle(frame) {

    const left =
        getPoint(frame, 27);

    const right =
        getPoint(frame, 28);

    if (!left || !right) {
        return null;
    }

    return {
        x:
            (left.x + right.x) / 2,

        y:
            (left.y + right.y) / 2
    };
}


// ============================================================
// 手首中心
// ============================================================

function getScoreWrist(frame) {

    const left =
        getPoint(frame, 15);

    const right =
        getPoint(frame, 16);

    if (!left || !right) {
        return null;
    }

    return {
        x:
            (left.x + right.x) / 2,

        y:
            (left.y + right.y) / 2
    };
}


// ============================================================
// 膝角度
// ============================================================

function getLeftKneeAngle(frame) {

    const hip =
        getPoint(frame, 23);

    const knee =
        getPoint(frame, 25);

    const ankle =
        getPoint(frame, 27);

    return scoreAngle(
        hip,
        knee,
        ankle
    );
}


function getRightKneeAngle(frame) {

    const hip =
        getPoint(frame, 24);

    const knee =
        getPoint(frame, 26);

    const ankle =
        getPoint(frame, 28);

    return scoreAngle(
        hip,
        knee,
        ankle
    );
}


// ============================================================
// 膝角度平均
// ============================================================

function getAverageKneeAngle(frame) {

    const left =
        getLeftKneeAngle(frame);

    const right =
        getRightKneeAngle(frame);

    const values = [];

    if (
        Number.isFinite(left)
    ) {
        values.push(left);
    }

    if (
        Number.isFinite(right)
    ) {
        values.push(right);
    }

    if (
        values.length === 0
    ) {
        return null;
    }

    return (
        values.reduce(
            (a, b) => a + b,
            0
        ) /
        values.length
    );
}


// ============================================================
// ① 両足踏切評価
//
// 開脚跳びでは、踏切付近の左右足首の動きと
// 左右足の高さの差を確認する。
// ============================================================

function calculateTakeOffScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            phase.takeOff
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "踏切位置を確認できませんでした。"
        };

    }


    const index =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                phase.takeOff
            )
        );


    const frame =
        frames[index];


    const left =
        getPoint(frame, 27);

    const right =
        getPoint(frame, 28);


    if (
        !left ||
        !right
    ) {

        return {
            score: 0,
            value: null,
            text:
                "両足の位置を確認できませんでした。"
        };

    }


    const heightDifference =
        Math.abs(
            left.y - right.y
        );


    let score;


    if (
        heightDifference < 0.035
    ) {

        score = 2;

    }

    else if (
        heightDifference < 0.075
    ) {

        score = 1;

    }

    else {

        score = 0;

    }


    return {

        score: score,

        value:
            heightDifference,

        text:
            score === 2
                ? "両足をそろえて踏み切れています。"
                : score === 1
                    ? "両足の踏切を意識しましょう。"
                    : "両足で同時に踏み切ることを意識しましょう。"

    };

}


// ============================================================
// ② 着手位置評価
//
// ★今回の改良ポイント
//
// handMeasuredだけでなく、
// ・実測値
// ・着手前後の手の動き
// ・左右の手の高さ
//
// を組み合わせる。
//
// ただし「実測値が小さいほど絶対に良い」とはしない。
// ============================================================

function calculateHandScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            phase.handContact
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "着手位置を確認できませんでした。"
        };

    }


    const index =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                phase.handContact
            )
        );


    const frame =
        frames[index];


    const measured =
        Number.isFinite(
            phase.handMeasured
        )
            ? phase.handMeasured
            : null;


    const left =
        getPoint(frame, 15);

    const right =
        getPoint(frame, 16);


    // --------------------------------------------------------
    // 実測値による基本評価
    // --------------------------------------------------------

    let baseScore = 0;


    if (
        measured != null
    ) {

        if (
            measured <= 0.25
        ) {

            baseScore = 2;

        }

        else if (
            measured <= 0.45
        ) {

            baseScore = 1;

        }

        else {

            baseScore = 0;

        }

    }


    // --------------------------------------------------------
    // 左右の手の高さ
    // --------------------------------------------------------

    let handLevelScore = 0;


    if (
        left &&
        right
    ) {

        const levelDifference =
            Math.abs(
                left.y -
                right.y
            );


        if (
            levelDifference <
            0.04
        ) {

            handLevelScore = 1;

        }

    }


    // --------------------------------------------------------
    // 着手前後の動き
    // --------------------------------------------------------

    let movementScore = 0;


    const before =
        frames[
            Math.max(
                0,
                index - 1
            )
        ];


    const after =
        frames[
            Math.min(
                frames.length - 1,
                index + 1
            )
        ];


    const beforeWrist =
        getScoreWrist(
            before
        );

    const currentWrist =
        getScoreWrist(
            frame
        );

    const afterWrist =
        getScoreWrist(
            after
        );


    if (
        beforeWrist &&
        currentWrist &&
        afterWrist
    ) {

        const beforeMove =
            scoreDistance(
                beforeWrist,
                currentWrist
            );

        const afterMove =
            scoreDistance(
                currentWrist,
                afterWrist
            );


        if (
            beforeMove != null &&
            afterMove != null
        ) {

            // 着手付近で手の動きが変化
            if (
                beforeMove >
                afterMove * 1.05
            ) {

                movementScore = 1;

            }

        }

    }


    // --------------------------------------------------------
    // 最終着手点
    //
    // 実測値を主軸にしつつ、
    // 動作情報で補正する。
    // --------------------------------------------------------

    let score =
        baseScore;


    if (
        baseScore >= 1 &&
        handLevelScore === 1
    ) {

        score += 0.5;

    }


    if (
        movementScore === 1 &&
        score < 2
    ) {

        score += 0.5;

    }


    score =
        Math.round(
            score
        );


    score =
        Math.max(
            0,
            Math.min(
                2,
                score
            )
        );


    let text;


    if (
        score === 2
    ) {

        text =
            "着手位置が安定しています。";

    }

    else if (
        score === 1
    ) {

        text =
            "着手位置は概ねできています。さらに安定させましょう。";

    }

    else {

        text =
            "着手位置を前後の動作と合わせて確認しましょう。";

    }


    return {

        score: score,

        value: measured,

        text: text,

        baseScore:
            baseScore,

        handLevelScore:
            handLevelScore,

        movementScore:
            movementScore

    };

}


// ============================================================
// ③ 腰の位置
//
// 着手時の腰の高さを、身体全体の大きさで正規化。
// ============================================================

function calculateHipScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            phase.handContact
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "腰の位置を確認できませんでした。"
        };

    }


    const index =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                phase.handContact
            )
        );


    const frame =
        frames[index];


    const hip =
        getScoreHip(frame);

    const shoulder =
        getScoreShoulder(frame);

    const ankle =
        getScoreAnkle(frame);


    if (
        !hip ||
        !shoulder ||
        !ankle
    ) {

        return {
            score: 0,
            value: null,
            text:
                "腰の位置を確認できませんでした。"
        };

    }


    const bodyLength =
        scoreDistance(
            shoulder,
            ankle
        );


    if (
        !bodyLength ||
        bodyLength <= 0
    ) {

        return {
            score: 0,
            value: null,
            text:
                "身体の位置を計測できませんでした。"
        };

    }


    // 肩から足首までに対する腰の位置
    const normalizedHip =
        Math.abs(
            hip.y -
            shoulder.y
        ) /
        bodyLength;


    let score;


    if (
        normalizedHip < 0.42
    ) {

        score = 2;

    }

    else if (
        normalizedHip < 0.58
    ) {

        score = 1;

    }

    else {

        score = 0;

    }


    return {

        score: score,

        value:
            normalizedHip,

        text:
            score === 2
                ? "腰がしっかり上がっています。"
                : score === 1
                    ? "腰の位置をもう少し高くしましょう。"
                    : "腰を高く上げることを意識しましょう。"

    };

}


// ============================================================
// ④ 膝の伸び
// ============================================================

function calculateKneeScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            phase.handContact
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "膝角度を確認できませんでした。"
        };

    }


    const center =
        phase.handContact;


    // 着手前後3フレームを見る
    const values = [];


    for (
        let offset = -2;
        offset <= 2;
        offset++
    ) {

        const index =
            center + offset;


        if (
            index < 0 ||
            index >= frames.length
        ) {
            continue;
        }


        const angle =
            getAverageKneeAngle(
                frames[index]
            );


        if (
            Number.isFinite(angle)
        ) {

            values.push(angle);

        }

    }


    if (
        values.length === 0
    ) {

        return {
            score: 0,
            value: null,
            text:
                "膝角度を確認できませんでした。"
        };

    }


    const maxAngle =
        Math.max(
            ...values
        );


    let score;


    if (
        maxAngle >= 165
    ) {

        score = 2;

    }

    else if (
        maxAngle >= 150
    ) {

        score = 1;

    }

    else {

        score = 0;

    }


    return {

        score: score,

        value:
            maxAngle,

        text:
            score === 2
                ? "膝がよく伸びています。"
                : score === 1
                    ? "膝をもう少し伸ばしましょう。"
                    : "膝を伸ばして跳ぶことを意識しましょう。"

    };

}


// ============================================================
// ⑤ 着地安定
// ============================================================

function calculateLandingScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            phase.landing
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "着地を確認できませんでした。"
        };

    }


    const index =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                phase.landing
            )
        );


    const values = [];


    for (
        let i =
            Math.max(
                0,
                index - 3
            );

        i <= index &&
        i < frames.length;

        i++
    ) {

        const left =
            getPoint(
                frames[i],
                27
            );

        const right =
            getPoint(
                frames[i],
                28
            );


        if (
            left &&
            right
        ) {

            values.push(
                Math.abs(
                    left.y -
                    right.y
                )
            );

        }

    }


    if (
        values.length === 0
    ) {

        return {
            score: 0,
            value: null,
            text:
                "着地位置を確認できませんでした。"
        };

    }


    const difference =
        values.reduce(
            (a, b) => a + b,
            0
        ) /
        values.length;


    let score;


    if (
        difference < 0.04
    ) {

        score = 2;

    }

    else if (
        difference < 0.08
    ) {

        score = 1;

    }

    else {

        score = 0;

    }


    return {

        score: score,

        value:
            difference,

        text:
            score === 2
                ? "着地が安定しています。"
                : score === 1
                    ? "着地では両足をそろえるとさらに安定します。"
                    : "着地時の安定を意識しましょう。"

    };

}


// ============================================================
// Dスコア計算
// ============================================================

function calculateDScore(
    frames,
    phase
) {

    console.log(
        "================================"
    );

    console.log(
        "score.js 改良版 採点開始"
    );

    console.log(
        "フレーム数:",
        frames
            ? frames.length
            : 0
    );

    console.log(
        "phase:",
        phase
    );


    if (
        !frames ||
        frames.length < 5
    ) {

        console.error(
            "score.js：フレーム不足"
        );

        return null;

    }


    if (!phase) {

        console.error(
            "score.js：phaseなし"
        );

        return null;

    }


    // ========================================================
    // 各項目採点
    // ========================================================

    const takeOff =
        calculateTakeOffScore(
            frames,
            phase
        );


    const hand =
        calculateHandScore(
            frames,
            phase
        );


    const hip =
        calculateHipScore(
            frames,
            phase
        );


    const knee =
        calculateKneeScore(
            frames,
            phase
        );


    const landing =
        calculateLandingScore(
            frames,
            phase
        );


    // ========================================================
    // 合計
    // ========================================================

    const score =
        takeOff.score +
        hand.score +
        hip.score +
        knee.score +
        landing.score;


    // ========================================================
    // 結果
    // ========================================================

    const result = {

        score:
            Math.max(
                0,
                Math.min(
                    10,
                    score
                )
            ),

        takeOffScore:
            takeOff.score,

        handScore:
            hand.score,

        hipScore:
            hip.score,

        kneeScore:
            knee.score,

        landingScore:
            landing.score,


        // ----------------------------------------------------
        // 実測値
        // ----------------------------------------------------

        handMeasured:
            hand.value,

        hipMeasured:
            hip.value,

        kneeMeasured:
            knee.value,

        landingMeasured:
            landing.value,


        // ----------------------------------------------------
        // コメント
        // ----------------------------------------------------

        takeOffText:
            takeOff.text,

        handText:
            hand.text,

        hipText:
            hip.text,

        kneeText:
            knee.text,

        landingText:
            landing.text,


        // ----------------------------------------------------
        // phase情報
        // ----------------------------------------------------

        takeOffFrame:
            phase.takeOff,

        handContactFrame:
            phase.handContact,

        highestHipFrame:
            phase.highestHip,

        landingFrame:
            phase.landing,


        // ----------------------------------------------------
        // 着手候補
        // ----------------------------------------------------

        handCandidates:
            phase.handCandidates ||
            [],

        candidateCount:
            phase.handCandidates
                ? phase.handCandidates.length
                : 0

    };


    // ========================================================
    // コンソール
    // ========================================================

    console.log(
        "------------------------------"
    );

    console.log(
        "踏切:",
        takeOff.score,
        "点"
    );

    console.log(
        "着手:",
        hand.score,
        "点",
        "実測値:",
        hand.value
    );

    console.log(
        "腰:",
        hip.score,
        "点",
        "実測値:",
        hip.value
    );

    console.log(
        "膝:",
        knee.score,
        "点",
        "角度:",
        knee.value
    );

    console.log(
        "着地:",
        landing.score,
        "点",
        "実測値:",
        landing.value
    );

    console.log(
        "------------------------------"
    );

    console.log(
        "Dスコア:",
        result.score
    );

    console.log(
        "================================"
    );


    return result;
}


// ============================================================
// デバッグ表示
// ============================================================

function showScoreDebug(
    result
) {

    if (!result) {
        return;
    }


    let el =
        document.getElementById(
            "scoreDebug"
        );


    if (!el) {

        el =
            document.createElement(
                "div"
            );

        el.id =
            "scoreDebug";

        el.style.marginTop =
            "10px";

        el.style.padding =
            "10px";

        el.style.background =
            "#f5f5f5";

        el.style.borderRadius =
            "8px";

        el.style.fontSize =
            "14px";


        const feedback =
            document.getElementById(
                "feedback"
            );


        if (
            feedback &&
            feedback.parentElement
        ) {

            feedback.parentElement.appendChild(
                el
            );

        }

    }


    el.innerHTML = `

        <strong>AI採点診断</strong>

        <br><br>

        踏切：
        ${result.takeOffScore} / 2

        <br>

        着手：
        ${result.handScore} / 2
       　
        実測値：
        ${
            Number.isFinite(
                result.handMeasured
            )
                ? result.handMeasured.toFixed(3)
                : "-"
        }

        <br>

        腰：
        ${result.hipScore} / 2

        <br>

        膝：
        ${result.kneeScore} / 2

        <br>

        着地：
        ${result.landingScore} / 2

        <hr>

        <strong>
            Dスコア：
            ${result.score}
        </strong>

    `;

}


// ============================================================
// 外部公開
// ============================================================

window.calculateDScore =
calculateDScore;

window.showScoreDebug =
showScoreDebug;


// ============================================================
// 読み込み確認
// ============================================================

console.log(
    "score.js 改良版 読み込み成功"
);