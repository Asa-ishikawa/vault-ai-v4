
/* =========================================================
   forwardRollTest.js Ver1.2
   台上前転・手首座標詳細診断

   Ver1.2 修正点
   ・手首の実座標を表示
   ・跳び箱の実座標を表示
   ・跳び箱に対する相対座標を表示
   ・左右の手首を独立して診断
   ・Visibilityを表示
   ・跳び箱検出フレームのみの診断表を表示
   ・既存の開脚跳びには影響しない
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
        testButton.textContent = "台上前転の詳細診断";

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
            "動画を解析した後、詳細診断ボタンを押してください。";

        detectButton.insertAdjacentElement("afterend", testButton);
        testButton.insertAdjacentElement("afterend", resultArea);

        testButton.addEventListener("click", function () {
            runTest(resultArea);
        });
    }

    // =====================================================
    // メイン処理
    // =====================================================

    function runTest(resultArea) {
        resultArea.innerHTML = "診断処理を実行しています……";

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

            resultArea.innerHTML = "";

            displayResult(result, resultArea);
            displayCoordinateDiagnostics(frames, resultArea);

        } catch (error) {
            resultArea.innerHTML =
                "<strong>診断エラー</strong><br>" +
                escapeHTML(error.message);
        }
    }

    // =====================================================
    // データ取得
    // =====================================================

    function getLandmarks(frame) {
        if (!frame) return null;

        if (Array.isArray(frame.landmarks)) {
            return frame.landmarks;
        }

        if (Array.isArray(frame.poseLandmarks)) {
            return frame.poseLandmarks;
        }

        return null;
    }

    function getWrist(frame, landmarkIndex, directKey) {
        if (!frame) return null;

        const landmarks = getLandmarks(frame);

        let point = null;

        if (
            landmarks &&
            landmarks[landmarkIndex]
        ) {
            point = landmarks[landmarkIndex];
        }

        // landmarksがない場合の補助取得
        if (!point && frame[directKey]) {
            point = frame[directKey];
        }

        if (!point) return null;

        const x = Number(point.x);
        const y = Number(point.y);
        const visibility = Number(point.visibility);

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return null;
        }

        return {
            x: x,
            y: y,
            visibility: Number.isFinite(visibility)
                ? visibility
                : 0
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
            bottom: y + height,
            confidence: Number(box.confidence) || 0
        };
    }

    // =====================================================
    // 相対座標計算
    // =====================================================

    function getRelativePosition(wrist, box) {
        if (!wrist || !box) return null;

        return {
            x: (wrist.x - box.x) / box.width,
            y: (wrist.y - box.y) / box.height
        };
    }

    function getInsideBox(wrist, box) {
        if (!wrist || !box) return false;

        return (
            wrist.x >= box.x &&
            wrist.x <= box.right &&
            wrist.y >= box.y &&
            wrist.y <= box.bottom
        );
    }

    // =====================================================
    // 数値表示
    // =====================================================

    function fmt(value) {
        if (!Number.isFinite(value)) return "-";
        return value.toFixed(3);
    }

    function makeCell(value) {
        return "<td style='padding:5px;border:1px solid #ccc'>" +
            escapeHTML(String(value)) +
            "</td>";
    }

    // =====================================================
    // 座標診断
    // =====================================================

    function displayCoordinateDiagnostics(frames, area) {
        let html = "";

        html += "<hr>";
        html += "<h3>手首・跳び箱の座標診断 Ver1.2</h3>";

        html += "<p>";
        html += "手首の実座標と、跳び箱に対する相対座標を分けて表示します。";
        html += "</p>";

        const sides = [
            {
                name: "左手首",
                index: 15,
                key: "leftWrist"
            },
            {
                name: "右手首",
                index: 16,
                key: "rightWrist"
            }
        ];

        sides.forEach(function (side) {
            let validCount = 0;
            let visibleCount = 0;
            let vaultCount = 0;
            let candidateCount = 0;

            const samples = [];

            frames.forEach(function (frame, arrayIndex) {
                const wrist = getWrist(
                    frame,
                    side.index,
                    side.key
                );

                const box = getVaultBox(frame);

                if (!wrist) return;

                validCount++;

                if (wrist.visibility >= 0.35) {
                    visibleCount++;
                }

                if (!box) return;

                vaultCount++;

                const relative = getRelativePosition(
                    wrist,
                    box
                );

                const inside = getInsideBox(wrist, box);

                // 跳び箱が検出されているフレームを保存
                if (samples.length < 20) {
                    samples.push({
                        frame: Number.isFinite(frame.frame)
                            ? frame.frame
                            : arrayIndex,
                        time: Number(frame.time),
                        wrist: wrist,
                        box: box,
                        relative: relative,
                        inside: inside
                    });
                }

                if (
                    wrist.visibility >= 0.35 &&
                    relative.x >= -0.5 &&
                    relative.x <= 1.5 &&
                    relative.y >= -1 &&
                    relative.y <= 1.5
                ) {
                    candidateCount++;
                }
            });

            html += "<div style='margin:14px 0;padding:12px;background:white;border:1px solid #d5dce5;border-radius:7px'>";

            html += "<h4>" + side.name + "</h4>";

            html += "<p>";
            html += "手首座標取得数：" + validCount + "フレーム<br>";
            html += "Visibility 0.35以上：" + visibleCount + "フレーム<br>";
            html += "跳び箱同時検出数：" + vaultCount + "フレーム<br>";
            html += "跳び箱周辺の広い範囲に入る数：" + candidateCount + "フレーム";
            html += "</p>";

            if (samples.length > 0) {
                html += "<strong>座標一覧（最大20フレーム）</strong>";

                html += "<div style='overflow-x:auto'>";
                html += "<table style='border-collapse:collapse;width:100%;font-size:12px;background:white'>";

                html += "<tr style='background:#e8eef5'>";
                html += "<th style='padding:5px;border:1px solid #ccc'>Frame</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>手X</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>手Y</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>Vis</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱X</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱Y</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱幅</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱高</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>相対X</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>相対Y</th>";
                html += "<th style='padding:5px;border:1px solid #ccc'>箱内</th>";
                html += "</tr>";

                samples.forEach(function (sample) {
                    html += "<tr>";

                    html += makeCell(sample.frame);
                    html += makeCell(fmt(sample.wrist.x));
                    html += makeCell(fmt(sample.wrist.y));
                    html += makeCell(fmt(sample.wrist.visibility));

                    html += makeCell(fmt(sample.box.x));
                    html += makeCell(fmt(sample.box.y));
                    html += makeCell(fmt(sample.box.width));
                    html += makeCell(fmt(sample.box.height));

                    html += makeCell(fmt(sample.relative.x));
                    html += makeCell(fmt(sample.relative.y));

                    html += makeCell(
                        sample.inside ? "はい" : "いいえ"
                    );

                    html += "</tr>";
                });

                html += "</table>";
                html += "</div>";

            } else {
                html += "<p>跳び箱と手首を同時に取得できたフレームがありません。</p>";
            }

            html += "</div>";
        });

        html += "<p style='font-size:12px;color:#555'>";
        html += "※相対X=0は跳び箱の左端、相対X=1は右端です。";
        html += "相対Y=0は跳び箱の上端、相対Y=1は下端です。";
        html += "</p>";

        area.insertAdjacentHTML("beforeend", html);
    }

    // =====================================================
    // 動作検出結果表示
    // =====================================================

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
            escapeHTML(result.message || "結果なし") +
            "</p>";

        html += "<p><strong>解析フレーム数：</strong>" +
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
                    escapeHTML(String(event.frame)) +
                    "<br>";

                html += "信頼度：" +
                    escapeHTML(String(event.confidence)) +
                    "<br>";

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

        const candidates = result.handCandidates || [];

        html += "<hr><strong>着手候補一覧</strong>";

        if (candidates.length > 0) {
            html += "<ul>";

            candidates.forEach(function (candidate) {
                html += "<li>";
                html += "Frame " +
                    escapeHTML(String(candidate.frame)) +
                    " / ";

                html += escapeHTML(candidate.side) +
                    " / ";

                html += escapeHTML(candidate.contactArea) +
                    " / 信頼度 ";

                html += escapeHTML(String(candidate.confidence));
                html += "</li>";
            });

            html += "</ul>";

        } else {
            html += "<p>着手候補はありません。</p>";
        }

        if (
            Array.isArray(result.warnings) &&
            result.warnings.length > 0
        ) {
            html += "<hr><strong>確認事項</strong><ul>";

            result.warnings.forEach(function (warning) {
                html += "<li>" + escapeHTML(warning) + "</li>";
            });

            html += "</ul>";
        }

        html += "<p style='color:#a33;font-weight:bold'>";
        html += "※この結果は動作候補です。実際の接触や安全性を確定するものではありません。教師が動画を確認してください。";
        html += "</p>";

        area.innerHTML = html;
    }

    // =====================================================
    // HTMLエスケープ
    // =====================================================

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // =====================================================
    // 初期化
    // =====================================================

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeTest
        );
    } else {
        initializeTest();
    }

})();
