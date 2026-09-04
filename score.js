// ============================================================
// 跳び箱AI採点システム
// score.js Ver6.3
// 暫定採点精度向上版
//
// 基準データ
// 成功①：D9
// 膝155.0 / 腰1.082 / 着手0.186 / 踏切0.007 / 着地0.029
//
// 成功②：D8
// 膝165.6 / 腰0.000 / 着手0.059 / 踏切0.012 / 着地0.034
//
// 普通①：D7
// 膝151.2 / 腰0.296 / 着手0.104 / 踏切0.012 / 着地0.087
//
// ※3本のみを基準にした「暫定版」
// ============================================================


// ============================================================
// メイン採点
// ============================================================

function calculateDScore(frames, phase) {

    console.log("================================");
    console.log("score.js Ver6.3 採点開始");
    console.log("================================");


    // --------------------------------------------------------
    // データ確認
    // --------------------------------------------------------

    if (!Array.isArray(frames) || frames.length < 5) {

        console.error(
            "骨格フレーム不足:",
            frames
        );

        return null;
    }


    if (!phase) {

        console.error(
            "phaseデータがありません"
        );

        return null;
    }


    console.log(
        "フレーム数:",
        frames.length
    );

    console.log(
        "phase:",
        phase
    );


    // ========================================================
    // 使用フレーム
    // ========================================================

    const takeOffFrame =
        safeFrameIndex(
            phase.takeOff,
            0,
            frames.length - 1
        );

    const handFrame =
        safeFrameIndex(
            phase.handContact,
            Math.floor(frames.length * 0.4),
            frames.length - 1
        );

    const highestHipFrame =
        safeFrameIndex(
            phase.highestHip,
            handFrame,
            frames.length - 1
        );

    const landingFrame =
        safeFrameIndex(
            phase.landing,
            frames.length - 1,
            frames.length - 1
        );


    console.log(
        "使用フレーム",
        {
            takeOffFrame,
            handFrame,
            highestHipFrame,
            landingFrame
        }
    );


    // ========================================================
    // ① 膝
    // ========================================================

    const kneeData =
        calculateKneeScore(
            frames,
            handFrame
        );


    // ========================================================
    // ② 腰
    // ========================================================

    const hipData =
        calculateHipScore(
            frames,
            takeOffFrame,
            highestHipFrame
        );


    // ========================================================
    // ③ 着手
    // ========================================================

    const handData =
        calculateHandScore(
            frames,
            phase,
            handFrame
        );


    // ========================================================
    // ④ 踏切
    // ========================================================

    const takeOffData =
        calculateTakeOffScore(
            frames,
            takeOffFrame
        );


    // ========================================================
    // ⑤ 着地
    // ========================================================

    const landingData =
        calculateLandingScore(
            frames,
            landingFrame
        );


    // ========================================================
    // 合計
    // ========================================================

    const totalScore =
        kneeData.score +
        hipData.score +
        handData.score +
        takeOffData.score +
        landingData.score;


    // ========================================================
    // 結果
    // ========================================================

    const result = {

        score:
            round1(totalScore),

        details: {

            knee:
                kneeData,

            hip:
                hipData,

            hand:
                handData,

            takeOff:
                takeOffData,

            landing:
                landingData

        },

        phase: {

            takeOff:
                takeOffFrame,

            handContact:
                handFrame,

            highestHip:
                highestHipFrame,

            landing:
                landingFrame

        }

    };


    // ========================================================
    // デバッグ
    // ========================================================

    console.log(
        "========== Ver6.3 採点結果 =========="
    );

    console.log(
        "膝:",
        kneeData
    );

    console.log(
        "腰:",
        hipData
    );

    console.log(
        "着手:",
        handData
    );

    console.log(
        "踏切:",
        takeOffData
    );

    console.log(
        "着地:",
        landingData
    );

    console.log(
        "Dスコア:",
        totalScore
    );


    return result;
}


