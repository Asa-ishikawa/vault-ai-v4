// ============================================================
// 跳び箱AI採点システム
// score.js 改良版 Ver6.0
//
// 開脚跳び Dスコア
//
// 5項目
// ① 両足踏切
// ② 着手位置
// ③ 腰の位置
// ④ 膝の伸び
// ⑤ 着地の安定
//
// 各項目 0～2点
// 合計 0～10点
//
// phase.js 改良版対応
// feedback.js 改良版対応
// ============================================================


// ============================================================
// 基本
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
// 点取得
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

    const p = lm[index];

    if (
        !Number.isFinite(Number(p.x)) ||
        !Number.isFinite(Number(p.y))
    ) {
        return null;
    }

    return {
        x: Number(p.x),
        y: Number(p.y),
        visibility:
            p.visibility == null
                ? 1
                : Number(p.visibility)
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

    const abx = a.x - b.x;
    const aby = a.y - b.y;

    const cbx = c.x - b.x;
    const cby = c.y - b.y;

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
        mag1 <= 0 ||
        mag2 <= 0
    ) {
        return null;
    }

    let cos =
        dot /
        (mag1 * mag2);

    cos =
        Math.max(
            -1,
            Math.min(
                1,
                cos
            )
        );

    return (
        Math.acos(cos) *
        180 /
        Math.PI
    );
}


// ============================================================
// 中点
// ============================================================

function getMidPoint(
    frame,
    index1,
    index2
) {

    const a =
        getPoint(
            frame,
            index1
        );

    const b =
        getPoint(
            frame,
            index2
        );

    if (!a || !b) {
        return null;
    }

    return {
        x:
            (a.x + b.x) / 2,

        y:
            (a.y + b.y) / 2
    };
}


// ============================================================
// 腰
// ============================================================

function getScoreHip(frame) {

    return getMidPoint(
        frame,
        23,
        24
    );
}


// ============================================================
// 肩
// ============================================================

function getScoreShoulder(frame) {

    return getMidPoint(
        frame,
        11,
        12
    );
}


// ============================================================
// 手
// ============================================================

function getScoreWrist(frame) {

    return getMidPoint(
        frame,
        15,
        16
    );
}


// ============================================================
// 足首
// ============================================================

function getScoreAnkle(frame) {

    return getMidPoint(
        frame,
        27,
        28
    );
}


// ============================================================
// 膝角度
// ============================================================

function getLeftKneeAngle(frame) {

    return scoreAngle(
        getPoint(frame, 23),
        getPoint(frame, 25),
        getPoint(frame, 27)
    );
}


function getRightKneeAngle(frame) {

    return scoreAngle(
        getPoint(frame, 24),
        getPoint(frame, 26),
        getPoint(frame, 28)
    );
}


// ============================================================
// 平均膝角度
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
// ① 両足踏切
//
// 踏切フレームだけを見るのではなく、
// 踏切前後の左右足首の高さを確認する。
// ============================================================

function calculateTakeOffScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            Number(phase.takeOff)
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "踏切位置を確認できませんでした。"
        };

    }


    const center =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                Number(phase.takeOff)
            )
        );


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


        const left =
            getPoint(
                frames[index],
                27
            );

        const right =
            getPoint(
                frames[index],
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
                "両足の位置を確認できませんでした。"
        };

    }


    const average =
        values.reduce(
            (a, b) => a + b,
            0
        ) /
        values.length;


    // ----------------------------------------
    // 判定
    // ----------------------------------------

    let score;


    if (
        average <= 0.035
    ) {

        score = 2;

    }
    else if (
        average <= 0.075
    ) {

        score = 1;

    }
    else {

        score = 0;

    }


    return {

        score,

        value:
            average,

        text:
            score === 2
                ? "両足をそろえて安定した踏切ができています。"
                : score === 1
                    ? "両足の踏切をもう少し安定させましょう。"
                    : "両足で同時に踏み切ることを意識しましょう。"

    };

}


// ============================================================
// ② 着手位置
//
// phase.js が選択した着手フレームを使用する。
// 「実測値だけ」で判定せず、
// 着手候補の中での動作の整合性も確認する。
// ============================================================

function calculateHandScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            Number(phase.handContact)
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
                Number(phase.handContact)
            )
        );


    const frame =
        frames[index];


    let measured =
        Number.isFinite(
            Number(phase.handMeasured)
        )
            ? Number(phase.handMeasured)
            : null;


    // phase.jsの別名にも対応
    if (
        measured === null &&
        Number.isFinite(
            Number(phase.handValue)
        )
    ) {

        measured =
            Number(
                phase.handValue
            );

    }


    // --------------------------------------------------------
    // 実測値
    // --------------------------------------------------------

    let score = 0;


    if (
        measured !== null
    ) {

        /*
         * 現在までの実験結果では
         *
         * 普通      0.132
         * 成功①    0.216
         * 成功②    0.242
         *
         * であり、
         * 「小さいほど必ず良い」
         * という判定にはしない。
         *
         * そこで着手位置は
         * 0.15～0.35付近を基本的な
         * 良好ゾーンとして扱う。
         */

        if (
            measured >= 0.15 &&
            measured <= 0.35
        ) {

            score = 2;

        }
        else if (
            measured >= 0.10 &&
            measured <= 0.45
        ) {

            score = 1;

        }
        else {

            score = 0;

        }

    }


    // --------------------------------------------------------
    // 左右の手の高さ
    // --------------------------------------------------------

    const left =
        getPoint(
            frame,
            15
        );

    const right =
        getPoint(
            frame,
            16
        );


    if (
        left &&
        right
    ) {

        const level =
            Math.abs(
                left.y -
                right.y
            );


        // 左右差が小さい場合は
        // 着手の安定性を補助する
        if (
            level <= 0.04 &&
            score === 1
        ) {

            score = 2;

        }

    }


    score =
        Math.max(
            0,
            Math.min(
                2,
                score
            )
        );


    return {

        score,

        value:
            measured,

        text:
            score === 2
                ? "着手位置が安定しています。"
                : score === 1
                    ? "着手位置は概ねできています。"
                    : "着手位置をもう一度確認しましょう。"

    };

}


// ============================================================
// ③ 腰の位置
//
// 着手時の腰位置を、身体の大きさで正規化する。
// ============================================================

function calculateHipScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            Number(phase.handContact)
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "腰の位置を確認できませんでした。"
        };

    }


    const center =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                Number(phase.handContact)
            )
        );


    const values = [];


    /*
     * 着手1フレームだけでは
     * ノイズの影響を受けやすいため、
     * 前後2フレームも確認。
     */

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


        const hip =
            getScoreHip(
                frames[index]
            );

        const shoulder =
            getScoreShoulder(
                frames[index]
            );

        const ankle =
            getScoreAnkle(
                frames[index]
            );


        if (
            !hip ||
            !shoulder ||
            !ankle
        ) {
            continue;
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
            continue;
        }


        const normalized =
            Math.abs(
                hip.y -
                shoulder.y
            ) /
            bodyLength;


        values.push(
            normalized
        );

    }


    if (
        values.length === 0
    ) {

        return {
            score: 0,
            value: null,
            text:
                "腰の位置を確認できませんでした。"
        };

    }


    /*
     * 「低い値が良い」
     * という単純判定ではなく、
     * 5フレームの中で最も高い状態を
     * 評価する。
     */

    const best =
        Math.min(
            ...values
        );


    let score;


    if (
        best <= 0.42
    ) {

        score = 2;

    }
    else if (
        best <= 0.58
    ) {

        score = 1;

    }
    else {

        score = 0;

    }


    return {

        score,

        value:
            best,

        text:
            score === 2
                ? "腰がしっかり上がっています。"
                : score === 1
                    ? "腰をもう少し高く上げましょう。"
                    : "腰を高く上げることを意識しましょう。"

    };

}


// ============================================================
// ④ 膝の伸び
//
// 着手直前～着手後の最大角度を見る。
// ============================================================

function calculateKneeScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            Number(phase.handContact)
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
        Number(
            phase.handContact
        );


    const values = [];


    for (
        let offset = -3;
        offset <= 3;
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

            values.push(
                angle
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

        score,

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
// ⑤ 着地
//
// 着地直前～着地フレームの
// 左右足の安定性を見る。
// ============================================================

function calculateLandingScore(
    frames,
    phase
) {

    if (
        !phase ||
        !Number.isFinite(
            Number(phase.landing)
        )
    ) {

        return {
            score: 0,
            value: null,
            text:
                "着地を確認できませんでした。"
        };

    }


    const center =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                Number(phase.landing)
            )
        );


    const values = [];


    for (
        let offset = -3;
        offset <= 0;
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


        const left =
            getPoint(
                frames[index],
                27
            );

        const right =
            getPoint(
                frames[index],
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


    const average =
        values.reduce(
            (a, b) => a + b,
            0
        ) /
        values.length;


    let score;


    if (
        average <= 0.04
    ) {

        score = 2;

    }
    else if (
        average <= 0.08
    ) {

        score = 1;

    }
    else {

        score = 0;

    }


    return {

        score,

        value:
            average,

        text:
            score === 2
                ? "着地が安定しています。"
                : score === 1
                    ? "着地はできています。両足をそろえるとさらに安定します。"
                    : "着地時の安定を意識しましょう。"

    };

}


// ============================================================
// Dスコア
// ============================================================

function calculateDScore(
    frames,
    phase
) {

    console.log(
        "======================================"
    );

    console.log(
        "score.js Ver6.0 採点開始"
    );


    // --------------------------------------------------------
    // データ確認
    // --------------------------------------------------------

    if (
        !Array.isArray(frames) ||
        frames.length < 5
    ) {

        console.error(
            "score.js：フレーム不足",
            frames
        );

        return null;

    }


    if (!phase) {

        console.error(
            "score.js：phaseなし"
        );

        return null;

    }


    console.log(
        "取得フレーム数：",
        frames.length
    );

    console.log(
        "踏切：",
        phase.takeOff
    );

    console.log(
        "着手：",
        phase.handContact
    );

    console.log(
        "最高点：",
        phase.highestHip
    );

    console.log(
        "着地：",
        phase.landing
    );


    // ========================================================
    // 5項目
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

    const total =
        takeOff.score +
        hand.score +
        hip.score +
        knee.score +
        landing.score;


    const score =
        Math.max(
            0,
            Math.min(
                10,
                total
            )
        );


    // ========================================================
    // 結果
    // ========================================================

    const result = {

        // -------------------------------
        // Dスコア
        // -------------------------------

        score,


        // -------------------------------
        // 5項目
        // -------------------------------

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


        // -------------------------------
        // 実測値
        // -------------------------------

        takeOffMeasured:
            takeOff.value,

        handMeasured:
            hand.value,

        hipMeasured:
            hip.value,

        kneeMeasured:
            knee.value,

        landingMeasured:
            landing.value,


        // -------------------------------
        // コメント
        // -------------------------------

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


        // -------------------------------
        // フェーズ
        // -------------------------------

        takeOffFrame:
            phase.takeOff,

        handContactFrame:
            phase.handContact,

        highestHipFrame:
            phase.highestHip,

        landingFrame:
            phase.landing,


        // -------------------------------
        // 着手候補
        // -------------------------------

        handCandidates:
            Array.isArray(
                phase.handCandidates
            )
                ? phase.handCandidates
                : [],

        candidateCount:
            Array.isArray(
                phase.handCandidates
            )
                ? phase.handCandidates.length
                : 0

    };


    // ========================================================
    // 採点ログ
    // ========================================================

    console.log(
        "--------------------------------------"
    );

    console.log(
        "① 両足踏切：",
        takeOff.score,
        "/2",
        "実測値:",
        takeOff.value
    );

    console.log(
        "② 着手位置：",
        hand.score,
        "/2",
        "実測値:",
        hand.value
    );

    console.log(
        "③ 腰の位置：",
        hip.score,
        "/2",
        "実測値:",
        hip.value
    );

    console.log(
        "④ 膝の伸び：",
        knee.score,
        "/2",
        "実測値:",
        knee.value
    );

    console.log(
        "⑤ 着地の安定：",
        landing.score,
        "/2",
        "実測値:",
        landing.value
    );

    console.log(
        "--------------------------------------"
    );

    console.log(
        "Dスコア：",
        score
    );

    console.log(
        "======================================"
    );


    return result;
}


// ============================================================
// 外部公開
// ============================================================

window.calculateDScore =
    calculateDScore;


console.log(
    "score.js Ver6.0 改良版 読み込み成功"
);