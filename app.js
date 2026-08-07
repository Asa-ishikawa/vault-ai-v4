// ===============================
// 跳び箱AI採点システム Ver5.3.2
// app.js（前半）
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

detectBtn.addEventListener("click", () => {

    if (!video.src) {

        alert("動画を選択してください");
        return;

    }

    clearPoseFrames();
    clearPhase();

    dScore.textContent = "-";
    totalScore.textContent = "-";

    status.textContent = "AI解析中...";

    video.currentTime = 0;

    video.play().then(() => {

        startPose(video, canvas, ctx);

    });

});
// ----------------------------
// AI終了
// ----------------------------

function finishAnalysis() {

    const frames = getPoseFrames();

    if (!frames || frames.length < 20) {

        status.textContent = "骨格データが不足しています";
        return;

    }

    const phase = detectPhases(frames);

    if (!phase) {

        status.textContent = "フェーズ検出に失敗しました";
        return;

    }

    const result = calculateDScore(frames, phase);

    dScore.textContent = result.score.toFixed(1);

    if (typeof showFeedback === "function") {

        showFeedback(result);

    }

    updateTotal();

    status.textContent = "解析完了";

}

window.finishAnalysis = finishAnalysis;

// ----------------------------
// 合計点
// ----------------------------

eScore.addEventListener("input", updateTotal);

function updateTotal() {

    const d = Number(dScore.textContent);
    const e = Number(eScore.value);

    if (isNaN(d) || isNaN(e)) {

        totalScore.textContent = "-";
        return;

    }

    totalScore.textContent = (d + e).toFixed(1);

}
// ----------------------------
// 動画終了検知
// ----------------------------

video.addEventListener("ended", () => {

    finishAnalysis();

});