// ============================================================
// ① 膝の伸び
//
// 成功①：155.0
// 成功②：165.6
// 普通①：151.2
//
// 暫定基準
// 160以上 → 2点
// 150以上 → 1点
// 150未満 → 0点
// ============================================================

function calculateKneeScore(
    frames,
    frameIndex
) {

    const frame =
        getFrame(
            frames,
            frameIndex
        );


    const angle =
        getKneeAngle(frame);


    // 実測値が取れない場合
    if (!Number.isFinite(angle)) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "膝角度を確認できませんでした。",

            threshold0:
                "150°未満",

            threshold1:
                "150°以上160°未満",

            threshold2:
                "160°以上"

        };

    }


    let score = 0;
    let text = "";


    if (angle >= 160) {

        score = 2;

        text =
            "膝がよく伸びています。";

    }

    else if (angle >= 150) {

        score = 1;

        text =
            "膝はある程度伸びています。もう少し伸ばすことを意識しましょう。";

    }

    else {

        score = 0;

        text =
            "膝の伸びを確認しましょう。";

    }


    return {

        score: score,

        value: round1(angle),

        measured:
            round1(angle) + "°",

        text: text,

        threshold0:
            "150°未満",

        threshold1:
            "150°以上160°未満",

        threshold2:
            "160°以上"

    };
}


// ============================================================
// ② 腰の位置
//
// 成功①：1.082
// 成功②：0.000
// 普通①：0.296
//
// 成功②が0なので、単純な閾値だけでは決めない。
// 現時点では比較的安全な暫定基準とする。
// ============================================================

function calculateHipScore(
    frames,
    takeOffFrame,
    highestFrame
) {

    const takeFrame =
        getFrame(
            frames,
            takeOffFrame
        );

    const highFrame =
        getFrame(
            frames,
            highestFrame
        );


    const takeHip =
        getHipCenter(
            takeFrame
        );

    const highHip =
        getHipCenter(
            highFrame
        );


    if (
        !takeHip ||
        !highHip
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を確認しましょう。",

            threshold0:
                "取得できない場合",

            threshold1:
                "暫定判定",

            threshold2:
                "暫定判定"

        };

    }


    // --------------------------------------------------------
    // y座標は小さいほど上
    // --------------------------------------------------------

    const rise =
        takeHip.y -
        highHip.y;


    // 異常値対策
    if (
        !Number.isFinite(rise) ||
        rise < -2 ||
        rise > 2
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を確認しましょう。",

            threshold0:
                "取得できない場合",

            threshold1:
                "暫定判定",

            threshold2:
                "暫定判定"

        };

    }


    // --------------------------------------------------------
    // 0～1付近の値として扱う
    // --------------------------------------------------------

    const measured =
        Math.max(
            0,
            rise
        );


    let score = 0;
    let text = "";


    // 現段階ではかなり慎重に判定
    if (measured >= 0.50) {

        score = 2;

        text =
            "跳び越す動作で腰が十分に上がっています。";

    }

    else if (measured >= 0.20) {

        score = 1;

        text =
            "腰は上がっています。さらに腰を高く保つことを意識しましょう。";

    }

    else {

        score = 0;

        text =
            "腰の位置を確認しましょう。";

    }


    return {

        score: score,

        value:
            round3(measured),

        measured:
            round3(measured),

        text: text,

        threshold0:
            "0.20未満",

        threshold1:
            "0.20以上0.50未満",

        threshold2:
            "0.50以上"

    };
}


// ============================================================
// ③ 着手位置
//
// 着手は実測値だけで決めない。
// phase.js が選んだ「本当の着手フレーム」を尊重する。
//
// さらに phase.js の
// handScore / handLikelihood / candidates
// があれば利用する。
// ============================================================

