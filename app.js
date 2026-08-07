// ===============================
// 跳び箱AI採点システム Ver5.3.2
// app.js 完成版
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

// ----------------------------
// 動画選択
// ----------------------------

videoFile.addEventListener("change", () => {

    const file = videoFile.files[0];

    if (!file) return;

    video.src = URL.createObjectURL(file);

    status.textContent = "動画を読み込み中...";

});

// ----------------------------
// 動画準備
// ----------------------------

video.addEventListener("loadedmetadata", () => {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

});

video.addEventListener("loadeddata", () => {

    canvas.style.width = video.clientWidth + "px";
    canvas.style.height = video.clientHeight + "px";

    status.textContent = "動画準備完了";

});

// ----------------------------
// AI開始
// ----------------------------

detectBtn.addEventListener("click", async () => {

    if (!video.src) {

        alert("動画を選択してください");
        return;

    }

    if (analyzing) return;

    analyzing = true;

    clearPoseFrames();
    clearPhase();

    dScore.textContent = "-";
    totalScore.textContent = "-";

    const phaseInfo =
        document.getElementById("phaseInfo");

    if (phaseInfo) {

        phaseInfo.textContent = "解析中...";

    }

    status.textContent = "AI解析中...";

    video.currentTime = 0;

    try {

        await video.play();

        startPose(video, canvas, ctx);

    }

    catch (error) {

        console.error(error);

        analyzing = false;

        status.textContent =
            "動画を再生できません";

    }

});

// ----------------------------
// 動画終了
// ----------------------------

video.addEventListener("ended", () => {

    if (!analyzing) return;

    finishAnalysis();

});

// ----------------------------
// AI終了
// ----------------------------

function finishAnalysis() {

    if (!analyzing) return;

    analyzing = false;

    const frames = getPoseFrames();

    console.log("取得フレーム数:", frames.length);

    if (!frames || frames.length < 20) {

        status.textContent =
            "骨格データが不足しています";

        return;

    }

    // ----------------------------
    // フェーズ検出
    // ----------------------------

    const phase =
        detectPhases(frames);

    if (!phase) {

        status.textContent =
            "フェーズ検出に失敗しました";

        return;

    }

    // ----------------------------
    // Dスコア
    // ----------------------------

    const result =
        calculateDScore(frames, phase);

    if (!result) {

        status.textContent =
            "採点に失敗しました";

        return;

    }

    dScore.textContent =
        Number(result.score).toFixed(1);

    // ----------------------------
    // フィードバック
    // ----------------------------

    if (typeof showFeedback === "function") {

        showFeedback(result);

    }

    // ----------------------------
    // 合計
    // ----------------------------

    updateTotal();

    status.textContent =
        "解析完了";

}

// ----------------------------
// 合計点
// ----------------------------

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

        totalScore.textContent = "-";

        return;

    }

    totalScore.textContent =
        (d + e).toFixed(1);

}

// ----------------------------
// 公開
// ----------------------------

window.finishAnalysis =
    finishAnalysis;

window.updateTotal =
    updateTotal;