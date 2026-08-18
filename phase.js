// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.4
// 着手検出 改良版
//
// 改良ポイント
// ・手の移動量最大だけでは着手を決めない
// ・踏切後～最高点の範囲を探索
// ・手の前方移動
// ・手の位置変化
// ・着手後の安定
//   を組み合わせて着手候補を評価
// ==================================================


// ==================================================
// ランドマーク取得
// ==================================================

function phaseGetPoint(frame, index) {

    if (!frame) {
        return null;
    }

    if (Array.isArray(frame.landmarks)) {

        const p = frame.landmarks[index];

        if (
            p &&
            Number.isFinite(Number(p.x)) &&
            Number.isFinite(Number(p.y))
        ) {
            return p;
        }
    }

    if (Array.isArray(frame.poseLandmarks)) {

        const p = frame.poseLandmarks[index];

        if (
            p &&
            Number.isFinite(Number(p.x)) &&
            Number.isFinite(Number(p.y))
        ) {
            return p;
        }
    }

    if (Array.isArray(frame.pose)) {

        const p = frame.pose[index];

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
// 足の中心
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
// 着手候補作成
//
// 踏切後～最高点までを調べる
// ==================================================

function phaseFindHandCandidates(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const candidates = [];

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

    if (end <= start) {

        start = 0;

        end =
            frames.length - 1;
    }


    // ----------------------------------------------
    // 各フレームの手データを作成
    // ----------------------------------------------

    const handData = [];


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


        // 腰から手までの距離
        const distance =
            Math.abs(
                hand.x -
                hip.x
            ) / scale;


        handData.push({

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


    // ----------------------------------------------
    // 候補を作る
    //
    // 「手の動きが最大」だけではなく、
    // 前後の変化を確認する
    // ----------------------------------------------

    for (
        let i = 1;
        i < handData.length - 1;
        i++
    ) {

        const current =
            handData[i];

        const previous =
            handData[i - 1];

        const next =
            handData[i + 1];


        // 前フレームからの移動
        const previousMovement =
            Math.abs(
                current.handX -
                previous.handX
            );


        // 次フレームへの移動
        const nextMovement =
            Math.abs(
                next.handX -
                current.handX
            );


        // 動きの変化量
        const movementChange =
            Math.abs(
                previousMovement -
                nextMovement
            );


        // 着手後に手が安定したか
        const stability =
            Math.abs(
                nextMovement
            );


        // 手の前方位置
        const forwardPosition =
            current.distance;


        // ------------------------------------------
        // 着手らしさ
        //
        // 前へ動いた
        // ↓
        // 動きが変化
        // ↓
        // 次フレームで少し安定
        // ------------------------------------------

        let score = 0;


        score +=
            previousMovement * 4;


        score +=
            movementChange * 3;


        score +=
            forwardPosition * 0.5;


        score -=
            stability * 2;


        candidates.push({

            index:
                current.index,

            frame:
                current.frame,

            handX:
                current.handX,

            handY:
                current.handY,

            hipX:
                current.hipX,

            hipY:
                current.hipY,

            distance:
                current.distance,

            movement:
                previousMovement,

            movementChange:
                movementChange,

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
        "phase.js Ver6.4 起動"
    );

    console.log(
        "===================================="
    );


    // ==================================================
    // フレーム確認
    // ==================================================

    if (!Array.isArray(frames)) {

        console.error(
            "phase.js: framesが配列ではありません",
            frames
        );

        return null;
    }


    console.log(
        "phase.js フレーム数:",
        frames.length
    );


    if (frames.length < 20) {

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
    // 最も「着手らしい」候補を選ぶ
    // ==================================================

    let selectedCandidate = null;


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


    let handContactIndex = 0;


    if (
        selectedCandidate
    ) {

        handContactIndex =
            selectedCandidate.index;
    }


    console.log(
        "選択着手フレーム:",
        phaseGetFrameNumber(
            frames[handContactIndex],
            handContactIndex
        )
    );


    console.log(
        "選択着手候補:",
        selectedCandidate
    );


    // ==================================================
    // 着地
    // ==================================================

    let landingIndex =
        frames.length - 1;


    // 最後のフレームを着地候補とする
    // 実際の着地判定はscore.js側で行う


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


        // ----------------------------------------------
        // デバッグ情報
        // ----------------------------------------------

        handCandidateCount:
            handCandidates.length,


        selectedHandFrame:
            phaseGetFrameNumber(
                frames[handContactIndex],
                handContactIndex
            ),


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

                    movement:
                        Number(
                            candidate.movement.toFixed(4)
                        ),

                    movementChange:
                        Number(
                            candidate.movementChange.toFixed(4)
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
        "phase.js Ver6.4 結果"
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
    "phase.js Ver6.4 読み込み成功"
);