// ==================================================
// 跳び箱AI採点システム
// score.js Ver6.0
// 着手位置・測定改善版
// ==================================================

function calculateDScore(frames, phase) {

    // ==================================================
    // データ確認
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

    const data = prepareFrames(frames);


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


    // ==================================================
    // 体格による正規化
    // ==================================================

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
    //
    // Ver6.0
    //
    // 着手フレーム前後15フレームを調査
    // 「最大値」ではなく候補をすべて保存
    // 実際に測定できた値を確認できるようにする
    // ==================================================

    const handCandidates = [];


    // --------------------------------------------------
    // 着手フレーム前後15フレーム
    // --------------------------------------------------

    const handSearchStart =
        Math.max(
            0,
            handIndex - 15
        );


    const handSearchEnd =
        Math.min(
            data.length - 1,
            handIndex + 15
        );


    for (
        let i = handSearchStart;
        i <= handSearchEnd;
        i++
    ) {

        const frame =
            data[i];


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


        const hip =
            getHipCenter(
                frame
            );


        let scale =
            getBodyScale(
                frame
            );


        if (
            !left ||
            !right ||
            !hip
        ) {
            continue;
        }


        if (
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

            handCandidates.push({

                index: i,

                frame:
                    frame.frame,

                value:
                    normalized,

                handX:
                    handX,

                hipX:
                    hip.x

            });

        }

    }



    // ==================================================
    // 着手候補を整理
    // ==================================================

    let handPosition = 0;

    let handMeasurementStatus =
        "データなし";

    let selectedHandFrame = null;


    if (
        handCandidates.length > 0
    ) {

        handMeasurementStatus =
            "測定成功";


        // --------------------------------------------------
        // 候補値を小さい順に並べる
        // --------------------------------------------------

        const sortedCandidates =
            [...handCandidates].sort(
                (a, b) =>
                    a.value -
                    b.value
            );


        // --------------------------------------------------
        // 着手フレームに最も近い候補を探す
        // --------------------------------------------------

        let nearestCandidate =
            handCandidates[0];


        let nearestDifference =
            Math.abs(
                nearestCandidate.index -
                handIndex
            );


        handCandidates.forEach(
            candidate => {

                const difference =
                    Math.abs(
                        candidate.index -
                        handIndex
                    );


                if (
                    difference <
                    nearestDifference
                ) {

                    nearestDifference =
                        difference;

                    nearestCandidate =
                        candidate;

                }

            }
        );


        // --------------------------------------------------
        // 着手フレーム付近の候補を優先
        //
        // ±3フレーム以内
        // --------------------------------------------------

        const nearCandidates =
            handCandidates.filter(
                candidate =>
                    Math.abs(
                        candidate.index -
                        handIndex
                    ) <= 3
            );


        if (
            nearCandidates.length > 0
        ) {

            // ------------------------------------------------
            // 近傍候補の中央値
            // ------------------------------------------------

            const nearValues =
                nearCandidates
                    .map(
                        candidate =>
                            candidate.value
                    )
                    .sort(
                        (a, b) =>
                            a - b
                    );


            const middle =
                Math.floor(
                    nearValues.length / 2
                );


            if (
                nearValues.length % 2 === 0
            ) {

                handPosition =
                    (
                        nearValues[middle - 1] +
                        nearValues[middle]
                    ) /
                    2;

            }

            else {

                handPosition =
                    nearValues[middle];

            }


            // ------------------------------------------------
            // 選択フレーム
            // ------------------------------------------------

            selectedHandFrame =
                nearestCandidate.frame;

        }

        else {

            handPosition =
                nearestCandidate.value;

            selectedHandFrame =
                nearestCandidate.frame;

        }

    }



    // ==================================================
    // 着手位置評価
    //
    // 暫定基準
    //
    // 0.25～0.80 → 2点
    // 0.10～0.25 → 1点
    // 0.80～1.10 → 1点
    // その他 → 0点
    // ==================================================

    let handScore = 0;
    let handText = "";


    if (
        handMeasurementStatus ===
        "データなし"
    ) {

        handScore = 0;

        handText =
            "着手位置のデータを取得できませんでした。";

    }

    else if (
        handPosition >= 0.25 &&
        handPosition <= 0.80
    ) {

        handScore = 2;

        handText =
            "着手位置が適切です。安定した位置に手をつけています。";

    }

    else if (
        (
            handPosition >= 0.10 &&
            handPosition < 0.25
        ) ||
        (
            handPosition > 0.80 &&
            handPosition <= 1.10
        )
    ) {

        handScore = 1;

        handText =
            "着手位置はおおむねできています。手をつく位置をさらに安定させましょう。";

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

            // ------------------------------------------------
            // ① 膝
            // ------------------------------------------------

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


            // ------------------------------------------------
            // ② 腰
            // ------------------------------------------------

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


            // ------------------------------------------------
            // ③ 着手
            // ------------------------------------------------

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
                    "体格比",

                status:
                    handMeasurementStatus,

                selectedFrame:
                    selectedHandFrame,

                candidateCount:
                    handCandidates.length,

                candidates:
                    handCandidates.map(
                        candidate => ({
                            frame:
                                candidate.frame,

                            value:
                                Number(
                                    candidate.value.toFixed(3)
                                )
                        })
                    )

            },


            // ------------------------------------------------
            // ④ 踏切
            // ------------------------------------------------

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


            // ------------------------------------------------
            // ⑤ 着地
            // ------------------------------------------------

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
    // コンソール確認
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "跳び箱AI採点システム Ver6.0"
    );

    console.log(
        "===================================="
    );


    console.log(
        "① 膝:",
        kneeScore,
        "角度:",
        kneeAngle.toFixed(1),
        "°"
    );


    console.log(
        "② 腰:",
        hipScore,
        "実測値:",
        hipRise.toFixed(3)
    );


    console.log(
        "③ 着手:"
    );


    console.log(
        "着手判定フレーム:",
        phase.handContact
    );


    console.log(
        "選択フレーム:",
        selectedHandFrame
    );


    console.log(
        "候補数:",
        handCandidates.length
    );


    console.log(
        "候補値:",
        handCandidates
    );


    console.log(
        "着手代表値:",
        handPosition.toFixed(3)
    );


    console.log(
        "着手測定状態:",
        handMeasurementStatus
    );


    console.log(
        "着手スコア:",
        handScore
    );


    console.log(
        "④ 踏切:",
        takeOffScore,
        "実測値:",
        footDifference.toFixed(3)
    );


    console.log(
        "⑤ 着地:",
        landingScore,
        "実測値:",
        landingDifference.toFixed(3)
    );


    console.log(
        "===================================="
    );


    console.log(
        "Dスコア:",
        total
    );


    console.log(
        "===================================="
    );


    return result;
}



// ==================================================
// 公開
// ==================================================

window.calculateDScore =
    calculateDScore;


console.log(
    "score.js Ver6.0 読み込み成功"
);