function calculateHandScore(
    frames,
    phase,
    handFrame
) {

    const frame =
        getFrame(
            frames,
            handFrame
        );


    const measured =
        getHandMeasuredValue(
            frame
        );


    // phase.js の着手候補情報
    const candidates =
        getHandCandidates(
            phase
        );


    const candidateCount =
        candidates.length;


    // 選択された候補
    let selectedCandidate = null;


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const c =
            candidates[i];


        const frameNumber =
            getCandidateFrame(
                c
            );


        if (
            frameNumber ===
            handFrame
        ) {

            selectedCandidate =
                c;

            break;

        }

    }


    // 着手らしさ
    let likelihood =
        getCandidateLikelihood(
            selectedCandidate
        );


    // phaseに直接保存されている場合
    if (
        !Number.isFinite(likelihood) &&
        Number.isFinite(
            Number(
                phase.handLikelihood
            )
        )
    ) {

        likelihood =
            Number(
                phase.handLikelihood
            );

    }


    // --------------------------------------------------------
    // 実測値が取れない場合
    // --------------------------------------------------------

    if (
        !Number.isFinite(measured)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着手位置を確認しましょう。",

            candidateCount:
                candidateCount,

            selectedFrame:
                handFrame,

            likelihood:
                Number.isFinite(likelihood)
                    ? likelihood
                    : null

        };

    }


    // --------------------------------------------------------
    // 着手位置判定
    //
    // 現段階では実測値だけで強く決めない。
    // phase.jsの「着手らしさ」を優先する。
    // --------------------------------------------------------

    let score = 0;


    if (
        Number.isFinite(likelihood)
    ) {

        if (
            likelihood >= 9
        ) {

            score = 2;

        }

        else if (
            likelihood >= 6
        ) {

            score = 1;

        }

        else {

            score = 0;

        }

    }

    else {

        // 着手らしさがない場合の暫定判定

        if (
            measured >= 0.05 &&
            measured <= 0.30
        ) {

            score = 1;

        }

        else {

            score = 0;

        }

    }


    let text = "";


    if (score === 2) {

        text =
            "着手タイミング・着手位置が安定しています。";

    }

    else if (score === 1) {

        text =
            "着手位置を確認しましょう。手をつく位置を安定させると、さらによくなります。";

    }

    else {

        text =
            "着手位置を確認しましょう。";

    }


    return {

        score: score,

        value:
            round3(measured),

        measured:
            round3(measured),

        text: text,

        candidateCount:
            candidateCount,

        selectedFrame:
            handFrame,

        likelihood:
            Number.isFinite(likelihood)
                ? likelihood
                : null

    };
}


// ============================================================
// ④ 両足踏切
//
// 現在の実測値だけでは
// 成功②と普通①が同じ0.012。
// したがって過剰な閾値変更はしない。
//
// 左右足の同時性を優先。
// ============================================================

