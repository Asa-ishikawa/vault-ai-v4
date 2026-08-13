// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.3
// 動作フェーズ検出・着手候補デバッグ完全版
// ==================================================


// ==================================================
// フレームからランドマークを取得
// ==================================================

function phaseGetPoint(frame, index) {

    if (!frame) {
        return null;
    }


    // ----------------------------------------------
    // landmarks
    // ----------------------------------------------

    if (
        Array.isArray(frame.landmarks)
    ) {

        const p =
            frame.landmarks[index];

        if (
            p &&
            Number.isFinite(Number(p.x)) &&
            Number.isFinite(Number(p.y))
        ) {

            return p;

        }

    }


    // ----------------------------------------------
    // poseLandmarks
    // ----------------------------------------------

    if (
        Array.isArray(frame.poseLandmarks)
    ) {

        const p =
            frame.poseLandmarks[index];

        if (
            p &&
            Number.isFinite(Number(p.x)) &&
            Number.isFinite(Number(p.y))
        ) {

            return p;

        }

    }


    // ----------------------------------------------
    // pose
    // ----------------------------------------------

    if (
        Array.isArray(frame.pose)
    ) {

        const p =
            frame.pose[index];

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

        return Number(
            frame.frame
        );

    }


    return index;

}



// ==================================================
// 腰中心
// ==================================================

