// ===============================
// 跳び箱AI採点システム Ver4.0
// app.js
// ===============================

// ----------------------------
// 要素取得
// ----------------------------
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

    const url = URL.createObjectURL(file);

    video.src = url;

    status.textContent = "動画を読み込み中...";

});

// ----------------------------
// 動画情報取得
// ----------------------------
video.addEventListener("loadedmetadata", () => {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

});

// ----------------------------
// 動画読込完了
// ----------------------------
video.addEventListener("loadeddata", () => {

    canvas.style.width = video.clientWidth + "px";
    canvas.style.height = video.clientHeight + "px";

    status.textContent = "動画の読み込み完了";

});

// ----------------------------
// AI開始
// ----------------------------
detectBtn.addEventListener("click", async () => {

    if (!video.src) {

        alert("動画を選択してください");
        return;

    }

    // ボタン無効
    detectBtn.disabled = true;
    detectBtn.textContent = "解析中...";

    status.textContent = "AI解析中...";

    // スコア初期化
    dScore.textContent = "-";
    totalScore.textContent = "-";

    video.currentTime = 0;

    try {

        await video.play();

        startPose(video, canvas, ctx);

    } catch (err) {

        console.error(err);

        status.textContent = "動画を再生できません";

        detectBtn.disabled = false;
        detectBtn.textContent = "AI骨格検出開始";

    }

});

// ----------------------------
// 動画終了
// ----------------------------
video.addEventListener("ended", () => {

    finishAnalysis(Number(dScore.textContent));

});

// ----------------------------
// AI終了
// ----------------------------
function finishAnalysis(score) {

    dScore.textContent = Number(score).toFixed(1);

    updateTotal();

    status.textContent = "解析完了";

    detectBtn.disabled = false;
    detectBtn.textContent = "AI骨格検出開始";

}

window.finishAnalysis = finishAnalysis;

// ----------------------------
// Eスコア変更
// ----------------------------
eScore.addEventListener("input", updateTotal);

// ----------------------------
// 合計点
// ----------------------------
function updateTotal() {

    const d = Number(dScore.textContent);
    const e = Number(eScore.value);

    if (isNaN(d) || isNaN(e)) {

        totalScore.textContent = "-";
        return;

    }

    totalScore.textContent = (d + e).toFixed(1);

}