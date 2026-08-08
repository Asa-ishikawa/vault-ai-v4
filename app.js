// ===============================
// 跳び箱AI採点システム Ver5.4
// app.js 完全版
// 解析終了処理・フェーズ・フィードバック安定化
// ===============================

const videoFile = document.getElementById("videoFile");
const video = document.getElementById("video");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");

const detectBtn = document.getElementById("detectBtn");
const status = document.getElementById("status");

const dScore = document.getElementById("dScore");
const eScore = document.getElementById("eScore");
const totalScore = document.getElementById("totalScore");

let analyzing = false;
let analysisFinished = false;


// ===============================
// フェーズ表示エリアを取得
// ===============================

function getPhaseInfoElement() {

    let phaseInfo =
        document.getElementById("phaseInfo");

    if (!phaseInfo) {

        phaseInfo =
            document.createElement("div");

        phaseInfo.id = "phaseInfo";

        phaseInfo.style.marginTop = "10px";
        phaseInfo.style.padding = "10px";
        phaseInfo.style.borderRadius = "8px";

        const statusCard =
            status.closest(".card");

        if (statusCard) {

            statusCard.appendChild(phaseInfo);

        } else {

            document.body.appendChild(phaseInfo);

        }

    }

    return phaseInfo;

}


// ===============================
// 動画選択
// ===============================

videoFile.addEventListener("change", () => {

    const file =
        videoFile.files[0];

    if (!file) return;

    video.src =
        URL.createObjectURL(file);

    analysisFinished = false;

    status.textContent =
        "動画を読み込み中...";

    const phaseInfo =
        getPhaseInfoElement();

    phaseInfo.textContent =
        "未解析";

});


// ===============================
// 動画準備
// ===============================

video.addEventListener(
    "loadedmetadata",
    () => {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;

    }
);


video.addEventListener(
    "loadeddata",
    () => {

        canvas.style.width =
            video.clientWidth + "px";

        canvas.style.height =
            video.clientHeight + "px";

        status.textContent =
            "動画準備完了";

    }
);


// ===============================
// AI開始
// ===============================

detectBtn.addEventListener(
    "click",
    async () => {

        if (!video.src) {

            alert(
                "動画を選択してください"
            );

            return;

        }

        if (analyzing) {

            return;

        }

        analyzing = true;
        analysisFinished = false;

        // ----------------------------
        // データ初期化
        // ----------------------------

        if (
            typeof clearPoseFrames ===
            "function"
        ) {

            clearPoseFrames();

        }

        if (
            typeof clearPhase ===
            "function"
        ) {

            clearPhase();

        }

        dScore.textContent = "-";
        totalScore.textContent = "-";

        const feedback =
            document.getElementById(
                "feedback"
            );

        if (feedback) {

            feedback.innerHTML =
                "解析中...";

        }

        const phaseInfo =
            getPhaseInfoElement();

        phaseInfo.textContent =
            "解析中...";

        status.textContent =
            "AI解析中...";

        // ----------------------------
        // 動画を最初に戻す
        // ----------------------------

        video.pause();

        video.currentTime = 0;

        try {

            await video.play();

            // ------------------------
            // 骨格検出開始
            // ------------------------

            if (
                typeof startPose !==
                "function"
            ) {

                throw new Error(
                    "startPose が見つかりません"
                );

            }

            startPose(
                video,
                canvas,
                ctx
            );

        }

        catch (error) {

            console.error(
                "AI開始エラー:",
                error
            );

            analyzing = false;

            status.textContent =
                "AI解析を開始できませんでした";

        }

    }
);


// ===============================
// 動画終了
// ===============================

video.addEventListener(
    "ended",
    () => {

        console.log(
            "動画終了を検出"
        );

        if (!analyzing) {

            return;

        }

        finishAnalysis();

    }
);


// ===============================
// AI終了・採点
// ===============================

