// ===============================
// 跳び箱AI採点システム Ver5.6
// score.js
// 腰の位置判定 改良版
// ===============================

function calculateDScore(frames, phase) {

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


    // ============================
    // フレーム検索
    // ============================

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

            kneeValues.push(angle);

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
    // Ver5.6 改良
    //
    // 「肩と腰の位置関係」ではなく、
    // 「踏切時から最高点まで腰がどれだけ上がったか」
    // を評価する。
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


    // ----------------------------
    // 体格による正規化
    // ----------------------------

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


    // ----------------------------
    // 腰の上昇量
    //
    // MediaPipeでは
    // yが小さいほど「上」
    // ----------------------------

    let hipRise = 0;


    if (
        takeOffHip &&
        peakHip
    ) {

        hipRise =
            (
                takeOffHip.y -
                peakHip.y
            ) / bodyScale;

    }


    // ----------------------------
    // 最高点付近の腰位置を
    // 数フレーム平均して安定化
    // ----------------------------

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
            ) / scale;


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


    // ----------------------------
    // 腰の評価
    //
    // 2点：
    // 踏切から十分に腰が上がっている
    //
    // 1点：
    // 腰は上がっている
    //
    // 0点：
    // 腰の上昇が小さい
    // ----------------------------

    let hipScore = 0;
    let hipText = "";


    if (hipRise >= 0.35) {

        hipScore = 2;

        hipText =
            "腰が高く上がっています。跳び箱を越えるための姿勢ができています。";

    }

    else if (hipRise >= 0.20) {

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
    // ==================================================

    const handValues = [];

    const handStart =
        Math.max(
            takeOffIndex,
            handIndex - 5
        );

    const handEnd =
        Math.min(
            data.length - 1,
            handIndex + 5
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
            ) / 2;


        const normalized =
            Math.abs(
                handX - hip.x
            ) / scale;


        if (
            Number.isFinite(
                normalized
            )
        ) {

            handValues.push(
                normalized
            );

        }

    }


    const handPosition =
        handValues.length > 0
            ? Math.max(...handValues)
            : 0;


    let handScore = 0;
    let handText = "";


    if (handPosition >= 1.0) {

        handScore = 2;

        handText =
            "着手位置が安定しています。";

    }

    else if (handPosition >= 0.55) {

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


    if (footDifference < 0.045) {

        takeOffScore = 2;

        takeOffText =
            "両足をそろえて踏み切れています。";

    }

    else if (footDifference < 0.08) {

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


    if (landingDifference < 0.05) {

        landingScore = 2;

        landingText =
            "着地が安定しています。";

    }

    else if (landingDifference < 0.1) {

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

                value: kneeAngle

            },


            hip: {

                score: hipScore,

                text: hipText,

                value: hipRise

            },


            hand: {

                score: handScore,

                text: handText,

                value: handPosition

            },


            takeOff: {

                score: takeOffScore,

                text: takeOffText,

                value: footDifference

            },


            landing: {

                score: landingScore,

                text: landingText,

                value: landingDifference

            }

        }

    };


    // ==================================================
    // デバッグ表示
    // ==================================================

    console.log(
        "========== Ver5.6 SCORE =========="
    );

    console.log(
        "膝:",
        kneeScore,
        kneeAngle
    );

    console.log(
        "腰:",
        hipScore,
        "腰上昇量:",
        hipRise
    );

    console.log(
        "着手:",
        handScore,
        handPosition
    );

    console.log(
        "踏切:",
        takeOffScore,
        footDifference
    );

    console.log(
        "着地:",
        landingScore,
        landingDifference
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
    "score.js Ver5.6 読み込み成功"
);