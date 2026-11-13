
// ============================================================
// 跳び箱AI採点システム
// feedback.js Ver6.3
// 完全置き換え版
//
// ・5項目の評価と実測値を表示
// ・0の実測値にも対応
// ・着手候補数をphase.handCandidatesから取得
// ・選択着手フレームを表示
// ・一部の実測値がなくても他項目を表示
// ============================================================

function getMeasuredValue(detail) {
    if (!detail) return null;

    const keys = [
        "measured",
        "value",
        "raw",
        "measuredValue"
    ];

    for (const key of keys) {
        const value = detail[key];

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            return value;
        }
    }

    return null;
}

function formatMeasured(value, digits = 3) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "取得できませんでした";
    }

    const num = Number(value);

    return Number.isFinite(num)
        ? num.toFixed(digits)
        : String(value);
}

function getScore(detail) {
    if (!detail) return 0;

    const score = Number(detail.score);

    return Number.isFinite(score) ? score : 0;
}

function getText(detail, defaultText) {
    if (
        detail &&
        detail.text !== undefined &&
        detail.text !== null &&
        detail.text !== ""
    ) {
        return String(detail.text);
    }

    return defaultText;
}

// ------------------------------------------------------------
// 着手候補情報
// ------------------------------------------------------------

function getHandCandidateInfo(result) {
    let candidateCount = null;
    let selectedFrame = null;

    if (!result) {
        return {
            candidateCount,
            selectedFrame
        };
    }

    const phase = result.phase || {};
    const hand = (result.details || {}).hand || {};

    // phase.jsが返す候補配列を優先
    const candidates =
        phase.handCandidates ||
        phase.handContactCandidates ||
        phase.candidates ||
        phase.handCandidateList;

    if (Array.isArray(candidates)) {
        candidateCount = candidates.length;
    }

    // 他の形式にも対応
    if (
        candidateCount === null &&
        result.candidateCount !== undefined &&
        result.candidateCount !== null
    ) {
        candidateCount = result.candidateCount;
    }

    if (
        candidateCount === null &&
        hand.candidateCount !== undefined &&
        hand.candidateCount !== null
    ) {
        candidateCount = hand.candidateCount;
    }

    // 選択された着手フレーム
    if (
        phase.handContact !== undefined &&
        phase.handContact !== null
    ) {
        selectedFrame = phase.handContact;
    } else if (
        hand.selectedFrame !== undefined &&
        hand.selectedFrame !== null
    ) {
        selectedFrame = hand.selectedFrame;
    } else if (
        result.selectedFrame !== undefined &&
        result.selectedFrame !== null
    ) {
        selectedFrame = result.selectedFrame;
    }

    return {
        candidateCount,
        selectedFrame
    };
}

// ------------------------------------------------------------
// 総合コメント
// ------------------------------------------------------------

function createTotalComment(result) {
    const score = Number(result && result.score);

    if (!Number.isFinite(score)) {
        return "評価結果を確認できませんでした。";
    }

    if (score >= 9) {
        return "とてもすばらしい動きです。各動作が安定しています。";
    }

    if (score >= 7) {
        return "すばらしい動きです。できている部分を維持しながら、さらに安定させましょう。";
    }

    if (score >= 5) {
        return "基本的な動きができています。苦手な部分を意識して練習しましょう。";
    }

    return "一つずつポイントを意識して、丁寧に練習しましょう。";
}

// ------------------------------------------------------------
// メイン表示
// ------------------------------------------------------------

function showFeedback(result) {
    const feedback = document.getElementById("feedback");

    if (!feedback) {
        console.error("feedback要素が見つかりません");
        return;
    }

    if (!result) {
        feedback.textContent =
            "評価結果を取得できませんでした。";
        return;
    }

    const details = result.details || {};

    const knee = details.knee || {};
    const hip = details.hip || {};
    const hand = details.hand || {};
    const takeOff = details.takeOff || {};
    const landing = details.landing || {};

    const handInfo = getHandCandidateInfo(result);

    const candidateText =
        handInfo.candidateCount !== null
            ? String(handInfo.candidateCount)
            : "-";

    const selectedFrameText =
        handInfo.selectedFrame !== null
            ? String(handInfo.selectedFrame)
            : "-";

    const totalScore = Number(result.score);

    const safeTotalScore =
        Number.isFinite(totalScore)
            ? totalScore.toFixed(1)
            : "-";

    const items = [
        {
            title: "① 膝の伸び",
            detail: knee,
            digits: 1,
            unit: "°",
            fallback: "膝の伸びを確認しましょう。"
        },
        {
            title: "② 腰の位置",
            detail: hip,
            digits: 3,
            unit: "",
            fallback: "腰の位置を確認しましょう。"
        },
        {
            title: "③ 着手位置",
            detail: hand,
            digits: 3,
            unit: "",
            fallback: "着手位置を確認しましょう。"
        },
        {
            title: "④ 両足踏切",
            detail: takeOff,
            digits: 3,
            unit: "",
            fallback: "踏切の状態を確認しましょう。"
        },
        {
            title: "⑤ 着地の安定",
            detail: landing,
            digits: 3,
            unit: "",
            fallback: "着地の安定を確認しましょう。"
        }
    ];

    const itemHTML = items.map(item => {
        const measured = formatMeasured(
            getMeasuredValue(item.detail),
            item.digits
        );

        return `
            <section>
                <h3>${item.title}</h3>
                <p>${getText(item.detail, item.fallback)}</p>
                <p>
                    評価：
                    <strong>${getScore(item.detail)}/2点</strong>
                </p>
                <p>
                    実測値：
                    <strong>${measured}${item.unit}</strong>
                </p>
            </section>
        `;
    }).join("");

    feedback.innerHTML = `
        <h3>AI評価結果</h3>

        <h2>Dスコア：${safeTotalScore}点</h2>

        ${itemHTML}

        <section>
            <h3>着手判定の診断</h3>
            <p>着手候補数：<strong>${candidateText}</strong></p>
            <p>選択着手フレーム：<strong>${selectedFrameText}</strong></p>
        </section>

        <section>
            <h3>総合コメント</h3>
            <p>${createTotalComment(result)}</p>
        </section>
    `;

    console.log("feedback.js Ver6.3 表示完了", {
        score: result.score,
        candidateCount: handInfo.candidateCount,
        selectedFrame: handInfo.selectedFrame,
        details
    });
}

// ------------------------------------------------------------
// 公開
// ------------------------------------------------------------

window.showFeedback = showFeedback;
window.createTotalComment = createTotalComment;
window.getHandCandidateInfo = getHandCandidateInfo;

console.log("feedback.js Ver6.3 読み込み成功");