function phaseGetHipCenter(frame) {

    const left =
        phaseGetPoint(
            frame,
            23
        );


    const right =
        phaseGetPoint(
            frame,
            24
        );


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



// ==================================================
// 体格スケール
// ==================================================

function phaseGetBodyScale(frame) {

    const leftShoulder =
        phaseGetPoint(
            frame,
            11
        );


    const rightShoulder =
        phaseGetPoint(
            frame,
            12
        );


    const leftHip =
        phaseGetPoint(
            frame,
            23
        );


    const rightHip =
        phaseGetPoint(
            frame,
            24
        );


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
// 着手候補を作る
//
// 今回は「候補が存在するか」を最優先。
// 採点基準はここでは変更しない。
// ==================================================

function phaseFindHandCandidates(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const candidates = [];


    // ----------------------------------------------
    // 探索範囲
    //
    // 踏切～最高点
    // ----------------------------------------------

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


    // ----------------------------------------------
    // 万一、範囲がおかしい場合
    // ----------------------------------------------

    if (
        end <= start
    ) {

        start = 0;

        end =
            frames.length - 1;

    }


    // ----------------------------------------------
    // 全フレームから手首情報を取得
    // ----------------------------------------------

    for (
        let i = start;
        i <= end;
        i++
    ) {

        const frame =
            frames[i];


        const leftWrist =
            phaseGetPoint(
                frame,
                15
            );


        const rightWrist =
            phaseGetPoint(
                frame,
                16
            );


        const hip =
            phaseGetHipCenter(
                frame
            );


        if (
            !leftWrist ||
            !rightWrist ||
            !hip
        ) {

            continue;

        }


        const scale =
            phaseGetBodyScale(
                frame
            );


        if (
            !Number.isFinite(scale) ||
            scale <= 0
        ) {

            continue;

        }


        const handX =
            (
                Number(leftWrist.x) +
                Number(rightWrist.x)
            ) / 2;


        const handY =
            (
                Number(leftWrist.y) +
                Number(rightWrist.y)
            ) / 2;


        const normalizedDistance =
            Math.abs(
                handX -
                hip.x
            ) /
            scale;


        if (
            !Number.isFinite(
                normalizedDistance
            )
        ) {

            continue;

        }


        // ------------------------------------------
        // 前後フレームとの差
        // ------------------------------------------

        let movement = 0;


        if (i > start) {

            const previous =
                frames[i - 1];


            const previousLeft =
                phaseGetPoint(
                    previous,
                    15
                );


            const previousRight =
                phaseGetPoint(
                    previous,
                    16
                );


            if (
                previousLeft &&
                previousRight
            ) {

                const previousX =
                    (
                        Number(
                            previousLeft.x
                        ) +
                        Number(
                            previousRight.x
                        )
                    ) / 2;


                movement =
                    Math.abs(
                        handX -
                        previousX
                    );

            }

        }


        // ------------------------------------------
        // 候補として保存
        // ------------------------------------------

        candidates.push({

            index:
                i,

            frame:
                phaseGetFrameNumber(
                    frame,
                    i
                ),

            handX:
                handX,

            handY:
                handY,

            hipX:
                hip.x,

            hipY:
                hip.y,

            distance:
                normalizedDistance,

            movement:
                movement

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
        "phase.js Ver6.3 起動"
    );

    console.log(
        "detectPhases() 実行"
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
            "phase.js: framesが配列ではありません",
            frames
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
    // ① 腰の最高点
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
            Number.isFinite(
                hip.y
            ) &&
            hip.y < minimumHipY
        ) {

            minimumHipY =
                hip.y;

            highestHipIndex =
                i;

        }

    }



    // ==================================================
    // ② 踏切検出
    // ==================================================

    let takeOffIndex = 0;

    let largestFootMovement = 0;


    for (
        let i = 1;
        i < frames.length;
        i++
    ) {

        const previousLeft =
            phaseGetPoint(
                frames[i - 1],
                27
            );


        const previousRight =
            phaseGetPoint(
                frames[i - 1],
                28
            );


        const currentLeft =
            phaseGetPoint(
                frames[i],
                27
            );


        const currentRight =
            phaseGetPoint(
                frames[i],
                28
            );


        if (
            !previousLeft ||
            !previousRight ||
            !currentLeft ||
            !currentRight
        ) {

            continue;

        }


        const previousY =
            (
                Number(previousLeft.y) +
                Number(previousRight.y)
            ) / 2;


        const currentY =
            (
                Number(currentLeft.y) +
                Number(currentRight.y)
            ) / 2;


        const movement =
            Math.abs(
                currentY -
                previousY
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
    // ③ 着手候補
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

    console.log(
        "着手候補:",
        handCandidates
    );



    // ==================================================
    // ④ 着手フレーム選択
    //
    // 「手の移動量」が最大の候補を基本採用
    // ==================================================

    let handContactIndex = 0;


    if (
        handCandidates.length > 0
    ) {

        let best =
            handCandidates[0];


        for (
            let i = 1;
            i < handCandidates.length;
            i++
        ) {

            const candidate =
                handCandidates[i];


            if (
                candidate.movement >
                best.movement
            ) {

                best =
                    candidate;

            }

        }


        handContactIndex =
            best.index;

    }



    // ==================================================
    // ⑤ 着地
    // ==================================================

    let landingIndex =
        frames.length - 1;



    // ==================================================
    // 着地候補
    // ==================================================

    const landingCandidates = [];


    const landingStart =
        Math.max(
            handContactIndex,
            highestHipIndex
        );


    for (
        let i = landingStart;
        i < frames.length;
        i++
    ) {

        const left =
            phaseGetPoint(
                frames[i],
                27
            );


        const right =
            phaseGetPoint(
                frames[i],
                28
            );


        if (
            !left ||
            !right
        ) {

            continue;

        }


        const footY =
            (
                Number(left.y) +
                Number(right.y)
            ) / 2;


        if (
            Number.isFinite(
                footY
            )
        ) {

            landingCandidates.push({

                index:
                    i,

                frame:
                    phaseGetFrameNumber(
                        frames[i],
                        i
                    ),

                footY:
                    footY

            });

        }

    }


    if (
        landingCandidates.length > 0
    ) {

        landingIndex =
            landingCandidates[
                landingCandidates.length - 1
            ].index;

    }



    // ==================================================
    // ⑥ 結果
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
        // 着手候補データ
        // ----------------------------------------------

        handCandidateCount:
            handCandidates.length,


        selectedHandFrame:
            phaseGetFrameNumber(
                frames[handContactIndex],
                handContactIndex
            ),


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
                        )

                })
            )

    };



    // ==================================================
    // コンソール確認
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.3 結果"
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
    "phase.js Ver6.3 読み込み成功"
);