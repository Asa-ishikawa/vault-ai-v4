// ===============================
// 跳び箱AI採点システム Ver4.0
// app.js
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

// --------------------
// 動画選択
// --------------------

videoFile.addEventListener("change", () => {

    const file = videoFile.files[0];

    if (!file) return;

    const url = URL.createObjectURL(file);

    video.src = url;

    status.textContent = "動画を読み込み中...";

});

// --------------------
// 動画準備完了
// --------------------

video.addEventListener("loadedmetadata", () => {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

});

video.addEventListener("loadeddata", () => {

    canvas.style.width = video.clientWidth + "px";
    canvas.style.height = video.clientHeight + "px";

    status.textContent = "動画の読み込み完了";

});

// --------------------
// AI開始
// --------------------

detectBtn.addEventListener("click", () => {

    if (!video.src) {

        alert("動画を選択してください");
        return;

    }

    video.currentTime = 0;

    status.textContent = "AI解析中...";

    video.play()
        .then(() => {

            startPose(video, canvas, ctx);
video.onended = () => {

    finishAnalysis(dScore.textContent);

};

        })
        .catch((err) => {

            console.error(err);

            status.textContent = "動画を再生できません";

        });

});

// --------------------
// AI終了
// --------------------

function finishAnalysis(score) {

    dScore.textContent = score;

    updateTotal();

    status.textContent = "解析完了";

}

window.finishAnalysis = finishAnalysis;

// --------------------
// 合計点
// --------------------

eScore.addEventListener("input", updateTotal);

function updateTotal() {

    const d = Number(dScore.textContent);

    const e = Number(eScore.value);

    if (isNaN(d)) {

        totalScore.textContent = "-";

        return;

    }

    totalScore.textContent = (d + e).toFixed(1);

}