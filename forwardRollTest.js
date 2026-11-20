
/* =========================================================
   forwardRollTest.js Ver1.4
   台上前転・手首／腰／脚の詳細座標診断

   Ver1.4 追加点
   ・腰、膝、足首の実座標を表示
   ・跳び箱に対する腰の相対座標を表示
   ・腰・脚の通過判定から除外された理由を表示
   ・handContactからlandingまでのフレームを診断
   ・既存の開脚跳びには影響しない
========================================================= */

(function () {
    "use strict";

    function initializeTest() {
        if (document.getElementById("forwardRollTestBtn")) return;

        const detectButton = document.getElementById("detectBtn");
        if (!detectButton) return;

        const button = document.createElement("button");
        button.id = "forwardRollTestBtn";
        button.type = "button";
        button.textContent = "台上前転の詳細診断";
        button.style.cssText =
            "display:block;margin:12px 0;padding:12px 18px;" +
            "background:#2878c8;color:white;border:0;" +
            "border-radius:6px;font-size:15px;cursor:pointer";

        const area = document.createElement("div");
        area.id = "forwardRollTestResult";
        area.style.cssText =
            "margin:12px 0;padding:14px;background:#f3f7fb;" +
            "border:1px solid #cbd8e5;border-radius:8px;" +
            "line-height:1.7;font-size:13px;overflow-wrap:anywhere";

        area.textContent =
            "動画を最後まで解析した後、詳細診断ボタンを押してください。";

        detectButton.insertAdjacentElement("afterend", button);
        button.insertAdjacentElement("afterend", area);

        button.addEventListener("click", function () {
            runTest(area);
        });
    }

    function runTest(area) {
        area.textContent = "診断中です……";

        try {
            if (typeof window.getPoseFrames !== "function") {
                throw new Error("getPoseFrames が見つかりません。");
            }
            if (typeof window.detectForwardRollPhases !== "function") {
                throw new Error("detectForwardRollPhases が見つかりません。");
            }

            const frames = window.getPoseFrames();
            if (!Array.isArray(frames) || !frames.length) {
                throw new Error("骨格データがありません。先に動画を解析してください。");
            }

            const result = window.detectForwardRollPhases(frames);
            if (!result) throw new Error("検出結果を取得できませんでした。");

            area.innerHTML = "";
            displayResult(result, area);
            displayBodyDiagnostics(frames, result, area);
            displayWristDiagnostics(frames, area);

        } catch (error) {
            area.innerHTML =
                "<strong>診断エラー</strong><p>" +
                esc(error.message) + "</p>";
        }
    }

    // -----------------------------------------------------
    // 基本データ取得
    // -----------------------------------------------------

    function getLandmarks(frame) {
        if (!frame) return null;
        if (Array.isArray(frame.landmarks)) return frame.landmarks;
        if (Array.isArray(frame.poseLandmarks)) return frame.poseLandmarks;
        return null;
    }

    function getPoint(frame, index) {
        const landmarks = getLandmarks(frame);
        if (!landmarks || !landmarks[index]) return null;

        const p = landmarks[index];
        const x = Number(p.x);
        const y = Number(p.y);
        const visibility = Number(p.visibility);

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        if (Number.isFinite(visibility) && visibility < 0.35) return null;

        return {
            x: x,
            y: y,
            visibility: Number.isFinite(visibility) ? visibility : 0
        };
    }

    function averagePoints(points) {
        const valid = points.filter(Boolean);
        if (!valid.length) return null;

        return {
            x: valid.reduce((s, p) => s + p.x, 0) / valid.length,
            y: valid.reduce((s, p) => s + p.y, 0) / valid.length
        };
    }

    function getHip(frame) {
        return averagePoints([
            getPoint(frame, 23),
            getPoint(frame, 24)
        ]);
    }

    function getKnees(frame) {
        return [
            getPoint(frame, 25),
            getPoint(frame, 26)
        ].filter(Boolean);
    }

    function getAnkles(frame) {
        return [
            getPoint(frame, 27),
            getPoint(frame, 28)
        ].filter(Boolean);
    }

    function getBox(frame) {
        if (!frame || !frame.vaultBox) return null;

        const b = frame.vaultBox;
        const x = Number(b.x);
        const y = Number(b.y);
        const width = Number(b.width);
        const height = Number(b.height);

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) return null;

        return {
            x: x,
            y: y,
            width: width,
            height: height
        };
    }

    function fmt(value) {
        return Number.isFinite(value) ? value.toFixed(3) : "-";
    }

    function cell(value) {
        return "<td style='border:1px solid #ccc;padding:4px;white-space:nowrap'>" +
            esc(String(value)) + "</td>";
    }

    function tableStart(headers) {
        let html = "<div style='overflow-x:auto'><table " +
            "style='border-collapse:collapse;background:white;font-size:11px'>";
        html += "<tr style='background:#e3ebf4'>";
        headers.forEach(h => {
            html += "<th style='border:1px solid #ccc;padding:4px'>" +
                esc(h) + "</th>";
        });
        return html + "</tr>";
    }

    // -----------------------------------------------------
    // 腰・脚の通過詳細診断
    // -----------------------------------------------------

    function displayBodyDiagnostics(frames, result, area) {
        const events = result.detected || {};
        const hand = events.handContact || {};
        const landing = events.landing || {};

        let start = hand.detected ? Number(hand.frame) + 1 : 0;
        let end = landing.detected ? Number(landing.frame) : frames.length - 1;

        if (!Number.isFinite(start)) start = 0;
        if (!Number.isFinite(end)) end = frames.length - 1;

        start = Math.max(0, start);
        end = Math.min(frames.length - 1, end);

        let html = "<hr><h3>腰・脚の通過 フレーム別詳細診断 Ver1.4</h3>";
        html += "<p>診断対象：Frame " + start + " ～ Frame " + end + "</p>";
        html += "<p>判定範囲は forwardRollPhase.js Ver1.4 の条件に合わせています。</p>";
       

        const rows = [];
        const counts = {
            noBox: 0,
            noHip: 0,
            horizontal: 0,
            vertical: 0,
            noLeg: 0,
            inRange: 0
        };

        for (let i = start; i <= end; i++) {
            const frame = frames[i];
            const hip = getHip(frame);
            const box = getBox(frame);
            const knees = getKnees(frame);
            const ankles = getAnkles(frame);
            const legs = knees.concat(ankles);

            let relativeX = NaN;
            let relativeY = NaN;
            let reason = "";

            if (!box) {
                reason = "跳び箱データなし";
                counts.noBox++;
            } else if (!hip) {
                reason = "腰データなし";
                counts.noHip++;
            } else {
                relativeX = (hip.x - box.x) / box.width;
                relativeY = (hip.y - box.y) / box.width;

            
const horizontalInside =
    relativeX >= -0.30 && relativeX <= 2.10;

const verticalInside =
    relativeY >= -0.75 && relativeY <= 0.75;

                if (!horizontalInside) {
                    reason = "左右範囲外";
                    counts.horizontal++;
                } else if (!verticalInside) {
                    reason = "上下範囲外";
                    counts.vertical++;
                } else if (!legs.length) {
                    reason = "膝・足首データなし";
                    counts.noLeg++;
                } else {
                    const legsAboveHip = legs.some(
                        p => p.y < hip.y + 0.08
                    );

                    reason = legsAboveHip
                        ? "位置条件OK・脚条件OK"
                        : "脚が腰より上にない";

                    counts.inRange++;
                }
            }

            rows.push({
                frame: i,
                hip: hip,
                box: box,
                knees: knees,
                ankles: ankles,
                rx: relativeX,
                ry: relativeY,
                reason: reason
            });
        }

        html += "<div style='padding:10px;background:white;border:1px solid #ccd6e0;border-radius:6px'>";
        html += "<strong>除外理由の集計</strong><ul>";
        html += "<li>跳び箱データなし：" + counts.noBox + "フレーム</li>";
        html += "<li>腰データなし：" + counts.noHip + "フレーム</li>";
        html += "<li>左右範囲外：" + counts.horizontal + "フレーム</li>";
        html += "<li>上下範囲外：" + counts.vertical + "フレーム</li>";
        html += "<li>膝・足首データなし：" + counts.noLeg + "フレーム</li>";
        html += "<li>位置条件を通過：" + counts.inRange + "フレーム</li>";
        html += "</ul></div>";

        html += "<p><strong>フレームごとの座標一覧</strong></p>";
        html += tableStart([
            "Frame", "腰X", "腰Y",
            "箱X", "箱Y", "箱幅",
            "相対X", "相対Y",
            "膝数", "足首数", "判定・除外理由"
        ]);

        rows.forEach(r => {
            html += "<tr>";
            html += cell(r.frame);
            html += cell(r.hip ? fmt(r.hip.x) : "-");
            html += cell(r.hip ? fmt(r.hip.y) : "-");
            html += cell(r.box ? fmt(r.box.x) : "-");
            html += cell(r.box ? fmt(r.box.y) : "-");
            html += cell(r.box ? fmt(r.box.width) : "-");
            html += cell(fmt(r.rx));
            html += cell(fmt(r.ry));
            html += cell(r.knees.length);
            html += cell(r.ankles.length);
            html += cell(r.reason);
            html += "</tr>";
        });

        html += "</table></div>";

        html += "<p style='font-size:12px;color:#555'>";
        html += "相対X=(腰X－箱X)÷箱幅、相対Y=(腰Y－箱Y)÷箱幅。";
        html += "判定条件は相対Xが-0.30～2.10、相対Yが-0.75～0.75です。";
        html += "</p>";

        area.insertAdjacentHTML("beforeend", html);
    }

    // -----------------------------------------------------
    // 手首・跳び箱の座標診断
    // -----------------------------------------------------

    function displayWristDiagnostics(frames, area) {
        let html = "<hr><h3>手首・跳び箱の座標診断</h3>";

        const sides = [
            { name: "左手首", index: 15 },
            { name: "右手首", index: 16 }
        ];

        sides.forEach(side => {
            let count = 0;
            const rows = [];

            frames.forEach((frame, i) => {
                const wrist = getPoint(frame, side.index);
                const box = getBox(frame);
                if (!wrist || !box) return;

                count++;
                if (rows.length < 20) {
                    rows.push({
                        frame: i,
                        wrist: wrist,
                        box: box,
                        rx: (wrist.x - box.x) / box.width,
                        ry: (wrist.y - box.y) / box.height
                    });
                }
            });

            html += "<h4>" + side.name + "（跳び箱同時検出 " +
                count + "フレーム）</h4>";

            if (!rows.length) {
                html += "<p>同時に取得できたフレームがありません。</p>";
                return;
            }

            html += tableStart([
                "Frame", "手X", "手Y", "Visibility",
                "箱X", "箱Y", "箱幅", "箱高",
                "相対X", "相対Y"
            ]);

            rows.forEach(r => {
                html += "<tr>";
                html += cell(r.frame);
                html += cell(fmt(r.wrist.x));
                html += cell(fmt(r.wrist.y));
                html += cell(fmt(r.wrist.visibility));
                html += cell(fmt(r.box.x));
                html += cell(fmt(r.box.y));
                html += cell(fmt(r.box.width));
                html += cell(fmt(r.box.height));
                html += cell(fmt(r.rx));
                html += cell(fmt(r.ry));
                html += "</tr>";
            });

            html += "</table></div>";
        });

        area.insertAdjacentHTML("beforeend", html);
    }

    // -----------------------------------------------------
    // 動作検出結果
    // -----------------------------------------------------

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

        let html = "<h3>台上前転・動作検出結果</h3>";
        html += "<p><strong>処理結果：</strong>" +
            esc(result.message || "結果なし") + "</p>";
        html += "<p><strong>解析フレーム数：</strong>" +
            esc(result.frameCount || 0) + "</p><hr>";

        labels.forEach(item => {
            const e = events[item[0]] || {};
            html += "<div style='margin:8px 0;padding:8px;background:white;border-radius:5px'>";
            html += "<strong>" + item[1] + "</strong><br>";
            html += "検出：" + (e.detected ? "あり" : "なし") + "<br>";

            if (e.detected) {
                html += "フレーム：" + esc(e.frame) + "<br>";
                html += "信頼度：" + esc(e.confidence) + "<br>";
            }

            html += "理由：" + esc(e.reason || "記載なし");
            html += "</div>";
        });

        const d = result.diagnostics || {};
        html += "<hr><strong>データ診断</strong>";
        html += "<p>跳び箱検出：" + (d.vaultDetected ? "あり" : "不足") + "<br>";
        html += "跳び箱検出フレーム数：" + esc(d.vaultFrameCount || 0) + "<br>";
        html += "腰の検出フレーム数：" + esc(d.hipFrameCount || 0) + "</p>";

        const body = events.bodyPass || {};
        const candidateCount = d.bodyPassCandidateCount !== undefined
            ? d.bodyPassCandidateCount : body.candidateCount;
        const bestScore = d.bodyPassBestScore !== undefined
            ? d.bodyPassBestScore : body.bestScore;

        html += "<hr><strong>腰・脚の通過 詳細診断</strong>";
        html += "<p>通過候補数：" +
            (candidateCount !== undefined ? esc(candidateCount) : "未取得") +
            "<br>最高信頼度：" +
            (Number.isFinite(Number(bestScore))
                ? Number(bestScore).toFixed(3) : "未取得") +
            "</p>";

        const candidates = Array.isArray(body.candidates)
            ? body.candidates : [];

        if (candidates.length) {
            html += "<strong>通過候補フレーム一覧</strong><ul>";
            candidates.forEach(c => {
                html += "<li>Frame " + esc(c.frame) +
                    " / 信頼度 " + esc(
                        Number.isFinite(Number(c.score))
                            ? Number(c.score).toFixed(3) : "-"
                    ) + "</li>";
            });
            html += "</ul>";
        } else {
            html += "<p>候補フレーム一覧はありません。</p>";
        }

        const handCandidates = result.handCandidates || [];
        html += "<hr><strong>着手候補一覧</strong>";

        if (handCandidates.length) {
            html += "<ul>";
            handCandidates.forEach(c => {
                html += "<li>Frame " + esc(c.frame) + " / " +
                    esc(c.side) + " / " + esc(c.contactArea) +
                    " / 信頼度 " + esc(c.confidence) + "</li>";
            });
            html += "</ul>";
        } else {
            html += "<p>着手候補はありません。</p>";
        }

        if (Array.isArray(result.warnings) && result.warnings.length) {
            html += "<hr><strong>確認事項</strong><ul>";
            result.warnings.forEach(w => {
                html += "<li>" + esc(w) + "</li>";
            });
            html += "</ul>";
        }

        html += "<p style='color:#a33;font-weight:bold'>";
        html += "※この結果は動作候補です。実際の接触や安全性を確定するものではありません。教師が動画を確認してください。";
        html += "</p>";

        area.innerHTML = html;
    }

    function esc(value) {
        return String(value === undefined || value === null ? "-" : value)
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
