// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.6
// 着手判定 改良版
//
// Ver6.6 改良内容
// ・候補を厳しく絞りすぎない
// ・着手前後の変化を総合評価
// ・急変だけで着手を決定しない
// ・候補を広く残して順位付け
// ・成功①・成功②・普通の比較用データを維持
// ・score.js / app.js との互換性を維持
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

function phaseGetFrameNumber(
    frame,
    index
) {

    if (
        frame &&
        Number.isFinite(
            Number(frame.frame)
        )
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

    if (
        !left ||
        !right
    ) {

        return null;

    }

    return {

        x:
            (
                left.x +
                right.x
            ) / 2,

        y:
            (
                left.y +
                right.y
            ) / 2

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

        const shoulderWidth =
            Math.abs(
                leftShoulder.x -
                rightShoulder.x
            );

        if (
            Number.isFinite(
                shoulderWidth
            )
        ) {

            values.push(
                shoulderWidth
            );

        }

    }


    if (
        leftHip &&
        rightHip
    ) {

        const hipWidth =
            Math.abs(
                leftHip.x -
                rightHip.x
            );

        if (
            Number.isFinite(
                hipWidth
            )
        ) {

            values.push(
                hipWidth
            );

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
        result <= 0.01
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

    if (
        !left ||
        !right
    ) {

        return null;

    }

    return {

        x:
            (
                left.x +
                right.x
            ) / 2,

        y:
            (
                left.y +
                right.y
            ) / 2

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

    if (
        !left ||
        !right
    ) {

        return null;

    }

    return {

        x:
            (
                left.x +
                right.x
            ) / 2,

        y:
            (
                left.y +
                right.y
            ) / 2

    };

}


// ==================================================
// 手のデータ作成
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

        if (
            !frames[i]
        ) {

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


        // 手と腰の水平距離
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
// 着手候補検出 Ver6.6
//
// ポイント
//
// ① 候補を広く残す
// ② 手の位置
// ③ 手の移動
// ④ 移動速度の変化
// ⑤ 前後の安定
// ⑥ 腰との位置関係
//
// を総合評価する
// ==================================================

function phaseFindHandCandidates(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const candidates = [];


    // ------------------------------------------------
    // 探索範囲
    // ------------------------------------------------

    let start =
        Math.max(
            0,
            takeOffIndex
        );

    let end =
        Math.min(
            frames.length - 1,
            highestHipIndex
        );


    // 範囲が狭すぎる場合
    if (
        end - start < 8
    ) {

        start = 0;

        end =
            frames.length - 1;

    }


    const handData =
        phaseBuildHandData(
            frames,
            start,
            end
        );


    if (
        handData.length < 5
    ) {

        return candidates;

    }


    // ------------------------------------------------
    // 候補を作る
    //
    // 今回は「急変したフレーム」だけに限定しない
    // ------------------------------------------------

    for (
        let i = 2;
        i < handData.length - 2;
        i++
    ) {

        const before2 =
            handData[i - 2];

        const before1 =
            handData[i - 1];

        const current =
            handData[i];

        const after1 =
            handData[i + 1];

        const after2 =
            handData[i + 2];


        // ============================================
        // 手の移動量
        // ============================================

        const moveBefore =
            Math.abs(
                current.handX -
                before1.handX
            );


        const moveAfter =
            Math.abs(
                after1.handX -
                current.handX
            );


        // ============================================
        // さらに前の移動
        // ============================================

        const moveBefore2 =
            Math.abs(
                before1.handX -
                before2.handX
            );


        // ============================================
        // さらに後の移動
        // ============================================

        const moveAfter2 =
            Math.abs(
                after2.handX -
                after1.handX
            );


        // ============================================
        // 移動速度の変化
        // ============================================

        const speedChange =
            Math.abs(
                moveBefore -
                moveAfter
            );


        // ============================================
        // 前後の平均移動
        // ============================================

        const averageMovement =
            (
                moveBefore2 +
                moveBefore +
                moveAfter +
                moveAfter2
            ) / 4;


        // ============================================
        // 着手前後の変化
        // ============================================

        const eventChange =
            Math.abs(
                moveBefore -
                moveAfter2
            );


        // ============================================
        // 着手後の安定性
        // ============================================

        const stability =
            (
                moveAfter +
                moveAfter2
            ) / 2;


        // ============================================
        // 手と腰の距離
        // ============================================

        const distance =
            current.distance;


        // ============================================
        // スコア
        // ============================================

        let score = 0;


        // --------------------------------------------
        // 手の移動
        // --------------------------------------------

        score +=
            averageMovement * 8;


        // --------------------------------------------
        // 着手前後の速度変化
        // --------------------------------------------

        score +=
            speedChange * 5;


        // --------------------------------------------
        // イベント変化
        // --------------------------------------------

        score +=
            eventChange * 3;


        // --------------------------------------------
        // 手が腰より前にある
        // --------------------------------------------

        score +=
            Math.min(
                distance,
                1.5
            ) * 0.5;


        // --------------------------------------------
        // 極端に動かない候補を減点
        // --------------------------------------------

        if (
            averageMovement < 0.002
        ) {

            score -= 0.5;

        }


        // --------------------------------------------
        // 着手後に極端に動く候補を減点
        // --------------------------------------------

        if (
            stability > 0.15
        ) {

            score -=
                stability * 1.5;

        }


        // --------------------------------------------
        // 候補登録
        // --------------------------------------------

        candidates.push({

            index:
                current.index,

            frame:
                current.frame,

            handX:
                current.handX,

            handY:
                current.handY,

            distance:
                distance,

            moveBefore:
                moveBefore,

            moveAfter:
                moveAfter,

            speedChange:
                speedChange,

            eventChange:
                eventChange,

            stability:
                stability,

            averageMovement:
                averageMovement,

            score:
                score

        });

    }


    // ==================================================
    // 候補数を確保
    //
    // Ver6.5では1候補になったため、
    // Ver6.6では上位候補を最低限残す。
    // ==================================================

    candidates.sort(
        (a, b) =>
            b.score -
            a.score
    );


    // ==================================================
    // 上位候補数
    //
    // 最大30候補
    // 最低3候補
    // ==================================================

    const maxCandidates =
        Math.min(
            30,
            candidates.length
        );


    const selectedCandidates =
        candidates.slice(
            0,
            maxCandidates
        );


    // ==================================================
    // フレーム順に戻す
    // ==================================================

    selectedCandidates.sort(
        (a, b) =>
            a.index -
            b.index
    );


    return selectedCandidates;

}


// ==================================================
// 着手選択
//
// 「最高スコアだけ」ではなく、
// 前後のまとまりも確認する
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


    // ------------------------------------------------
    // 候補の中でスコアが最大
    // ------------------------------------------------

    let best =
        candidates[0];


    for (
        let i = 1;
        i < candidates.length;
        i++
    ) {

        const candidate =
            candidates[i];


        // --------------------------------------------
        // 基本はイベントスコア
        // --------------------------------------------

        if (
            candidate.score >
            best.score
        ) {

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
        "phase.js Ver6.6 起動"
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
            "phase.js: framesが配列ではありません"
        );

        return null;

    }


    console.log(
        "phase.js フレーム数:",
        frames.length
    );


    if (
        frames.length < 20
    ) {

        console.error(
            "phase.js: フレーム不足"
        );

        return null;

    }


    // ==================================================
    // 最高点検出
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
    // 踏切検出
    // ==================================================

    let takeOffIndex = 0;

    let largestFootMovement = 0;


    for (
        let i = 1;
        i < frames.length;
        i++
    ) {

        const previous =
            phaseGetFootCenter(
                frames[i - 1]
            );

        const current =
            phaseGetFootCenter(
                frames[i]
            );


        if (
            !previous ||
            !current
        ) {

            continue;

        }


        const movement =
            Math.abs(
                current.y -
                previous.y
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
        "------------------------------------"
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


    let handContactIndex = 0;


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


        // ------------------------------------------
        // 着手デバッグ
        // ------------------------------------------

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


        // ------------------------------------------
        // 候補一覧
        // ------------------------------------------

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

                    eventChange:
                        Number(
                            candidate.eventChange.toFixed(4)
                        ),

                    stability:
                        Number(
                            candidate.stability.toFixed(4)
                        ),

                    averageMovement:
                        Number(
                            candidate.averageMovement.toFixed(4)
                        ),

                    score:
                        Number(
                            candidate.score.toFixed(4)
                        )

                })
            )

    };


    // ==================================================
    // コンソール表示
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.6 結果"
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
    "phase.js Ver6.6 読み込み成功"
);