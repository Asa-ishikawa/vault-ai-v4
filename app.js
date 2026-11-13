
// ============================================================
// 跳び箱AI採点システム
// app.js Ver7.2
// 完全置き換え版
// ・解析開始時のエラーを画面に表示
// ・Pose関連関数の読み込み確認
// ・動画再生開始を優先して診断
// ・解析終了後に採点
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

function setStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateTotal() {
    const d = Number(dScoreElement?.textContent);
    const e = Number(eScoreElement?.value ?? eScoreElement?.textContent);

    if (Number.isFinite(d) && Number.isFinite(e) && totalScoreElement) {
        totalScoreElement.textContent = (d + e).toFixed(1);
    }
}

// ============================================================
// 必要な関数の確認
// ============================================================

function checkRequiredFunctions() {
    const required = [
        "startPose",
        "clearPoseFrames",
        "getPoseFrames",
        "detectPhases",
        "calculateDScore"
    ];

    const missing = required.filter(name => {
        return typeof window[name] !== "function" &&
               typeof globalThis[name] !== "function";
    });

    if (missing.length > 0) {
        throw new Error(
            "必要な関数が読み込まれていません：" + missing.join(", ")
        );
    }

    if (typeof window.Pose !== "function" &&
        typeof Pose !== "function") {
        throw new Error("MediaPipe Poseが読み込まれていません。");
    }
}

// ============================================================
// 動画選択
// ============================================================

if (videoFile) {
    videoFile.addEventListener("change", () => {
        try {
            const file = videoFile.files?.[0];
            if (!file) return;

            currentAnalysisId++;
            analyzing = false;
            analysisFinished = false;

            if (typeof clearPoseFrames === "function") {
                clearPoseFrames();
            }

            if (typeof clearPhase === "function") {
                clearPhase();
            }

            if (dScoreElement) dScoreElement.textContent = "-";
            if (totalScoreElement) totalScoreElement.textContent = "-";

            const feedback = document.getElementById("feedback");
            if (feedback) feedback.textContent = "";

            const phaseInfo = document.getElementById("phaseInfo");
            if (phaseInfo) phaseInfo.textContent = "未解析";

            video.src = URL.createObjectURL(file);
            video.load();

            setStatus("動画を読み込みました。解析ボタンを押してください。");

        } catch (error) {
            setStatus("動画選択エラー：" + error.message);
        }
    });
}

// ============================================================
// 動画イベント
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
// フェーズ表示
// ============================================================

function showPhaseInfo(phase) {
    const element = document.getElementById("phaseInfo");
    if (!element) return;

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
        document.getElementById("appDiagnostic").textContent =
    "診断：AI骨格検出ボタンが押されました！";

        // 最初に表示を更新する
        setStatus("解析ボタンを受け付けました。準備中です...");

        if (!video || !video.src) {
            setStatus("先に動画を選択してください。");
            return;
        }

        if (analyzing) {
            setStatus("すでに解析中です。");
            return;
        }

        const analysisId = ++currentAnalysisId;

        analyzing = true;
        analysisFinished = false;
        detectBtn.disabled = true;

        try {
            // 必要な関数を確認
            setStatus("必要なプログラムを確認しています...");
            checkRequiredFunctions();

            document.getElementById("appDiagnostic").textContent =
    "診断：必要なプログラムの確認が完了しました！";

            // 古いデータを消去
            setStatus("解析データを初期化しています...");

            clearPoseFrames();

            if (typeof clearPhase === "function") {
                clearPhase();
            }

            if (dScoreElement) dScoreElement.textContent = "-";
            if (totalScoreElement) totalScoreElement.textContent = "-";

            const feedback = document.getElementById("feedback");
            if (feedback) feedback.textContent = "";

            const phaseInfo = document.getElementById("phaseInfo");
            if (phaseInfo) phaseInfo.textContent = "解析準備中";

            // 動画を先頭に戻す
            video.pause();
            video.currentTime = 0;

            setStatus("動画データを読み込んでいます...");

            if (video.readyState < 2) {
                await new Promise((resolve, reject) => {
                    const onLoaded = () => {
                        cleanup();
                        resolve();
                    };

                    const onError = () => {
                        cleanup();
                        reject(new Error("動画データを読み込めません。"));
                    };

                    const cleanup = () => {
                        video.removeEventListener("loadeddata", onLoaded);
                        video.removeEventListener("error", onError);
                    };

                    video.addEventListener("loadeddata", onLoaded);
                    video.addEventListener("error", onError);
                });
            }

            if (analysisId !== currentAnalysisId) return;

            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;

            // 骨格検出を初期化
            setStatus("AI骨格検出を初期化しています...");
            document.getElementById("appDiagnostic").textContent =
    "診断：Pose初期化を開始しました...";

            await startPose(video, canvas, ctx);
            document.getElementById("appDiagnostic").textContent =
    "診断：Pose初期化が完了しました！";

            if (analysisId !== currentAnalysisId) return;

            // 動画再生
            setStatus("動画を再生しながら骨格を検出しています...");

            await video.play();

        } catch (error) {
            console.error("解析開始エラー:", error);

            setStatus(
                "解析開始エラー：" +
                (error?.message || String(error))
            );

            analyzing = false;
            detectBtn.disabled = false;
        }
    });
} else {
    setStatus("エラー：AI骨格検出開始ボタンが見つかりません。");
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
        if (typeof waitForPoseComplete === "function") {
            await waitForPoseComplete();
        }

        if (analysisId !== currentAnalysisId) return;

        const frames = getPoseFrames();

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

        if (!result || !Number.isFinite(Number(result.score))) {
            setStatus("採点結果を取得できませんでした。");
            return;
        }

        if (dScoreElement) {
            dScoreElement.textContent = Number(result.score).toFixed(1);
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
        setStatus("解析終了エラー：" + error.message);

    } finally {
        analyzing = false;
        if (detectBtn) detectBtn.disabled = false;
    }
}

window.updateTotal = updateTotal;

console.log("app.js Ver7.2 読み込み成功");

const appDiagnostic = document.getElementById("appDiagnostic");

if (appDiagnostic) {
    appDiagnostic.textContent =
        "app.js Ver7.2 読み込み成功！";
    appDiagnostic.style.background = "#d8f3dc";
}