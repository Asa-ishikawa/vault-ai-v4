// ==================================================
// 跳び箱AI採点システム
// score.js Ver5.9 完成版
//
// ・膝角度判定
// ・腰上昇量判定
// ・着手位置判定
// ・両足踏切判定
// ・着地安定判定
// ・実測値表示
// ・膝角度候補表示
// ・着地なし判定
// ==================================================


function calculateDScore(frames, phase) {

    // ==================================================
    // 基本チェック
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


        data.forEach(
            (frame, index) => {

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



    // ==================================================
    // ① 膝の伸び
    // ==================================================

    const kneeValues = [];


    // --------------------------------------------------
    // 3点から膝角度を計算
    // --------------------------------------------------

    function calculateKneeAngle(
        hip,
        knee,
        ankle
    ) {

        if (
            !hip ||
            !knee ||
            !ankle
        ) {

            return null;

        }


        const v1x =
            hip.x -
            knee.x;


        const v1y =
            hip.y -
            knee.y;


        const v2x =
            ankle.x -
            knee.x;


        const v2y =
            ankle.y -
            knee.y;


        const dot =
            v1x * v2x +
            v1y * v2y;


        const length1 =
            Math.sqrt(
                v1x * v1x +
                v1y * v1y
            );


        const length2 =
            Math.sqrt(
                v2x * v2x +
                v2y * v2y
            );


        if (
            length1 <= 0 ||
            length2 <= 0
        ) {

            return null;

        }


        let cos =
            dot /
            (
                length1 *
                length2
            );


        cos =
            Math.max(
                -1,
                Math.min(
                    1,
                    cos
                )
            );


        const angle =
            Math.acos(cos) *
            180 /
            Math.PI;


        if (
            !Number.isFinite(angle)
        ) {

            return null;

        }


        return angle;

    }



    // --------------------------------------------------
    // 膝を測定する範囲
    //
    // 腰の最高点を中心に前後20フレーム
    // --------------------------------------------------

    const kneeStart =
        Math.max(
            0,
            hipIndex - 20
        );


    const kneeEnd =
        Math.min(
            data.length - 1,
            hipIndex + 20
        );



    // --------------------------------------------------
    // 各フレームを確認
    // --------------------------------------------------

    for (
        let i = kneeStart;
        i <= kneeEnd;
        i++
    ) {

        const frame =
            data[i];


        if (!frame) {

            continue;

        }



        // ==============================================
        // 左脚
        // ==============================================

        const leftHip =
            getPoint(
                frame,
                23
            );


        const leftKnee =
            getPoint(
                frame,
                25
            );


        const leftAnkle =
            getPoint(
                frame,
                27
            );


        const leftAngle =
            calculateKneeAngle(
                leftHip,
                leftKnee,
                leftAnkle
            );


        if (
            Number.isFinite(
                leftAngle
            ) &&
            leftAngle > 0 &&
            leftAngle <= 180
        ) {

            kneeValues.push(
                leftAngle
            );

        }



        // ==============================================
        // 右脚
        // ==============================================

        const rightHip =
            getPoint(
                frame,
                24
            );


        const rightKnee =
            getPoint(
                frame,
                26
            );


        const rightAnkle =
            getPoint(
                frame,
                28
            );


        const rightAngle =
            calculateKneeAngle(
                rightHip,
                rightKnee,
                rightAnkle
            );


        if (
            Number.isFinite(
                rightAngle
            ) &&
            rightAngle > 0 &&
            rightAngle <= 180
        ) {

            kneeValues.push(
                rightAngle
            );

        }

    }



    // --------------------------------------------------
    // 膝角度
    // --------------------------------------------------

    let kneeAngle = 0;


    if (
        kneeValues.length > 0
    ) {

        kneeAngle =
            kneeValues.reduce(
                (a, b) =>
                    a + b,
                0
            ) /
            kneeValues.length;

    }



    // --------------------------------------------------
    // 膝の評価
    // --------------------------------------------------

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



    // --------------------------------------------------
    // 膝デバッグ情報を画面へ
    // --------------------------------------------------

    const kneeDebug =
        document.getElementById(
            "kneeDebug"
        );


    if (
        kneeDebug
    ) {

        kneeDebug.textContent =
            "膝角度候補：" +
            (
                kneeValues.length > 0
                    ? kneeValues
                        .map(
                            value =>
                                Number(
                                    value
                                ).toFixed(1)
                        )
                        .join(" / ")
                    : "データなし"
            );

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



    // ==================================================
    // 体格による正規化
    // ==================================================

    let bodyScale =
        getBodyScale(
            peakFrame
        );


    if (
        !Number.isFinite(
            bodyScale
        ) ||
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
    // 最高点付近を確認
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
            !Number.isFinite(
                scale
            ) ||
            scale <= 0
        ) {

            continue;

        }


        const rise =
            (
                takeOffHip
                    ? takeOffHip.y -
                      hip.y
                    : 0
            ) /
            scale;


        if (
            Number.isFinite(
                rise
            )
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
    //
    // 0点：0.200未満
    // 1点：0.200～0.349
    // 2点：0.350以上
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
            !Number.isFinite(
                scale
            ) ||
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
                (a, b) =>
                    a + b,
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
                (a, b) =>
                    a + b,
                0
            ) /
            landingValues.length
            : 1;


    let landingScore = 0;
    let landingText = "";


    // --------------------------------------------------
    // 着地データが存在しない場合
    // --------------------------------------------------

    if (
        landingValues.length === 0
    ) {

        landingScore = 0;

        landingText =
            "着地を確認できませんでした。最後まで着地する動作を行いましょう。";

    }

    else if (
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

        score:
            total,

        details: {

            // ==========================================
            // 膝
            // ==========================================

            knee: {

                score:
                    kneeScore,

                text:
                    kneeText,

                value:
                    kneeAngle,

                measured:
                    kneeAngle.toFixed(1) +
                    "°"

            },


            // ==========================================
            // 腰
            // ==========================================

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


            // ==========================================
            // 着手
            // ==========================================

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


            // ==========================================
            // 踏切
            // ==========================================

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


            // ==========================================
            // 着地
            // ==========================================

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



    // ==================================================
    // デバッグ
    // ==================================================

    console.log(
        "========== Ver5.9 SCORE =========="
    );


    console.log(
        "フレーム数:",
        data.length
    );


    console.log(
        "膝:",
        kneeScore,
        "角度:",
        kneeAngle.toFixed(1),
        "候補数:",
        kneeValues.length
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
        landingDifference.toFixed(3),
        "候補数:",
        landingValues.length
    );


    console.log(
        "Dスコア:",
        total
    );



    return result;

}



// ==================================================
// 公開
// ==================================================

window.calculateDScore =
    calculateDScore;


console.log(
    "score.js Ver5.9 読み込み成功"
);