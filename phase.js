// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.8
// 着手判定・時系列重視版
// ==================================================
//
// Ver6.8 改良内容
//
// ① 踏切直後すぎるフレームを除外
// ② 最高点直前すぎるフレームを除外
// ③ 着手候補を「時系列」で評価
// ④ 手の移動方向を確認
// ⑤ 着手前の移動と着手後の変化を確認
// ⑥ 候補を近いフレームでまとめる
// ⑦ 最初の数フレームを着手としない
// ⑧ 成功①・成功②・普通の比較用データを維持
//
// score.js / app.js との互換性を維持
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
        ) /
        values.length;


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
// 手データ作成
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

        if (!frames[i]) {
            continue;
        }


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
            ) /
            scale;


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
// 踏切検出
// ==================================================

function phaseFindTakeOff(frames) {

    let bestIndex = 0;

    let bestMovement = 0;


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
            bestMovement
        ) {

            bestMovement =
                movement;

            bestIndex =
                i;

        }

    }


    return bestIndex;
}


// ==================================================
// 最高点検出
// ==================================================

function phaseFindHighestHip(frames) {

    let bestIndex = 0;

    let minimumY =
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
            hip.y < minimumY
        ) {

            minimumY =
                hip.y;

            bestIndex =
                i;

        }

    }


    return bestIndex;
}


// ==================================================
// 着手探索範囲
//
// 重要：
//
// 踏切直後は除外
// 最高点直前も除外
//
// 「動作の中央部分」を優先する
// ==================================================

function phaseGetHandSearchRange(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const distance =
        highestHipIndex -
        takeOffIndex;


    let start =
        Math.floor(
            takeOffIndex +
            distance * 0.25
        );


    let end =
        Math.floor(
            takeOffIndex +
            distance * 0.75
        );


    // 最低限の範囲を確保

    if (
        end - start < 8
    ) {

        start =
            takeOffIndex + 2;

        end =
            highestHipIndex - 2;

    }


    start =
        Math.max(
            2,
            start
        );


    end =
        Math.min(
            frames.length - 3,
            end
        );


    return {
        start,
        end
    };
}


