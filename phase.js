// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.5
// 着手イベント検出・改良版
//
// 改良ポイント
// ・手の移動量最大だけで着手を決めない
// ・着手前後の変化を見る
// ・急激な変化の直後を着手候補として評価
// ・候補の前後フレームの安定性も評価
// ・成功①・成功②・普通のデータを考慮
// ・既存のscore.jsとの互換性を維持
// ==================================================


// ==================================================
// 基本関数
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
            return p;
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

        values.push(
            Math.abs(
                Number(leftShoulder.x) -
                Number(rightShoulder.x)
            )
        );
    }

    if (
        leftHip &&
        rightHip
    ) {

        values.push(
            Math.abs(
                Number(leftHip.x) -
                Number(rightHip.x)
            )
        );
    }

    if (values.length === 0) {
        return 0.3;
    }

    const result =
        values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;

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

    if (!left || !right) {
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
// 着手候補検出
//
// 「そのフレームだけ」ではなく、
// 前後3フレームを見る
// ==================================================

function phaseFindHandCandidates(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const candidates = [];

    let start =
        Math.max(
            1,
            takeOffIndex
        );

    let end =
        Math.min(
            frames.length - 2,
            highestHipIndex
        );

    if (
        end <= start
    ) {

        start = 1;

        end =
            frames.length - 2;
    }


    const handData =
        phaseBuildHandData(
            frames,
            start - 1,
            end + 1
        );


    if (
        handData.length < 5
    ) {
        return candidates;
    }


    // ----------------------------------------------
    // 各候補を評価
    // ----------------------------------------------

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


        // ------------------------------------------
        // 前方向への移動
        // ------------------------------------------

        const moveBefore =
            Math.abs(
                current.handX -
                before1.handX
            );


        // ------------------------------------------
        // 着手直後の移動
        // ------------------------------------------

        const moveAfter =
            Math.abs(
                after1.handX -
                current.handX
            );


        // ------------------------------------------
        // 前後の変化
        // ------------------------------------------

        const changeBefore =
            Math.abs(
                before1.handX -
                before2.handX
            );


        const changeAfter =
            Math.abs(
                after2.handX -
                after1.handX
            );


        // ------------------------------------------
        // 着手前後の速度変化
        // ------------------------------------------

        const speedChange =
            Math.abs(
                moveBefore -
                moveAfter
            );


        // ------------------------------------------
        // 着手後の安定性
        // ------------------------------------------

        const stability =
            Math.abs(
                after2.handX -
                after1.handX
            );


        // ------------------------------------------
        // 腰との距離
        // ------------------------------------------

        const distance =
            current.distance;


        // ------------------------------------------
        // 「急変」の強さ
        // ------------------------------------------

        const acceleration =
            Math.abs(
                moveBefore -
                changeBefore
            );


        // ------------------------------------------
        // 着手イベントスコア
        // ------------------------------------------

        let score = 0;


        // 手の動き
        score +=
            moveBefore * 5;


        // 前後の速度変化
        score +=
            speedChange * 4;


        // 急激な変化
        score +=
            acceleration * 3;


        // 手が前方に出ている
        score +=
            Math.min(
                distance,
                2
            ) * 0.4;


        // 着手後に安定している
        score +=
            Math.max(
                0,
                0.15 -
                stability
            ) * 2;


        // ------------------------------------------
        // 明らかな「ただの移動」を少し減点
        // ------------------------------------------

        if (
            moveBefore < 0.005
        ) {

            score -= 1;
        }


        // ------------------------------------------
        // 候補登録
        // ------------------------------------------

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

            acceleration:
                acceleration,

            stability:
                stability,

            score:
                score
        });
    }


    return candidates;
}


// ==================================================
// メイン
// ==================================================

function detectPhases(frames) {

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.5 起動"
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
    //
    // 今回は「イベントスコア最大」
    // ==================================================

    let selectedCandidate =
        null;


    if (
        handCandidates.length > 0
    ) {

        selectedCandidate =
            handCandidates[0];


        for (
            let i = 1;
            i < handCandidates.length;
            i++
        ) {

            const candidate =
                handCandidates[i];


            if (
                candidate.score >
                selectedCandidate.score
            ) {

                selectedCandidate =
                    candidate;
            }
        }
    }


    // ==================================================
    // 着手フレーム
    // ==================================================

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

        selectedHandScore:
            selectedCandidate
                ? Number(
                    selectedCandidate.score.toFixed(4)
                )
                : 0,

        selectedHandDistance:
            selectedCandidate
                ? Number(
                    selectedCandidate.distance.toFixed(3)
                )
                : 0,


        // ------------------------------------------
        // 全候補
        // ------------------------------------------

        handCandidates:
            handCandidates.map(
                candidate => ({

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

                    acceleration:
                        Number(
                            candidate.acceleration.toFixed(4)
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
    // コンソール
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.5 結果"
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
        "選択着手実測値:",
        result.selectedHandDistance
    );

    console.log(
        "選択着手イベントスコア:",
        result.selectedHandScore
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
    "phase.js Ver6.5 読み込み成功"
);