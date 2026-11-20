
/*
 * forwardRollFeedback.js
 * 台上前転専用 AI評価コメント表示
 * Ver1.0
 */

(function () {
    "use strict";

    const ITEMS = [
        { key: "takeOff", label: "① 踏切" },
        { key: "handContact", label: "② 着手" },
        { key: "rotation", label: "③ 回転" },
        { key: "bodyPass", label: "④ 腰の通過" },
        { key: "landing", label: "⑤ 着地" }
    ];

    function createElement(tag, text, className) {
        const element = document.createElement(tag);

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        if (className) {
            element.className = className;
        }

        return element;
    }

    function getItemStatus(item) {
        if (!item || item.score === null || item.score === undefined) {
            return "判定不能";
        }

        return "暫定 " + item.score + " / 2 点";
    }

    function getConfidence(item) {
        if (!item || typeof item.confidence !== "number") {
            return "";
        }

        return "検出信頼度：" +
            Math.round(item.confidence * 100) + "%";
    }

    function showForwardRollFeedback(result) {
        const target = document.getElementById("feedback");

        if (!target) {
            console.error("feedback表示欄が見つかりません。");
            return;
        }

        target.replaceChildren();

        if (!result || !result.details) {
            target.appendChild(
                createElement("p", "台上前転の評価結果を取得できませんでした。")
            );
            return;
        }

        const title = createElement("h3", "台上前転 AI評価結果");
        target.appendChild(title);

        const judgedCount = Number(result.judgedCount) || 0;
        const unknownCount = Number(result.unknownCount) || 0;
        const score = Number(result.score) || 0;

        const summary = createElement("div");
        summary.style.cssText =
            "margin:10px 0;padding:12px;" +
            "background:#eef5ff;border-radius:8px;";

        if (result.isComplete === true &&
            typeof result.fullScore === "number") {

            summary.appendChild(
                createElement(
                    "h3",
                    "暫定Dスコア：" + result.fullScore + " / 10 点"
                )
            );

            summary.appendChild(
                createElement("p", "5項目すべてを検出しました。")
            );

        } else {
            summary.appendChild(
                createElement(
                    "h3",
                    "暫定評価：" + score + " / " +
                    (Number(result.maxScore) || 0) + " 点"
                )
            );

            summary.appendChild(
                createElement(
                    "p",
                    judgedCount + "項目判定 ／ " +
                    unknownCount + "項目判定不能"
                )
            );

            summary.appendChild(
                createElement(
                    "p",
                    "5項目すべての検出が完了していないため、" +
                    "10点満点のDスコアは確定できません。"
                )
            );
        }

        target.appendChild(summary);

        const listTitle = createElement("h4", "項目別の検出結果");
        target.appendChild(listTitle);

        const list = createElement("div");

        ITEMS.forEach(function (definition) {
            const item = result.details[definition.key];

            const card = createElement("div");
            card.style.cssText =
                "margin:8px 0;padding:10px;" +
                "border:1px solid #ddd;border-radius:8px;";

            card.appendChild(
                createElement("strong", definition.label)
            );

            card.appendChild(
                createElement("p", getItemStatus(item))
            );

            const confidence = getConfidence(item);

            if (confidence) {
                card.appendChild(
                    createElement("small", confidence)
                );
            }

            if (item && item.reason) {
                card.appendChild(
                    createElement("p", item.reason)
                );
            }

            list.appendChild(card);
        });

        target.appendChild(list);

        if (Array.isArray(result.warnings) &&
            result.warnings.length > 0) {

            target.appendChild(
                createElement("h4", "検出時の注意")
            );

            const warningList = createElement("ul");

            result.warnings.forEach(function (warning) {
                warningList.appendChild(
                    createElement("li", warning)
                );
            });

            target.appendChild(warningList);
        }

        const note = createElement(
            "p",
            "※この結果はAIによる動作検出に基づく暫定評価です。" +
            "検出信頼度は技の出来栄えを直接示すものではありません。" +
            "最終的な技の評価は、教師が動画を確認して判断してください。"
        );

        note.style.cssText =
            "margin-top:15px;padding:10px;" +
            "background:#fff3cd;border-radius:8px;" +
            "font-size:13px;line-height:1.7;";

        target.appendChild(note);
    }

    function clearForwardRollFeedback() {
        const target = document.getElementById("feedback");

        if (target) {
            target.textContent =
                "台上前転の解析結果がここに表示されます。";
        }
    }

    window.showForwardRollFeedback = showForwardRollFeedback;
    window.clearForwardRollFeedback = clearForwardRollFeedback;

})();
