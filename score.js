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

    // --------------------------------------------------------
    // フレームからランドマーク配列を取得
    // --------------------------------------------------------

    function getLandmarks(frame) {

        if (!frame) {
            return null;
        }

        if (Array.isArray(frame)) {
            return frame;
        }

        if (Array.isArray(frame.landmarks)) {
            return frame.landmarks;
        }

        if (Array.isArray(frame.poseLandmarks)) {
            return frame.poseLandmarks;
        }

        if (
            frame.results &&
            Array.isArray(frame.results.poseLandmarks)
        ) {
            return frame.results.poseLandmarks;
        }

        return null;
    }


    // --------------------------------------------------------
    // 踏切フレーム
    // --------------------------------------------------------

    const takeFrame =
        getFrame(
            frames,
            takeOffFrame
        );

    const takeHip =
        getHipCenter(
            takeFrame
        );


    if (!takeHip) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を確認しましょう。",

            threshold0:
                "0.10未満",

            threshold1:
                "0.10以上0.20未満",

            threshold2:
                "0.20以上"

        };
    }


    // --------------------------------------------------------
    // 踏切時の身体サイズを取得
    // 肩の中心～腰の中心
    // --------------------------------------------------------

    const takeLandmarks =
        getLandmarks(
            takeFrame
        );


    let bodyScale = 0.20;


    if (
        takeLandmarks &&
        takeLandmarks[11] &&
        takeLandmarks[12] &&
        takeLandmarks[23] &&
        takeLandmarks[24]
    ) {

        const shoulderX =
            (
                takeLandmarks[11].x +
                takeLandmarks[12].x
            ) / 2;

        const shoulderY =
            (
                takeLandmarks[11].y +
                takeLandmarks[12].y
            ) / 2;

        const hipX =
            (
                takeLandmarks[23].x +
                takeLandmarks[24].x
            ) / 2;

        const hipY =
            (
                takeLandmarks[23].y +
                takeLandmarks[24].y
            ) / 2;


        const dx =
            hipX -
            shoulderX;

        const dy =
            hipY -
            shoulderY;


        const scale =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (
            Number.isFinite(scale) &&
            scale > 0.03 &&
            scale < 1
        ) {

            bodyScale =
                scale;
        }
    }


    // --------------------------------------------------------
    // 最高点付近を複数フレーム確認
    //
    // ★ここだけ変更
    //
    // 最高点の「前」を広めに確認し、
    // 最高点の「後」は2フレームだけ確認する
    //
    // highestFrame - 6 ～ highestFrame + 2
    // --------------------------------------------------------

    const centerIndex =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                Number(highestFrame)
            )
        );


    const riseCandidates = [];


    for (
        let offset = -6;
        offset <= 2;
        offset++
    ) {

        const index =
            centerIndex +
            offset;


        if (
            index < 0 ||
            index >= frames.length
        ) {
            continue;
        }


        const frame =
            getFrame(
                frames,
                index
            );


        const hip =
            getHipCenter(
                frame
            );


        if (!hip) {
            continue;
        }


        if (
            !Number.isFinite(hip.y)
        ) {
            continue;
        }


        // ----------------------------------------------------
        // 腰の上昇量
        // ----------------------------------------------------

        const rawRise =
            takeHip.y -
            hip.y;


        if (
            !Number.isFinite(rawRise)
        ) {
            continue;
        }


        // ----------------------------------------------------
        // 身体サイズで正規化
        // ----------------------------------------------------

        const normalizedRise =
            rawRise /
            bodyScale;


        if (
            Number.isFinite(normalizedRise) &&
            normalizedRise >= 0 &&
            normalizedRise <= 3
        ) {

            riseCandidates.push(
                normalizedRise
            );
        }
    }


    // --------------------------------------------------------
    // 有効データなし
    // --------------------------------------------------------

    if (
        riseCandidates.length === 0
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を確認しましょう。",

            threshold0:
                "0.10未満",

            threshold1:
                "0.10以上0.20未満",

            threshold2:
                "0.20以上"

        };
    }


    // --------------------------------------------------------
    // 上昇量を並べ替え
    // --------------------------------------------------------

    riseCandidates.sort(
        (a, b) =>
            a - b
    );


    // --------------------------------------------------------
    // 上位3フレームの平均
    // --------------------------------------------------------

    const useCount =
        Math.min(
            3,
            riseCandidates.length
        );


    const topValues =
        riseCandidates.slice(
            riseCandidates.length -
            useCount
        );


    const measured =
        topValues.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        topValues.length;


    // --------------------------------------------------------
    // 異常値対策
    // --------------------------------------------------------

    if (
        !Number.isFinite(measured) ||
        measured < 0 ||
        measured > 3
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "腰の位置を確認しましょう。",

            threshold0:
                "0.10未満",

            threshold1:
                "0.10以上0.20未満",

            threshold2:
                "0.20以上"

        };
    }


    // --------------------------------------------------------
    // 腰の評価
    //
    // 0.10未満       → 0点
    // 0.10以上0.20未満 → 1点
    // 0.20以上       → 2点
    // --------------------------------------------------------

    let score = 0;
    let text = "";


    if (
        measured >= 0.20
    ) {

        score = 2;

        text =
            "跳び越す動作で腰が十分に上がっています。";

    }

    else if (
        measured >= 0.10
    ) {

        score = 1;

        text =
            "腰は上がっています。さらに腰を高く保つことを意識しましょう。";

    }

    else {

        score = 0;

        text =
            "腰の位置を確認しましょう。";
    }


    // --------------------------------------------------------
    // 結果
    // --------------------------------------------------------

    return {

        score: score,

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
            "0.10未満",

        threshold1:
            "0.10以上0.20未満",

        threshold2:
            "0.20以上"

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

// ============================================================
// ③ 着手位置
//
// 着手判定 Ver6.4
//
// 改良内容
// ・phase.jsが選んだ着手フレームを基準にする
// ・その前後の候補フレームも比較する
// ・最も「着手らしい」候補を採用する
// ・1フレームだけの誤判定に引っ張られにくくする
// ・candidateCount / selectedFrame / likelihood は維持
// ・他4項目の採点ロジックは変更しない
// ============================================================

// ============================================================
// ③ 着手位置
//
// 着手判定 Ver6.5
//
// 改良内容
// ・phase.jsの着手候補を使用
// ・候補フレームの「連続性」を評価
// ・1フレームだけの孤立候補を弱くする
// ・連続した候補グループを作る
// ・最も着手動作らしい連続グループを選択
// ・グループ中央付近を着手フレームとして採用
// ・実測値は採用フレームから取得
// ・candidateCount / selectedFrame / likelihood を維持
// ・他4項目の採点ロジックは変更しない
// ============================================================

function calculateHandScore(
    frames,
    phase,
    handFrame
) {

    // --------------------------------------------------------
    // フレームが取得できない場合
    // --------------------------------------------------------

    if (
        !Array.isArray(frames) ||
        frames.length === 0
    ) {

        return {

            score: 0,

            value: null,

            measured:
                "取得できませんでした",

            text:
                "着手位置を確認しましょう。",

            candidateCount: 0,

            selectedFrame:
                handFrame,

            likelihood: null

        };

    }


    // --------------------------------------------------------
    // phase.jsから着手候補を取得
    // --------------------------------------------------------

    const candidates =
        getHandCandidates(phase);

    const candidateCount =
        candidates.length;


    // --------------------------------------------------------
    // phase.jsが選択した着手フレーム
    // --------------------------------------------------------

    const baseFrame =
        Number.isFinite(
            Number(handFrame)
        )
            ? Math.round(
                Number(handFrame)
            )
            : Math.floor(
                frames.length * 0.4
            );


    // --------------------------------------------------------
    // 候補を整理
    // --------------------------------------------------------

    const candidateMap =
        new Map();


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const candidate =
            candidates[i];

        const frameNumber =
            getCandidateFrame(
                candidate
            );

        const likelihood =
            getCandidateLikelihood(
                candidate
            );


        if (
            !Number.isFinite(
                frameNumber
            )
        ) {

            continue;

        }


        const frame =
            Math.round(
                frameNumber
            );


        if (
            frame < 0 ||
            frame >= frames.length
        ) {

            continue;

        }


        const existing =
            candidateMap.get(
                frame
            );


        // 同じフレームが複数ある場合、
        // likelihoodが高い方を残す
        if (
            !existing
        ) {

            candidateMap.set(
                frame,
                {

                    frame:
                        frame,

                    likelihood:
                        Number.isFinite(
                            likelihood
                        )
                            ? likelihood
                            : NaN

                }

            );

        }

        else if (
            !Number.isFinite(
                existing.likelihood
            ) &&
            Number.isFinite(
                likelihood
            )
        ) {

            existing.likelihood =
                likelihood;

        }

        else if (
            Number.isFinite(
                likelihood
            ) &&
            Number.isFinite(
                existing.likelihood
            ) &&
            likelihood >
            existing.likelihood
        ) {

            existing.likelihood =
                likelihood;

        }

    }


    // --------------------------------------------------------
    // 候補フレームを昇順に並べる
    // --------------------------------------------------------

    const candidateList =
        Array.from(
            candidateMap.values()
        )
        .sort(
            function(a, b) {

                return (
                    a.frame -
                    b.frame
                );

            }
        );


    // --------------------------------------------------------
    // 候補がない場合
    // --------------------------------------------------------

    if (
        candidateList.length === 0
    ) {

        const fallbackFrame =
            Math.max(
                0,
                Math.min(
                    frames.length - 1,
                    baseFrame
                )
            );


        const fallback =
            getFrame(
                frames,
                fallbackFrame
            );


        const fallbackMeasured =
            getHandMeasuredValue(
                fallback
            );


        if (
            !Number.isFinite(
                fallbackMeasured
            )
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
                    fallbackFrame,

                likelihood:
                    null

            };

        }


        return {

            score: 0,

            value:
                round3(
                    fallbackMeasured
                ),

            measured:
                round3(
                    fallbackMeasured
                ),

            text:
                "着手位置を確認しましょう。",

            candidateCount:
                candidateCount,

            selectedFrame:
                fallbackFrame,

            likelihood:
                null

        };

    }


    // --------------------------------------------------------
    // 連続候補グループを作る
    //
    // 例
    //
    // 10,11,12,13,14
    //
    // → 1つの連続グループ
    //
    // 20,21
    //
    // → 別のグループ
    //
    // --------------------------------------------------------

    const groups = [];

    let currentGroup = [];


    for (
        let i = 0;
        i < candidateList.length;
        i++
    ) {

        const candidate =
            candidateList[i];


        if (
            currentGroup.length === 0
        ) {

            currentGroup.push(
                candidate
            );

            continue;

        }


        const previous =
            currentGroup[
                currentGroup.length - 1
            ];


        const gap =
            candidate.frame -
            previous.frame;


        // 1フレーム飛んでも
        // 同じ動作候補として扱う
        if (
            gap <= 2
        ) {

            currentGroup.push(
                candidate
            );

        }

        else {

            groups.push(
                currentGroup
            );

            currentGroup = [
                candidate
            ];

        }

    }


    if (
        currentGroup.length > 0
    ) {

        groups.push(
            currentGroup
        );

    }


    // --------------------------------------------------------
    // 各グループを評価
    //
    // 評価要素
    //
    // ① 連続フレーム数
    // ② likelihood
    // ③ phase.jsの選択フレームに近いか
    //
    // 「長く続く＋着手らしい＋選択フレームに近い」
    // グループを優先
    // --------------------------------------------------------

    let bestGroup =
        null;

    let bestGroupScore =
        -Infinity;


    for (
        let i = 0;
        i < groups.length;
        i++
    ) {

        const group =
            groups[i];


        if (
            group.length === 0
        ) {

            continue;

        }


        const firstFrame =
            group[0].frame;

        const lastFrame =
            group[
                group.length - 1
            ].frame;


        const centerFrame =
            (
                firstFrame +
                lastFrame
            ) / 2;


        // ----------------------------------------------------
        // グループ内の最大likelihood
        // ----------------------------------------------------

        let maxLikelihood =
            NaN;

        let totalLikelihood = 0;

        let likelihoodCount = 0;


        for (
            let j = 0;
            j < group.length;
            j++
        ) {

            const likelihood =
                group[j].likelihood;


            if (
                Number.isFinite(
                    likelihood
                )
            ) {

                if (
                    !Number.isFinite(
                        maxLikelihood
                    ) ||
                    likelihood >
                    maxLikelihood
                ) {

                    maxLikelihood =
                        likelihood;

                }


                totalLikelihood +=
                    likelihood;

                likelihoodCount++;

            }

        }


        const averageLikelihood =
            likelihoodCount > 0
                ? totalLikelihood /
                  likelihoodCount
                : 5;


        // ----------------------------------------------------
        // 連続性スコア
        //
        // 1フレーム → 1
        // 2フレーム → 2
        // 3フレーム → 3
        // ...
        //
        // 長く続く候補を優先
        // ----------------------------------------------------

        const continuityScore =
            group.length;


        // ----------------------------------------------------
        // phase.jsが選んだフレームとの距離
        // ----------------------------------------------------

        const distanceFromBase =
            Math.abs(
                centerFrame -
                baseFrame
            );


        // ----------------------------------------------------
        // 距離ペナルティ
        // ----------------------------------------------------

        const distancePenalty =
            distanceFromBase *
            0.20;


        // ----------------------------------------------------
        // グループ評価
        //
        // 連続性を強めに評価する
        // ----------------------------------------------------

        const groupScore =
            continuityScore * 1.5 +
            averageLikelihood * 0.5 -
            distancePenalty;


        if (
            groupScore >
            bestGroupScore
        ) {

            bestGroupScore =
                groupScore;

            bestGroup = {

                group:
                    group,

                firstFrame:
                    firstFrame,

                lastFrame:
                    lastFrame,

                centerFrame:
                    centerFrame,

                maxLikelihood:
                    maxLikelihood,

                averageLikelihood:
                    averageLikelihood,

                distanceFromBase:
                    distanceFromBase,

                groupScore:
                    groupScore

            };

        }

    }


    // --------------------------------------------------------
    // グループが決まらなかった場合
    // --------------------------------------------------------

    if (
        !bestGroup
    ) {

        const fallbackFrame =
            Math.max(
                0,
                Math.min(
                    frames.length - 1,
                    baseFrame
                )
            );


        const fallback =
            getFrame(
                frames,
                fallbackFrame
            );


        const fallbackMeasured =
            getHandMeasuredValue(
                fallback
            );


        if (
            !Number.isFinite(
                fallbackMeasured
            )
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
                    fallbackFrame,

                likelihood:
                    null

            };

        }


        return {

            score: 0,

            value:
                round3(
                    fallbackMeasured
                ),

            measured:
                round3(
                    fallbackMeasured
                ),

            text:
                "着手位置を確認しましょう。",

            candidateCount:
                candidateCount,

            selectedFrame:
                fallbackFrame,

            likelihood:
                null

        };

    }


    // --------------------------------------------------------
    // 選択した連続グループ
    // --------------------------------------------------------

    const selectedGroup =
        bestGroup.group;


    // --------------------------------------------------------
    // グループの中央フレーム
    //
    // ただし、
    // phase.jsが選んだbaseFrameが
    // グループ内に入っている場合は、
    // baseFrameを優先する
    //
    // これにより大きくフレームがズレるのを防ぐ
    // --------------------------------------------------------

    let selectedFrame =
        Math.round(
            bestGroup.centerFrame
        );


    const baseIsInsideGroup =
        selectedGroup.some(
            function(candidate) {

                return (
                    candidate.frame ===
                    baseFrame
                );

            }
        );


    if (
        baseIsInsideGroup
    ) {

        selectedFrame =
            baseFrame;

    }


    // --------------------------------------------------------
    // 念のため範囲内に収める
    // --------------------------------------------------------

    selectedFrame =
        Math.max(
            0,
            Math.min(
                frames.length - 1,
                selectedFrame
            )
        );


    // --------------------------------------------------------
    // 選択フレームから実測値を取得
    // --------------------------------------------------------

    let selectedFrameData =
        getFrame(
            frames,
            selectedFrame
        );


    let measured =
        getHandMeasuredValue(
            selectedFrameData
        );


    // --------------------------------------------------------
    // 中央フレームに値がない場合
    // グループ内から最も近い有効フレームを探す
    // --------------------------------------------------------

    if (
        !Number.isFinite(
            measured
        )
    ) {

        let nearestCandidate =
            null;

        let nearestDistance =
            Infinity;


        for (
            let i = 0;
            i < selectedGroup.length;
            i++
        ) {

            const candidate =
                selectedGroup[i];


            const frameData =
                getFrame(
                    frames,
                    candidate.frame
                );


            const candidateMeasured =
                getHandMeasuredValue(
                    frameData
                );


            if (
                !Number.isFinite(
                    candidateMeasured
                )
            ) {

                continue;

            }


            const distance =
                Math.abs(
                    candidate.frame -
                    selectedFrame
                );


            if (
                distance <
                nearestDistance
            ) {

                nearestDistance =
                    distance;

                nearestCandidate = {

                    frame:
                        candidate.frame,

                    measured:
                        candidateMeasured,

                    likelihood:
                        candidate.likelihood

                };

            }

        }


        if (
            nearestCandidate
        ) {

            selectedFrame =
                nearestCandidate.frame;

            measured =
                nearestCandidate.measured;

        }

    }


    // --------------------------------------------------------
    // 実測値が取得できない場合
    // --------------------------------------------------------

    if (
        !Number.isFinite(
            measured
        )
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
                selectedFrame,

            likelihood:
                Number.isFinite(
                    bestGroup.maxLikelihood
                )
                    ? bestGroup.maxLikelihood
                    : null

        };

    }


    // --------------------------------------------------------
    // 選択フレームのlikelihoodを取得
    // --------------------------------------------------------

    let selectedLikelihood =
        NaN;


    for (
        let i = 0;
        i < selectedGroup.length;
        i++
    ) {

        if (
            selectedGroup[i].frame ===
            selectedFrame
        ) {

            selectedLikelihood =
                selectedGroup[i].likelihood;

            break;

        }

    }


    // --------------------------------------------------------
    // 選択フレームにlikelihoodがない場合
    // グループ最大値を使用
    // --------------------------------------------------------

    if (
        !Number.isFinite(
            selectedLikelihood
        )
    ) {

        selectedLikelihood =
            bestGroup.maxLikelihood;

    }


    // --------------------------------------------------------
    // 着手評価
    //
    // likelihoodがある場合
    //
    // 9以上 → 2点
    // 6以上 → 1点
    // 6未満 → 0点
    //
    // likelihoodがない場合は
    // 既存の実測値による評価を使用
    // --------------------------------------------------------

    let score = 0;


    if (
        Number.isFinite(
            selectedLikelihood
        )
    ) {

        if (
            selectedLikelihood >= 9
        ) {

            score = 2;

        }

        else if (
            selectedLikelihood >= 6
        ) {

            score = 1;

        }

        else {

            score = 0;

        }

    }

    else {

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


    // --------------------------------------------------------
    // コメント
    // --------------------------------------------------------

    let text = "";


    if (
        score === 2
    ) {

        text =
            "着手タイミング・着手位置が安定しています。";

    }

    else if (
        score === 1
    ) {

        text =
            "着手位置を確認しましょう。手をつく位置を安定させると、さらによくなります。";

    }

    else {

        text =
            "着手位置を確認しましょう。";

    }


    // --------------------------------------------------------
    // デバッグ情報
    // --------------------------------------------------------

    console.log(
        "========== 着手判定 Ver6.5 =========="
    );

    console.log(
        "phase着手フレーム:",
        baseFrame
    );

    console.log(
        "着手候補数:",
        candidateCount
    );

    console.log(
        "候補グループ数:",
        groups.length
    );

    console.log(
        "選択グループ:",
        bestGroup.firstFrame,
        "～",
        bestGroup.lastFrame
    );

    console.log(
        "選択グループ連続数:",
        selectedGroup.length
    );

    console.log(
        "グループ中央フレーム:",
        Math.round(
            bestGroup.centerFrame
        )
    );

    console.log(
        "選択着手フレーム:",
        selectedFrame
    );

    console.log(
        "着手実測値:",
        measured
    );

    console.log(
        "選択likelihood:",
        Number.isFinite(
            selectedLikelihood
        )
            ? selectedLikelihood
            : null
    );

    console.log(
        "平均likelihood:",
        Number.isFinite(
            bestGroup.averageLikelihood
        )
            ? bestGroup.averageLikelihood
            : null
    );

    console.log(
        "連続性スコア:",
        selectedGroup.length
    );

    console.log(
        "着手点:",
        score
    );


    // --------------------------------------------------------
    // 結果を返す
    // --------------------------------------------------------

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

        candidateCount:
            candidateCount,

        selectedFrame:
            selectedFrame,

        likelihood:
            Number.isFinite(
                selectedLikelihood
            )
                ? selectedLikelihood
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

// ============================================================
// 着地判定 Ver6.3.2
// 着地判定だけ改良
//
// 改良内容
// ・着地フレーム周辺を複数フレーム確認
// ・1フレームだけの異常値に引っ張られにくくする
// ・中央値を利用して安定性を評価
// ・他4項目の採点ロジックは変更しない
// ============================================================

function calculateLandingScore(
    frames,
    frameIndex
) {

    // ========================================================
    // 基本チェック
    // ========================================================

    if (
        !Array.isArray(frames) ||
        frames.length === 0
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


    // ========================================================
    // 着地フレームを安全に取得
    // ========================================================

    const landingFrame =
        safeFrameIndex(
            frameIndex,
            frames.length - 1,
            frames.length - 1
        );


    // ========================================================
    // 着地周辺のフレームを取得
    //
    // 着地直前2フレーム
    // 着地フレーム
    // 着地直後1フレーム
    //
    // 合計4フレーム
    // ========================================================

    const start =
        Math.max(
            0,
            landingFrame - 2
        );


    const end =
        Math.min(
            frames.length - 1,
            landingFrame + 1
        );


    const values = [];


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            frames[i];


        if (!frame) {

            continue;

        }


        // ----------------------------------------------------
        // まずフレームに保存された着地実測値を確認
        // ----------------------------------------------------

        const directValues = [

            frame.landingMeasured,

            frame.landingValue,

            frame.landingDifference,

            frame.landingDiff

        ];


        let found = false;


        for (
            let j = 0;
            j < directValues.length;
            j++
        ) {

            const value =
                Number(
                    directValues[j]
                );


            if (
                Number.isFinite(value)
            ) {

                values.push(
                    Math.abs(value)
                );

                found = true;

                break;

            }

        }


        // ----------------------------------------------------
        // 保存値がない場合は左右足の距離を計算
        // ----------------------------------------------------

        if (found) {

            continue;

        }


        const landmarks =
            getLandmarks(
                frame
            );


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


        const leftVisibility =
            left.visibility !== undefined
                ? Number(
                    left.visibility
                )
                : 1;


        const rightVisibility =
            right.visibility !== undefined
                ? Number(
                    right.visibility
                )
                : 1;


        // 骨格認識が低いフレームは除外
        if (
            leftVisibility < 0.45 ||
            rightVisibility < 0.45
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
            Number.isFinite(
                distance
            )
        ) {

            values.push(
                distance
            );

        }

    }


    // ========================================================
    // データなし
    // ========================================================

    if (
        values.length === 0
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


    // ========================================================
    // 中央値を計算
    //
    // 1フレームだけ極端な値になっても
    // 判定全体が大きく変わりにくい
    // ========================================================

    const sortedValues =
        [...values].sort(
            (a, b) => a - b
        );


    let measured;


    const middle =
        Math.floor(
            sortedValues.length / 2
        );


    if (
        sortedValues.length % 2 === 0
    ) {

        measured =
            (
                sortedValues[middle - 1] +
                sortedValues[middle]
            ) / 2;

    }

    else {

        measured =
            sortedValues[middle];

    }


    // ========================================================
    // 着地評価
    //
    // 現在の基準を維持
    //
    // 0.05以下       → 2点
    // 0.05～0.10     → 1点
    // 0.10超         → 0点
    // ========================================================

    let score = 0;

    let text = "";


    if (
        measured <= 0.05
    ) {

        score = 2;

        text =
            "着地が安定しています。";

    }

    else if (
        measured <= 0.10
    ) {

        score = 1;

        text =
            "着地できています。両足をそろえると、さらに安定します。";

    }

    else {

        score = 0;

        text =
            "着地では両足を安定させることを意識しましょう。";

    }


    // ========================================================
    // 診断情報
    // ========================================================

    console.log(
        "========== 着地判定 Ver6.3.2 =========="
    );

    console.log(
        "phase着地フレーム:",
        frameIndex
    );

    console.log(
        "着地評価フレーム範囲:",
        start,
        "～",
        end
    );

    console.log(
        "取得できた着地値:",
        values
    );

    console.log(
        "着地候補値の中央値:",
        measured
    );

    console.log(
        "着地点:",
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
            "0.10より大きい",

        threshold1:
            "0.05より大きく0.10以下",

        threshold2:
            "0.05以下",

        landingFrame:
            landingFrame,

        candidateCount:
            values.length

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