function calculateTakeOffScore(
    frames,
    frameIndex
) {

    // ========================================================
    // 踏切周辺の候補フレーム
    // ========================================================

    const start =
        Math.max(
            0,
            frameIndex - 3
        );

    const end =
        Math.min(
            frames.length - 1,
            frameIndex + 3
        );


    const candidates = [];


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            getFrame(
                frames,
                i
            );


        if (!frame) {

            continue;

        }


        // ----------------------------------------------------
        // 左右足首の差
        // ----------------------------------------------------

        const measured =
            calculateTakeOffDifference(
                frame
            );


        if (
            !Number.isFinite(
                measured
            )
        ) {

            continue;

        }


        // ----------------------------------------------------
        // visibility確認
        // ----------------------------------------------------

        const landmarks =
            getLandmarks(
                frame
            );


        let visibility =
            1;


        if (
            landmarks &&
            landmarks[27] &&
            landmarks[28]
        ) {

            const leftVisibility =
                Number(
                    landmarks[27]
                        .visibility
                );


            const rightVisibility =
                Number(
                    landmarks[28]
                        .visibility
                );


            const values =
                [];


            if (
                Number.isFinite(
                    leftVisibility
                )
            ) {

                values.push(
                    leftVisibility
                );

            }


            if (
                Number.isFinite(
                    rightVisibility
                )
            ) {

                values.push(
                    rightVisibility
                );

            }


            if (
                values.length > 0
            ) {

                visibility =
                    values.reduce(
                        (a, b) =>
                            a + b,
                        0
                    ) /
                    values.length;

            }

        }


        // ----------------------------------------------------
        // visibilityが低すぎるフレームは除外
        // ----------------------------------------------------

        if (
            visibility < 0.45
        ) {

            continue;

        }


        // ----------------------------------------------------
        // 踏切フレームからの距離
        // ----------------------------------------------------

        const distance =
            Math.abs(
                i -
                frameIndex
            );


        // ----------------------------------------------------
        // 候補スコア
        //
        // 左右差が小さい
        // ＋
        // phase.jsの踏切フレームに近い
        // ＋
        // visibilityが高い
        // ----------------------------------------------------

        const differenceScore =
            measured * 100;


        const distancePenalty =
            distance * 0.8;


        const visibilityPenalty =
            (
                1 -
                visibility
            ) * 2;


        const candidateScore =
            differenceScore +
            distancePenalty +
            visibilityPenalty;


        candidates.push({

            frame:
                i,

            measured:
                measured,

            visibility:
                visibility,

            distance:
                distance,

            candidateScore:
                candidateScore

        });

    }


    // ========================================================
    // 候補なし
    // ========================================================

    if (
        candidates.length === 0
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "踏切の状態を確認しましょう。",

            threshold0:
                "0.030より大きい",

            threshold1:
                "0.015より大きく0.030以下",

            threshold2:
                "0.015以下"

        };

    }


    // ========================================================
    // 一番踏切らしい候補を選択
    // ========================================================

    candidates.sort(
        (a, b) =>
            a.candidateScore -
            b.candidateScore
    );


    const best =
        candidates[0];


    const measured =
        best.measured;


    // ========================================================
    // 採点
    // ========================================================

    let score = 0;

    let text = "";


    if (
        measured <= 0.015
    ) {

        score = 2;

        text =
            "両足をそろえて踏み切れています。";

    }

    else if (
        measured <= 0.030
    ) {

        score = 1;

        text =
            "両足踏切に近づいています。両足をそろえることを意識しましょう。";

    }

    else {

        score = 0;

        text =
            "両足をそろえて踏み切ることを意識しましょう。";

    }


    // ========================================================
    // 診断ログ
    // ========================================================

    console.log(
        "========== 踏切判定 Ver6.3.1 =========="
    );

    console.log(
        "phase踏切フレーム:",
        frameIndex
    );

    console.log(
        "候補数:",
        candidates.length
    );

    console.log(
        "選択踏切フレーム:",
        best.frame
    );

    console.log(
        "踏切実測値:",
        measured
    );

    console.log(
        "visibility:",
        best.visibility
    );

    console.log(
        "踏切点:",
        score
    );


    // ========================================================
    // 結果
    // ========================================================

    return {

        score:
            score,

        value:
            round3(
                measured
            ),

        measured:
            round3(
                measured
            ),

        text:
            text,

        threshold0:
            "0.030より大きい",

        threshold1:
            "0.015より大きく0.030以下",

        threshold2:
            "0.015以下",

        selectedFrame:
            best.frame,

        candidateCount:
            candidates.length

    };

}


// ============================================================
// ⑤ 着地の安定
//
// 成功①：0.029
// 成功②：0.034
// 普通①：0.087
//
// 現時点で最も差が見えやすい項目。
// 暫定基準
//
// 0.05以下 → 2点
// 0.05～0.10 → 1点
// 0.10超 → 0点
// ============================================================