// ==================================================
// 着手候補検出
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


    if (
        range.end <= range.start
    ) {

        return candidates;

    }


    const data =
        phaseBuildHandData(
            frames,
            range.start - 2,
            range.end + 2
        );


    if (
        data.length < 7
    ) {

        return candidates;

    }


    // ==================================================
    // 各フレーム評価
    // ==================================================

    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        const current =
            data[i];

        const before2 =
            data[i - 2];

        const before1 =
            data[i - 1];

        const after1 =
            data[i + 1];

        const after2 =
            data[i + 2];


        if (
            current.index <
            range.start
        ) {

            continue;

        }


        if (
            current.index >
            range.end
        ) {

            continue;

        }


        // ==================================================
        // 手の移動
        // ==================================================

        const moveBefore2 =
            current.handX -
            before1.handX;

        const moveBefore1 =
            before1.handX -
            before2.handX;

        const moveAfter1 =
            after1.handX -
            current.handX;

        const moveAfter2 =
            after2.handX -
            after1.handX;


        const absBefore =
            (
                Math.abs(moveBefore2) +
                Math.abs(moveBefore1)
            ) / 2;


        const absAfter =
            (
                Math.abs(moveAfter1) +
                Math.abs(moveAfter2)
            ) / 2;


        // ==================================================
        // 方向
        // ==================================================

        const forwardDirection =
            Math.sign(
                moveBefore2 +
                moveBefore1
            );


        const afterDirection =
            Math.sign(
                moveAfter1 +
                moveAfter2
            );


        // ==================================================
        // 方向変化
        // ==================================================

        let directionChange = 0;


        if (
            forwardDirection !== 0 &&
            afterDirection !== 0 &&
            forwardDirection !==
            afterDirection
        ) {

            directionChange = 1;

        }


        // ==================================================
        // 速度変化
        // ==================================================

        const speedChange =
            Math.abs(
                absBefore -
                absAfter
            );


        // ==================================================
        // 手の位置
        // ==================================================

        const distance =
            current.distance;


        // ==================================================
        // 着手前後のY変化
        // ==================================================

        const yBefore =
            Math.abs(
                current.handY -
                before1.handY
            );


        const yAfter =
            Math.abs(
                after1.handY -
                current.handY
            );


        const verticalChange =
            Math.abs(
                yBefore -
                yAfter
            );


        // ==================================================
        // 着手後安定
        // ==================================================

        const stability =
            (
                Math.abs(moveAfter1) +
                Math.abs(moveAfter2)
            ) / 2;


        // ==================================================
        // フレーム位置
        // ==================================================

        const phaseRatio =
            (
                current.index -
                takeOffIndex
            ) /
            Math.max(
                1,
                highestHipIndex -
                takeOffIndex
            );


        // ==================================================
        // スコア
        // ==================================================

        let score = 0;


        // ------------------------------------------
        // 着手前に手が移動
        // ------------------------------------------

        score +=
            Math.min(
                absBefore * 10,
                3
            );


        // ------------------------------------------
        // 速度変化
        // ------------------------------------------

        score +=
            Math.min(
                speedChange * 12,
                3
            );


        // ------------------------------------------
        // 方向変化
        // ------------------------------------------

        score +=
            directionChange * 1.5;


        // ------------------------------------------
        // 縦方向の変化
        // ------------------------------------------

        score +=
            Math.min(
                verticalChange * 8,
                1.5
            );


        // ------------------------------------------
        // 手と腰の距離
        //
        // 極端に大きい値は評価しない
        // ------------------------------------------

        if (
            distance >= 0.15 &&
            distance <= 1.5
        ) {

            score += 0.5;

        }


        // ------------------------------------------
        // 動作中央を優先
        //
        // 0.25～0.75を中心とする
        // ------------------------------------------

        const centerDistance =
            Math.abs(
                phaseRatio -
                0.5
            );


        score +=
            Math.max(
                0,
                1 -
                centerDistance * 2
            );


        // ------------------------------------------
        // 着手後に安定する
        // ------------------------------------------

        if (
            stability < 0.08
        ) {

            score += 1;

        }
        else if (
            stability > 0.20
        ) {

            score -= 1;

        }


        // ------------------------------------------
        // ほとんど動かない場合
        // ------------------------------------------

        if (
            absBefore < 0.003
        ) {

            score -= 2;

        }


        // ------------------------------------------
        // 極端な位置は減点
        // ------------------------------------------

        if (
            distance > 2.0
        ) {

            score -= 2;

        }


        candidates.push({

            index:
                current.index,

            frame:
                current.frame,

            distance:
                distance,

            moveBefore:
                absBefore,

            moveAfter:
                absAfter,

            speedChange:
                speedChange,

            directionChange:
                directionChange,

            verticalChange:
                verticalChange,

            stability:
                stability,

            phaseRatio:
                phaseRatio,

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
    // 上位候補
    // ==================================================

    const top =
        candidates.slice(
            0,
            Math.min(
                12,
                candidates.length
            )
        );


    // ==================================================
    // 近すぎる候補を整理
    //
    // 同じ動作を何度も候補にしない
    // ==================================================

    const filtered = [];


    for (
        const candidate of top
    ) {

        const tooClose =
            filtered.some(
                existing =>
                    Math.abs(
                        existing.index -
                        candidate.index
                    ) <= 2
            );


        if (
            !tooClose
        ) {

            filtered.push(
                candidate
            );

        }

    }


    // ==================================================
    // フレーム順
    // ==================================================

    filtered.sort(
        (a, b) =>
            a.index -
            b.index
    );


    return filtered;
}


// ==================================================
// 着手選択
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


    let best =
        candidates[0];


    let bestScore =
        -Infinity;


    for (
        const candidate of candidates
    ) {

        let score =
            candidate.score;


        // ==================================================
        // 極端に早いフレームを除外
        // ==================================================

        if (
            candidate.index < 5
        ) {

            score -= 5;

        }


        // ==================================================
        // 極端に遅いフレームを除外
        // ==================================================

        if (
            candidate.phaseRatio > 0.80
        ) {

            score -= 3;

        }


        // ==================================================
        // 着手前後の変化を重視
        // ==================================================

        score +=
            candidate.speedChange * 4;


        score +=
            candidate.verticalChange * 2;


        // ==================================================
        // 良い候補
        // ==================================================

        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            best =
                candidate;

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
        "phase.js Ver6.8 起動"
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


    console.log(
        "踏切内部index:",
        takeOffIndex
    );

    console.log(
        "最高点内部index:",
        highestHipIndex
    );


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
    // 着手選択
    // ==================================================

    const selectedCandidate =
        phaseSelectHandCandidate(
            handCandidates
        );


    let handContactIndex =
        takeOffIndex + 1;


    if (
        selectedCandidate
    ) {

        handContactIndex =
            selectedCandidate.index;

    }


    // ==================================================
    // 着地
    // ==================================================

    const landingIndex =
        frames.length - 1;


    // ==================================================
    // フレーム番号
    // ==================================================

    const takeOffFrame =
        phaseGetFrameNumber(
            frames[takeOffIndex],
            takeOffIndex
        );


    const handContactFrame =
        phaseGetFrameNumber(
            frames[handContactIndex],
            handContactIndex
        );


    const highestHipFrame =
        phaseGetFrameNumber(
            frames[highestHipIndex],
            highestHipIndex
        );


    const landingFrame =
        phaseGetFrameNumber(
            frames[landingIndex],
            landingIndex
        );


    // ==================================================
    // 結果
    // ==================================================

    const result = {

        takeOff:
            takeOffFrame,

        handContact:
            handContactFrame,

        highestHip:
            highestHipFrame,

        landing:
            landingFrame,


        // ==================================================
        // 着手デバッグ
        // ==================================================

        handCandidateCount:
            handCandidates.length,

        selectedHandFrame:
            handContactFrame,

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
        // 探索範囲
        // ==================================================

        handSearchStart:
            phaseGetHandSearchRange(
                frames,
                takeOffIndex,
                highestHipIndex
            ).start,

        handSearchEnd:
            phaseGetHandSearchRange(
                frames,
                takeOffIndex,
                highestHipIndex
            ).end,


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

                    verticalChange:
                        Number(
                            candidate.verticalChange.toFixed(4)
                        ),

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
    // デバッグ表示
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.8 結果"
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
// 公開
// ==================================================

window.detectPhases =
    detectPhases;


console.log(
    "phase.js Ver6.8 読み込み成功"
);