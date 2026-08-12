// ============================================================
// 跳び箱AI採点システム
// score.js Ver6.0
// 一発貼り付け完成版
//
// ・膝角度候補を保存
// ・「データなし」になりにくい安全処理
// ・腰の位置
// ・着手位置
// ・両足踏切
// ・着地安定
// ・実測値表示
// ============================================================


function calculateDScore(frames, phase) {

    // ========================================================
    // ① 基本チェック
    // ========================================================

    if (
        !Array.isArray(frames) ||
        frames.length < 10
    ) {

        console.warn(
            "score.js：フレームデータ不足",
            frames
        );

        return {
            score: 0,
            details: {}
        };

    }


    // ========================================================
    // ② phase がなくても採点できるようにする
    // ========================================================

    if (!phase) {

        console.warn(
            "score.js：phaseデータなし"
        );

        phase = {

            takeOff: 0,

            handContact:
                Math.floor(frames.length * 0.35),

            highestHip:
                Math.floor(frames.length * 0.55),

            landing:
                frames.length - 1

        };

    }


    // ========================================================
    // ③ フレームデータを準備
    // ========================================================

    let data = null;


    try {

        if (
            typeof prepareFrames ===
            "function"
        ) {

            data =
                prepareFrames(frames);

        }
        else {

            data = frames;

        }

    }
    catch (error) {

        console.error(
            "prepareFramesエラー:",
            error
        );

        data = frames;

    }


    if (
        !Array.isArray(data) ||
        data.length < 10
    ) {

        console.warn(
            "score.js：使用可能なフレームがありません"
        );

        return {
            score: 0,
            details: {}
        };

    }


    // ========================================================
    // ④ フレーム検索
    // ========================================================

    function findFrame(frameNumber) {

        const target =
            Number(frameNumber);


        if (
            !Number.isFinite(target)
        ) {

            return 0;

        }


        let bestIndex = 0;

        let bestDifference =
            Infinity;


        data.forEach(
            (frame, index) => {

                const frameNo =
                    Number(
                        frame.frame
                    );


                if (
                    !Number.isFinite(
                        frameNo
                    )
                ) {

                    return;

                }


                const difference =
                    Math.abs(
                        frameNo -
                        target
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

            }
        );


        return bestIndex;

    }


    const takeOffIndex =
        findFrame(
            phase.takeOff
        );


    const handIndex =
        findFrame(
            phase.handContact
        );


    const hipIndex =
        findFrame(
            phase.highestHip
        );


    const landingIndex =
        findFrame(
            phase.landing
        );



    // ========================================================
    // ① 膝の伸び
    // ========================================================

    const kneeValues = [];


    // 膝を調べる範囲
    const kneeStart =
        Math.max(
            0,
            Math.min(
                handIndex,
                hipIndex - 10
            )
        );


    const kneeEnd =
        Math.min(
            data.length - 1,
            hipIndex + 10
        );


    for (
        let i = kneeStart;
        i <= kneeEnd;
        i++
    ) {

        try {

            if (
                typeof getAverageKneeAngle ===
                "function"
            ) {

                const angle =
                    Number(
                        getAverageKneeAngle(
                            data[i]
                        )
                    );


                if (
                    Number.isFinite(angle) &&
                    angle > 0 &&
                    angle <= 180
                ) {

                    kneeValues.push(
                        angle
                    );

                }

            }

        }
        catch (error) {

            console.warn(
                "膝角度取得エラー:",
                error
            );

        }

    }



    // ========================================================
    // 膝角度候補を保存
    // ========================================================

    const kneeCandidates =
        kneeValues.map(
            value =>
                Number(
                    value.toFixed(1)
                )
        );


    console.log(
        "【膝検証】kneeCandidates:",
        kneeCandidates
    );



    // ========================================================
    // 膝角度
    // ========================================================

    let kneeAngle = 0;


    if (
        kneeValues.length > 0
    ) {

        kneeAngle =
            kneeValues.reduce(
                (a, b) => a + b,
                0
            ) /
            kneeValues.length;

    }



    // ========================================================
    // 膝評価
    //
    // 165°以上 → 2点
    // 150°以上 → 1点
    // 150°未満 → 0点
    // ========================================================

    let kneeScore = 0;

    let kneeText = "";


    if (
        kneeAngle >= 165
    ) {

        kneeScore = 2;

        kneeText =
            "膝がしっかり伸びています。";

    }

    else if (
        kneeAngle >= 150
    ) {

        kneeScore = 1;

        kneeText =
            "膝は伸びていますが、もう少し伸ばせます。";

    }

    else {

        kneeScore = 0;

        kneeText =
            "空中で膝を伸ばすことを意識しましょう。";

    }



    // ========================================================
    // ② 腰の位置
    // ========================================================

    const takeOffFrame =
        data[takeOffIndex];


    const peakFrame =
        data[hipIndex];


    let takeOffHip = null;

    let peakHip = null;


    try {

        if (
            typeof getHipCenter ===
            "function"
        ) {

            takeOffHip =
                getHipCenter(
                    takeOffFrame
                );


            peakHip =
                getHipCenter(
                    peakFrame
                );

        }

    }
    catch (error) {

        console.warn(
            "腰位置取得エラー:",
            error
        );

    }



    // ========================================================
    // 体格スケール
    // ========================================================

    let bodyScale = 0.3;


    try {

        if (
            typeof getBodyScale ===
            "function"
        ) {

            const scale =
                Number(
                    getBodyScale(
                        peakFrame
                    )
                );


            if (
                Number.isFinite(scale) &&
                scale > 0
            ) {

                bodyScale =
                    scale;

            }

        }

    }
    catch (error) {

        console.warn(
            "bodyScale取得エラー:",
            error
        );

    }



    // ========================================================
    // 腰上昇量
    // ========================================================

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



    // ========================================================
    // 最高点周辺を確認
    // ========================================================

    const peakHipValues = [];


    const peakStart =
        Math.max(
            0,
            handIndex - 2
        );


    const peakEnd =
        Math.min(
            data.length - 1,
            hipIndex + 8
        );


    for (
        let i = peakStart;
        i <= peakEnd;
        i++
    ) {

        try {

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
        catch (error) {

            continue;

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



    // ========================================================
    // 腰評価
    // ========================================================

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



    // ========================================================
    // ③ 着手位置
    // ========================================================

    const handValues = [];


    const handStart =
        Math.max(
            0,
            takeOffIndex
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

        try {

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
        catch (error) {

            continue;

        }

    }


    const handPosition =
        handValues.length > 0
            ? Math.max(
                ...handValues
            )
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



    // ========================================================
    // ④ 両足踏切
    // ========================================================

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

        try {

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
        catch (error) {

            continue;

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



    // ========================================================
    // ⑤ 着地
    // ========================================================

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

        try {

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
        catch (error) {

            continue;

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



    // ========================================================
    // 合計
    // ========================================================

    const total =
        kneeScore +
        hipScore +
        handScore +
        takeOffScore +
        landingScore;



    // ========================================================
    // 結果
    // ========================================================

    const result = {

        score: total,

        details: {

            // ----------------------------
            // 膝
            // ----------------------------

            knee: {

                score:
                    kneeScore,

                text:
                    kneeText,

                value:
                    kneeAngle,

                measured:
                    kneeAngle.toFixed(1) +
                    "°",

                candidates:
                    kneeCandidates,

                candidateCount:
                    kneeCandidates.length

            },


            // ----------------------------
            // 腰
            // ----------------------------

            hip: {

                score:
                    hipScore,

                text:
                    hipText,

                value:
                    hipRise,

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


            // ----------------------------
            // 着手
            // ----------------------------

            hand: {

                score:
                    handScore,

                text:
                    handText,

                value:
                    handPosition,

                measured:
                    handPosition.toFixed(3),

                unit:
                    "体格比"

            },


            // ----------------------------
            // 踏切
            // ----------------------------

            takeOff: {

                score:
                    takeOffScore,

                text:
                    takeOffText,

                value:
                    footDifference,

                measured:
                    footDifference.toFixed(3),

                unit:
                    "左右足首Y差"

            },


            // ----------------------------
            // 着地
            // ----------------------------

            landing: {

                score:
                    landingScore,

                text:
                    landingText,

                value:
                    landingDifference,

                measured:
                    landingDifference.toFixed(3),

                unit:
                    "左右足首Y差"

            }

        }

    };



    // ========================================================
    // デバッグ
    // ========================================================

    console.log(
        "================================"
    );

    console.log(
        "跳び箱AI採点 Ver6.0"
    );

    console.log(
        "フレーム数:",
        data.length
    );

    console.log(
        "膝候補数:",
        kneeCandidates.length
    );

    console.log(
        "膝候補:",
        kneeCandidates
    );

    console.log(
        "膝:",
        kneeScore,
        kneeAngle.toFixed(1) + "°"
    );

    console.log(
        "腰:",
        hipScore,
        hipRise.toFixed(3)
    );

    console.log(
        "着手:",
        handScore,
        handPosition.toFixed(3)
    );

    console.log(
        "踏切:",
        takeOffScore,
        footDifference.toFixed(3)
    );

    console.log(
        "着地:",
        landingScore,
        landingDifference.toFixed(3)
    );

    console.log(
        "Dスコア:",
        total
    );

    console.log(
        "================================"
    );



    return result;

}



// ============================================================
// グローバル公開
// ============================================================

window.calculateDScore =
    calculateDScore;


console.log(
    "score.js Ver6.0 読み込み成功"
);