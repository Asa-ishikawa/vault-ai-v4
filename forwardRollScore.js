
// ============================================================
// 跳び箱AI採点システム
// forwardRollScore.js Ver1.0
//
// 台上前転専用・暫定採点
//
// 評価項目
// ① 踏切
// ② 着手
// ③ 回転姿勢
// ④ 腰・脚の通過
// ⑤ 着地
//
// 注意
// ・AIの検出信頼度による暫定評価
// ・動作の質や安全性を確定するものではない
// ・未検出項目は0点ではなく「判定不能」
// ・最終評価は教師が動画を確認する
//
// 既存のscore.jsには変更を加えない
// ============================================================

(function () {

    "use strict";

    const VERSION = "1.0";

    // --------------------------------------------------------
    // 信頼度による暫定点
    // --------------------------------------------------------

    const CONFIG = {
        TWO_POINT: 0.60,
        ONE_POINT: 0.40
    };


    // --------------------------------------------------------
    // 信頼度を安全に取得
    // --------------------------------------------------------

    function getConfidence(event) {

        if (!event || typeof event !== "object") {
            return null;
        }

        const value = event.confidence;

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number = Number(value);

        if (
            !Number.isFinite(number) ||
            number < 0 ||
            number > 1
        ) {
            return null;
        }

        return number;
    }


    // --------------------------------------------------------
    // イベントが検出されているか確認
    // --------------------------------------------------------

    function isDetected(event) {

        return !!(
            event &&
            typeof event === "object" &&
            event.detected === true
        );
    }


    // --------------------------------------------------------
    // 1項目の採点
    // --------------------------------------------------------

    function evaluateEvent(event, label) {

        // 検出されていない
        if (!isDetected(event)) {

            return {
                label: label,
                score: null,
                status: "判定不能",
                confidence: null,
                frame: null,
                time: null,
                text: label + "を検出できませんでした。動画を確認してください。"
            };
        }


        const confidence = getConfidence(event);


        // 信頼度が取得できない
        if (confidence === null) {

            return {
                label: label,
                score: null,
                status: "判定不能",
                confidence: null,
                frame: event.frame ?? null,
                time: event.time ?? null,
                text: label + "は検出されましたが、信頼度を取得できませんでした。"
            };
        }


        // 信頼度に応じた暫定点
        let score;
        let status;
        let text;


        if (confidence >= CONFIG.TWO_POINT) {

            score = 2;
            status = "検出・高信頼度";
            text = label + "を比較的高い信頼度で検出しました。";

        }

        else if (confidence >= CONFIG.ONE_POINT) {

            score = 1;
            status = "検出・中信頼度";
            text = label + "を検出しましたが、確認が必要です。";

        }

        else {

            score = 0;
            status = "検出・低信頼度";
            text = label + "の検出信頼度が低いため、動画で確認してください。";

        }


        return {
            label: label,
            score: score,
            status: status,
            confidence: confidence,
            frame: event.frame ?? null,
            time: event.time ?? null,
            text: text
        };
    }


    // --------------------------------------------------------
    // 回転姿勢
    //
    // 回転開始・回転終了の両方を確認する
    // --------------------------------------------------------

    function evaluateRotation(rotationStart, rotationEnd) {

        const label = "回転姿勢";


        if (
            !isDetected(rotationStart) ||
            !isDetected(rotationEnd)
        ) {

            return {
                label: label,
                score: null,
                status: "判定不能",
                confidence: null,
                frame: null,
                time: null,
                text: "回転の開始または終了を検出できませんでした。"
            };
        }


        const startConfidence =
            getConfidence(rotationStart);

        const endConfidence =
            getConfidence(rotationEnd);


        if (
            startConfidence === null ||
            endConfidence === null
        ) {

            return {
                label: label,
                score: null,
                status: "判定不能",
                confidence: null,
                frame: null,
                time: null,
                text: "回転姿勢の信頼度を取得できませんでした。"
            };
        }


        // 低い方の信頼度を採用
        const confidence = Math.min(
            startConfidence,
            endConfidence
        );


        return evaluateEvent(
            {
                detected: true,
                confidence: confidence,
                frame: rotationStart.frame,
                time: rotationStart.time
            },
            label
        );
    }


    // --------------------------------------------------------
    // メイン採点
    // --------------------------------------------------------

    function calculateForwardRollDScore(frames, phase) {

        console.log("================================");
        console.log("forwardRollScore.js Ver" + VERSION);
        console.log("台上前転 採点開始");
        console.log("================================");


        // ----------------------------------------------------
        // データ確認
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // 5項目の評価
        // ----------------------------------------------------

        const details = {

            takeOff: evaluateEvent(
                detected.takeOff,
                "踏切"
            ),

            handContact: evaluateEvent(
                detected.handContact,
                "着手"
            ),

            rotation: evaluateRotation(
                detected.rotationStart,
                detected.rotationEnd
            ),

            bodyPass: evaluateEvent(
                detected.bodyPass,
                "腰・脚の通過"
            ),

            landing: evaluateEvent(
                detected.landing,
                "着地"
            )

        };


        // ----------------------------------------------------
        // 判定できた項目だけ合計
        // ----------------------------------------------------

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

            if (
                Number.isFinite(item.score)
            ) {

                totalScore += item.score;
                judgedCount++;

            } else {

                unknownCount++;

            }

        });


        const isComplete =
            judgedCount === 5;


        // ----------------------------------------------------
        // 結果
        //
        // score：判定できた項目の暫定点合計
        // maxScore：判定できた項目の配点合計
        // fullScore：5項目すべて判定できた場合のみ10点満点
        // ----------------------------------------------------

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

            warnings: []

        };


        // ----------------------------------------------------
        // 注意事項
        // ----------------------------------------------------

        result.warnings.push(
            "この点数はAIの検出信頼度に基づく暫定評価です。"
        );

        result.warnings.push(
            "動作の質や安全性をAIだけで確定することはできません。"
        );

        result.warnings.push(
            "最終評価は教師が動画を確認して判断してください。"
        );


        if (!isComplete) {

            result.warnings.push(
                "判定不能の項目があります。10点満点の確定点は表示できません。"
            );

        }


        // ----------------------------------------------------
        // 診断ログ
        // ----------------------------------------------------

        console.log("========== 台上前転 採点結果 ==========");

        console.log("踏切:", details.takeOff);
        console.log("着手:", details.handContact);
        console.log("回転姿勢:", details.rotation);
        console.log("腰・脚の通過:", details.bodyPass);
        console.log("着地:", details.landing);

        console.log("判定済み項目:", judgedCount);
        console.log("判定不能項目:", unknownCount);

        console.log("暫定合計:", totalScore);
        console.log("判定可能な配点:", judgedCount * 2);
        console.log("10点満点の確定:", isComplete);

        console.log("======================================");


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
        "forwardRollScore.js Ver" + VERSION + " 読み込み成功"
    );

})();
