// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.7
// 着手判定 改良版
//
// Ver6.7
// ・踏切前の誤候補を除外
// ・最高点後の誤候補を除外
// ・着手探索範囲を動作フェーズで限定
// ・単純な移動量最大を使用しない
// ・着手前後の変化を評価
// ・候補を適正数に整理
// ・score.js / app.jsとの互換性維持
// ==================================================


// ==================================================
// 点取得
// ==================================================

function phaseGetPoint(frame, index) {

    if (!frame) return null;

    const sources = [
        frame.landmarks,
        frame.poseLandmarks,
        frame.pose
    ];

    for (const source of sources) {

        if (!Array.isArray(source)) continue;

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
// 体格スケール
// ==================================================

function phaseGetBodyScale(frame) {

    const leftShoulder =
        phaseGetPoint(frame, 11);

    const rightShoulder =
        phaseGetPoint(frame, 12);

    const leftHip =
        phaseGetPoint(frame, 23);

    const rightHip =
        phaseGetPoint(frame, 24);

    const values = [];


    if (
        leftShoulder &&
        rightShoulder
    ) {

        const value =
            Math.abs(
                leftShoulder.x -
                rightShoulder.x
            );

        if (
            Number.isFinite(value)
        ) {

            values.push(value);

        }

    }


    if (
        leftHip &&
        rightHip
    ) {

        const value =
            Math.abs(
                leftHip.x -
                rightHip.x
            );

        if (
            Number.isFinite(value)
        ) {

            values.push(value);

        }

    }


    if (
        values.length === 0
    ) {

        return 0.3;

    }


    const result =
        values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;


    if (
        !Number.isFinite(result) ||
        result < 0.01
    ) {

        return 0.3;

    }


    return result;
}


// ==================================================
// 両手中心
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
// 両足中心
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
// 手データ
// ==================================================

function phaseBuildHandData(
    frames,
    start,
    end
) {

    const data = [];


    for (
        let i = start;
        i <= end;
        i++
    ) {

        const hand =
            phaseGetHandCenter(
                frames[i]
            );

        const hip =
            phaseGetHipCenter(
                frames[i]
            );

        const scale =
            phaseGetBodyScale(
                frames[i]
            );


        if (
            !hand ||
            !hip ||
            !Number.isFinite(scale) ||
            scale <= 0
        ) {

            continue;

        }


        const distance =
            Math.abs(
                hand.x -
                hip.x
            ) / scale;


        data.push({

            index: i,

            frame:
                phaseGetFrameNumber(
                    frames[i],
                    i
                ),

            handX:
                hand.x,

            handY:
                hand.y,

            hipX:
                hip.x,

            hipY:
                hip.y,

            distance:
                distance

        });

    }


    return data;
}


// ==================================================
// 着手探索範囲
//
// 踏切後～最高点までの範囲だけを使う
//
// 前後に少し余裕を持たせる
// ==================================================

function phaseGetHandSearchRange(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const total =
        frames.length;


    let start =
        Math.floor(
            takeOffIndex +
            (highestHipIndex - takeOffIndex)
            * 0.15
        );


    let end =
        Math.floor(
            takeOffIndex +
            (highestHipIndex - takeOffIndex)
            * 0.85
        );


    // 最低限の探索範囲

    if (
        end - start < 8
    ) {

        start =
            Math.max(
                1,
                takeOffIndex + 1
            );

        end =
            Math.min(
                total - 2,
                highestHipIndex
            );

    }


    // 安全範囲

    start =
        Math.max(
            1,
            start
        );


    end =
        Math.min(
            total - 2,
            end
        );


    return {
        start,
        end
    };
}


// ==================================================
// 着手候補検出 Ver6.7
// ==================================================

function phaseFindHandCandidates(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const candidates = [];


    const range =
        phaseGetHandSearchRange(
            frames,
            takeOffIndex,
            highestHipIndex
        );


    console.log(
        "着手探索範囲:",
        range.start,
        "～",
        range.end
    );


    const handData =
        phaseBuildHandData(
            frames,
            range.start - 2,
            range.end + 2
        );


    if (
        handData.length < 5
    ) {

        return candidates;

    }


    // ==================================================
    // 各フレームを評価
    // ==================================================

    for (
        let i = 2;
        i < handData.length - 2;
        i++
    ) {

        const current =
            handData[i];

        const before1 =
            handData[i - 1];

        const before2 =
            handData[i - 2];

        const after1 =
            handData[i + 1];

        const after2 =
            handData[i + 2];


        if (
            current.index < range.start ||
            current.index > range.end
        ) {

            continue;

        }


        // ==================================================
        // 手のX方向移動
        // ==================================================

        const move1 =
            current.handX -
            before1.handX;

        const move2 =
            before1.handX -
            before2.handX;

        const move3 =
            after1.handX -
            current.handX;

        const move4 =
            after2.handX -
            after1.handX;


        // ==================================================
        // 移動量
        // ==================================================

        const absMove1 =
            Math.abs(move1);

        const absMove2 =
            Math.abs(move2);

        const absMove3 =
            Math.abs(move3);

        const absMove4 =
            Math.abs(move4);


        // ==================================================
        // 前後の平均
        // ==================================================

        const beforeMovement =
            (
                absMove2 +
                absMove1
            ) / 2;


        const afterMovement =
            (
                absMove3 +
                absMove4
            ) / 2;


        // ==================================================
        // 速度変化
        // ==================================================

        const speedChange =
            Math.abs(
                beforeMovement -
                afterMovement
            );


        // ==================================================
        // 方向変化
        // ==================================================

        let directionChange = 0;


        if (
            move1 * move3 < 0
        ) {

            directionChange = 1;

        }


        // ==================================================
        // 着手前後の位置変化
        // ==================================================

        const positionChange =
            Math.abs(
                after1.handX -
                before1.handX
            );


        // ==================================================
        // 着手後安定
        // ==================================================

        const stability =
            (
                absMove3 +
                absMove4
            ) / 2;


        // ==================================================
        // 腰との距離
        // ==================================================

        const distance =
            current.distance;


        // ==================================================
        // スコア
        // ==================================================

        let score = 0;


        // 手が動いている
        score +=
            beforeMovement * 8;


        // 着手前後の速度変化
        score +=
            speedChange * 10;


        // 方向変化
        score +=
            directionChange * 0.8;


        // 手が前に出ている
        score +=
            Math.min(
                distance,
                1.5
            ) * 0.25;


        // 着手後の安定
        score +=
            Math.max(
                0,
                0.12 - stability
            ) * 3;


        // 動きがほとんどない場合
        if (
            beforeMovement < 0.003
        ) {

            score -= 1;

        }


        // 着手後も激しく動く場合
        if (
            stability > 0.12
        ) {

            score -=
                stability * 2;

        }


        candidates.push({

            index:
                current.index,

            frame:
                current.frame,

            distance:
                distance,

            moveBefore:
                beforeMovement,

            moveAfter:
                afterMovement,

            speedChange:
                speedChange,

            directionChange:
                directionChange,

            positionChange:
                positionChange,

            stability:
                stability,

            score:
                score

        });

    }


    // ==================================================
    // スコア順
    // ==================================================

    candidates.sort(
        (a, b) =>
            b.score -
            a.score
    );


    // ==================================================
    // 上位候補を残す
    //
    // 最大15候補
    // ==================================================

    const limited =
        candidates.slice(
            0,
            Math.min(
                15,
                candidates.length
            )
        );


    // ==================================================
    // フレーム順に戻す
    // ==================================================

    limited.sort(
        (a, b) =>
            a.index -
            b.index
    );


    return limited;
}


// ==================================================
// 着手選択
//
// 「最も高いスコア」だけではなく、
// 前後の候補との距離も確認
// ==================================================

function phaseSelectHandCandidate(
    candidates
) {

    if (
        !Array.isArray(candidates) ||
        candidates.length === 0
    ) {

        return null;

    }


    // ==================================================
    // 候補を再評価
    // ==================================================

    const scored = [];


    candidates.forEach(
        candidate => {

            let finalScore =
                candidate.score;


            // ------------------------------------------
            // 動画の最初・最後を避ける
            // ------------------------------------------

            if (
                candidate.index < 3
            ) {

                finalScore -= 5;

            }


            // ------------------------------------------
            // 着手候補同士の孤立を避ける
            // ------------------------------------------

            const nearby =
                candidates.filter(
                    other =>
                        Math.abs(
                            other.index -
                            candidate.index
                        ) <= 2
                );


            if (
                nearby.length >= 2
            ) {

                finalScore += 1;

            }


            scored.push({

                candidate:
                    candidate,

                finalScore:
                    finalScore

            });

        }
    );


    // ==================================================
    // 最大を選択
    // ==================================================

    scored.sort(
        (a, b) =>
            b.finalScore -
            a.finalScore
    );


    return scored[0].candidate;
}


// ==================================================
// メイン
// ==================================================

function detectPhases(frames) {

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.7 起動"
    );

    console.log(
        "===================================="
    );


    // ==================================================
    // フレーム確認
    // ==================================================

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
    // 最高点
    // ==================================================

    let highestHipIndex = 0;

    let minimumHipY =
        Infinity;


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
            hip.y < minimumHipY
        ) {

            minimumHipY =
                hip.y;

            highestHipIndex =
                i;

        }

    }


    // ==================================================
    // 踏切
    // ==================================================

    let takeOffIndex = 0;

    let largestFootMovement = 0;


    for (
        let i = 1;
        i < frames.length;
        i++
    ) {

        const before =
            phaseGetFootCenter(
                frames[i - 1]
            );

        const current =
            phaseGetFootCenter(
                frames[i]
            );


        if (
            !before ||
            !current
        ) {

            continue;

        }


        const movement =
            Math.abs(
                current.y -
                before.y
            );


        if (
            movement >
            largestFootMovement
        ) {

            largestFootMovement =
                movement;

            takeOffIndex =
                i;

        }

    }


    // ==================================================
    // 着手候補
    // ==================================================

    const handCandidates =
        phaseFindHandCandidates(
            frames,
            takeOffIndex,
            highestHipIndex
        );


    console.log(
        "着手候補数:",
        handCandidates.length
    );


    // ==================================================
    // 着手
    // ==================================================

    const selectedCandidate =
        phaseSelectHandCandidate(
            handCandidates
        );


    let handContactIndex =
        takeOffIndex;


    if (
        selectedCandidate
    ) {

        handContactIndex =
            selectedCandidate.index;

    }


    const selectedFrame =
        phaseGetFrameNumber(
            frames[handContactIndex],
            handContactIndex
        );


    // ==================================================
    // 着地
    // ==================================================

    const landingIndex =
        frames.length - 1;


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
            selectedFrame,

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
        // 着手デバッグ
        // ==================================================

        handCandidateCount:
            handCandidates.length,

        selectedHandFrame:
            selectedFrame,

        selectedHandDistance:
            selectedCandidate
                ? Number(
                    selectedCandidate.distance.toFixed(3)
                )
                : 0,

        selectedHandScore:
            selectedCandidate
                ? Number(
                    selectedCandidate.score.toFixed(4)
                )
                : 0,


        // ==================================================
        // 候補一覧
        // ==================================================

        handCandidates:
            handCandidates.map(
                (candidate, index) => ({

                    candidate:
                        index + 1,

                    frame:
                        candidate.frame,

                    index:
                        candidate.index,

                    distance:
                        Number(
                            candidate.distance.toFixed(3)
                        ),

                    moveBefore:
                        Number(
                            candidate.moveBefore.toFixed(4)
                        ),

                    moveAfter:
                        Number(
                            candidate.moveAfter.toFixed(4)
                        ),

                    speedChange:
                        Number(
                            candidate.speedChange.toFixed(4)
                        ),

                    directionChange:
                        candidate.directionChange,

                    positionChange:
                        Number(
                            candidate.positionChange.toFixed(4)
                        ),

                    stability:
                        Number(
                            candidate.stability.toFixed(4)
                        ),

                    score:
                        Number(
                            candidate.score.toFixed(4)
                        )

                })
            )

    };


    // ==================================================
    // デバッグ
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.7 結果"
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
                "スコア",
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
// 公開
// ==================================================

window.detectPhases =
    detectPhases;


console.log(
    "phase.js Ver6.7 読み込み成功"
);