function finishAnalysis() {

    if (!analyzing) {

        return;

    }

    if (analysisFinished) {

        return;

    }

    console.log(
        "========== 解析終了 =========="
    );

    analysisFinished = true;
    analyzing = false;

    // ----------------------------
    // 骨格フレーム取得
    // ----------------------------

    let frames = [];

    try {

        if (
            typeof getPoseFrames !==
            "function"
        ) {

            throw new Error(
                "getPoseFrames が見つかりません"
            );

        }

        frames =
            getPoseFrames();

    }

    catch (error) {

        console.error(
            "フレーム取得エラー:",
            error
        );

        status.textContent =
            "骨格データ取得に失敗しました";

        return;

    }

    console.log(
        "取得フレーム数:",
        frames.length
    );


    if (
        !frames ||
        frames.length < 20
    ) {

        status.textContent =
            "骨格データが不足しています";

        const phaseInfo =
            getPhaseInfoElement();

        phaseInfo.textContent =
            "解析失敗";

        return;

    }


    // ============================
    // フェーズ検出
    // ============================

    let phase = null;

    try {

        if (
            typeof detectPhases !==
            "function"
        ) {

            throw new Error(
                "detectPhases が見つかりません"
            );

        }

        phase =
            detectPhases(frames);

        console.log(
            "フェーズ結果:",
            phase
        );

    }

    catch (error) {

        console.error(
            "フェーズ検出エラー:",
            error
        );

        const phaseInfo =
            getPhaseInfoElement();

        phaseInfo.textContent =
            "フェーズ検出エラー";

        status.textContent =
            "フェーズ検出に失敗しました";

        return;

    }


    if (!phase) {

        const phaseInfo =
            getPhaseInfoElement();

        phaseInfo.textContent =
            "フェーズ検出に失敗しました";

        status.textContent =
            "フェーズ検出に失敗しました";

        return;

    }


    // ============================
    // フェーズ表示
    // ============================

    const phaseInfo =
        getPhaseInfoElement();

    phaseInfo.innerHTML = `

        <strong>動作フェーズ</strong><br>

        踏切：
        ${phase.takeOff}
        フレーム<br>

        着手：
        ${phase.handContact}
        フレーム<br>

        最高点：
        ${phase.highestHip}
        フレーム<br>

        着地：
        ${phase.landing}
        フレーム

    `;


    // ============================
    // Dスコア
    // ============================

    let result = null;

    try {

        if (
            typeof calculateDScore !==
            "function"
        ) {

            throw new Error(
                "calculateDScore が見つかりません"
            );

        }

        result =
            calculateDScore(
                frames,
                phase
            );

        console.log(
            "採点結果:",
            result
        );

    }

    catch (error) {

        console.error(
            "Dスコア計算エラー:",
            error
        );

        status.textContent =
            "Dスコア計算に失敗しました";

        return;

    }


    if (!result) {

        status.textContent =
            "採点結果を取得できませんでした";

        return;

    }


    // ============================
    // Dスコア表示
    // ============================

    const numericScore =
        Number(result.score);

    if (
        Number.isFinite(
            numericScore
        )
    ) {

        dScore.textContent =
            numericScore.toFixed(1);

    }

    else {

        dScore.textContent =
            "-";

    }


    // ============================
    // フィードバック
    // ============================

    try {

        if (
            typeof showFeedback ===
            "function"
        ) {

            showFeedback(result);

            console.log(
                "フィードバック表示完了"
            );

        }

        else {

            console.error(
                "showFeedback が見つかりません"
            );

        }

    }

    catch (error) {

        console.error(
            "フィードバック表示エラー:",
            error
        );

        const feedback =
            document.getElementById(
                "feedback"
            );

        if (feedback) {

            feedback.innerHTML =
                "AI評価は完了しましたが、コメント表示でエラーが発生しました。";

        }

    }


    // ============================
    // 合計点
    // ============================

    try {

        updateTotal();

    }

    catch (error) {

        console.error(
            "合計点計算エラー:",
            error
        );

    }


    // ============================
    // 完了
    // ============================

    status.textContent =
        "解析完了";

    console.log(
        "========== 解析完了 =========="
    );

}


// ===============================
// 合計点
// ===============================

eScore.addEventListener(
    "input",
    updateTotal
);


function updateTotal() {

    const d =
        Number(dScore.textContent);

    const e =
        Number(eScore.value);

    if (
        !Number.isFinite(d) ||
        !Number.isFinite(e)
    ) {

        totalScore.textContent =
            "-";

        return;

    }

    totalScore.textContent =
        (d + e).toFixed(1);

}


// ===============================
// 公開
// ===============================

window.finishAnalysis =
    finishAnalysis;

window.updateTotal =
    updateTotal;

console.log(
    "app.js Ver5.4 読み込み成功"
);