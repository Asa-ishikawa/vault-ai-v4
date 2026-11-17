
/* =========================================================
   forwardRollTest.js Ver1.1
   台上前転・手首位置診断機能付き
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
            "white-space:normal",
            "overflow-wrap:anywhere"
        ].join(";");

        resultArea.innerHTML =
            "台上前転の動画を解析した後、上のボタンを押してください。";

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
                throw new Error("getPoseFrames が見つかりません。");
            }

            if (typeof window.detectForwardRollPhases !== "function") {
                throw new Error("detectForwardRollPhases が見つかりません。");
            }

            const frames = window.getPoseFrames();

            if (!Array.isArray(frames) || frames.length === 0) {
                throw new Error("骨格データがありません。先に動画を解析してください。");
            }

            const result = window.detectForwardRollPhases(frames);

            if (!result) {
                throw new Error("検出結果を取得できませんでした。");
            }

            displayResult(result, resultArea);
            displayWristDiagnostics(frames, resultArea);

        } catch (error) {
            resultArea.innerHTML =
                "<strong>検出テストで問題が発生しました</strong><br>" +
                escapeHTML(error.message);
        }
    }

    function getLandmarks(frame) {
        if (!frame) return null;

        return (
            frame.landmarks ||
            frame.poseLandmarks ||
            frame.keypoints ||
            null
        );
    }

    function getWrist(frame, index) {
        const landmarks = getLandmarks(frame);

        if (!landmarks || !landmarks[index]) return null;

        const point = landmarks[index];

        const x = Number(point.x);
        const y = Number(point.y);
        const visibility = Number(point.visibility);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        return {
            x: x,
            y: y,
            visibility: Number.isFinite(visibility) ? visibility : 0
        };
    }

    function getVaultBox(frame) {
        if (!frame || !frame.vaultBox) return null;

        const box = frame.vaultBox;

        const x = Number(box.x);
        const y = Number(box.y);
        const width = Number(box.width);
        const height = Number(box.height);

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return null;
        }

        return {
            x: x,
            y: y,
            width: width,
            height: height,
            right: x + width,
            bottom: y + height
        };
    }

    function getDistanceFromBox(wrist, box) {
        if (!wrist || !box) return null;

        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        return {
            centerX: Math.abs(wrist.x - centerX),
            centerY: Math.abs(wrist.y - centerY),
            topY: wrist.y - box.y,
            leftX: wrist.x - box.x,
            rightX: box.right - wrist.x
        };
    }

    function displayWristDiagnostics(frames, area) {
        let html = "";

        html += "<hr><h3>手首の位置診断</h3>";
        html += "<p>MediaPipeの左右の手首座標と、跳び箱の検出位置を確認します。</p>";

        const sides = [
            { name: "左手首", index: 15 },
            { name: "右手首", index: 16 }
        ];

        sides.forEach(function (side) {
            let validCount = 0;
            let visibleCount = 0;
            let boxCount = 0;
            let samples = [];

            frames.forEach(function (frame, arrayIndex) {
                const wrist = getWrist(frame, side.index);

                if (!wrist) return;

                validCount++;

                if (wrist.visibility >= 0.35) {
                    visibleCount++;
                }

                const box = getVaultBox(frame);

                if (!box) return;

                boxCount++;

                const distance = getDistanceFromBox(wrist, box);

                if (samples.length < 12) {
                    samples.push({
                        frame: frame.frame !== undefined
                            ? frame.frame
                            : arrayIndex,
                        wrist: wrist,
                        box: box,
                        distance: distance
                    });
                }
            });

            html += "<div style='margin:12px 0;padding:10px;background:white;border-radius:6px'>";
            html += "<strong>" + side.name + "</strong>";

            html += "<p>";
            html += "座標取得フレーム数：" + validCount + "<br>";
            html += "visibility 0.35以上：" + visibleCount + "<br>";
            html += "跳び箱も検出されたフレーム数：" + boxCount;
            html += "</p>";

            if (samples.length > 0) {
                html += "<strong>座標サンプル（最大12件）</strong>";
                html += "<div style='overflow-x:auto'>";
                html += "<table style='border-collapse:collapse;width:100%;font-size:12px'>";
                html += "<tr style='background:#e8eef5'>";
                html += "<th style='padding:5px;border:1px solid #ccc'>Frame</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>手首X</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>手首Y</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>Visibility</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱X</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱Y</th>";
                html += "</tr>";

                samples.forEach(function (sample) {
                    html += "<tr>";
                    html += "<td style='padding:5px;border:1px solid #ccc'>" +
                        escapeHTML(String(sample.frame)) + "</td>";
                    html += "<td style='padding:5px;border:1px solid #ccc'>" +
                        sample.wrist.x.toFixed(3) + "</td>";
                    html += "<td style='padding:5px;border:1px solid #ccc'>" +
                        sample.wrist.y.toFixed(3) + "</td>";
                    html += "<td style='padding:5px;border:1px solid #ccc'>" +
                        sample.wrist.visibility.toFixed(3) + "</td>";
                    html += "<td style='padding:5px;border:1px solid #ccc'>" +
                        sample.box.x.toFixed(3) + "</td>";
                    html += "<td style='padding:5px;border:1px solid #ccc'>" +
                        sample.box.y.toFixed(3) + "</td>";
                    html += "</tr>";
                });

                html += "</table></div>";
            } else {
                html += "<p>手首の座標を取得できませんでした。</p>";
            }

            html += "</div>";
        });

        html += "<p style='color:#555;font-size:12px'>";
        html += "※座標は動画内の相対位置です。手首の座標だけで実際の接触を確定することはできません。";
        html += "</p>";

        area.insertAdjacentHTML("beforeend", html);
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

        html += "<p><strong>処理結果：</strong>" +
            escapeHTML(result.message || "結果なし") + "</p>";

        html += "<p><strong>解析フレーム数：</strong>" +
            escapeHTML(String(result.frameCount || 0)) + "</p>";

        html += "<hr>";

        labels.forEach(function (item) {
            const event = events[item[0]] || {};
            const detected = event.detected === true;

            html += "<div style='margin:10px 0;padding:8px;background:white;border-radius:5px'>";
            html += "<strong>" + item[1] + "</strong><br>";

            if (detected) {
                html += "検出：あり<br>";
                html += "フレーム：" + escapeHTML(String(event.frame)) + "<br>";
                html += "信頼度：" + escapeHTML(String(event.confidence)) + "<br>";
                html += "理由：" + escapeHTML(event.reason || "記載なし");
            } else {
                html += "検出：なし<br>";
                html += "理由：" + escapeHTML(event.reason || "検出できませんでした");
            }

            html += "</div>";
        });

        const diagnostics = result.diagnostics || {};

        html += "<hr><strong>データ診断</strong>";

        html += "<p>跳び箱検出：" +
            (diagnostics.vaultDetected ? "あり" : "不足") + "</p>";

        html += "<p>跳び箱検出フレーム数：" +
            escapeHTML(String(diagnostics.vaultFrameCount || 0)) + "</p>";

        html += "<p>腰の検出フレーム数：" +
            escapeHTML(String(diagnostics.hipFrameCount || 0)) + "</p>";

        if (Array.isArray(result.warnings) && result.warnings.length > 0) {
            html += "<hr><strong>確認事項</strong><ul>";

            result.warnings.forEach(function (warning) {
                html += "<li>" + escapeHTML(warning) + "</li>";
            });

            html += "</ul>";
        }

        html += "<p style='color:#a33;font-weight:bold'>";
        html += "※この結果は動作候補です。採点や安全性の確定には使用せず、教師が動画を確認してください。";
        html += "</p>";

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
        document.addEventListener("DOMContentLoaded", initializeTest);
    } else {
        initializeTest();
    }

})();
