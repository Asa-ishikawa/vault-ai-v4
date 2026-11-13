
// ============================================================
// 跳び箱AI採点システム
// app.js Ver7.1
// 完全置き換え版
//
// ・Pose初期化を待ってから動画再生
// ・動画終了後にPose処理の完了を待つ
// ・解析完了の二重実行を防止
// ・既存score.js / phase.js / feedback.jsと連携
// ============================================================

const videoFile = document.getElementById("videoFile");
const video = document.getElementById("video");
const canvas = document.getElementById("outputCanvas");
const detectBtn = document.getElementById("detectBtn");

const statusElement = document.getElementById("status");
const dScoreElement = document.getElementById("dScore");
const eScoreElement = document.getElementById("eScore");
const totalScoreElement = document.getElementById("totalScore");

const ctx = canvas ? canvas.getContext("2d") : null;

let analyzing = false;
let analysisFinished = false;
let currentAnalysisId = 0;

// ============================================================
// 表示更新
// ============================================================

function setStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateTotal() {
    const d = Number(dScoreElement?.textContent);
    const e = Number(eScoreElement?.value ?? eScoreElement?.textContent);

    if (
        Number.isFinite(d) &&
        Number.isFinite(e) &&
        totalScoreElement
    ) {
        totalScoreElement.textContent = (d + e).toFixed(1);
    }
}

// ============================================================
// 動画選択
// ============================================================

if (videoFile) {
    videoFile.addEventListener("change", () => {
        const file = videoFile.files?.[0];

        if (!file) return;

        currentAnalysisId++;
        analyzing = false;
        analysisFinished = false;

        clearPoseFrames();
        if (typeof clearPhase === "function") {
            clearPhase();
        }

        if (dScoreElement) dScoreElement.textContent = "-";
        if (totalScoreElement) totalScoreElement.textContent = "-";

        const feedback = document.getElementById("feedback");
        if (feedback) feedback.innerHTML = "";

        const phaseInfo = document.getElementById("phaseInfo");
        if (phaseInfo) phaseInfo.textContent = "";

        video.src = URL.createObjectURL(file);
        video.load();

        setStatus("動画を読み込みました。解析ボタンを押してください。");
    });
}

// ============================================================
// 動画メタデータ
// ============================================================

if (video) {
    video.addEventListener("loadedmetadata", () => {
        if (canvas) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
        }
    });

    video.addEventListener("ended", () => {
        if (analyzing) {
            finishAnalysis(currentAnalysisId);
        }
    });

    video.addEventListener("error", () => {
        setStatus("動画の読み込みに失敗しました。別の動画を選択してください。");
    });
}

// ============================================================
// フェーズ情報表示
// ============================================================

function showPhaseInfo(phase) {
    let element = document.getElementById("phaseInfo");

    if (!element) {
        element = document.createElement("div");
        element.id = "phaseInfo";
        element.style.cssText = `
            margin-top:10px;
            padding:10px;
            background:#eef6ff;
            border-radius:8px;
            line-height:1.7;
        `;

        if (canvas && canvas.parentElement) {
            canvas.parentElement.appendChild(element);
        } else {
            document.body.appendChild(element);
        }
    }

    element.innerHTML = `
        <strong>動作フェーズ検出結果</strong><br>
        踏切フレーム：${phase.takeOff ?? "-"}<br>
        着手フレーム：${phase.handContact ?? "-"}<br>
        腰最高点フレーム：${phase.highestHip ?? "-"}<br>
        着地フレーム：${phase.landing ?? "-"}<br>
        着手候補数：${Array.isArray(phase.handCandidates)
            ? phase.handCandidates.length
            : "-"}
    `;
}

// ============================================================
// 解析開始
// ============================================================

if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
        if (!video || !video.src) {
            setStatus("先に動画を選択してください。");
            return;
        }

        if (analyzing) return;

        currentAnalysisId++;
        const analysisId = currentAnalysisId;

        analyzing = true;
        analysisFinished = false;

        detectBtn.disabled = true;

        clearPoseFrames();

        if (typeof clearPhase === "function") {
            clearPhase();
        }

        if (dScoreElement) dScoreElement.textContent = "-";
        if (totalScoreElement) totalScoreElement.textContent = "-";

        const feedback = document.getElementById("feedback");
        if (feedback) feedback.innerHTML = "";

        const phaseInfo = document.getElementById("phaseInfo");
        if (phaseInfo) phaseInfo.innerHTML = "";

        setStatus("骨格検出を準備しています...");

        try {
            video.pause();
            video.currentTime = 0;

            await new Promise(resolve => {
                if (video.readyState >= 2) {
                    resolve();
                } else {
                    video.addEventListener("loadeddata", resolve, {
                        once: true
                    });
                }
            });

            if (analysisId !== currentAnalysisId) return;

            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;

            // Pose解析を開始
            const poseStart = startPose(video, canvas, ctx);

            // startPoseの初期化完了を待つ
            await poseStart;

            if (analysisId !== currentAnalysisId) return;

            setStatus("解析中です。動画が終わるまでお待ちください。");

            await video.play();

        } catch (error) {
            console.error("解析開始エラー:", error);

            setStatus("解析を開始できませんでした。動画を選び直してください。");

            analyzing = false;
            detectBtn.disabled = false;
        }
    });
}

// ============================================================
// 解析終了
// ============================================================

async function finishAnalysis(analysisId) {
    if (analysisId !== currentAnalysisId) return;
    if (analysisFinished) return;

    analysisFinished = true;

    setStatus("骨格検出の最終処理を待っています...");

    try {
        // Poseの非同期処理完了を待つ
        if (typeof waitForPoseComplete === "function") {
            await waitForPoseComplete();
        }

        if (analysisId !== currentAnalysisId) return;

        const frames = getPoseFrames();

        console.log("解析終了時フレーム数:", frames.length);

        if (frames.length < 10) {
            setStatus(
                `骨格データが不足しています。取得フレーム数：${frames.length}`
            );
            return;
        }

        setStatus("動作フェーズを判定しています...");

        const phase = detectPhases(frames);

        showPhaseInfo(phase);

        if (typeof showSelectedHandFrameTime === "function") {
            showSelectedHandFrameTime(phase.handContact);
        }

        setStatus("採点しています...");

        const result = calculateDScore(frames, phase);

        console.log("採点結果:", result);

        if (
            !result ||
            !Number.isFinite(Number(result.score))
        ) {
            setStatus("採点結果を取得できませんでした。");
            return;
        }

        if (dScoreElement) {
            dScoreElement.textContent =
                Number(result.score).toFixed(1);
        }

        if (typeof showFeedback === "function") {
            showFeedback(result);
        }

        updateTotal();

        setStatus(
            `解析完了。骨格取得フレーム数：${frames.length}`
        );

    } catch (error) {
        console.error("解析終了エラー:", error);
        setStatus("解析中にエラーが発生しました。");
    } finally {
        analyzing = false;
        if (detectBtn) detectBtn.disabled = false;
    }
}

// ============================================================
// 公開
// ============================================================

window.updateTotal = updateTotal;

console.log("app.js Ver7.1 読み込み成功");
