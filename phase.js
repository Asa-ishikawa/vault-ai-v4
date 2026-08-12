// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.1
// 動作フェーズ検出・着手候補確認版
// ==================================================


// ==================================================
// メイン
// ==================================================

function detectPhases(frames) {

    console.log("====================================");
    console.log("phase.js Ver6.1");
    console.log("動作フェーズ検出開始");
    console.log("====================================");


    // ==================================================
    // データ確認
    // ==================================================

    if (
        !Array.isArray(frames) ||
        frames.length < 20
    ) {

        console.log(
            "phase: フレーム不足",
            frames
        );

        return null;
    }


    console.log(
        "総フレーム数:",
        frames.length
    );



    // ==================================================
    // フレーム番号取得
    // ==================================================

    function getFrameNumber(frame, index) {

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
    // 座標取得
    // ==================================================

    function getPoint(frame, index) {

        if (!frame) {
            return null;
        }


        // landmarks形式
        if (
            Array.isArray(
                frame.landmarks
            )
        ) {

            const p =
                frame.landmarks[index];

            if (
                p &&
                Number.isFinite(p.x) &&
                Number.isFinite(p.y)
            ) {

                return p;

            }

        }


        // poseLandmarks形式
        if (
            Array.isArray(
                frame.poseLandmarks
            )
        ) {

            const p =
                frame.poseLandmarks[index];

            if (
                p &&
                Number.isFinite(p.x) &&
                Number.isFinite(p.y)
            ) {

                return p;

            }

        }


        // pose形式
        if (
            Array.isArray(
                frame.pose
            )
        ) {

            const p =
                frame.pose[index];

            if (
                p &&
                Number.isFinite(p.x) &&
                Number.isFinite(p.y)
            ) {

                return p;

            }

        }


        return null;
    }



    // ==================================================
    // 左右腰の中心
    // ==================================================

    function getHipCenter(frame) {

        const left =
            getPoint(
                frame,
                23
            );


        const right =
            getPoint(
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
    //
    // 肩幅＋腰幅を利用
    // ==================================================

    function getBodyScale(frame) {

        const leftShoulder =
            getPoint(
                frame,
                11
            );


        const rightShoulder =
            getPoint(
                frame,
                12
            );


        const leftHip =
            getPoint(
                frame,
                23
            );


        const rightHip =
            getPoint(
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
                    leftShoulder.x -
                    rightShoulder.x
                )
            );

        }


        if (
            leftHip &&
            rightHip
        ) {

            values.push(
                Math.abs(
                    leftHip.x -
                    rightHip.x
                )
            );

        }


        if (
            values.length === 0
        ) {

            return 0.3;

        }


        const average =
            values.reduce(
                (a, b) => a + b,
                0
            ) /
            values.length;


        if (
            !Number.isFinite(
                average
            ) ||
            average <= 0.01
        ) {

            return 0.3;

        }


        return average;

    }



    // ==================================================
    // ① 腰の最高点
    //
    // MediaPipeではYが小さいほど上
    // ==================================================

    let highestHip = 0;

    let minHipY = Infinity;


    frames.forEach(
        (frame, index) => {

            const hip =
                getHipCenter(
                    frame
                );


            if (!hip) {
                return;
            }


            if (
                Number.isFinite(
                    hip.y
                ) &&
                hip.y < minHipY
            ) {

                minHipY =
                    hip.y;

                highestHip =
                    index;

            }

        }
    );



    // ==================================================
    // ② 踏切候補
    //
    // 足首Yが大きく変化する前後を確認
    // ==================================================

    let takeOff = 0;

    let maxFootChange = 0;


    for (
        let i = 1;
        i < frames.length;
        i++
    ) {

        const prevLeft =
            getPoint(
                frames[i - 1],
                27
            );


        const prevRight =
            getPoint(
                frames[i - 1],
                28
            );


        const left =
            getPoint(
                frames[i],
                27
            );


        const right =
            getPoint(
                frames[i],
                28
            );


        if (
            !prevLeft ||
            !prevRight ||
            !left ||
            !right
        ) {

            continue;

        }


        const previousY =
            (
                prevLeft.y +
                prevRight.y
            ) / 2;


        const currentY =
            (
                left.y +
                right.y
            ) / 2;


        const change =
            Math.abs(
                currentY -
                previousY
            );


        if (
            change >
            maxFootChange
        ) {

            maxFootChange =
                change;

            takeOff =
                i;

        }

    }



    // ==================================================
    // ③ 着手候補検出
    //
    // 手首Xの「前方への移動」を利用
    //
    // 今回は候補をすべて保存する
    // ==================================================

    const handCandidates = [];


    for (
        let i = 1;
        i < frames.length;
        i++
    ) {

        const frame =
            frames[i];


        const previous =
            frames[i - 1];


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


        const previousLeft =
            getPoint(
                previous,
                15
            );


        const previousRight =
            getPoint(
                previous,
                16
            );


        if (
            !left ||
            !right ||
            !previousLeft ||
            !previousRight
        ) {

            continue;

        }


        const handX =
            (
                left.x +
                right.x
            ) / 2;


        const previousHandX =
            (
                previousLeft.x +
                previousRight.x
            ) / 2;


        const movement =
            Math.abs(
                handX -
                previousHandX
            );


        const hip =
            getHipCenter(
                frame
            );


        if (!hip) {
            continue;
        }


        const scale =
            getBodyScale(
                frame
            );


        if (
            !Number.isFinite(scale) ||
            scale <= 0
        ) {

            continue;

        }


        const distance =
            Math.abs(
                handX -
                hip.x
            ) /
            scale;


        if (
            Number.isFinite(
                distance
            )
        ) {

            handCandidates.push({

                index:
                    i,

                frame:
                    getFrameNumber(
                        frame,
                        i
                    ),

                movement:
                    movement,

                distance:
                    distance,

                handX:
                    handX,

                hipX:
                    hip.x

            });

        }

    }



    // ==================================================
    // 着手候補を「踏切後～最高点前」に限定
    //
    // 開脚跳びでは
    // 踏切 → 着手 → 最高点
    // の順になるため
    // ==================================================

    const validHandCandidates =
        handCandidates.filter(
            candidate => {

                return (
                    candidate.index >=
                    takeOff
                    &&
                    candidate.index <=
                    highestHip
                );

            }
        );



    // ==================================================
    // 候補がない場合
    // 広い範囲から再検索
    // ==================================================

    let finalHandCandidates =
        validHandCandidates;


    if (
        finalHandCandidates.length === 0
    ) {

        finalHandCandidates =
            handCandidates;

    }



    // ==================================================
    // 着手フレーム決定
    //
    // 「手が最も前に出た瞬間」を基本とする
    //
    // X座標の最大値ではなく、
    // 踏切後の手の移動量を考慮
    // ==================================================

    let handContact = 0;


    if (
        finalHandCandidates.length > 0
    ) {

        let best =
            finalHandCandidates[0];


        finalHandCandidates.forEach(
            candidate => {

                // 手の前方移動量を優先
                if (
                    candidate.movement >
                    best.movement
                ) {

                    best =
                        candidate;

                }

            }
        );


        handContact =
            best.index;

    }



    // ==================================================
    // ④ 着地
    //
    // 最後の有効フレームを基本とする
    // ==================================================

    let landing =
        frames.length - 1;



    // ==================================================
    // 着地候補を探す
    //
    // 足首が下方向へ戻り、
    // その後ある程度安定する場所
    // ==================================================

    const landingCandidates = [];


    for (
        let i = Math.max(
            highestHip,
            handContact
        );
        i < frames.length;
        i++
    ) {

        const left =
            getPoint(
                frames[i],
                27
            );


        const right =
            getPoint(
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
                left.y +
                right.y
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
                    getFrameNumber(
                        frames[i],
                        i
                    ),

                footY:
                    footY

            });

        }

    }



    // ==================================================
    // 着地候補の中から
    // 後半の安定したフレームを採用
    // ==================================================

    if (
        landingCandidates.length > 0
    ) {

        landing =
            landingCandidates[
                landingCandidates.length - 1
            ].index;

    }



    // ==================================================
    // 結果
    // ==================================================

    const result = {

        takeOff:
            getFrameNumber(
                frames[takeOff],
                takeOff
            ),

        handContact:
            getFrameNumber(
                frames[handContact],
                handContact
            ),

        highestHip:
            getFrameNumber(
                frames[highestHip],
                highestHip
            ),

        landing:
            getFrameNumber(
                frames[landing],
                landing
            ),


        // ----------------------------------------------
        // デバッグ用
        // ----------------------------------------------

        handCandidateCount:
            finalHandCandidates.length,


        handCandidates:
            finalHandCandidates.map(
                candidate => ({

                    frame:
                        candidate.frame,

                    index:
                        candidate.index,

                    movement:
                        Number(
                            candidate.movement.toFixed(4)
                        ),

                    distance:
                        Number(
                            candidate.distance.toFixed(3)
                        )

                })
            ),


        selectedHandFrame:
            getFrameNumber(
                frames[handContact],
                handContact
            )

    };



    // ==================================================
    // コンソール表示
    // ==================================================

    console.log(
        "========== PHASE Ver6.1 =========="
    );


    console.log(
        "総フレーム:",
        frames.length
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
        "着手候補:",
        result.handCandidates
    );


    console.log(
        "選択着手フレーム:",
        result.selectedHandFrame
    );


    console.log(
        "=================================="
    );


    return result;
}



// ==================================================
// 公開
// ==================================================

window.detectPhases =
    detectPhases;


console.log(
    "phase.js Ver6.1 読み込み成功"
);