// ===============================
// 跳び箱AI採点システム Ver5.8
// score.js 完成版
// 実測値表示対応
// 着地判定連携版
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

        // 着地なしの場合
        if (
            frameNumber === -1 ||
            frameNumber === null ||
            typeof frameNumber === "undefined"
        ) {
            return -1;
        }

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
// Ver5.9
// 膝角度取得・フレーム範囲改善版
// ==================================================

const kneeValues = [];


// ==================================================
// 3点から膝角度を計算
// ==================================================

function


    // ==================================================
    // ② 腰の位置
    // ==================================================

    const takeOffFrame =
        takeOffIndex >= 0
            ? data[takeOffIndex]
            : null;


    const peakFrame =
        hipIndex >= 0
            ? data[hipIndex]
            : null;


    const takeOffHip =
        takeOffFrame
            ? getHipCenter(
                takeOffFrame
            )
            : null;


    const peakHip =
        peakFrame
            ? getHipCenter(
                peakFrame
            )
            : null;


    // ==================================================
    // 体格による正規化
    // ==================================================

    let bodyScale =
        peakFrame
            ? getBodyScale(
                peakFrame
            )
            : 0.3;


    if (
        !Number.isFinite(bodyScale) ||
        bodyScale <= 0
    ) {

        bodyScale = 0.3;

    }


    // ==================================================
    // 腰の上昇量
    // ==================================================

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


    // ==================================================
    // 最高点付近を複数フレーム確認
    // ==================================================

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
            scale <= 0 ||
            !takeOffHip
        ) {
            continue;
        }


        const rise =
            (
                takeOffHip.y -
                hip.y
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


    // ==================================================
    // 腰の評価
    // ==================================================

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
            ) /
            2;


        const normalized =
            Math.abs(
                handX -
                hip.x
            ) /
            scale;


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


    if (
        handPosition >= 1.0
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
    //
    // ★今回の重要な修正
    //
    // phase.js が「着地なし」と判定した場合は
    // 左右足首Y差が小さくても着地点を与えない。
    //
    // これにより、
    //
    // 「跳び箱の上に座って動画終了」
    //
    // のような動画を着地2点にしない。
    // ==================================================

    const hasLanding =
        Number.isFinite(
            Number(phase.landing)
        ) &&
        Number(phase.landing) >= 0;


    const landingValues = [];


    if (
        hasLanding &&
        landingIndex >= 0
    ) {

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


    // --------------------------------------------------
    // 着地なし
    // --------------------------------------------------

    if (!hasLanding) {

        landingScore = 0;

        landingText =
            "着地が確認できませんでした。床まで着地する動作を確認しましょう。";

    }

    // --------------------------------------------------
    // 着地あり＋安定
    // --------------------------------------------------

    else if (
        landingDifference < 0.05
    ) {

        landingScore = 2;

        landingText =
            "着地が安定しています。";

    }

    // --------------------------------------------------
    // 着地あり＋やや不安定
    // --------------------------------------------------

    else if (
        landingDifference < 0.1
    ) {

        landingScore = 1;

        landingText =
            "着地できています。両足をそろえると、さらに安定します。";

    }

    // --------------------------------------------------
    // 着地あり＋不安定
    // --------------------------------------------------

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

            // --------------------------
            // 膝
            // --------------------------

            knee: {

                score: kneeScore,

                text: kneeText,

                value: kneeAngle,

                measured:
                    kneeAngle.toFixed(1) +
                    "°"

            },


            // --------------------------
            // 腰
            // --------------------------

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


            // --------------------------
            // 着手
            // --------------------------

            hand: {

                score: handScore,

                text: handText,

                value: handPosition,

                measured:
                    handPosition.toFixed(3),

                unit:
                    "体格比"

            },


            // --------------------------
            // 踏切
            // --------------------------

            takeOff: {

                score: takeOffScore,

                text: takeOffText,

                value: footDifference,

                measured:
                    footDifference.toFixed(3),

                unit:
                    "左右足首Y差"

            },


            // --------------------------
            // 着地
            // --------------------------

            landing: {

                score: landingScore,

                text: landingText,

                value:
                    hasLanding
                        ? landingDifference
                        : 0,

                measured:
                    hasLanding
                        ? landingDifference.toFixed(3)
                        : "着地なし",

                unit:
                    "左右足首Y差"

            }

        }

    };


    // ==================================================
    // コンソール
    // ==================================================

    console.log(
        "========== Ver5.8 SCORE =========="
    );


    console.log(
        "膝:",
        kneeScore,
        "角度:",
        kneeAngle.toFixed(1),
        "°"
    );


    console.log(
        "腰:",
        hipScore,
        "腰上昇量:",
        hipRise.toFixed(3)
    );


    console.log(
        "着手:",
        handScore,
        "実測値:",
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
        hasLanding
            ? landingDifference.toFixed(3)
            : "着地なし"
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