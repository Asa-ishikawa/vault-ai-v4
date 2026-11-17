
/* =========================================================
   forwardRollTest.js Ver1.0
   台上前転・動作フェーズ検出テスト画面
========================================================= */

(function () {
    "use strict";

    function initializeTest() {
        if (document.getElementById("forwardRollTestBtn")) return;

        const detectButton = document.getElementById("detectBtn");

        if (!detectButton) {
            console.error("解析ボタンが見つかりません");
            return;
        }

        // テストボタン
        const testButton = document.createElement("button");
        testButton.id = "forwardRollTestBtn";
        testButton.type = "button";
        testButton.textContent = "台上前転の動作検出テスト";

        testButton.style.cssText = [
            "display:block",
            "margin:12px 0",
            "padding:12px 18px",
            "background:#2878c8",
            "color:white",
            "border:0",
            "border-radius:6px",
            "font-size:15px",
            "cursor:pointer"
        ].join(";");

        // 結果表示欄
        const resultArea = document.createElement("div");
        resultArea.id = "forwardRollTestResult";

        resultArea.style.cssText = [
            "margin:12px 0",
            "padding:14px",
            "background:#f3f7fb",
            "border:1px solid #cbd8e5",
            "border-radius:8px",
            "line-height:1.7",
            "font-size:14px",
            "white-space:normal"
        ].join(";");

        resultArea.innerHTML =
            "台上前転の動画を解析した後、上のボタンを押してください。";

        // 解析ボタンの後ろに追加
        detectButton.insertAdjacentElement("afterend", testButton);
        testButton.insertAdjacentElement("afterend", resultArea);

        testButton.addEventListener("click", function () {
            runTest(resultArea);
        });
    }

    function runTest(resultArea) {
        resultArea.innerHTML = "検出処理を実行しています……";

        try {
            if (typeof window.getPoseFrames !== "function") {
                throw new Error(
                    "getPoseFrames が見つかりません。pose.js の読み込みを確認してください。"
                );
            }

            if (typeof window.detectForwardRollPhases !== "function") {
                throw new Error(
                    "detectForwardRollPhases が見つかりません。forwardRollPhase.js の読み込みを確認してください。"
                );
            }

            const frames = window.getPoseFrames();

            if (!Array.isArray(frames) || frames.length === 0) {
                throw new Error(
                    "骨格データがありません。先に動画を解析してください。"
                );
            }

            const result =
                window.detectForwardRollPhases(frames);

            if (!result) {
                throw new Error("検出結果を取得できませんでした。");
            }

            displayResult(result, resultArea);

        } catch (error) {
            resultArea.innerHTML =
                "<strong>検出テストで問題が発生しました</strong><br>" +
                escapeHTML(error.message);
        }
    }

    function displayResult(result, area) {
        const events = result.detected || {};

        const labels = [
            ["takeOff", "踏切"],
            ["handContact", "着手"],
            ["rotationStart", "回転開始"],
            ["rotationEnd", "回転終了"],
            ["bodyPass", "腰・脚の通過"],
            ["landing", "着地"]
        ];

        let html = "";

        html += "<h3>台上前転・動作検出結果</h3>";

        html +=
            "<p><strong>処理結果：</strong>" +
            escapeHTML(result.message || "結果なし") +
            "</p>";

        html +=
            "<p><strong>解析フレーム数：</strong>" +
            escapeHTML(String(result.frameCount || 0)) +
            "</p>";

        html += "<hr>";

        labels.forEach(function (item) {
            const event = events[item[0]] || {};
            const detected = event.detected === true;

            html += "<div style='margin:10px 0;padding:8px;background:white;border-radius:5px'>";
            html += "<strong>" + item[1] + "</strong><br>";

            if (detected) {
                html += "検出：あり<br>";
                html += "フレーム：" +
                    escapeHTML(String(event.frame)) + "<br>";
                html += "信頼度：" +
                    escapeHTML(String(event.confidence)) + "<br>";
                html += "理由：" +
                    escapeHTML(event.reason || "記載なし");
            } else {
                html += "検出：なし<br>";
                html += "理由：" +
                    escapeHTML(event.reason || "検出できませんでした");
            }

            html += "</div>";
        });

        const diagnostics = result.diagnostics || {};

        html += "<hr><strong>データ診断</strong>";

        html += "<p>跳び箱検出：" +
            (diagnostics.vaultDetected ? "あり" : "不足") +
            "</p>";

        html += "<p>跳び箱検出フレーム数：" +
            escapeHTML(String(diagnostics.vaultFrameCount || 0)) +
            "</p>";

        html += "<p>腰の検出フレーム数：" +
            escapeHTML(String(diagnostics.hipFrameCount || 0)) +
            "</p>";

        if (Array.isArray(result.warnings) &&
            result.warnings.length > 0) {

            html += "<hr><strong>確認事項</strong><ul>";

            result.warnings.forEach(function (warning) {
                html += "<li>" + escapeHTML(warning) + "</li>";
            });

            html += "</ul>";
        }

        html +=
            "<p style='color:#a33;font-weight:bold'>" +
            "※この結果は動作候補です。採点や安全性の確定には使用せず、教師が動画を確認してください。" +
            "</p>";

        area.innerHTML = html;
    }

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeTest
        );
    } else {
        initializeTest();
    }

})();
