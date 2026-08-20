// ==================================================
// 跳び箱AI採点システム
// phase.js Ver6.9
// 「本当に着手らしい1フレーム」を選択する版
// ==================================================
//
// 改良ポイント
//
// ① 候補を厳しく絞りすぎない
// ② 踏切後～最高点までを広く探索
// ③ 「手の前方移動」を重視
// ④ 「手の移動速度の変化」を確認
// ⑤ 「手と腰の位置関係」を確認
// ⑥ 「着手後に手の動きが変化する」ことを確認
// ⑦ 動作の端のフレームを減点
// ⑧ 候補0でも最適フレームを必ず選択
// ⑨ 候補一覧を画面表示用に保存
//
// score.js / app.jsとの互換性を維持
// ==================================================


// ==================================================
// 基本データ取得
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
        result <= 0
    ) {

        return 0.3;

    }


    return result;
}


// ==================================================
// 踏切検出
// ==================================================

function phaseFindTakeOff(frames) {

    let bestIndex = 1;

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
// 最高点
// ==================================================

function phaseFindHighestHip(frames) {

    let bestIndex = 0;

    let minY =
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
//
// 今回は候補を取りこぼさないため
// 広めに探索する
// ==================================================

function phaseGetHandSearchRange(
    frames,
    takeOffIndex,
    highestHipIndex
) {

    const movement =
        highestHipIndex -
        takeOffIndex;


    let start =
        Math.floor(
            takeOffIndex +
            movement * 0.12
        );


    let end =
        Math.floor(
            takeOffIndex +
            movement * 0.82
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
// 着手候補作成
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


    console.log(
        "着手探索範囲:",
        range.start,
        "～",
        range.end
    );


    const candidates = [];


    // ==================================================
    // 探索
    // ==================================================

    for (
        let i = range.start;
        i <= range.end;
        i++
    ) {

        const current =
            frames[i];

        const before1 =
            frames[
                Math.max(
                    0,
                    i - 1
                )
            ];

        const before2 =
            frames[
                Math.max(
                    0,
                    i - 2
                )
            ];

        const after1 =
            frames[
                Math.min(
                    frames.length - 1,
                    i + 1
                )
            ];

        const after2 =
            frames[
                Math.min(
                    frames.length - 1,
                    i + 2
                )
            ];


        const hand =
            phaseGetHandCenter(
                current
            );

        const handBefore1 =
            phaseGetHandCenter(
                before1
            );

        const handBefore2 =
            phaseGetHandCenter(
                before2
            );

        const handAfter1 =
            phaseGetHandCenter(
                after1
            );

        const handAfter2 =
            phaseGetHandCenter(
                after2
            );


        const hip =
            phaseGetHipCenter(
                current
            );


        if (
            !hand ||
            !handBefore1 ||
            !handBefore2 ||
            !handAfter1 ||
            !handAfter2 ||
            !hip
        ) {

            continue;

        }


        const scale =
            phaseGetBodyScale(
                current
            );


        if (
            !Number.isFinite(scale) ||
            scale <= 0
        ) {

            continue;

        }


        // ==================================================
        // 手の位置
        // ==================================================

        const distance =
            Math.abs(
                hand.x -
                hip.x
            ) /
            scale;


        // ==================================================
        // 手のX移動
        // ==================================================

        const move1 =
            hand.x -
            handBefore1.x;

        const move2 =
            handBefore1.x -
            handBefore2.x;

        const move3 =
            handAfter1.x -
            hand.x;

        const move4 =
            handAfter2.x -
            handAfter1.x;


        const beforeSpeed =
            (
                Math.abs(move1) +
                Math.abs(move2)
            ) / 2;


        const afterSpeed =
            (
                Math.abs(move3) +
                Math.abs(move4)
            ) / 2;


        const speedChange =
            Math.abs(
                beforeSpeed -
                afterSpeed
            );


        // ==================================================
        // 方向変化
        // ==================================================

        const beforeDirection =
            Math.sign(
                move1 +
                move2
            );

        const afterDirection =
            Math.sign(
                move3 +
                move4
            );


        let directionChange = 0;


        if (
            beforeDirection !== 0 &&
            afterDirection !== 0 &&
            beforeDirection !==
            afterDirection
        ) {

            directionChange = 1;

        }


        // ==================================================
        // Y方向変化
        // ==================================================

        const yBefore =
            Math.abs(
                hand.y -
                handBefore1.y
            );

        const yAfter =
            Math.abs(
                handAfter1.y -
                hand.y
            );


        const verticalChange =
            Math.abs(
                yBefore -
                yAfter
            );


        // ==================================================
        // 着手後の安定
        // ==================================================

        const stability =
            (
                Math.abs(move3) +
                Math.abs(move4)
            ) / 2;


        // ==================================================
        // 動作中の位置
        // ==================================================

        const phaseRatio =
            (
                i -
                takeOffIndex
            ) /
            Math.max(
                1,
                highestHipIndex -
                takeOffIndex
            );


        // ==================================================
        // 評価
        // ==================================================

        let score = 0;


        // --------------------------------------------------
        // ① 手が動いている
        // --------------------------------------------------

        score +=
            Math.min(
                beforeSpeed * 15,
                3
            );


        // --------------------------------------------------
        // ② 移動速度が変化
        // --------------------------------------------------

        score +=
            Math.min(
                speedChange * 20,
                3
            );


        // --------------------------------------------------
        // ③ 方向変化
        // --------------------------------------------------

        score +=
            directionChange * 2;


        // --------------------------------------------------
        // ④ Y方向変化
        // --------------------------------------------------

        score +=
            Math.min(
                verticalChange * 10,
                1.5
            );


        // --------------------------------------------------
        // ⑤ 手と腰の位置
        //
        // 極端な値を除外
        // --------------------------------------------------

        if (
            distance >= 0.10 &&
            distance <= 1.60
        ) {

            score += 1;

        }


        // --------------------------------------------------
        // ⑥ 中央付近を優先
        // --------------------------------------------------

        const centerDistance =
            Math.abs(
                phaseRatio -
                0.50
            );


        score +=
            Math.max(
                0,
                1.5 -
                centerDistance * 3
            );


        // --------------------------------------------------
        // ⑦ 着手後の安定
        // --------------------------------------------------

        if (
            stability < 0.08
        ) {

            score += 1.5;

        }
        else if (
            stability < 0.15
        ) {

            score += 0.5;

        }
        else if (
            stability > 0.30
        ) {

            score -= 1;

        }


        // --------------------------------------------------
        // ⑧ 最初すぎるフレームを減点
        // --------------------------------------------------

        if (
            phaseRatio < 0.10
        ) {

            score -= 4;

        }


        // --------------------------------------------------
        // ⑨ 最高点直前を減点
        // --------------------------------------------------

        if (
            phaseRatio > 0.82
        ) {

            score -= 3;

        }


        // --------------------------------------------------
        // ⑩ 極端に手が腰から離れている場合
        // --------------------------------------------------

        if (
            distance > 2.0
        ) {

            score -= 3;

        }


        // --------------------------------------------------
        // ⑪ ほとんど手が動いていない場合
        // --------------------------------------------------

        if (
            beforeSpeed < 0.002
        ) {

            score -= 2;

        }


        candidates.push({

            index:
                i,

            frame:
                phaseGetFrameNumber(
                    current,
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
    //
    // 今回は候補を多めに残す
    // ==================================================

    const top =
        candidates.slice(
            0,
            Math.min(
                20,
                candidates.length
            )
        );


    // ==================================================
    // 近すぎる候補を整理
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
                    ) <= 1
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
// 本当に着手らしいフレームを選択
// ==================================================

function phaseSelectBestHand(
    candidates,
    takeOffIndex,
    highestHipIndex
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


        const ratio =
            candidate.phaseRatio;


        // ==================================================
        // 着手は動作中央付近を優先
        // ==================================================

        if (
            ratio >= 0.25 &&
            ratio <= 0.70
        ) {

            score += 3;

        }
        else if (
            ratio >= 0.15 &&
            ratio <= 0.80
        ) {

            score += 1;

        }
        else {

            score -= 2;

        }


        // ==================================================
        // 「手が動いている」ことを重視
        // ==================================================

        score +=
            Math.min(
                candidate.beforeSpeed * 10,
                2
            );


        // ==================================================
        // 「着手前後の変化」を重視
        // ==================================================

        score +=
            Math.min(
                candidate.speedChange * 10,
                2
            );


        // ==================================================
        // 着手後に安定
        // ==================================================

        if (
            candidate.stability < 0.10
        ) {

            score += 2;

        }


        // ==================================================
        // 極端に早い
        // ==================================================

        if (
            candidate.index <=
            takeOffIndex + 1
        ) {

            score -= 6;

        }


        // ==================================================
        // 最高点直前
        // ==================================================

        if (
            candidate.index >=
            highestHipIndex - 1
        ) {

            score -= 5;

        }


        // ==================================================
        // 最良候補
        // ==================================================

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
// メイン
// ==================================================

function detectPhases(frames) {

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.9 起動"
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


    // ==================================================
    // 着手候補
    // ==================================================

    const candidates =
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
    // 最良候補選択
    // ==================================================

    const best =
        phaseSelectBestHand(
            candidates,
            takeOffIndex,
            highestHipIndex
        );


    // ==================================================
    // 候補0対策
    //
    // 候補がない場合は探索範囲から
    // 最も中央に近い有効フレームを選ぶ
    // ==================================================

    let handContactIndex;


    if (best) {

        handContactIndex =
            best.index;

    }
    else {

        const range =
            phaseGetHandSearchRange(
                frames,
                takeOffIndex,
                highestHipIndex
            );


        handContactIndex =
            Math.floor(
                (
                    range.start +
                    range.end
                ) / 2
            );


        console.warn(
            "着手候補なし。探索範囲中央を使用:",
            handContactIndex
        );

    }


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
        // 着手デバッグ
        // ==================================================

        handCandidateCount:
            candidates.length,

        selectedHandFrame:
            phaseGetFrameNumber(
                frames[handContactIndex],
                handContactIndex
            ),

        selectedHandDistance:
            best
                ? Number(
                    best.distance.toFixed(3)
                )
                : 0,

        selectedHandScore:
            best
                ? Number(
                    best.finalScore.toFixed(4)
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
    // コンソール表示
    // ==================================================

    console.log(
        "===================================="
    );

    console.log(
        "phase.js Ver6.9 結果"
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
    "phase.js Ver6.9 読み込み成功"
);