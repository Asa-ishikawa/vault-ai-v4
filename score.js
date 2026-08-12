// ===============================
// 跳び箱AI採点システム
// score.js Ver5.8
// 着手位置判定 改善版
// ===============================

function calculateDScore(frames, phase) {

    // ==================================================
    // データチェック
    // ==================================================

    if (
        !Array.isArray(frames) ||
        frames.length < 20 ||
        !phase
    ) {
        return {
            score: 0,
            details: {}
        };
    }


    // ==================================================
    // フレームデータ準備
    // ==================================================

    const data =
        prepareFrames(frames);


    if (
        !data ||
        data.length < 20
    ) {
        return {
            score: 0,
            details: {}
        };
    }


    // ==================================================
    // フレーム検索
    // ==================================================

    function findFrame(frameNumber) {

        let bestIndex = 0;
        let bestDifference = Infinity;

        data.forEach((frame, index) => {

            const difference =
                Math.abs(
                    Number(frame.frame) -
                    Number(frameNumber)
                );

            if (
                difference <
                bestDifference
            ) {

                bestDifference =
                    difference;

                bestIndex =
                    index;

            }

        });

        return bestIndex;

    }


    const takeOffIndex =
        findFrame(phase.takeOff);


    const handIndex =
        findFrame(phase.handContact);


    const hipIndex =
        findFrame(phase.highestHip);


    const landingIndex =
        findFrame(phase.landing);



    // ==================================================
    // ① 膝の伸び
    // ==================================================

    const kneeValues = [];


    const kneeStart =
        Math.max(
            handIndex,
            hipIndex - 6
        );


    const kneeEnd =
        Math.min(
            data.length - 1,
            hipIndex + 6
        );


    for (
        let i = kneeStart;
        i <= kneeEnd;
        i++
    ) {

        const angle =
            getAverageKneeAngle(
                data[i]
            );


        if (
            Number.isFinite(angle) &&
            angle > 0
        ) {

            kneeValues.push(
                angle
            );

        }

    }


    const kneeAngle =
        kneeValues.length > 0
            ? kneeValues.reduce(
                (a, b) => a + b,
                0
            ) /
            kneeValues.length
            : 0;


    let kneeScore = 0;
    let kneeText = "";


    if (kneeAngle >= 165) {

        kneeScore = 2;

        kneeText =
            "膝がしっかり伸びています。";

    }

    else if (kneeAngle >= 150) {

        kneeScore = 1;

        kneeText =
            "膝は伸びていますが、もう少し伸ばせます。";

    }

    else {

        kneeScore = 0;

        kneeText =
            "空中で膝を伸ばすことを意識しましょう。";

    }



    // ==================================================
    // ② 腰の位置
    // ==================================================

    const takeOffFrame =
        data[takeOffIndex];


    const peakFrame =
        data[hipIndex];


    const takeOffHip =
        getHipCenter(
            takeOffFrame
        );


    const peakHip =
        getHipCenter(
            peakFrame
        );


    let bodyScale =
        getBodyScale(
            peakFrame
        );


    if (
        !Number.isFinite(bodyScale) ||
        bodyScale <= 0
    ) {

        bodyScale = 0.3;

    }


    let hipRise = 0;


    if (
        takeOffHip &&
        peakHip
    ) {

        hipRise =
            (
                takeOffHip.y -
                peakHip.y
            ) /
            bodyScale;

    }


    const peakHipValues = [];


    const peakStart =
        Math.max(
            handIndex,
            hipIndex - 5
        );


    const peakEnd =
        Math.min(
            data.length - 1,
            hipIndex + 5
        );


    for (
        let i = peakStart;
        i <= peakEnd;
        i++
    ) {

        const hip =
            getHipCenter(
                data[i]
            );


        const scale =
            getBodyScale(
                data[i]
            );


        if (
            !hip ||
            !Number.isFinite(scale) ||
            scale <= 0
        ) {
            continue;
        }


        const rise =
            (
                takeOffHip
                    ? takeOffHip.y - hip.y
                    : 0
            ) /
            scale;


        if (
            Number.isFinite(rise)
        ) {

            peakHipValues.push(
                rise
            );

        }

    }


    if (
        peakHipValues.length > 0
    ) {

        hipRise =
            Math.max(
                ...peakHipValues
            );

    }


    let hipScore = 0;
    let hipText = "";


    if (
        hipRise >= 0.35
    ) {

        hipScore = 2;

        hipText =
            "腰が高く上がっています。跳び箱を越えるための姿勢ができています。";

    }

    else if (
        hipRise >= 0.20
    ) {

        hipScore = 1;

        hipText =
            "腰は上がっています。もう少し腰を高くすると、より大きな跳び方になります。";

    }

    else {

        hipScore = 0;

        hipText =
            "踏み切った後、腰を高く上げることを意識しましょう。";

    }



    // ==================================================
    // ③ 着手位置
    //
    // Ver5.8 改善版
    //
    // 旧方式：
    // 最大値を採用
    //
    // 問題：
    // 失敗動画で一瞬だけ大きな値が出ると
    // 「着手が良い」と誤判定する。
    //
    // 新方式：
    // 着手前後の複数フレームを取得し、
    // 中央値を採用する。
    //
    // また、極端に大きい値を
    // 「適切な着手」と判定しない。
    // ==================================================

    const handValues = [];


    // 着手の前後8フレームを確認
    const handStart =
        Math.max(
            takeOffIndex,
            handIndex - 8
        );


    const handEnd =
        Math.min(
            data.length - 1,
            handIndex + 8
        );


    for (
        let i = handStart;
        i <= handEnd;
        i++
    ) {

        const left =
            getPoint(
                data[i],
                15
            );


        const right =
            getPoint(
                data[i],
                16
            );


        const hip =
            getHipCenter(
                data[i]
            );


        const scale =
            getBodyScale(
                data[i]
            );


        if (
            !left ||
            !right ||
            !hip ||
            !Number.isFinite(scale) ||
            scale <= 0
        ) {
            continue;
        }


        const handX =
            (
                left.x +
                right.x
            ) /
            2;


        const normalized =
            Math.abs(
                handX -
                hip.x
            ) /
            scale;


        if (
            Number.isFinite(normalized) &&
            normalized >= 0
        ) {

            handValues.push(
                normalized
            );

        }

    }



    // ==================================================
    // 中央値を求める
    // ==================================================

    let handPosition = 0;


    if (
        handValues.length > 0
    ) {

        const sorted =
            [...handValues]
                .sort(
                    (a, b) => a - b
                );


        const middle =
            Math.floor(
                sorted.length / 2
            );


        if (
            sorted.length % 2 === 0
        ) {

            handPosition =
                (
                    sorted[middle - 1] +
                    sorted[middle]
                ) /
                2;

        }

        else {

            handPosition =
                sorted[middle];

        }

    }



    // ==================================================
    // 着手位置評価
    //
    // 新しい基準
    //
    // 0点：
    // 0.55未満
    //
    // 1点：
    // 0.55以上 かつ 1.25未満
    //
    // 2点：
    // 0.80以上 かつ 1.25未満
    //
    // 1.25以上：
    // 手を出しすぎている可能性があるため0点
    //
    // ※極端な値を高評価しない
    // ==================================================

    let handScore = 0;
    let handText = "";


    if (
        handPosition >= 1.25
    ) {

        handScore = 0;

        handText =
            "手を前に出しすぎている可能性があります。跳び箱に対して適切な位置へ手をつきましょう。";

    }

    else if (
        handPosition >= 0.80
    ) {

        handScore = 2;

        handText =
            "着手位置が安定しています。";

    }

    else if (
        handPosition >= 0.55
    ) {

        handScore = 1;

        handText =
            "着手できています。もう少し前方へ手をつくことを意識しましょう。";

    }

    else {

        handScore = 0;

        handText =
            "跳び箱に対して適切な位置へ手をつくことを意識しましょう。";

    }



    // ==================================================
    // ④ 両足踏切
    // ==================================================

    const footValues = [];


    const takeStart =
        Math.max(
            0,
            takeOffIndex - 5
        );


    const takeEnd =
        Math.min(
            data.length - 1,
            takeOffIndex + 5
        );


    for (
        let i = takeStart;
        i <= takeEnd;
        i++
    ) {

        const left =
            getPoint(
                data[i],
                27
            );


        const right =
            getPoint(
                data[i],
                28
            );


        if (
            !left ||
            !right
        ) {
            continue;
        }


        const difference =
            Math.abs(
                left.y -
                right.y
            );


        if (
            Number.isFinite(
                difference
            )
        ) {

            footValues.push(
                difference
            );

        }

    }


    const footDifference =
        footValues.length > 0
            ? footValues.reduce(
                (a, b) => a + b,
                0
            ) /
            footValues.length
            : 1;


    let takeOffScore = 0;
    let takeOffText = "";


    if (
        footDifference < 0.045
    ) {

        takeOffScore = 2;

        takeOffText =
            "両足をそろえて踏み切れています。";

    }

    else if (
        footDifference < 0.08
    ) {

        takeOffScore = 1;

        takeOffText =
            "両足踏切はできています。左右の足のタイミングをそろえると、さらに安定します。";

    }

    else {

        takeOffScore = 0;

        takeOffText =
            "両足をそろえて踏み切ることを意識しましょう。";

    }



    // ==================================================
    // ⑤ 着地の安定
    // ==================================================

    const landingValues = [];


    const landingStart =
        Math.max(
            0,
            landingIndex - 6
        );


    const landingEnd =
        Math.min(
            data.length - 1,
            landingIndex + 6
        );


    for (
        let i = landingStart;
        i <= landingEnd;
        i++
    ) {

        const left =
            getPoint(
                data[i],
                27
            );


        const right =
            getPoint(
                data[i],
                28
            );


        if (
            !left ||
            !right
        ) {
            continue;
        }


        const difference =
            Math.abs(
                left.y -
                right.y
            );


        if (
            Number.isFinite(
                difference
            )
        ) {

            landingValues.push(
                difference
            );

        }

    }


    const landingDifference =
        landingValues.length > 0
            ? landingValues.reduce(
                (a, b) => a + b,
                0
            ) /
            landingValues.length
            : 1;


    let landingScore = 0;
    let landingText = "";


    if (
        landingDifference < 0.05
    ) {

        landingScore = 2;

        landingText =
            "着地が安定しています。";

    }

    else if (
        landingDifference < 0.1
    ) {

        landingScore = 1;

        landingText =
            "着地できています。両足をそろえると、さらに安定します。";

    }

    else {

        landingScore = 0;

        landingText =
            "着地では両足を安定させることを意識しましょう。";

    }



    // ==================================================
    // 合計
    // ==================================================

    const total =
        kneeScore +
        hipScore +
        handScore +
        takeOffScore +
        landingScore;



    // ==================================================
    // 結果
    // ==================================================

    const result = {

        score: total,

        details: {

            knee: {

                score: kneeScore,

                text: kneeText,

                value: kneeAngle,

                measured:
                    kneeAngle.toFixed(1) +
                    "°"

            },


            hip: {

                score: hipScore,

                text: hipText,

                value: hipRise,

                measured:
                    hipRise.toFixed(3),

                unit:
                    "体格比",

                threshold0:
                    "0.200未満",

                threshold1:
                    "0.200～0.349",

                threshold2:
                    "0.350以上"

            },


            hand: {

                score: handScore,

                text: handText,

                value: handPosition,

                measured:
                    handPosition.toFixed(3),

                unit:
                    "体格比"

            },


            takeOff: {

                score: takeOffScore,

                text: takeOffText,

                value: footDifference,

                measured:
                    footDifference.toFixed(3),

                unit:
                    "左右足首Y差"

            },


            landing: {

                score: landingScore,

                text: landingText,

                value: landingDifference,

                measured:
                    landingDifference.toFixed(3),

                unit:
                    "左右足首Y差"

            }

        }

    };



    // ==================================================
    // デバッグ
    // ==================================================

    console.log(
        "========== Ver5.8 SCORE =========="
    );


    console.log(
        "膝:",
        kneeScore,
        "実測値:",
        kneeAngle.toFixed(1)
    );


    console.log(
        "腰:",
        hipScore,
        "実測値:",
        hipRise.toFixed(3)
    );


    console.log(
        "着手候補値:",
        handValues.map(
            v => v.toFixed(3)
        )
    );


    console.log(
        "着手:",
        handScore,
        "中央値:",
        handPosition.toFixed(3)
    );


    console.log(
        "踏切:",
        takeOffScore,
        "実測値:",
        footDifference.toFixed(3)
    );


    console.log(
        "着地:",
        landingScore,
        "実測値:",
        landingDifference.toFixed(3)
    );


    console.log(
        "Dスコア:",
        total
    );


    return result;

}



// ===============================
// 公開
// ===============================

window.calculateDScore =
    calculateDScore;


console.log(
    "score.js Ver5.8 読み込み成功"
);