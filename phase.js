// ==================================================
// 跳び箱AI採点システム
// phase.js Ver7.0
// 着手「連続区間」判定版
// ==================================================
//
// 目的
//
// 単一フレームの数値だけで着手を決めない。
// 「着手らしい動きが続いている区間」を探し、
// その区間の中から代表フレームを1つ選択する。
//
// ==================================================


// ==================================================
// Point取得
// ==================================================

function phaseGetPoint(frame, index) {

    if (!frame) {
        return null;
    }

    const sources = [
        frame.landmarks,
        frame.poseLandmarks,
        frame.pose
    ];

    for (const source of sources) {

        if (!Array.isArray(source)) {
            continue;
        }

        const p = source[index];

        if (
            p &&
            Number.isFinite(Number(p.x)) &&
            Number.isFinite(Number(p.y))
        ) {

            return {
                x: Number(p.x),
                y: Number(p.y)
            };

        }

    }

    return null;
}


// ==================================================
// フレーム番号
// ==================================================

function phaseGetFrameNumber(frame, index) {

    if (
        frame &&
        Number.isFinite(Number(frame.frame))
    ) {

        return Number(frame.frame);

    }

    return index;
}


// ==================================================
// 腰中心
// ==================================================

function phaseGetHipCenter(frame) {

    const left =
        phaseGetPoint(frame, 23);

    const right =
        phaseGetPoint(frame, 24);

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


// ==================================================
// 手中心
// ==================================================

function phaseGetHandCenter(frame) {

    const left =
        phaseGetPoint(frame, 15);

    const right =
        phaseGetPoint(frame, 16);

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


// ==================================================
// 足中心
// ==================================================

function phaseGetFootCenter(frame) {

    const left =
        phaseGetPoint(frame, 27);

    const right =
        phaseGetPoint(frame, 28);

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


// ==================================================
// 体格スケール
// ==================================================

function phaseGetBodyScale(frame) {

    const ls =
        phaseGetPoint(frame, 11);

    const rs =
        phaseGetPoint(frame, 12);

    const lh =
        phaseGetPoint(frame, 23);

    const rh =
        phaseGetPoint(frame, 24);

    const values = [];


    if (ls && rs) {

        const shoulder =
            Math.abs(
                ls.x - rs.x
            );

        if (
            Number.isFinite(shoulder) &&
            shoulder > 0.01
        ) {

            values.push(
                shoulder
            );

        }

    }


    if (lh && rh) {

        const hip =
            Math.abs(
                lh.x - rh.x
            );

        if (
            Number.isFinite(hip) &&
            hip > 0.01
        ) {

            values.push(
                hip
            );

        }

    }


    if (values.length === 0) {

        return 0.3;

    }


    const scale =
        values.reduce(
            (a, b) => a + b,
            0
        ) /
        values.length;


    if (
        !Number.isFinite(scale) ||
        scale <= 0
    ) {

        return 0.3;

    }


    return scale;
}


// ==================================================
// 踏切検出
//
// 「足の高さが大きく変化する場所」を探索
// ==================================================

function phaseFindTakeOff(frames) {

    let bestIndex = 1;
    let bestScore = -Infinity;


    for (
        let i = 2;
        i < frames.length - 2;
        i++
    ) {

        const p0 =
            phaseGetFootCenter(
                frames[i - 2]
            );

        const p1 =
            phaseGetFootCenter(
                frames[i - 1]
            );

        const p2 =
            phaseGetFootCenter(
                frames[i]
            );

        const p3 =
            phaseGetFootCenter(
                frames[i + 1]
            );

        if (
            !p0 ||
            !p1 ||
            !p2 ||
            !p3
        ) {

            continue;

        }


        const before =
            Math.abs(
                p1.y -
                p0.y
            );


        const after =
            Math.abs(
                p3.y -
                p2.y
            );


        const change =
            Math.abs(
                after -
                before
            );


        const score =
            before +
            after +
            change;


        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            bestIndex =
                i;

        }

    }


    return bestIndex;
}


// ==================================================
// 最高点
// ==================================================

function phaseFindHighestHip(frames) {

    let bestIndex = 0;
    let minY = Infinity;


    for (
        let i = 0;
        i < frames.length;
        i++
    ) {

        const hip =
            phaseGetHipCenter(
                frames[i]
            );


        if (!hip) {
            continue;
        }


        if (
            Number.isFinite(hip.y) &&
            hip.y < minY
        ) {

            minY =
                hip.y;

            bestIndex =
                i;

        }

    }


    return bestIndex;
}


// ==================================================
// 着手探索範囲
// ==================================================

function phaseGetHandSearchRange(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    let start =
        Math.floor(
            takeOffIndex +
            (
                highestHipIndex -
                takeOffIndex
            ) * 0.10
        );


    let end =
        Math.floor(
            takeOffIndex +
            (
                highestHipIndex -
                takeOffIndex
            ) * 0.85
        );


    start =
        Math.max(
            1,
            start
        );


    end =
        Math.min(
            frames.length - 2,
            end
        );


    if (
        end <= start
    ) {

        start =
            Math.max(
                1,
                takeOffIndex + 1
            );

        end =
            Math.min(
                frames.length - 2,
                highestHipIndex
            );

    }


    return {
        start,
        end
    };
}


// ==================================================
// 1フレームの着手特徴量
// ==================================================

function phaseAnalyzeHandFrame(
    frames,
    i,
    takeOffIndex,
    highestHipIndex
) {

    if (
        i < 2 ||
        i >= frames.length - 2
    ) {

        return null;

    }


    const current =
        phaseGetHandCenter(
            frames[i]
        );

    const prev1 =
        phaseGetHandCenter(
            frames[i - 1]
        );

    const prev2 =
        phaseGetHandCenter(
            frames[i - 2]
        );

    const next1 =
        phaseGetHandCenter(
            frames[i + 1]
        );

    const next2 =
        phaseGetHandCenter(
            frames[i + 2]
        );

    const hip =
        phaseGetHipCenter(
            frames[i]
        );


    if (
        !current ||
        !prev1 ||
        !prev2 ||
        !next1 ||
        !next2 ||
        !hip
    ) {

        return null;

    }


    const scale =
        phaseGetBodyScale(
            frames[i]
        );


    if (
        !Number.isFinite(scale) ||
        scale <= 0
    ) {

        return null;

    }


    // ==================================================
    // 手と腰の距離
    // ==================================================

    const distance =
        Math.abs(
            current.x -
            hip.x
        ) /
        scale;


    // ==================================================
    // 手のX移動
    // ==================================================

    const v1 =
        current.x -
        prev1.x;

    const v2 =
        prev1.x -
        prev2.x;

    const v3 =
        next1.x -
        current.x;

    const v4 =
        next2.x -
        next1.x;


    const beforeSpeed =
        (
            Math.abs(v1) +
            Math.abs(v2)
        ) / 2;


    const afterSpeed =
        (
            Math.abs(v3) +
            Math.abs(v4)
        ) / 2;


    const speedChange =
        Math.abs(
            beforeSpeed -
            afterSpeed
        );


    // ==================================================
    // Y方向
    // ==================================================

    const yBefore =
        Math.abs(
            current.y -
            prev1.y
        );


    const yAfter =
        Math.abs(
            next1.y -
            current.y
        );


    const verticalChange =
        Math.abs(
            yBefore -
            yAfter
        );


    // ==================================================
    // 前後方向変化
    // ==================================================

    const directionBefore =
        Math.sign(
            v1 +
            v2
        );


    const directionAfter =
        Math.sign(
            v3 +
            v4
        );


    const directionChange =
        (
            directionBefore !== 0 &&
            directionAfter !== 0 &&
            directionBefore !==
            directionAfter
        )
            ? 1
            : 0;


    // ==================================================
    // 着手後の安定
    // ==================================================

    const stability =
        (
            Math.abs(v3) +
            Math.abs(v4)
        ) / 2;


    // ==================================================
    // 動作比率
    // ==================================================

    const denominator =
        Math.max(
            1,
            highestHipIndex -
            takeOffIndex
        );


    const phaseRatio =
        (
            i -
            takeOffIndex
        ) /
        denominator;


    // ==================================================
    // 基本スコア
    // ==================================================

    let score = 0;


    // 手が動いている
    score +=
        Math.min(
            beforeSpeed * 12,
            3
        );


    // 速度変化
    score +=
        Math.min(
            speedChange * 18,
            3
        );


    // 方向変化
    score +=
        directionChange * 2;


    // Y変化
    score +=
        Math.min(
            verticalChange * 10,
            1.5
        );


    // ==================================================
    // 手と腰の距離
    // ==================================================

    if (
        distance >= 0.08 &&
        distance <= 1.80
    ) {

        score += 1;

    }


    // ==================================================
    // 動作中央
    // ==================================================

    const centerDistance =
        Math.abs(
            phaseRatio -
            0.50
        );


    score +=
        Math.max(
            0,
            2 -
            centerDistance * 4
        );


    // ==================================================
    // 着手後の安定
    // ==================================================

    if (
        stability < 0.08
    ) {

        score += 2;

    }
    else if (
        stability < 0.15
    ) {

        score += 1;

    }
    else if (
        stability > 0.35
    ) {

        score -= 1;

    }


    // ==================================================
    // 端を避ける
    // ==================================================

    if (
        phaseRatio < 0.10
    ) {

        score -= 5;

    }


    if (
        phaseRatio > 0.85
    ) {

        score -= 4;

    }


    // ==================================================
    // 極端な値を減点
    // ==================================================

    if (
        distance > 2.0
    ) {

        score -= 4;

    }


    if (
        beforeSpeed < 0.001
    ) {

        score -= 2;

    }


    return {

        index: i,

        frame:
            phaseGetFrameNumber(
                frames[i],
                i
            ),

        distance:
            distance,

        beforeSpeed:
            beforeSpeed,

        afterSpeed:
            afterSpeed,

        speedChange:
            speedChange,

        verticalChange:
            verticalChange,

        directionChange:
            directionChange,

        stability:
            stability,

        phaseRatio:
            phaseRatio,

        score:
            score

    };
}


// ==================================================
// 着手候補作成
//
// 単発ではなく「近いフレームをまとめる」
// ==================================================

function phaseFindHandCandidates(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const range =
        phaseGetHandSearchRange(
            frames,
            takeOffIndex,
            highestHipIndex
        );


    const all = [];


    for (
        let i = range.start;
        i <= range.end;
        i++
    ) {

        const item =
            phaseAnalyzeHandFrame(
                frames,
                i,
                takeOffIndex,
                highestHipIndex
            );


        if (item) {

            all.push(item);

        }

    }


    if (
        all.length === 0
    ) {

        return [];

    }


    // ==================================================
    // 動作スコアの中央値を計算
    // ==================================================

    const scoreValues =
        all
            .map(
                x => x.score
            )
            .sort(
                (a, b) =>
                    a - b
            );


    const median =
        scoreValues[
            Math.floor(
                scoreValues.length / 2
            )
        ];


    // ==================================================
    // 候補条件
    //
    // 絶対値だけでなく、
    // 動画内で比較する。
    // ==================================================

    const threshold =
        Math.max(
            median + 0.8,
            2.0
        );


    const selected =
        all.filter(
            x =>
                x.score >= threshold
        );


    // ==================================================
    // 候補が少なすぎる場合
    //
    // 上位フレームを救済
    // ==================================================

    if (
        selected.length === 0
    ) {

        all.sort(
            (a, b) =>
                b.score -
                a.score
        );


        const rescue =
            all.slice(
                0,
                Math.min(
                    5,
                    all.length
                )
            );


        return rescue.sort(
            (a, b) =>
                a.index -
                b.index
        );

    }


    // ==================================================
    // 連続区間を作る
    // ==================================================

    const sorted =
        selected.sort(
            (a, b) =>
                a.index -
                b.index
        );


    const groups = [];

    let currentGroup = [];


    for (
        const item of sorted
    ) {

        if (
            currentGroup.length === 0
        ) {

            currentGroup.push(
                item
            );

            continue;

        }


        const previous =
            currentGroup[
                currentGroup.length - 1
            ];


        if (
            item.index -
            previous.index <= 2
        ) {

            currentGroup.push(
                item
            );

        }
        else {

            groups.push(
                currentGroup
            );

            currentGroup = [
                item
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


    // ==================================================
    // 各区間を評価
    // ==================================================

    const groupResults =
        groups.map(
            group => {

                const averageScore =
                    group.reduce(
                        (sum, item) =>
                            sum +
                            item.score,
                        0
                    ) /
                    group.length;


                const averageDistance =
                    group.reduce(
                        (sum, item) =>
                            sum +
                            item.distance,
                        0
                    ) /
                    group.length;


                const best =
                    group.reduce(
                        (a, b) =>
                            b.score >
                            a.score
                                ? b
                                : a
                    );


                return {

                    group,

                    start:
                        group[0].index,

                    end:
                        group[
                            group.length - 1
                        ].index,

                    count:
                        group.length,

                    averageScore:
                        averageScore,

                    averageDistance:
                        averageDistance,

                    best:
                        best

                };

            }
        );


    // ==================================================
    // 一番「着手らしい区間」
    // ==================================================

    groupResults.sort(
        (a, b) => {

            const scoreA =
                a.averageScore +
                Math.min(
                    a.count,
                    5
                ) * 0.8;

            const scoreB =
                b.averageScore +
                Math.min(
                    b.count,
                    5
                ) * 0.8;

            return scoreB - scoreA;

        }
    );


    if (
        groupResults.length === 0
    ) {

        return [];

    }


    // ==================================================
    // 最良区間
    // ==================================================

    const bestGroup =
        groupResults[0];


    // ==================================================
    // 区間内の候補
    // ==================================================

    return bestGroup.group;
}


// ==================================================
// 区間から代表フレームを選択
// ==================================================

function phaseSelectBestHand(
    candidates
) {

    if (
        !Array.isArray(candidates) ||
        candidates.length === 0
    ) {

        return null;

    }


    let best =
        null;

    let bestScore =
        -Infinity;


    for (
        const candidate of candidates
    ) {

        let score =
            candidate.score;


        // ==================================================
        // 区間中央を少し優先
        // ==================================================

        const first =
            candidates[0].index;

        const last =
            candidates[
                candidates.length - 1
            ].index;


        const center =
            (
                first +
                last
            ) / 2;


        const distanceFromCenter =
            Math.abs(
                candidate.index -
                center
            );


        score -=
            distanceFromCenter * 0.15;


        // ==================================================
        // 着手後の安定
        // ==================================================

        if (
            candidate.stability < 0.12
        ) {

            score += 1;

        }


        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            best = {

                ...candidate,

                finalScore:
                    score

            };

        }

    }


    return best;
}


// ==================================================
// 候補0の場合の安全な選択
// ==================================================

function phaseFallbackHand(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const range =
        phaseGetHandSearchRange(
            frames,
            takeOffIndex,
            highestHipIndex
        );


    let best =
        null;

    let bestScore =
        -Infinity;


    for (
        let i = range.start;
        i <= range.end;
        i++
    ) {

        const item =
            phaseAnalyzeHandFrame(
                frames,
                i,
                takeOffIndex,
                highestHipIndex
            );


        if (!item) {
            continue;
        }


        // 中央寄り
        const center =
            (
                range.start +
                range.end
            ) / 2;


        const centerPenalty =
            Math.abs(
                i -
                center
            ) * 0.08;


        const score =
            item.score -
            centerPenalty;


        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            best = {

                ...item,

                finalScore:
                    score

            };

        }

    }


    return best;
}


// ==================================================
// メイン
// ==================================================

function detectPhases(frames) {

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver7.0 起動"
    );

    console.log(
        "===================================="
    );


    if (
        !Array.isArray(frames)
    ) {

        console.error(
            "framesが配列ではありません"
        );

        return null;

    }


    if (
        frames.length < 20
    ) {

        console.error(
            "フレーム不足:",
            frames.length
        );

        return null;

    }


    console.log(
        "総フレーム数:",
        frames.length
    );


    // ==================================================
    // 踏切
    // ==================================================

    const takeOffIndex =
        phaseFindTakeOff(
            frames
        );


    // ==================================================
    // 最高点
    // ==================================================

    const highestHipIndex =
        phaseFindHighestHip(
            frames
        );


    // ==================================================
    // 着手候補
    // ==================================================

    let candidates =
        phaseFindHandCandidates(
            frames,
            takeOffIndex,
            highestHipIndex
        );


    console.log(
        "着手候補数:",
        candidates.length
    );


    // ==================================================
    // 最良候補
    // ==================================================

    let best =
        phaseSelectBestHand(
            candidates
        );


    // ==================================================
    // 候補0対策
    // ==================================================

    if (!best) {

        console.warn(
            "通常候補なし。フォールバック探索を実行"
        );


        best =
            phaseFallbackHand(
                frames,
                takeOffIndex,
                highestHipIndex
            );

    }


    // ==================================================
    // それでも見つからない場合
    // ==================================================

    if (!best) {

        console.error(
            "着手フレームを決定できません"
        );

        return null;

    }


    const handContactIndex =
        best.index;


    // ==================================================
    // 着地
    // ==================================================

    const landingIndex =
        frames.length - 1;


    // ==================================================
    // 探索範囲
    // ==================================================

    const range =
        phaseGetHandSearchRange(
            frames,
            takeOffIndex,
            highestHipIndex
        );


    // ==================================================
    // 結果
    // ==================================================

    const result = {

        takeOff:
            phaseGetFrameNumber(
                frames[takeOffIndex],
                takeOffIndex
            ),

        handContact:
            phaseGetFrameNumber(
                frames[handContactIndex],
                handContactIndex
            ),

        highestHip:
            phaseGetFrameNumber(
                frames[highestHipIndex],
                highestHipIndex
            ),

        landing:
            phaseGetFrameNumber(
                frames[landingIndex],
                landingIndex
            ),


        // ==================================================
        // 着手情報
        // ==================================================

        handCandidateCount:
            candidates.length,

        selectedHandFrame:
            phaseGetFrameNumber(
                frames[handContactIndex],
                handContactIndex
            ),

        selectedHandDistance:
            Number(
                best.distance.toFixed(3)
            ),

        selectedHandScore:
            Number(
                best.finalScore.toFixed(4)
            ),


        // ==================================================
        // 探索範囲
        // ==================================================

        handSearchStart:
            phaseGetFrameNumber(
                frames[range.start],
                range.start
            ),

        handSearchEnd:
            phaseGetFrameNumber(
                frames[range.end],
                range.end
            ),


        // ==================================================
        // 候補一覧
        // ==================================================

        handCandidates:
            candidates.map(
                (candidate, index) => ({

                    candidate:
                        index + 1,

                    frame:
                        candidate.frame,

                    distance:
                        Number(
                            candidate.distance.toFixed(3)
                        ),

                    beforeSpeed:
                        Number(
                            candidate.beforeSpeed.toFixed(4)
                        ),

                    afterSpeed:
                        Number(
                            candidate.afterSpeed.toFixed(4)
                        ),

                    speedChange:
                        Number(
                            candidate.speedChange.toFixed(4)
                        ),

                    verticalChange:
                        Number(
                            candidate.verticalChange.toFixed(4)
                        ),

                    directionChange:
                        candidate.directionChange,

                    stability:
                        Number(
                            candidate.stability.toFixed(4)
                        ),

                    phaseRatio:
                        Number(
                            candidate.phaseRatio.toFixed(3)
                        ),

                    score:
                        Number(
                            candidate.score.toFixed(4)
                        )

                })
            )

    };


    // ==================================================
    // コンソール
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver7.0 結果"
    );

    console.log(
        "踏切:",
        result.takeOff
    );

    console.log(
        "着手:",
        result.handContact
    );

    console.log(
        "最高点:",
        result.highestHip
    );

    console.log(
        "着地:",
        result.landing
    );

    console.log(
        "着手探索範囲:",
        result.handSearchStart,
        "～",
        result.handSearchEnd
    );

    console.log(
        "着手候補数:",
        result.handCandidateCount
    );

    console.log(
        "選択着手フレーム:",
        result.selectedHandFrame
    );

    console.log(
        "着手位置実測値:",
        result.selectedHandDistance
    );

    console.log(
        "着手イベントスコア:",
        result.selectedHandScore
    );


    console.log(
        "---------- 着手候補 ----------"
    );


    result.handCandidates.forEach(
        candidate => {

            console.log(
                "候補" +
                candidate.candidate +
                ":",
                candidate.frame +
                "フレーム",
                "実測値",
                candidate.distance,
                "イベントスコア",
                candidate.score
            );

        }
    );


    console.log(
        "===================================="
    );


    return result;
}


// ==================================================
// phase情報クリア
// ==================================================

function clearPhase() {

    const phaseInfo =
        document.getElementById(
            "phaseInfo"
        );


    if (phaseInfo) {

        phaseInfo.textContent =
            "未解析";

    }

}


// ==================================================
// 公開
// ==================================================

window.detectPhases =
    detectPhases;

window.clearPhase =
    clearPhase;


console.log(
    "phase.js Ver7.0 読み込み成功"
);