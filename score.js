// ============================================================
// 跳び箱AI採点システム score.js Ver6.1
// データ欠落防止・着手候補連携版
// ============================================================

(function () {
    "use strict";

    // ----------------------------------------------------------
    // 共通
    // ----------------------------------------------------------
    function n(v, fallback = NaN) {
        const x = Number(v);
        return Number.isFinite(x) ? x : fallback;
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }


    // ----------------------------------------------------------
    // ランドマーク取得
    // ----------------------------------------------------------
    function getScorePoint(frame, index) {

        if (!frame) {
            return null;
        }

        let list = null;

        // 配列
        if (Array.isArray(frame)) {

            list = frame;

        }

        // landmarks
        else if (Array.isArray(frame.landmarks)) {

            list = frame.landmarks;

        }

        // poseLandmarks
        else if (Array.isArray(frame.poseLandmarks)) {

            list = frame.poseLandmarks;

        }

        // results.poseLandmarks
        else if (
            frame.results &&
            Array.isArray(frame.results.poseLandmarks)
        ) {

            list =
                frame.results.poseLandmarks;

        }


        const p =
            list &&
            list[index];


        if (
            !p ||
            !Number.isFinite(Number(p.x)) ||
            !Number.isFinite(Number(p.y))
        ) {

            return null;

        }


        return p;

    }


    // ----------------------------------------------------------
    // visibility
    // ----------------------------------------------------------
    function visibility(frame, index) {

        const p =
            getScorePoint(
                frame,
                index
            );

        if (!p) {

            return 0;

        }


        const v =
            Number(p.visibility);


        return Number.isFinite(v)
            ? v
            : 1;

    }


    // ----------------------------------------------------------
    // フレーム番号の正規化
    // ----------------------------------------------------------
    function normalizeFrames(frames) {

        if (
            !Array.isArray(frames)
        ) {

            return [];

        }


        return frames
            .map(
                (
                    raw,
                    index
                ) => {

                    if (!raw) {

                        return null;

                    }


                    let frameNumber =
                        index;


                    for (
                        const key of [
                            "frame",
                            "frameNumber",
                            "index"
                        ]
                    ) {

                        const value =
                            Number(
                                raw[key]
                            );


                        if (
                            Number.isFinite(
                                value
                            )
                        ) {

                            frameNumber =
                                value;

                            break;

                        }

                    }


                    return {

                        raw:
                            raw,

                        arrayIndex:
                            index,

                        frameNumber:
                            frameNumber

                    };

                }
            )
            .filter(Boolean);

    }


    // ----------------------------------------------------------
    // 最も近いフレーム
    // ----------------------------------------------------------
    function nearestFrame(
        data,
        requested
    ) {

        if (
            !data.length
        ) {

            return -1;

        }


        const target =
            Number(requested);


        if (
            !Number.isFinite(target)
        ) {

            return 0;

        }


        let best =
            0;

        let diff =
            Infinity;


        data.forEach(
            (
                item,
                index
            ) => {

                const d =
                    Math.abs(
                        item.frameNumber -
                        target
                    );


                if (
                    d < diff
                ) {

                    diff =
                        d;

                    best =
                        index;

                }

            }
        );


        return best;

    }


    // ----------------------------------------------------------
    // phase値取得
    // ----------------------------------------------------------
    function phaseNumber(
        phase,
        keys,
        fallback
    ) {

        if (!phase) {

            return fallback;

        }


        for (
            const key of keys
        ) {

            const value =
                Number(
                    phase[key]
                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                return value;

            }

        }


        return fallback;

    }


    // ----------------------------------------------------------
    // 腰中心
    // ----------------------------------------------------------
    function hipCenter(frame) {

        const left =
            getScorePoint(
                frame,
                23
            );


        const right =
            getScorePoint(
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


    // ----------------------------------------------------------
    // 身体サイズ
    // ----------------------------------------------------------
    function bodyScale(frame) {

        const shoulderL =
            getScorePoint(
                frame,
                11
            );


        const shoulderR =
            getScorePoint(
                frame,
                12
            );


        const hip =
            hipCenter(frame);


        if (
            !shoulderL ||
            !shoulderR ||
            !hip
        ) {

            return NaN;

        }


        const shoulderX =
            (
                Number(
                    shoulderL.x
                ) +
                Number(
                    shoulderR.x
                )
            ) / 2;


        const shoulderY =
            (
                Number(
                    shoulderL.y
                ) +
                Number(
                    shoulderR.y
                )
            ) / 2;


        const torso =
            Math.hypot(
                shoulderX -
                hip.x,

                shoulderY -
                hip.y
            );


        const shoulder =
            Math.hypot(

                Number(
                    shoulderL.x
                ) -
                Number(
                    shoulderR.x
                ),

                Number(
                    shoulderL.y
                ) -
                Number(
                    shoulderR.y
                )

            );


        return Math.max(
            torso,
            shoulder,
            0.001
        );

    }


    // ----------------------------------------------------------
    // 角度
    // ----------------------------------------------------------
    function angle(
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


        const ab =
            Math.hypot(
                abx,
                aby
            );


        const cb =
            Math.hypot(
                cbx,
                cby
            );


        if (
            !ab ||
            !cb
        ) {

            return NaN;

        }


        const cos =
            clamp(

                (
                    abx * cbx +
                    aby * cby
                ) /
                (
                    ab * cb
                ),

                -1,
                1

            );


        return (
            Math.acos(cos) *
            180 /
            Math.PI
        );

    }


    // ----------------------------------------------------------
    // 膝平均角度
    // ----------------------------------------------------------
    function kneeAverage(frame) {

        const left =
            angle(

                getScorePoint(
                    frame,
                    23
                ),

                getScorePoint(
                    frame,
                    25
                ),

                getScorePoint(
                    frame,
                    27
                )

            );


        const right =
            angle(

                getScorePoint(
                    frame,
                    24
                ),

                getScorePoint(
                    frame,
                    26
                ),

                getScorePoint(
                    frame,
                    28
                )

            );


        const values = [];


        if (
            Number.isFinite(left)
        ) {

            values.push(
                left
            );

        }


        if (
            Number.isFinite(right)
        ) {

            values.push(
                right
            );

        }


        if (
            !values.length
        ) {

            return NaN;

        }


        return (
            values.reduce(
                (
                    a,
                    b
                ) =>
                    a + b,
                0
            )
            /
            values.length
        );

    }


    // ==========================================================
    // 着手候補
    // ==========================================================

    function phaseCandidates(
        phase
    ) {

        if (!phase) {

            return [];

        }


        const keys = [

            "handCandidates",

            "handCandidateList",

            "handCandidatesList",

            "candidates"

        ];


        for (
            const key of keys
        ) {

            if (
                Array.isArray(
                    phase[key]
                ) &&
                phase[key].length
            ) {

                return phase[key];

            }

        }


        return [];

    }


    // ----------------------------------------------------------
    // 候補フレーム
    // ----------------------------------------------------------
    function candidateFrame(
        item
    ) {

        if (
            typeof item ===
            "number"
        ) {

            return Number(item);

        }


        if (
            !item ||
            typeof item !==
            "object"
        ) {

            return NaN;

        }


        for (
            const key of [
                "frame",
                "frameNumber",
                "index",
                "selectedFrame"
            ]
        ) {

            const value =
                Number(
                    item[key]
                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                return value;

            }

        }


        return NaN;

    }


    // ----------------------------------------------------------
    // 候補実測値
    // ----------------------------------------------------------
    function candidateValue(
        item
    ) {

        if (
            !item ||
            typeof item !==
            "object"
        ) {

            return NaN;

        }


        for (
            const key of [
                "measured",
                "value",
                "handValue",
                "position",
                "normalized"
            ]
        ) {

            const value =
                Number(
                    item[key]
                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                return value;

            }

        }


        return NaN;

    }


    // ----------------------------------------------------------
    // 着手らしさ
    // ----------------------------------------------------------
    function candidateLikeness(
        item
    ) {

        if (
            !item ||
            typeof item !==
            "object"
        ) {

            return NaN;

        }


        for (
            const key of [
                "handLikeness",
                "likeness",
                "candidateScore",
                "finalScore",
                "score"
            ]
        ) {

            const value =
                Number(
                    item[key]
                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                return value;

            }

        }


        return NaN;

    }


    // ==========================================================
    // 着手実測値
    // ==========================================================

    function handValue(
        frame
    ) {

        const left =
            getScorePoint(
                frame,
                15
            );


        const right =
            getScorePoint(
                frame,
                16
            );


        const hip =
            hipCenter(
                frame
            );


        let scale =
            bodyScale(
                frame
            );


        if (
            !left ||
            !right ||
            !hip
        ) {

            return NaN;

        }


        // 身体尺度が取得できない場合の補助
        if (
            !Number.isFinite(
                scale
            ) ||
            scale <= 0
        ) {

            const shoulderL =
                getScorePoint(
                    frame,
                    11
                );


            const shoulderR =
                getScorePoint(
                    frame,
                    12
                );


            if (
                shoulderL &&
                shoulderR
            ) {

                scale =
                    Math.hypot(

                        Number(
                            shoulderL.x
                        ) -
                        Number(
                            shoulderR.x
                        ),

                        Number(
                            shoulderL.y
                        ) -
                        Number(
                            shoulderR.y
                        )

                    );

            }

        }


        if (
            !Number.isFinite(
                scale
            ) ||
            scale <= 0
        ) {

            scale =
                0.30;

        }


        const handX =
            (
                Number(left.x) +
                Number(right.x)
            ) / 2;


        return (
            Math.abs(
                handX -
                hip.x
            )
            /
            scale
        );

    }


    // ----------------------------------------------------------
    // phase候補がない場合の補完
    // ----------------------------------------------------------
    function makeFallbackCandidates(
        data,
        selectedIndex
    ) {

        const list = [];


        const start =
            Math.max(
                0,
                selectedIndex - 10
            );


        const end =
            Math.min(
                data.length - 1,
                selectedIndex + 10
            );


        for (
            let i = start;
            i <= end;
            i++
        ) {

            const value =
                handValue(
                    data[i].raw
                );


            if (
                !Number.isFinite(
                    value
                )
            ) {

                continue;

            }


            list.push({

                frame:
                    data[i].frameNumber,

                value:
                    value,

                measured:
                    value.toFixed(3),

                // phase.jsの着手らしさがないので
                // 勝手なスコアは付けない
                handLikeness:
                    NaN

            });

        }


        return list;

    }


    // ==========================================================
    // ① 膝
    // ==========================================================

    function scoreKnee(
        data,
        hipIndex,
        handIndex
    ) {

        const values = [];


        const center =
            Math.max(

                0,

                Math.min(

                    data.length - 1,

                    hipIndex >= 0
                        ? hipIndex
                        : handIndex

                )

            );


        const start =
            Math.max(
                0,
                center - 20
            );


        const end =
            Math.min(
                data.length - 1,
                center + 20
            );


        for (
            let i = start;
            i <= end;
            i++
        ) {

            const value =
                kneeAverage(
                    data[i].raw
                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                values.push(
                    value
                );

            }

        }


        if (
            !values.length
        ) {

            return {

                score:
                    0,

                value:
                    null,

                measured:
                    "取得できませんでした",

                text:
                    "膝角度の骨格データを取得できませんでした。",

                candidateCount:
                    0

            };

        }


        const measured =
            values.reduce(
                (
                    a,
                    b
                ) =>
                    a + b,
                0
            )
            /
            values.length;


        let score =
            0;


        let text =
            "膝の伸びを意識しましょう。";


        if (
            measured >= 165
        ) {

            score =
                2;

            text =
                "膝がしっかり伸びています。";

        }

        else if (
            measured >= 150
        ) {

            score =
                1;

            text =
                "膝は伸びていますが、もう少し伸ばせます。";

        }


        return {

            score:

                score,

            value:

                measured,

            measured:

                measured.toFixed(1) +
                "°",

            text:

                text,

            candidateCount:

                values.length

        };

    }


    // ==========================================================
    // ② 腰
    // ==========================================================

    function scoreHip(
        data,
        takeOffIndex,
        hipIndex
    ) {

        const takeFrame =
            data[
                takeOffIndex
            ];


        const takeHip =
            takeFrame
                ? hipCenter(
                    takeFrame.raw
                )
                : null;


        if (
            !takeHip
        ) {

            return {

                score:
                    0,

                value:
                    null,

                measured:
                    "取得できませんでした",

                text:
                    "踏切時の腰位置を取得できませんでした。",

                threshold0:
                    "0.200未満",

                threshold1:
                    "0.200～0.349",

                threshold2:
                    "0.350以上"

            };

        }


        const start =
            Math.max(

                0,

                takeOffIndex,

                hipIndex - 8

            );


        const end =
            Math.min(

                data.length - 1,

                hipIndex + 8

            );


        let best =
            -Infinity;


        for (
            let i = start;
            i <= end;
            i++
        ) {

            const hip =
                hipCenter(
                    data[i].raw
                );


            let scale =
                bodyScale(
                    data[i].raw
                );


            if (
                !hip
            ) {

                continue;

            }


            if (
                !Number.isFinite(
                    scale
                ) ||
                scale <= 0
            ) {

                scale =
                    0.30;

            }


            const rise =
                (
                    takeHip.y -
                    hip.y
                )
                /
                scale;


            if (
                Number.isFinite(
                    rise
                )
            ) {

                best =
                    Math.max(
                        best,
                        rise
                    );

            }

        }


        if (
            !Number.isFinite(
                best
            )
        ) {

            return {

                score:
                    0,

                value:
                    null,

                measured:
                    "取得できませんでした",

                text:
                    "腰位置の実測値を取得できませんでした。",

                threshold0:
                    "0.200未満",

                threshold1:
                    "0.200～0.349",

                threshold2:
                    "0.350以上"

            };

        }


        const measured =
            Math.max(
                0,
                best
            );


        let score =
            0;


        let text =
            "腰を高く上げることを意識しましょう。";


        if (
            measured >= 0.35
        ) {

            score =
                2;

            text =
                "腰が高く上がっています。";

        }

        else if (
            measured >= 0.20
        ) {

            score =
                1;

            text =
                "腰は上がっています。もう少し高くするとさらに安定します。";

        }


        return {

            score:
                score,

            value:
                measured,

            measured:
                measured.toFixed(3),

            text:
                text,

            unit:
                "体格比",

            threshold0:
                "0.200未満",

            threshold1:
                "0.200～0.349",

            threshold2:
                "0.350以上"

        };

    }


    // ==========================================================
    // ③ 着手
    // ==========================================================

    function scoreHand(
        data,
        phase,
        takeOffIndex
    ) {

        const raw =
            phaseCandidates(
                phase
            );


        let candidates =
            [];


        // phase.jsから候補を受け取る
        raw.forEach(
            item => {

                const frame =
                    candidateFrame(
                        item
                    );


                if (
                    !Number.isFinite(
                        frame
                    )
                ) {

                    return;

                }


                let value =
                    candidateValue(
                        item
                    );


                const index =
                    nearestFrame(
                        data,
                        frame
                    );


                if (
                    !Number.isFinite(
                        value
                    ) &&
                    index >= 0
                ) {

                    value =
                        handValue(
                            data[index].raw
                        );

                }


                if (
                    !Number.isFinite(
                        value
                    )
                ) {

                    return;

                }


                candidates.push({

                    frame:
                        frame,

                    value:
                        value,

                    measured:
                        value.toFixed(3),

                    handLikeness:
                        candidateLikeness(
                            item
                        )

                });

            }
        );


        // ------------------------------------------------------
        // phase.jsの選択フレーム
        // ------------------------------------------------------

        let selectedFrame =
            phaseNumber(

                phase,

                [
                    "handContact",
                    "selectedHandFrame",
                    "handFrame"
                ],

                NaN

            );


        let selectedIndex =
            Number.isFinite(
                selectedFrame
            )

                ? nearestFrame(
                    data,
                    selectedFrame
                )

                : -1;


        // phaseに選択フレームがない場合
        if (
            selectedIndex < 0
        ) {

            selectedIndex =
                Math.max(

                    0,

                    Math.min(

                        data.length - 1,

                        takeOffIndex + 5

                    )

                );


            selectedFrame =
                data[selectedIndex]
                    ? data[selectedIndex].frameNumber
                    : NaN;

        }


        // ------------------------------------------------------
        // 候補がなければscore.js側で補完
        // ------------------------------------------------------

        if (
            !candidates.length
        ) {

            candidates =
                makeFallbackCandidates(
                    data,
                    selectedIndex
                );

        }


        // ------------------------------------------------------
        // phase.jsが選んだフレームを最優先
        // ------------------------------------------------------

        let selected =
            candidates.find(
                item =>

                    Number.isFinite(
                        selectedFrame
                    ) &&

                    Math.abs(

                        Number(
                            item.frame
                        ) -
                        Number(
                            selectedFrame
                        )

                    ) < 0.001

            );


        // ------------------------------------------------------
        // 候補一覧に選択フレームがなければ追加
        // ------------------------------------------------------

        if (
            !selected &&
            selectedIndex >= 0
        ) {

            const value =
                handValue(
                    data[selectedIndex].raw
                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                selected = {

                    frame:
                        data[selectedIndex]
                            .frameNumber,

                    value:
                        value,

                    measured:
                        value.toFixed(3),

                    handLikeness:

                        phase &&

                        Number.isFinite(
                            Number(
                                phase.selectedHandScore
                            )
                        )

                            ? Number(
                                phase.selectedHandScore
                            )

                            : NaN

                };


                candidates.push(
                    selected
                );

            }

        }


        // ------------------------------------------------------
        // phaseに選択フレームが無い場合だけ
        // 候補の着手らしさから選択
        // ------------------------------------------------------

        if (
            !selected &&
            candidates.length
        ) {

            const scored =
                candidates.filter(
                    item =>
                        Number.isFinite(
                            Number(
                                item.handLikeness
                            )
                        )
                );


            if (
                scored.length
            ) {

                selected =
                    scored.reduce(
                        (
                            best,
                            item
                        ) =>

                            Number(
                                item.handLikeness
                            )
                            >
                            Number(
                                best.handLikeness
                            )

                                ? item
                                : best

                    );

            }

            else {

                selected =
                    candidates[0];

            }

        }


        const measured =
            selected
                ? Number(
                    selected.value
                )
                : NaN;


        const likeness =
            selected &&

            Number.isFinite(
                Number(
                    selected.handLikeness
                )
            )

                ? Number(
                    selected.handLikeness
                )

                : NaN;


        // ======================================================
        // 着手点数
        //
        // phase.jsの「着手らしさ」を優先
        //
        // 8以上 → 2点
        // 5～7 → 1点
        // 4以下 → 0点
        //
        // これまでの
        // 成功①：着手らしさ10
        // 成功②：着手らしさ8
        // 普通：着手らしさ7
        // の結果に合わせた判定
        // ======================================================

        let score =
            0;


        let text =
            "着手位置を確認しましょう。";


        if (
            Number.isFinite(
                likeness
            )
        ) {

            if (
                likeness >= 8
            ) {

                score =
                    2;

                text =
                    "適切なタイミング・位置で着手できています。";

            }

            else if (
                likeness >= 5
            ) {

                score =
                    1;

                text =
                    "着手できています。タイミングと位置をさらに安定させましょう。";

            }

            else {

                score =
                    0;

                text =
                    "着手のタイミングと位置を意識しましょう。";

            }

        }

        // ------------------------------------------------------
        // phaseに着手らしさがない場合
        // 実測値で補完
        // ------------------------------------------------------

        else if (
            Number.isFinite(
                measured
            )
        ) {

            if (
                measured >= 0.35
            ) {

                score =
                    2;

                text =
                    "適切な位置に着手できています。";

            }

            else if (
                measured >= 0.20
            ) {

                score =
                    1;

                text =
                    "着手位置をもう少し意識しましょう。";

            }

            else {

                score =
                    0;

                text =
                    "着手位置を意識しましょう。";

            }

        }

        else {

            text =
                "着手位置の骨格データを取得できませんでした。";

        }


        return {

            score:
                score,

            value:
                Number.isFinite(
                    measured
                )
                    ? measured
                    : null,

            measured:
                Number.isFinite(
                    measured
                )
                    ? measured.toFixed(3)
                    : "取得できませんでした",

            text:
                text,

            unit:
                "体格比",

            // ★必ず残す
            candidateCount:
                candidates.length,

            selectedFrame:
                selected
                    ? Number(
                        selected.frame
                    )
                    : null,

            handContact:
                selected
                    ? Number(
                        selected.frame
                    )
                    : null,

            selectedScore:
                Number.isFinite(
                    likeness
                )
                    ? likeness
                    : null,

            candidates:
                candidates.map(
                    (
                        item,
                        index
                    ) => ({

                        number:
                            index + 1,

                        frame:
                            Number(
                                item.frame
                            ),

                        value:
                            Number(
                                item.value
                            ),

                        measured:
                            item.measured,

                        handLikeness:
                            Number.isFinite(
                                Number(
                                    item.handLikeness
                                )
                            )
                                ? Number(
                                    item.handLikeness
                                )
                                : null

                    })
                )

        };

    }


    // ==========================================================
    // ④ 両足踏切
    // ==========================================================

    function scoreTakeOff(
        data,
        takeOffIndex
    ) {

        const center =
            Math.max(

                0,

                Math.min(

                    data.length - 1,

                    takeOffIndex

                )

            );


        const start =
            Math.max(
                0,
                center - 5
            );


        const end =
            Math.min(
                data.length - 1,
                center + 7
            );


        const values =
            [];


        for (
            let i = start;
            i <= end;
            i++
        ) {

            const left =
                getScorePoint(
                    data[i].raw,
                    27
                );


            const right =
                getScorePoint(
                    data[i].raw,
                    28
                );


            if (
                !left ||
                !right
            ) {

                continue;

            }


            const value =
                Math.abs(

                    Number(
                        left.y
                    ) -

                    Number(
                        right.y
                    )

                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                values.push({

                    frame:
                        data[i].frameNumber,

                    value:
                        value,

                    visibility:
                        (
                            visibility(
                                data[i].raw,
                                27
                            )
                            +
                            visibility(
                                data[i].raw,
                                28
                            )
                        ) / 2

                });

            }

        }


        if (
            !values.length
        ) {

            return {

                score:
                    0,

                value:
                    null,

                measured:
                    "取得できませんでした",

                text:
                    "踏切の骨格データを取得できませんでした。",

                candidateCount:
                    0,

                frame:
                    null

            };

        }


        let best =
            values[0];


        let bestRank =
            Infinity;


        values.forEach(
            item => {

                const distance =
                    Math.abs(

                        item.frame -

                        data[
                            center
                        ].frameNumber

                    );


                const rank =

                    item.value * 100 +

                    distance * 0.5 +

                    (
                        1 -
                        item.visibility
                    ) * 2;


                if (
                    rank < bestRank
                ) {

                    bestRank =
                        rank;

                    best =
                        item;

                }

            }
        );


        let score =
            0;


        let text =
            "両足をそろえて踏み切ることを意識しましょう。";


        if (
            best.value < 0.045
        ) {

            score =
                2;

            text =
                "両足をそろえて踏み切れています。";

        }

        else if (
            best.value < 0.08
        ) {

            score =
                1;

            text =
                "両足踏切はできています。左右の足のタイミングをそろえると、さらに安定します。";

        }


        return {

            score:
                score,

            value:
                best.value,

            measured:
                best.value.toFixed(3),

            text:
                text,

            unit:
                "左右足首Y差",

            candidateCount:
                values.length,

            frame:
                best.frame

        };

    }


    // ==========================================================
    // ⑤ 着地
    // ==========================================================

    function scoreLanding(
        data,
        landingIndex
    ) {

        const center =
            Math.max(

                0,

                Math.min(

                    data.length - 1,

                    landingIndex

                )

            );


        const start =
            Math.max(
                0,
                center - 6
            );


        const end =
            Math.min(
                data.length - 1,
                center + 6
            );


        const values =
            [];


        for (
            let i = start;
            i <= end;
            i++
        ) {

            const left =
                getScorePoint(
                    data[i].raw,
                    27
                );


            const right =
                getScorePoint(
                    data[i].raw,
                    28
                );


            if (
                !left ||
                !right
            ) {

                continue;

            }


            const value =
                Math.abs(

                    Number(
                        left.y
                    ) -

                    Number(
                        right.y
                    )

                );


            if (
                Number.isFinite(
                    value
                )
            ) {

                values.push(
                    value
                );

            }

        }


        if (
            !values.length
        ) {

            return {

                score:
                    0,

                value:
                    null,

                measured:
                    "取得できませんでした",

                text:
                    "着地を確認できませんでした。最後まで着地する動作を行いましょう。",

                candidateCount:
                    0

            };

        }


        const measured =
            values.reduce(
                (
                    a,
                    b
                ) =>
                    a + b,
                0
            )
            /
            values.length;


        let score =
            0;


        let text =
            "着地では両足を安定させることを意識しましょう。";


        if (
            measured < 0.05
        ) {

            score =
                2;

            text =
                "着地が安定しています。";

        }

        else if (
            measured < 0.10
        ) {

            score =
                1;

            text =
                "着地できています。両足をそろえると、さらに安定します。";

        }


        return {

            score:
                score,

            value:
                measured,

            measured:
                measured.toFixed(3),

            text:
                text,

            unit:
                "左右足首Y差",

            candidateCount:
                values.length

        };

    }


    // ==========================================================
    // データ不足でも必ず5項目を返す
    // ==========================================================

    function emptyResult(
        message
    ) {

        return {

            score:
                0,


            details: {

                knee: {

                    score:
                        0,

                    value:
                        null,

                    measured:
                        "取得できませんでした",

                    text:
                        "膝角度の骨格データを取得できませんでした。"

                },


                hip: {

                    score:
                        0,

                    value:
                        null,

                    measured:
                        "取得できませんでした",

                    text:
                        "腰位置の骨格データを取得できませんでした。",

                    threshold0:
                        "0.200未満",

                    threshold1:
                        "0.200～0.349",

                    threshold2:
                        "0.350以上"

                },


                hand: {

                    score:
                        0,

                    value:
                        null,

                    measured:
                        "取得できませんでした",

                    text:
                        "着手位置の骨格データを取得できませんでした。",

                    candidateCount:
                        0,

                    selectedFrame:
                        null,

                    handContact:
                        null,

                    selectedScore:
                        null,

                    candidates:
                        []

                },


                takeOff: {

                    score:
                        0,

                    value:
                        null,

                    measured:
                        "取得できませんでした",

                    text:
                        "踏切の骨格データを取得できませんでした。",

                    candidateCount:
                        0,

                    frame:
                        null

                },


                landing: {

                    score:
                        0,

                    value:
                        null,

                    measured:
                        "取得できませんでした",

                    text:
                        "着地の骨格データを取得できませんでした。",

                    candidateCount:
                        0

                }

            },


            diagnostics: {

                message:
                    message ||
                    "データを確認してください。"

            }

        };

    }


    // ==========================================================
    // メイン
    // ==========================================================

    function calculateDScore(
        frames,
        phase
    ) {

        console.log(
            "========================================"
        );

        console.log(
            "score.js Ver6.1 採点開始"
        );


        // ======================================================
        // ★重要
        // ここでは details:{} を返さない
        // ======================================================

        if (
            !Array.isArray(
                frames
            ) ||
            frames.length === 0
        ) {

            console.error(
                "score.js：フレームデータなし"
            );


            return emptyResult(
                "骨格フレームがありません。"
            );

        }


        const data =
            normalizeFrames(
                frames
            );


        if (
            !data.length
        ) {

            return emptyResult(
                "骨格フレームを解析できませんでした。"
            );

        }


        // ======================================================
        // phaseが一部欠けても補完
        // ======================================================

        const defaultTakeOff =
            0;


        const defaultHand =
            Math.min(
                5,
                data.length - 1
            );


        const defaultHip =
            Math.min(

                data.length - 1,

                Math.max(

                    defaultHand,

                    Math.floor(
                        data.length * 0.35
                    )

                )

            );


        const defaultLanding =
            data.length - 1;


        const takeOffFrame =
            phaseNumber(

                phase,

                [
                    "takeOff",
                    "takeoff",
                    "takeOffFrame"
                ],

                defaultTakeOff

            );


        const handFrame =
            phaseNumber(

                phase,

                [
                    "handContact",
                    "selectedHandFrame",
                    "handFrame"
                ],

                defaultHand

            );


        const hipFrame =
            phaseNumber(

                phase,

                [
                    "highestHip",
                    "highestHipFrame",
                    "hipPeak"
                ],

                defaultHip

            );


        const landingFrame =
            phaseNumber(

                phase,

                [
                    "landing",
                    "landingFrame"
                ],

                defaultLanding

            );


        const takeOffIndex =
            nearestFrame(
                data,
                takeOffFrame
            );


        const handIndex =
            nearestFrame(
                data,
                handFrame
            );


        const hipIndex =
            nearestFrame(
                data,
                hipFrame
            );


        const landingIndex =
            nearestFrame(
                data,
                landingFrame
            );


        // ======================================================
        // 5項目
        // ======================================================

        const knee =
            scoreKnee(

                data,

                hipIndex,

                handIndex

            );


        const hip =
            scoreHip(

                data,

                takeOffIndex,

                hipIndex

            );


        const hand =
            scoreHand(

                data,

                phase || {},

                takeOffIndex

            );


        const takeOff =
            scoreTakeOff(

                data,

                takeOffIndex

            );


        const landing =
            scoreLanding(

                data,

                landingIndex

            );


        // ======================================================
        // Dスコア
        // ======================================================

        const total =

            Number(
                knee.score || 0
            )

            +

            Number(
                hip.score || 0
            )

            +

            Number(
                hand.score || 0
            )

            +

            Number(
                takeOff.score || 0
            )

            +

            Number(
                landing.score || 0
            );


        // ======================================================
        // 結果
        // ======================================================

        const result = {

            score:
                total,


            details: {

                knee:
                    knee,

                hip:
                    hip,

                hand:
                    hand,

                takeOff:
                    takeOff,

                landing:
                    landing

            },


            diagnostics: {

                frameCount:
                    data.length,

                phaseReceived:
                    !!phase,

                takeOffFrame:
                    data[
                        takeOffIndex
                    ]
                        ? data[
                            takeOffIndex
                        ].frameNumber
                        : null,

                handFrame:
                    hand.selectedFrame,

                highestHipFrame:
                    data[
                        hipIndex
                    ]
                        ? data[
                            hipIndex
                        ].frameNumber
                        : null,

                landingFrame:
                    data[
                        landingIndex
                    ]
                        ? data[
                            landingIndex
                        ].frameNumber
                        : null,

                handCandidateCount:
                    hand.candidateCount

            }

        };


        // ======================================================
        // app.jsなどからも取得できるように残す
        // ======================================================

        result.handCandidates =
            hand.candidates;


        result.handCandidateCount =
            hand.candidateCount;


        result.selectedHandFrame =
            hand.selectedFrame;


        result.handMeasured =
            hand.value;


        // ======================================================
        // 診断ログ
        // ======================================================

        console.log(
            "フレーム数:",
            data.length
        );


        console.log(
            "膝:",
            knee.score,
            knee.measured
        );


        console.log(
            "腰:",
            hip.score,
            hip.measured
        );


        console.log(
            "着手:",
            hand.score,
            hand.measured
        );


        console.log(
            "着手候補数:",
            hand.candidateCount
        );


        console.log(
            "選択着手フレーム:",
            hand.selectedFrame
        );


        console.log(
            "踏切:",
            takeOff.score,
            takeOff.measured
        );


        console.log(
            "着地:",
            landing.score,
            landing.measured
        );


        console.log(
            "Dスコア:",
            total
        );


        console.log(
            "========================================"
        );


        return result;

    }


    // ==========================================================
    // 公開
    // ==========================================================

    window.calculateDScore =
        calculateDScore;


    console.log(
        "score.js Ver6.1 読み込み成功"
    );


})();

// ============================================================
// Ver6.4.1 追加診断ブロック
// 既存の採点ロジックは一切変更しない
// ・calculateDScore の戻り値をそのまま使用
// ・点数、実測値、既存の閾値文字列を画面表示するだけ
// ============================================================
(function () {
    "use strict";

    const originalCalculateDScore = window.calculateDScore;

    if (typeof originalCalculateDScore !== "function") {
        console.error("Ver6.4.1: 元の calculateDScore が見つかりません");
        return;
    }

    function safeText(value, fallback = "-") {
        if (value === undefined || value === null || value === "") return fallback;
        return String(value);
    }

    function measuredText(detail) {
        if (!detail) return "取得できませんでした";
        if (detail.measured !== undefined && detail.measured !== null && detail.measured !== "") {
            return String(detail.measured);
        }
        if (detail.value !== undefined && detail.value !== null && detail.value !== "") {
            const n = Number(detail.value);
            return Number.isFinite(n) ? String(n) : String(detail.value);
        }
        return "取得できませんでした";
    }

    function makeReason(label, detail) {
        if (!detail) return `${label}: データなし`;
        const score = Number(detail.score);
        const scoreText = Number.isFinite(score) ? `${score}/2点` : "点数不明";
        const measured = measuredText(detail);

        const thresholds = [];
        if (detail.threshold0) thresholds.push(`0点基準: ${detail.threshold0}`);
        if (detail.threshold1) thresholds.push(`1点基準: ${detail.threshold1}`);
        if (detail.threshold2) thresholds.push(`2点基準: ${detail.threshold2}`);

        const basis = thresholds.length
            ? thresholds.join(" / ")
            : "現在のscore.js既存判定をそのまま使用";

        return `${label}: 実測値 ${measured} → ${scoreText}。${basis}`;
    }

    function ensureDiagnosticElement() {
        let el = document.getElementById("scoreDiagnostic641");
        if (el) return el;

        el = document.createElement("div");
        el.id = "scoreDiagnostic641";
        el.style.marginTop = "12px";
        el.style.padding = "12px";
        el.style.border = "1px solid #bbb";
        el.style.borderRadius = "8px";
        el.style.background = "#fafafa";
        el.style.fontSize = "14px";
        el.style.lineHeight = "1.7";

        const feedback = document.getElementById("feedback");
        if (feedback && feedback.parentElement) {
            feedback.parentElement.appendChild(el);
        } else {
            document.body.appendChild(el);
        }
        return el;
    }

    function renderDiagnostics(result) {
        const el = ensureDiagnosticElement();

        if (!result || !result.details) {
            el.innerHTML = `
                <strong>採点診断 Ver6.4.1</strong><br>
                診断データを取得できませんでした。
            `;
            return;
        }

        const d = result.details;
        const knee = d.knee || {};
        const hip = d.hip || {};
        const hand = d.hand || {};
        const takeOff = d.takeOff || {};
        const landing = d.landing || {};

        const total = Number(result.score);
        const totalText = Number.isFinite(total) ? total.toFixed(1) : "-";

        const candidateCount =
            hand.candidateCount !== undefined && hand.candidateCount !== null
                ? hand.candidateCount
                : (result.handCandidateCount !== undefined ? result.handCandidateCount : "-");

        const selectedFrame =
            hand.selectedFrame !== undefined && hand.selectedFrame !== null
                ? hand.selectedFrame
                : (result.selectedHandFrame !== undefined ? result.selectedHandFrame : "-");

        el.innerHTML = `
            <strong>採点診断 Ver6.4.1（採点ロジック変更なし）</strong><br><br>

            <strong>Dスコア:</strong> ${totalText}点<br><br>

            <strong>① 膝</strong><br>
            実測値: ${safeText(measuredText(knee))}<br>
            判定: ${safeText(knee.score, 0)}/2点<br>
            診断: ${safeText(makeReason("膝", knee))}<br><br>

            <strong>② 腰</strong><br>
            実測値: ${safeText(measuredText(hip))}<br>
            判定: ${safeText(hip.score, 0)}/2点<br>
            診断: ${safeText(makeReason("腰", hip))}<br><br>

            <strong>③ 着手</strong><br>
            実測値: ${safeText(measuredText(hand))}<br>
            判定: ${safeText(hand.score, 0)}/2点<br>
            着手候補数: ${safeText(candidateCount)}<br>
            選択着手フレーム: ${safeText(selectedFrame)}<br>
            診断: ${safeText(makeReason("着手", hand))}<br><br>

            <strong>④ 踏切</strong><br>
            実測値: ${safeText(measuredText(takeOff))}<br>
            判定: ${safeText(takeOff.score, 0)}/2点<br>
            診断: ${safeText(makeReason("踏切", takeOff))}<br><br>

            <strong>⑤ 着地</strong><br>
            実測値: ${safeText(measuredText(landing))}<br>
            判定: ${safeText(landing.score, 0)}/2点<br>
            診断: ${safeText(makeReason("着地", landing))}<br><br>

            <small>
                ※ Ver6.4.1 は現在正常に動いている score.js の計算結果を表示しているだけです。<br>
                ※ 点数・実測値・フェーズ判定の計算式は変更していません。
            </small>
        `;
    }

    window.calculateDScore = function (frames, phase) {
        const result = originalCalculateDScore(frames, phase);

        try {
            renderDiagnostics(result);
        } catch (error) {
            console.error("Ver6.4.1 診断表示エラー:", error);
        }

        return result;
    };

    window.renderScoreDiagnostics641 = renderDiagnostics;

    console.log("score.js Ver6.4.1 診断表示追加版 読み込み成功");
})();
