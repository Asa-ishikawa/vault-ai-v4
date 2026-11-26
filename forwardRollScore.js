
// ============================================================
// 跳び箱AI採点システム
// forwardRollScore.js Ver2.0
//
// 台上前転専用・動作特徴による暫定採点
//
// 評価項目
// ① 踏切
// ② 着手
// ③ 回転姿勢
// ④ 腰・脚の通過
// ⑤ 着地
//
// 各項目2点・合計10点
//
// 注意
// ・検出信頼度を技の出来栄えの点数に直接変換しない
// ・動作特徴からの暫定評価
// ・判定不能は0点にしない
// ・最終評価は教師が動画を確認する
// ============================================================

(function () {

    "use strict";

    const VERSION = "2.0";

    const CONFIG = {
        MIN_CONFIDENCE: 0.35,
        EXCELLENT_SCORE: 2,
        PARTIAL_SCORE: 1,
        INSUFFICIENT_SCORE: 0
    };

    // --------------------------------------------------------
    // 数値の安全な取得
    // --------------------------------------------------------

    function number(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const n = Number(value);

        return Number.isFinite(n) ? n : null;
    }

    // --------------------------------------------------------
    // イベントの確認
    // --------------------------------------------------------

    function isDetected(event) {

        return !!(
            event &&
            typeof event === "object" &&
            event.detected === true
        );
    }

    function getConfidence(event) {

        if (!isDetected(event)) {
            return null;
        }

        const value = number(event.confidence);

        if (
            value === null ||
            value < 0 ||
            value > 1
        ) {
            return null;
        }

        return value;
    }

    function isReliable(event) {

        const confidence = getConfidence(event);

        return (
            confidence !== null &&
            confidence >= CONFIG.MIN_CONFIDENCE
        );
    }

    // --------------------------------------------------------
    // 判定結果の共通形式
    // --------------------------------------------------------

    function makeResult(
        label,
        score,
        status,
        reason,
        event,
        features
    ) {

        return {

            label: label,

            score: score,

            status: status,

            confidence: getConfidence(event),

            frame: event?.frame ?? null,

            time: event?.time ?? null,

            reason: reason,

            text: reason,

            features: features || {}

        };
    }

    function unknown(label, reason, event) {

        return makeResult(
            label,
            null,
            "判定不能",
            reason,
            event,
            {}
        );
    }

    // --------------------------------------------------------
    // ① 踏切
    //
    // 現在のphase情報では両足の踏切を確定できない。
    // 検出イベントだけで2点にはしない。
    // --------------------------------------------------------

    function evaluateTakeOff(event) {

        if (!isDetected(event)) {

            return unknown(
                "踏切",
                "踏切動作を検出できませんでした。",
                event
            );
        }

        if (!isReliable(event)) {

            return unknown(
                "踏切",
                "踏切候補は検出されましたが、判定の確かさが不足しています。",
                event
            );
        }

        return unknown(
            "踏切",
            "踏切候補を検出しました。両足で踏み切れているか、動画で確認してください。",
            event
        );
    }

    // --------------------------------------------------------
    // ② 着手
    //
    // 手首の位置候補だけでは実際の接触や支持を
    // 確定できないため、教師確認を残す。
    // --------------------------------------------------------

    function evaluateHandContact(event) {

        if (!isDetected(event)) {

            return unknown(
                "着手",
                "着手位置を検出できませんでした。",
                event
            );
        }

        if (!isReliable(event)) {

            return unknown(
                "着手",
                "着手候補の検出信頼度が不足しています。",
                event
            );
        }

        return unknown(
            "着手",
            "手首の位置候補を検出しました。両手の着手位置と支持姿勢を動画で確認してください。",
            event
        );
    }

    // --------------------------------------------------------
    // ③ 回転姿勢
    //
    // 回転開始と終了の検出を確認する。
    // ただし、現在のphase情報だけでは身体の丸まりを
    // 正確に採点できないため、教師確認を残す。
    // --------------------------------------------------------

    function evaluateRotation(start, end) {

        if (
            !isDetected(start) ||
            !isDetected(end)
        ) {

            return unknown(
                "回転姿勢",
                "回転の開始または終了を検出できませんでした。",
                start
            );
        }

        if (
            !isReliable(start) ||
            !isReliable(end)
        ) {

            return unknown(
                "回転姿勢",
                "回転の検出信頼度が不足しています。",
                start
            );
        }

        return unknown(
            "回転姿勢",
            "回転の開始と終了を検出しました。身体の丸まりと回転の滑らかさを動画で確認してください。",
            start
        );
    }

    // --------------------------------------------------------
    // ④ 腰・脚の通過
    //
    // bodyPassイベントは候補検出であり、
    // 通過の完成度を確定するものではない。
    // --------------------------------------------------------

    function evaluateBodyPass(event) {

        if (!isDetected(event)) {

            return unknown(
                "腰・脚の通過",
                "腰・脚の通過を検出できませんでした。",
                event
            );
        }

        if (!isReliable(event)) {

            return unknown(
                "腰・脚の通過",
                "腰・脚の通過候補の検出信頼度が不足しています。",
                event
            );
        }

        return unknown(
            "腰・脚の通過",
            "通過候補を検出しました。腰の位置と脚の通過を動画で確認してください。",
            event
        );
    }

    // --------------------------------------------------------
    // ⑤ 着地
    //
    // 足首の動きが小さいことだけでは接地や安定を
    // 確定できないため、教師確認を残す。
    // --------------------------------------------------------

    function evaluateLanding(event) {

        if (!isDetected(event)) {

            return unknown(
                "着地",
                "着地候補を検出できませんでした。",
                event
            );
        }

        if (!isReliable(event)) {

            return unknown(
                "着地",
                "着地候補の検出信頼度が不足しています。",
                event
            );
        }

        return unknown(
            "着地",
            "着地候補を検出しました。両足での着地と姿勢の安定を動画で確認してください。",
            event
        );
    }

    // --------------------------------------------------------
    // メイン採点
    // --------------------------------------------------------

    function calculateForwardRollDScore(frames, phase) {

        console.log(
            "forwardRollScore.js Ver" + VERSION
        );

        if (
            !Array.isArray(frames) ||
            frames.length < 5
        ) {

            console.error("台上前転：骨格フレーム不足");

            return null;
        }

        if (
            !phase ||
            !phase.detected
        ) {

            console.error("台上前転：フェーズデータ不足");

            return null;
        }

        const detected = phase.detected;

        const details = {

            takeOff: evaluateTakeOff(
                detected.takeOff
            ),

            handContact: evaluateHandContact(
                detected.handContact
            ),

            rotation: evaluateRotation(
                detected.rotationStart,
                detected.rotationEnd
            ),

            bodyPass: evaluateBodyPass(
                detected.bodyPass
            ),

            landing: evaluateLanding(
                detected.landing
            )

        };

        const keys = [
            "takeOff",
            "handContact",
            "rotation",
            "bodyPass",
            "landing"
        ];

        let totalScore = 0;
        let judgedCount = 0;
        let unknownCount = 0;

        keys.forEach(function (key) {

            const item = details[key];

            if (Number.isFinite(item.score)) {

                totalScore += item.score;
                judgedCount++;

            } else {

                unknownCount++;

            }

        });

        const isComplete = judgedCount === 5;

        const result = {

            skill: "台上前転",

            version: VERSION,

            score: totalScore,

            maxScore: judgedCount * 2,

            fullScore: isComplete
                ? totalScore
                : null,

            judgedCount: judgedCount,

            unknownCount: unknownCount,

            isComplete: isComplete,

            details: details,

            phase: phase,

            warnings: [

                "AIによる動作検出は暫定的なものです。",

                "検出信頼度は技の出来栄えを示す点数ではありません。",

                "両足踏切・手の接触・支持・着地の安定性は教師が動画で確認してください。",

                "判定不能は0点として扱いません。"

            ]

        };

        console.log(
            "台上前転 採点結果",
            result
        );

        return result;
    }

    // --------------------------------------------------------
    // 公開
    // --------------------------------------------------------

    window.calculateForwardRollDScore =
        calculateForwardRollDScore;

    window.FORWARD_ROLL_SCORE_VERSION =
        VERSION;

    console.log(
        "forwardRollScore.js Ver" +
        VERSION +
        " 読み込み成功"
    );

})();