function calculateLandingScore(
    frames,
    frameIndex
) {

    const measured =
        calculateLandingDifference(
            frames,
            frameIndex
        );


    if (
        !Number.isFinite(measured)
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着地の安定を確認しましょう。",

            threshold0:
                "0.10より大きい",

            threshold1:
                "0.05より大きく0.10以下",

            threshold2:
                "0.05以下"

        };

    }


    let score = 0;
    let text = "";


    if (measured <= 0.05) {

        score = 2;

        text =
            "着地が安定しています。";

    }

    else if (measured <= 0.10) {

        score = 1;

        text =
            "着地できています。両足をそろえると、さらに安定します。";

    }

    else {

        score = 0;

        text =
            "着地では両足を安定させることを意識しましょう。";

    }


    return {

        score: score,

        value:
            round3(measured),

        measured:
            round3(measured),

        text: text,

        threshold0:
            "0.10より大きい",

        threshold1:
            "0.05より大きく0.10以下",

        threshold2:
            "0.05以下"

    };
}


// ============================================================
// 膝角度取得
// ============================================================

function getKneeAngle(frame) {

    if (!frame) {

        return NaN;

    }


    // --------------------------------------------------------
    // 既存utils.jsに関数がある場合
    // --------------------------------------------------------

    if (
        typeof calculateKneeAngle ===
        "function"
    ) {

        try {

            const value =
                Number(
                    calculateKneeAngle(
                        frame
                    )
                );


            if (
                Number.isFinite(value)
            ) {

                return value;

            }

        }

        catch (e) {

            console.warn(
                "calculateKneeAngleエラー:",
                e
            );

        }

    }


    // --------------------------------------------------------
    // 左右膝を直接計算
    // --------------------------------------------------------

    const landmarks =
        getLandmarks(frame);


    if (
        !landmarks ||
        landmarks.length < 27
    ) {

        return NaN;

    }


    const left =
        calculateAngle(
            landmarks[23],
            landmarks[25],
            landmarks[27]
        );


    const right =
        calculateAngle(
            landmarks[24],
            landmarks[26],
            landmarks[28]
        );


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

        return NaN;

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
// 腰中心取得
// ============================================================

function getHipCenter(frame) {

    if (!frame) {

        return null;

    }


    // utils.js等の関数がある場合
    if (
        typeof window.getHipCenter ===
        "function" &&
        window.getHipCenter !==
        getHipCenter
    ) {

        try {

            const result =
                window.getHipCenter(
                    frame
                );


            if (
                result &&
                Number.isFinite(
                    Number(result.x)
                ) &&
                Number.isFinite(
                    Number(result.y)
                )
            ) {

                return {

                    x:
                        Number(result.x),

                    y:
                        Number(result.y)

                };

            }

        }

        catch (e) {

            console.warn(
                "既存getHipCenterエラー:",
                e
            );

        }

    }


    const landmarks =
        getLandmarks(frame);


    if (
        !landmarks ||
        landmarks.length < 25
    ) {

        return null;

    }


    const left =
        landmarks[23];

    const right =
        landmarks[24];


    if (
        !left ||
        !right
    ) {

        return null;

    }


    return {

        x:
            (
                Number(left.x) +
                Number(right.x)
            ) / 2,

        y:
            (
                Number(left.y) +
                Number(right.y)
            ) / 2

    };
}


// ============================================================
// 着手実測値
//
// 「手と跳び箱の位置関係」を既存データから取得。
// phase.js側に measured がある場合は優先。
// ============================================================

function getHandMeasuredValue(frame) {

    if (!frame) {

        return NaN;

    }


    // frame自身に保存されている場合
    const directValues = [

        frame.handMeasured,

        frame.handPosition,

        frame.handValue,

        frame.handDistance

    ];


    for (
        let i = 0;
        i < directValues.length;
        i++
    ) {

        const value =
            Number(
                directValues[i]
            );


        if (
            Number.isFinite(value)
        ) {

            return Math.abs(value);

        }

    }


    // landmarkからの簡易値
    const landmarks =
        getLandmarks(frame);


    if (
        !landmarks ||
        landmarks.length < 17
    ) {

        return NaN;

    }


    const leftWrist =
        landmarks[15];

    const rightWrist =
        landmarks[16];


    const values = [];


    if (
        leftWrist &&
        Number.isFinite(
            Number(leftWrist.x)
        )
    ) {

        values.push(
            Math.abs(
                Number(leftWrist.x)
            )
        );

    }


    if (
        rightWrist &&
        Number.isFinite(
            Number(rightWrist.x)
        )
    ) {

        values.push(
            Math.abs(
                Number(rightWrist.x)
            )
        );

    }


    if (
        values.length === 0
    ) {

        return NaN;

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
// 踏切差
// ============================================================

function calculateTakeOffDifference(
    frame
) {

    if (!frame) {

        return NaN;

    }


    // frameに保存されている値を優先
    const directValues = [

        frame.takeOffMeasured,

        frame.takeOffValue,

        frame.footDifference,

        frame.footDiff,

        frame.takeoffDifference

    ];


    for (
        let i = 0;
        i < directValues.length;
        i++
    ) {

        const value =
            Number(
                directValues[i]
            );


        if (
            Number.isFinite(value)
        ) {

            return Math.abs(value);

        }

    }


    const landmarks =
        getLandmarks(frame);


    if (
        !landmarks ||
        landmarks.length < 31
    ) {

        return NaN;

    }


    // 左右足首
    const left =
        landmarks[27];

    const right =
        landmarks[28];


    if (
        !left ||
        !right
    ) {

        return NaN;

    }


    const difference =
        Math.abs(
            Number(left.y) -
            Number(right.y)
        );


    if (
        !Number.isFinite(
            difference
        )
    ) {

        return NaN;

    }


    return difference;
}


// ============================================================
// 着地差
// ============================================================

function calculateLandingDifference(
    frames,
    landingFrame
) {

    if (
        !Array.isArray(frames) ||
        frames.length === 0
    ) {

        return NaN;

    }


    const index =
        safeFrameIndex(
            landingFrame,
            frames.length - 1,
            frames.length - 1
        );


    // --------------------------------------------------------
    // まず既存の着地データを探す
    // --------------------------------------------------------

    const target =
        frames[index];


    if (target) {

        const directValues = [

            target.landingMeasured,

            target.landingValue,

            target.landingDifference,

            target.landingDiff

        ];


        for (
            let i = 0;
            i < directValues.length;
            i++
        ) {

            const value =
                Number(
                    directValues[i]
                );


            if (
                Number.isFinite(value)
            ) {

                return Math.abs(value);

            }

        }

    }


    // --------------------------------------------------------
    // 最終フレーム周辺の左右足の広がりを計算
    // --------------------------------------------------------

    const start =
        Math.max(
            0,
            index - 2
        );

    const end =
        Math.min(
            frames.length - 1,
            index + 1
        );


    const values = [];


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            frames[i];


        const landmarks =
            getLandmarks(frame);


        if (
            !landmarks ||
            landmarks.length < 29
        ) {

            continue;

        }


        const left =
            landmarks[27];

        const right =
            landmarks[28];


        if (
            !left ||
            !right
        ) {

            continue;

        }


        const dx =
            Number(left.x) -
            Number(right.x);

        const dy =
            Number(left.y) -
            Number(right.y);


        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (
            Number.isFinite(distance)
        ) {

            values.push(
                distance
            );

        }

    }


    if (
        values.length === 0
    ) {

        return NaN;

    }


    // --------------------------------------------------------
    // 着地時の足のばらつき
    // --------------------------------------------------------

    return (
        values.reduce(
            (a, b) => a + b,
            0
        ) /
        values.length
    );
}


// ============================================================
// 着手候補取得
// ============================================================

function getHandCandidates(phase) {

    if (!phase) {

        return [];

    }


    const candidates = [

        phase.handCandidates,

        phase.handContactCandidates,

        phase.candidates,

        phase.handCandidateList

    ];


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        if (
            Array.isArray(
                candidates[i]
            )
        ) {

            return candidates[i];

        }

    }


    return [];
}


// ============================================================
// 候補フレーム取得
// ============================================================

function getCandidateFrame(candidate) {

    if (!candidate) {

        return NaN;

    }


    const values = [

        candidate.frame,

        candidate.frameIndex,

        candidate.index,

        candidate.frameNumber

    ];


    for (
        let i = 0;
        i < values.length;
        i++
    ) {

        const value =
            Number(
                values[i]
            );


        if (
            Number.isFinite(value)
        ) {

            return value;

        }

    }


    return NaN;
}


// ============================================================
// 着手らしさ取得
// ============================================================

function getCandidateLikelihood(
    candidate
) {

    if (!candidate) {

        return NaN;

    }


    const values = [

        candidate.likelihood,

        candidate.handLikelihood,

        candidate.handScore,

        candidate.score,

        candidate.handness

    ];


    for (
        let i = 0;
        i < values.length;
        i++
    ) {

        const value =
            Number(
                values[i]
            );


        if (
            Number.isFinite(value)
        ) {

            return value;

        }

    }


    return NaN;
}


// ============================================================
// frameからlandmarks取得
// ============================================================

function getLandmarks(frame) {

    if (!frame) {

        return null;

    }


    if (
        Array.isArray(frame)
    ) {

        return frame;

    }


    const possible = [

        frame.landmarks,

        frame.poseLandmarks,

        frame.keypoints,

        frame.results &&
        frame.results.poseLandmarks

    ];


    for (
        let i = 0;
        i < possible.length;
        i++
    ) {

        if (
            Array.isArray(
                possible[i]
            )
        ) {

            return possible[i];

        }

    }


    return null;
}


// ============================================================
// フレーム取得
// ============================================================

function getFrame(
    frames,
    index
) {

    if (
        !Array.isArray(frames) ||
        frames.length === 0
    ) {

        return null;

    }


    const safeIndex =
        safeFrameIndex(
            index,
            0,
            frames.length - 1
        );


    return frames[safeIndex];
}


// ============================================================
// 安全なフレーム番号
// ============================================================

function safeFrameIndex(
    value,
    fallback,
    max
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return fallback;

    }


    return Math.max(
        0,
        Math.min(
            Math.round(number),
            max
        )
    );
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

        return NaN;

    }


    const abx =
        Number(a.x) -
        Number(b.x);

    const aby =
        Number(a.y) -
        Number(b.y);

    const cbx =
        Number(c.x) -
        Number(b.x);

    const cby =
        Number(c.y) -
        Number(b.y);


    const abLength =
        Math.sqrt(
            abx * abx +
            aby * aby
        );


    const cbLength =
        Math.sqrt(
            cbx * cbx +
            cby * cby
        );


    if (
        abLength === 0 ||
        cbLength === 0
    ) {

        return NaN;

    }


    let cosine =
        (
            abx * cbx +
            aby * cby
        ) /
        (
            abLength *
            cbLength
        );


    cosine =
        Math.max(
            -1,
            Math.min(
                1,
                cosine
            )
        );


    return (
        Math.acos(
            cosine
        ) *
        180 /
        Math.PI
    );
}


// ============================================================
// 数値丸め
// ============================================================

function round1(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return null;

    }


    return Number(
        number.toFixed(1)
    );
}


function round3(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return null;

    }


    return Number(
        number.toFixed(3)
    );
}


// ============================================================
// 公開
// ============================================================

window.calculateDScore =
    calculateDScore;


console.log(
    "================================"
);

console.log(
    "score.js Ver6.3 読み込み成功"
);

console.log(
    "暫定採点精度向上版"
);

console.log(
    "================================"
);