
// ============================================================
// 跳び箱AI採点システム
// app.js Ver10.0
// 完全置き換え版
//
// Ver9.1の機能を維持
// ・MediaPipe骨格検出
// ・開脚跳び／閉脚跳びの既存採点
// ・動作フェーズ検出
// ・跳び箱検出
// ・AI評価コメント
// ・Eスコアと総合得点
// ・採点結果保存
// ・クラス別一覧／検索／絞り込み／並べ替え
// ・クラス集計／詳細表示／個別削除
//
// Ver10.0追加
// ・台上前転の専用フェーズ検出
// ・台上前転の専用Dスコア計算
// ・台上前転の専用評価コメント
// ・判定不能項目を0点と誤認しない保存方式
// ・判定保留記録を平均点に含めない
//
// ※score.js、feedback.jsの既存ロジックは変更しない
// ============================================================


// ============================================================
// 基本要素
// ============================================================

const videoFile = document.getElementById("videoFile");
const video = document.getElementById("video");
const canvas = document.getElementById("outputCanvas");
const detectBtn = document.getElementById("detectBtn");

const statusElement = document.getElementById("status");
const dScoreElement = document.getElementById("dScore");
const eScoreElement = document.getElementById("eScore");
const totalScoreElement = document.getElementById("totalScore");

const classNameElement = document.getElementById("className");
const studentNameElement = document.getElementById("studentName");
const skillElement = document.getElementById("skill");

const saveResultBtn = document.getElementById("saveResultBtn");
const saveStatusElement = document.getElementById("saveStatus");

const savedResultsElement = document.getElementById("savedResults");
const refreshResultsBtn = document.getElementById("refreshResultsBtn");

const filterClassElement = document.getElementById("filterClass");
const searchStudentElement = document.getElementById("searchStudent");
const filterSkillElement = document.getElementById("filterSkill");
const sortResultsElement = document.getElementById("sortResults");

const classSummaryElement = document.getElementById("classSummary");
const savedResultDetailElement = document.getElementById("savedResultDetail");

const ctx = canvas ? canvas.getContext("2d") : null;

let analyzing = false;
let analysisFinished = false;
let currentAnalysisId = 0;
let currentScoringResult = null;


// ============================================================
// 共通ユーティリティ
// ============================================================

function getCurrentSkill() {
    return skillElement?.value || "開脚跳び";
}

function isForwardRollSkill(skill = getCurrentSkill()) {
    return skill === "台上前転";
}

function getFiniteNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function formatScore(value) {
    const number = getFiniteNumber(value);
    return number === null ? "-" : number.toFixed(1);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };
        return map[character];
    });
}


// ============================================================
// 状態表示
// ============================================================

function setStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function setAppDiagnostic(message, success = true) {
    const element = document.getElementById("appDiagnostic");
    if (!element) return;

    element.textContent = message;
    element.style.background = success ? "#d8f3dc" : "#fff3cd";
}


// ============================================================
// 総合得点
// 判定保留の場合は合計を計算しない
// ============================================================

function updateTotal() {
    if (!dScoreElement || !totalScoreElement) return;

    const d = getFiniteNumber(dScoreElement.textContent);
    const e = getFiniteNumber(
        eScoreElement?.value ?? eScoreElement?.textContent
    );

    if (d === null || e === null) {
        totalScoreElement.textContent = "-";
        return;
    }

    totalScoreElement.textContent = (d + e).toFixed(1);
}


// ============================================================
// 必要な関数の確認
// ============================================================

function checkRequiredFunctions(skill = getCurrentSkill()) {
    const commonRequired = [
        "startPose",
        "clearPoseFrames",
        "getPoseFrames"
    ];

    const skillRequired = isForwardRollSkill(skill)
        ? [
            "detectForwardRollPhases",
            "calculateForwardRollDScore",
            "showForwardRollFeedback"
        ]
        : [
            "detectPhases",
            "calculateDScore"
        ];

    const required = [...commonRequired, ...skillRequired];

    const missing = required.filter(name => {
        return typeof window[name] !== "function" &&
               typeof globalThis[name] !== "function";
    });

    if (missing.length > 0) {
        throw new Error(
            "必要な関数が読み込まれていません：" +
            missing.join(", ")
        );
    }

    if (
        typeof window.Pose !== "function" &&
        typeof Pose !== "function"
    ) {
        throw new Error("MediaPipe Poseが読み込まれていません。");
    }
}


// ============================================================
// 保存ボタンの状態
// ============================================================

function setSaveButtonEnabled(enabled) {
    if (saveResultBtn) {
        saveResultBtn.disabled = !enabled;
    }
}


// ============================================================
// 解析表示の初期化
// ============================================================

function clearAnalysisDisplay() {
    if (dScoreElement) {
        dScoreElement.textContent = "-";
    }

    if (totalScoreElement) {
        totalScoreElement.textContent = "-";
    }

    const feedback = document.getElementById("feedback");
    if (feedback) feedback.textContent = "";

    const phaseInfo = document.getElementById("phaseInfo");
    if (phaseInfo) phaseInfo.textContent = "未解析";

    const vaultDiagnostic = document.getElementById("vaultDiagnostic");
    if (vaultDiagnostic) vaultDiagnostic.textContent = "";
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
            currentScoringResult = null;

            setSaveButtonEnabled(false);

            if (saveStatusElement) {
                saveStatusElement.textContent =
                    "新しい動画を選択しました。解析後に保存できます。";
            }

            if (typeof clearPoseFrames === "function") {
                clearPoseFrames();
            }

            if (typeof clearPhase === "function") {
                clearPhase();
            }

            if (typeof clearForwardRollPhase === "function") {
                clearForwardRollPhase();
            }

            if (typeof clearForwardRollFeedback === "function") {
                clearForwardRollFeedback();
            }

            clearAnalysisDisplay();

            video.src = URL.createObjectURL(file);
            video.load();

            setStatus(
                "動画を読み込みました。解析ボタンを押してください。"
            );
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
        setStatus(
            "動画の読み込みに失敗しました。別の動画を選択してください。"
        );
    });
}


// ============================================================
// フェーズ表示
// 開脚跳び・閉脚跳び
// ============================================================

function showPhaseInfo(phase) {
    const element = document.getElementById("phaseInfo");
    if (!element) return;

    element.innerHTML = `
        <strong>動作フェーズ検出結果</strong><br>
        踏切フレーム：${escapeHTML(phase.takeOff ?? "-")}<br>
        着手フレーム：${escapeHTML(phase.handContact ?? "-")}<br>
        腰最高点フレーム：${escapeHTML(phase.highestHip ?? "-")}<br>
        着地フレーム：${escapeHTML(phase.landing ?? "-")}<br>
        着手候補数：${
            Array.isArray(phase.handCandidates)
                ? phase.handCandidates.length
                : "-"
        }
    `;
}


// ============================================================
// 台上前転フェーズ表示
// ============================================================

function showForwardRollPhaseInfo(phase) {
    const element = document.getElementById("phaseInfo");
    if (!element) return;

    const detected = phase?.detected || {};

    const labels = [
        ["takeOff", "踏切"],
        ["handContact", "着手"],
        ["rotationStart", "回転開始"],
        ["rotationEnd", "回転終了"],
        ["bodyPass", "体の通過"],
        ["landing", "着地"]
    ];

    const rows = labels.map(([key, label]) => {
        const event = detected[key];
        const frame = event?.frame ?? "-";
        const confidence = getFiniteNumber(event?.confidence);

        return `
            <div>
                <strong>${label}：</strong>
                ${escapeHTML(frame)}
                ${confidence === null
                    ? ""
                    : `（信頼度 ${confidence.toFixed(2)}）`}
            </div>
        `;
    }).join("");

    const warnings = Array.isArray(phase?.warnings)
        ? phase.warnings
        : [];

    element.innerHTML = `
        <strong>台上前転・動作フェーズ検出結果</strong>
        ${rows}
        <p>${escapeHTML(phase?.message || "")}</p>
        ${
            warnings.length
                ? `<p>確認事項：${warnings.map(escapeHTML).join("／")}</p>`
                : ""
        }
    `;
}


// ============================================================
// 解析開始
// ============================================================

if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
        setAppDiagnostic(
            "診断：AI骨格検出ボタンが押されました！"
        );

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
        const selectedSkill = getCurrentSkill();

        analyzing = true;
        analysisFinished = false;
        currentScoringResult = null;

        setSaveButtonEnabled(false);
        detectBtn.disabled = true;

        try {
            setStatus("必要なプログラムを確認しています...");
            checkRequiredFunctions(selectedSkill);

            setAppDiagnostic(
                "診断：必要なプログラムの確認が完了しました！"
            );

            setStatus("解析データを初期化しています...");

            clearPoseFrames();

            if (typeof clearPhase === "function") {
                clearPhase();
            }

            if (typeof clearForwardRollPhase === "function") {
                clearForwardRollPhase();
            }

            if (typeof clearForwardRollFeedback === "function") {
                clearForwardRollFeedback();
            }

            clearAnalysisDisplay();

            video.pause();
            video.currentTime = 0;

            setStatus("動画データを読み込んでいます...");

            if (video.readyState < 2) {
                setStatus("動画データを再読み込みしています...");

                await new Promise((resolve, reject) => {
                    let completed = false;

                    const finish = (error = null) => {
                        if (completed) return;
                        completed = true;

                        clearTimeout(timer);
                        video.removeEventListener("loadeddata", onLoaded);
                        video.removeEventListener("canplay", onLoaded);
                        video.removeEventListener("error", onError);

                        if (error) reject(error);
                        else resolve();
                    };

                    const onLoaded = () => finish();

                    const onError = () => {
                        finish(
                            new Error("動画データの読み込みに失敗しました。")
                        );
                    };

                    const timer = setTimeout(() => {
                        finish(
                            new Error(
                                "動画の読み込みが10秒以内に完了しませんでした。"
                            )
                        );
                    }, 10000);

                    video.addEventListener("loadeddata", onLoaded);
                    video.addEventListener("canplay", onLoaded);
                    video.addEventListener("error", onError);

                    if (video.readyState >= 2) {
                        finish();
                    }
                });
            }

            if (analysisId !== currentAnalysisId) return;

            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;

            setStatus("AI骨格検出を初期化しています...");
            setAppDiagnostic("診断：Pose初期化を開始しました...");

            await startPose(video, canvas, ctx);

            setAppDiagnostic("診断：Pose初期化が完了しました！");

            if (analysisId !== currentAnalysisId) return;

            setStatus(
                "動画を再生しながら骨格を検出しています..."
            );

            await video.play();

        } catch (error) {
            console.error("解析開始エラー:", error);

            setStatus(
                "解析開始エラー：" +
                (error?.message || String(error))
            );

            setAppDiagnostic(
                "解析開始エラー：" + error.message,
                false
            );

            analyzing = false;
            detectBtn.disabled = false;
        }
    });
} else {
    setStatus("エラー：AI骨格検出開始ボタンが見つかりません。");
}


// ============================================================
// 開脚跳び・閉脚跳びの跳び箱診断
// ============================================================

function showVaultDiagnostic(frames, phase) {
    const vaultDiagnostic =
        document.getElementById("vaultDiagnostic");

    if (!vaultDiagnostic) return;

    const handContactFrame = frames.find(frame => {
        return frame.frame === phase.handContact;
    });

    if (
        handContactFrame &&
        handContactFrame.handPositionRelativeToVault
    ) {
        phase.handPositionRelativeToVault =
            handContactFrame.handPositionRelativeToVault;

        console.log(
            "着手位置（跳び箱基準）:",
            phase.handPositionRelativeToVault
        );
    } else {
        phase.handPositionRelativeToVault = null;
        console.log("着手位置：取得できませんでした");
    }

    const box = handContactFrame?.vaultBox;
    const leftHand =
        handContactFrame?.leftHandPositionRelativeToVault;
    const rightHand =
        handContactFrame?.rightHandPositionRelativeToVault;
    const centerHand =
        handContactFrame?.handPositionRelativeToVault;

    const formatPoint = point => {
        if (
            !point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
        ) {
            return "取得できません";
        }

        return `X=${point.x.toFixed(3)} / Y=${point.y.toFixed(3)}`;
    };

    const formatBox = value => {
        if (!value) return "検出できません";

        const x = getFiniteNumber(value.x);
        const y = getFiniteNumber(value.y);
        const width = getFiniteNumber(value.width);
        const height = getFiniteNumber(value.height);

        if ([x, y, width, height].some(v => v === null)) {
            return "検出データが不完全です";
        }

        return (
            `X=${x.toFixed(3)} / Y=${y.toFixed(3)}\n` +
            `幅=${width.toFixed(3)} / 高さ=${height.toFixed(3)}`
        );
    };

    vaultDiagnostic.textContent =
        `【着手位置診断】\n` +
        `跳び箱：${formatBox(box)}\n` +
        `左手：${formatPoint(leftHand)}\n` +
        `右手：${formatPoint(rightHand)}\n` +
        `手の中心：${formatPoint(centerHand)}`;
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

        if (!Array.isArray(frames) || frames.length < 10) {
            setStatus(
                `骨格データが不足しています。取得フレーム数：${frames?.length || 0}`
            );
            return;
        }

        const selectedSkill = getCurrentSkill();
        let phase = null;
        let result = null;

        // ----------------------------------------------------
        // 台上前転
        // ----------------------------------------------------

        if (isForwardRollSkill(selectedSkill)) {
            setStatus("台上前転の動作フェーズを判定しています...");

            phase = detectForwardRollPhases(frames);

            if (!phase) {
                setStatus("台上前転の動作フェーズを検出できませんでした。");
                return;
            }

            showForwardRollPhaseInfo(phase);

            if (phase.success === false) {
                setStatus(
                    "台上前転の動作を十分に検出できませんでした。動画を確認してください。"
                );

                if (typeof showForwardRollFeedback === "function") {
                    showForwardRollFeedback({
                        isComplete: false,
                        score: 0,
                        maxScore: 0,
                        judgedCount: 0,
                        unknownCount: 5,
                        details: {},
                        warnings: phase.warnings || [phase.message || "検出失敗"]
                    });
                }

                return;
            }

            setStatus("台上前転のDスコアを計算しています...");

            result = calculateForwardRollDScore(frames, phase);

            if (!result) {
                setStatus("台上前転の採点結果を取得できませんでした。");
                return;
            }

            result.phase = phase;
            result.skill = "台上前転";

            if (typeof showForwardRollFeedback === "function") {
                showForwardRollFeedback(result);
            }

            const complete =
                result.isComplete === true &&
                getFiniteNumber(result.fullScore) !== null;

            if (complete) {
                dScoreElement.textContent =
                    Number(result.fullScore).toFixed(1);
            } else {
                dScoreElement.textContent = "判定保留";
            }

            updateTotal();

            currentScoringResult = result;
            setSaveButtonEnabled(true);

            if (saveStatusElement) {
                saveStatusElement.textContent = complete
                    ? "解析完了。クラス名・生徒名・Eスコアを確認して保存してください。"
                    : "一部の項目が判定保留です。暫定記録として保存できます。";
            }

            setStatus(
                complete
                    ? `台上前転の解析完了。骨格取得フレーム数：${frames.length}`
                    : `台上前転の解析完了（一部判定保留）。骨格取得フレーム数：${frames.length}`
            );

            setAppDiagnostic(
                complete
                    ? "Ver10.0：台上前転の解析・採点が完了しました！"
                    : "Ver10.0：台上前転の解析完了。一部項目は判定保留です。"
            );

            return;
        }


        // ----------------------------------------------------
        // 開脚跳び・閉脚跳び
        // 既存の採点処理を維持
        // ----------------------------------------------------

        setStatus("動作フェーズを判定しています...");

        phase = detectPhases(frames);

        if (!phase) {
            setStatus("動作フェーズを検出できませんでした。");
            return;
        }

        showPhaseInfo(phase);
        showVaultDiagnostic(frames, phase);

        setStatus("Dスコアを計算しています...");

        result = calculateDScore(frames, phase);

        if (result) {
            result.phase = phase;

            if (!result.details) {
                result.details = {};
            }

            if (!result.details.hand) {
                result.details.hand = {};
            }

            result.details.hand.measured =
                phase.handMeasured ?? null;

            result.details.hand.candidateCount =
                Array.isArray(phase.handCandidates)
                    ? phase.handCandidates.length
                    : 0;

            result.details.hand.selectedFrame =
                phase.handContact ?? null;
        }

        if (
            !result ||
            getFiniteNumber(result.score) === null
        ) {
            setStatus("採点結果を取得できませんでした。");
            return;
        }

        dScoreElement.textContent =
            Number(result.score).toFixed(1);

        if (typeof showFeedback === "function") {
            showFeedback(result);
        }

        updateTotal();

        currentScoringResult = result;
        setSaveButtonEnabled(true);

        if (saveStatusElement) {
            saveStatusElement.textContent =
                "解析完了。クラス名・生徒名・Eスコアを確認して保存してください。";
        }

        setStatus(
            `解析完了。骨格取得フレーム数：${frames.length}`
        );

        setAppDiagnostic(
            "Ver10.0：解析・採点が正常に完了しました！"
        );

    } catch (error) {
        console.error("解析終了エラー:", error);

        setStatus("解析終了エラー：" + error.message);

        setAppDiagnostic(
            "解析終了エラー：" + error.message,
            false
        );

    } finally {
        analyzing = false;

        if (detectBtn) {
            detectBtn.disabled = false;
        }
    }
}


// ============================================================
// 日付取得
// ============================================================

function getTodayString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ============================================================
// 保存用の評価項目を作成
// ============================================================

function createSavedDetails(result) {
    const details = result.details || {};
    const output = {};

    // 台上前転
    if (result.skill === "台上前転" || isForwardRollSkill()) {
        const keys = [
            ["takeOff", "踏切"],
            ["handContact", "着手"],
            ["rotation", "回転"],
            ["bodyPass", "体の通過"],
            ["landing", "着地"]
        ];

        keys.forEach(([key, label]) => {
            const item = details[key] || {};
            const score = getFiniteNumber(item.score);

            output[key] = {
                label,
                score,
                status: item.status ?? (score === null ? "判定不能" : "判定済み"),
                confidence: getFiniteNumber(item.confidence),
                reason: item.reason ?? "",
                text: item.text ?? item.reason ?? "",
                frame: item.frame ?? null
            };
        });

        return output;
    }

    // 開脚跳び・閉脚跳び
    const keys = [
        "knee",
        "hip",
        "hand",
        "takeOff",
        "landing"
    ];

    const labels = {
        knee: "膝の伸び",
        hip: "腰の位置",
        hand: "着手位置",
        takeOff: "両足踏切",
        landing: "着地の安定"
    };

    keys.forEach(key => {
        const item = details[key] || {};

        output[key] = {
            label: labels[key],
            score: getFiniteNumber(item.score),
            value: item.value ?? null,
            measured: item.measured ?? null,
            text: item.text ?? "",
            candidateCount: item.candidateCount ?? null,
            selectedFrame: item.selectedFrame ?? null
        };
    });

    return output;
}


// ============================================================
// 保存用フェーズ情報
// ============================================================

function createSavedPhase(phase, skill) {
    if (skill === "台上前転") {
        return {
            version: phase.version ?? null,
            success: phase.success ?? null,
            message: phase.message ?? "",
            detected: phase.detected || {},
            diagnostics: phase.diagnostics || {},
            warnings: Array.isArray(phase.warnings)
                ? phase.warnings
                : [],
            handCandidates: Array.isArray(phase.handCandidates)
                ? phase.handCandidates.length
                : 0
        };
    }

    return {
        takeOff: phase.takeOff ?? null,
        handContact: phase.handContact ?? null,
        highestHip: phase.highestHip ?? null,
        landing: phase.landing ?? null,
        handMeasured: phase.handMeasured ?? null,
        handCandidates: Array.isArray(phase.handCandidates)
            ? phase.handCandidates.length
            : 0,
        selectionScore: phase.selectionScore ?? null
    };
}


// ============================================================
// 採点結果を保存
// ============================================================

async function saveCurrentResult() {
    if (!currentScoringResult) {
        throw new Error("保存できる採点結果がありません。");
    }

    if (!window.VaultStorage) {
        throw new Error("保存プログラムが読み込まれていません。");
    }

    const className = classNameElement?.value.trim() || "";
    const studentName = studentNameElement?.value.trim() || "";
    const skill = getCurrentSkill();

    if (!className) {
        throw new Error("クラス名を入力してください。");
    }

    if (!studentName) {
        throw new Error("生徒名を入力してください。");
    }

    const phase = currentScoringResult.phase || {};
    const isForwardRoll = skill === "台上前転";

    let dScore = null;
    let eScore = null;
    let totalScore = null;
    let enteredEScore = getFiniteNumber(eScoreElement?.value);

    if (isForwardRoll) {
        const complete =
            currentScoringResult.isComplete === true &&
            getFiniteNumber(currentScoringResult.fullScore) !== null;

        if (complete) {
            dScore = Number(currentScoringResult.fullScore);
            eScore = enteredEScore;

            if (
                eScore === null ||
                eScore < 0 ||
                eScore > 10
            ) {
                throw new Error("Eスコアは0～10の範囲で入力してください。");
            }

            totalScore = dScore + eScore;
        } else {
            // 判定保留の場合は確定D/E/総合得点を保存しない
            dScore = null;
            eScore = null;
            totalScore = null;
        }
    } else {
        dScore = getFiniteNumber(currentScoringResult.score);
        eScore = enteredEScore;

        if (dScore === null) {
            throw new Error("Dスコアを取得できません。");
        }

        if (
            eScore === null ||
            eScore < 0 ||
            eScore > 10
        ) {
            throw new Error("Eスコアは0～10の範囲で入力してください。");
        }

        updateTotal();
        totalScore = getFiniteNumber(totalScoreElement?.textContent);

        if (totalScore === null) {
            throw new Error("総合得点を計算できませんでした。");
        }
    }

    const record = {
        className,
        studentName,
        skill,
        date: getTodayString(),
        savedAt: new Date().toISOString(),

        dScore: dScore === null ? null : Number(dScore.toFixed(1)),
        eScore: eScore === null ? null : Number(eScore.toFixed(1)),
        totalScore: totalScore === null
            ? null
            : Number(totalScore.toFixed(1)),

        // 判定保留の記録も後から確認できるようにする
        isComplete: isForwardRoll
            ? currentScoringResult.isComplete === true
            : true,

        provisionalScore: isForwardRoll
            ? getFiniteNumber(currentScoringResult.score)
            : null,

        provisionalMaxScore: isForwardRoll
            ? getFiniteNumber(currentScoringResult.maxScore)
            : null,

        judgedCount: isForwardRoll
            ? getFiniteNumber(currentScoringResult.judgedCount)
            : null,

        unknownCount: isForwardRoll
            ? getFiniteNumber(currentScoringResult.unknownCount)
            : null,

        enteredEScore: isForwardRoll && dScore === null
            ? enteredEScore
            : null,

        details: createSavedDetails(currentScoringResult),
        phase: createSavedPhase(phase, skill),

        totalComment:
            typeof createTotalComment === "function" && !isForwardRoll
                ? createTotalComment(currentScoringResult)
                : isForwardRoll
                    ? (
                        currentScoringResult.isComplete
                            ? "台上前転の5項目を判定しました。"
                            : "一部の項目が判定保留です。映像を確認してください。"
                    )
                    : ""
    };

    return await window.VaultStorage.saveResult(record);
}


// ============================================================
// 保存ボタン
// ============================================================

if (saveResultBtn) {
    saveResultBtn.addEventListener("click", async () => {
        saveResultBtn.disabled = true;

        if (saveStatusElement) {
            saveStatusElement.textContent = "採点結果を保存しています...";
        }

        try {
            const id = await saveCurrentResult();

            if (saveStatusElement) {
                saveStatusElement.textContent =
                    `保存しました。保存番号：${id}`;
            }

            await renderSavedResults();

        } catch (error) {
            console.error("保存エラー:", error);

            if (saveStatusElement) {
                saveStatusElement.textContent =
                    "保存できませんでした：" + error.message;
            }

            alert("保存できませんでした。\n" + error.message);

        } finally {
            saveResultBtn.disabled = !currentScoringResult;
        }
    });
}


// ============================================================
// 保存記録のクラス名を取得
// ============================================================

function getRecordClassName(record) {
    const value = String(record.className ?? "").trim();
    return value || "未設定";
}


// ============================================================
// クラス選択欄を更新
// ============================================================

function updateClassOptions(results) {
    if (!filterClassElement) return;

    const previousValue = filterClassElement.value;

    const classNames = [
        ...new Set(results.map(getRecordClassName))
    ].sort((a, b) => a.localeCompare(b, "ja"));

    filterClassElement.innerHTML = `
        <option value="">すべてのクラス</option>
        ${classNames.map(name => `
            <option value="${escapeHTML(name)}">
                ${escapeHTML(name)}
            </option>
        `).join("")}
    `;

    if (previousValue && classNames.includes(previousValue)) {
        filterClassElement.value = previousValue;
    }
}


// ============================================================
// 一覧の絞り込みと並べ替え
// ============================================================

function filterAndSortResults(results) {
    const selectedClass = filterClassElement?.value || "";
    const searchName =
        searchStudentElement?.value.trim().toLowerCase() || "";
    const selectedSkill = filterSkillElement?.value || "";
    const sortMode = sortResultsElement?.value || "dateDesc";

    const filtered = results.filter(record => {
        if (
            selectedClass &&
            getRecordClassName(record) !== selectedClass
        ) return false;

        if (
            searchName &&
            !String(record.studentName || "")
                .toLowerCase()
                .includes(searchName)
        ) return false;

        if (selectedSkill && record.skill !== selectedSkill) {
            return false;
        }

        return true;
    });

    filtered.sort((a, b) => {
        const aScore = getFiniteNumber(a.totalScore);
        const bScore = getFiniteNumber(b.totalScore);

        switch (sortMode) {
            case "dateAsc":
                return String(a.savedAt || a.date || "")
                    .localeCompare(String(b.savedAt || b.date || ""));

            case "scoreDesc":
                if (aScore === null && bScore === null) return 0;
                if (aScore === null) return 1;
                if (bScore === null) return -1;
                return bScore - aScore;

            case "scoreAsc":
                if (aScore === null && bScore === null) return 0;
                if (aScore === null) return 1;
                if (bScore === null) return -1;
                return aScore - bScore;

            case "nameAsc":
                return String(a.studentName || "")
                    .localeCompare(String(b.studentName || ""), "ja");

            case "dateDesc":
            default:
                return String(b.savedAt || b.date || "")
                    .localeCompare(String(a.savedAt || a.date || ""));
        }
    });

    return filtered;
}


// ============================================================
// クラス集計表示
// 判定保留の記録は平均点に含めない
// ============================================================

function renderClassSummary(results) {
    if (!classSummaryElement) return;

    const studentNames = new Set(
        results
            .map(record => String(record.studentName || "").trim())
            .filter(Boolean)
    );

    const scores = results
        .map(record => getFiniteNumber(record.totalScore))
        .filter(score => score !== null);

    const recordCount = results.length;
    const completedCount = scores.length;

    const average = completedCount > 0
        ? (
            scores.reduce((sum, score) => sum + score, 0) /
            completedCount
        ).toFixed(1)
        : "-";

    const className =
        filterClassElement?.value || "すべてのクラス";

    classSummaryElement.innerHTML = `
        <strong>${escapeHTML(className)} の集計</strong>
        <div style="
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:8px;
            margin-top:10px;
        ">
            <div style="background:white;padding:10px;border-radius:8px;text-align:center;">
                <strong style="font-size:22px;">${studentNames.size}</strong>
                <br><small>記録人数</small>
            </div>
            <div style="background:white;padding:10px;border-radius:8px;text-align:center;">
                <strong style="font-size:22px;">${recordCount}</strong>
                <br><small>記録件数</small>
            </div>
            <div style="background:white;padding:10px;border-radius:8px;text-align:center;">
                <strong style="font-size:22px;">${average}</strong>
                <br><small>確定記録の平均</small>
            </div>
        </div>
        <p style="margin-top:8px;font-size:13px;">
            確定記録：${completedCount}件 ／ 判定保留：${recordCount - completedCount}件
        </p>
    `;
}


// ============================================================
// 保存記録の詳細表示
// ============================================================

function showSavedResultDetail(record) {
    if (!savedResultDetailElement) return;

    if (!record) {
        savedResultDetailElement.textContent =
            "詳細を表示できませんでした。";
        return;
    }

    const details = record.details || {};
    const isForwardRoll = record.skill === "台上前転";

    const keys = isForwardRoll
        ? ["takeOff", "handContact", "rotation", "bodyPass", "landing"]
        : ["takeOff", "hand", "hip", "knee", "landing"];

    const rows = keys.map(key => {
        const item = details[key] || {};
        const label = item.label || key;
        const score = getFiniteNumber(item.score);
        const scoreText = score === null
            ? "判定不能"
            : `${score.toFixed(1)} 点`;

        const extra = isForwardRoll && getFiniteNumber(item.confidence) !== null
            ? `<br><small>検出信頼度：${Number(item.confidence).toFixed(2)}</small>`
            : "";

        return `
            <tr>
                <th>${escapeHTML(label)}</th>
                <td>${escapeHTML(scoreText)}${extra}</td>
                <td>${escapeHTML(item.text || item.reason || "評価コメントなし")}</td>
            </tr>
        `;
    }).join("");

    const total = getFiniteNumber(record.totalScore);
    const dScore = getFiniteNumber(record.dScore);
    const eScore = getFiniteNumber(record.eScore);

    const scoreSummary = total === null
        ? "判定保留（確定得点なし）"
        : `${total.toFixed(1)} 点`;

    const provisionalText = isForwardRoll && total === null
        ? `
            <p><strong>暫定評価：</strong>
            ${escapeHTML(record.provisionalScore ?? "-")} /
            ${escapeHTML(record.provisionalMaxScore ?? "-")}</p>
            <p><strong>判定済み項目：</strong>
            ${escapeHTML(record.judgedCount ?? "-")}件</p>
            <p><strong>判定保留項目：</strong>
            ${escapeHTML(record.unknownCount ?? "-")}件</p>
        `
        : "";

    savedResultDetailElement.innerHTML = `
        <div style="
            padding:14px;
            border:1px solid #ccc;
            border-radius:8px;
            background:#fff;
        ">
            <h3>採点記録の詳細</h3>

            <p><strong>クラス：</strong>${escapeHTML(getRecordClassName(record))}</p>
            <p><strong>生徒名：</strong>${escapeHTML(record.studentName || "")}</p>
            <p><strong>技：</strong>${escapeHTML(record.skill || "")}</p>
            <p><strong>実施日：</strong>${escapeHTML(record.date || "")}</p>

            <p><strong>Dスコア：</strong>${dScore === null ? "判定保留" : dScore.toFixed(1)}</p>
            <p><strong>Eスコア：</strong>${eScore === null ? "-" : eScore.toFixed(1)}</p>
            <p><strong>総合得点：</strong>${escapeHTML(scoreSummary)}</p>

            ${provisionalText}

            <h4>評価項目別の結果</h4>

            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>評価項目</th>
                            <th>得点・検出情報</th>
                            <th>評価内容</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

            <h4>総合コメント</h4>
            <p style="white-space:pre-wrap;">
                ${escapeHTML(record.totalComment || "総合コメントなし")}
            </p>

            <button type="button" id="closeSavedDetailBtn">
                詳細を閉じる
            </button>
        </div>
    `;

    const closeButton = document.getElementById("closeSavedDetailBtn");

    if (closeButton) {
        closeButton.addEventListener("click", () => {
            savedResultDetailElement.innerHTML = "";
        });
    }
}


// ============================================================
// 保存結果一覧
// ============================================================

async function renderSavedResults() {
    if (!savedResultsElement) return;

    if (!window.VaultStorage) {
        savedResultsElement.textContent =
            "保存プログラムが読み込まれていません。";
        return;
    }

    try {
        const allResults =
            await window.VaultStorage.getAllResults();

        updateClassOptions(allResults);

        const results = filterAndSortResults(allResults);

        renderClassSummary(results);

        if (results.length === 0) {
            savedResultsElement.textContent =
                allResults.length === 0
                    ? "まだ採点結果は保存されていません。"
                    : "条件に一致する記録はありません。";
            return;
        }

        const rows = results.map(record => {
            const id = Number(record.id);

            const dScore = getFiniteNumber(record.dScore);
            const eScore = getFiniteNumber(record.eScore);
            const totalScore = getFiniteNumber(record.totalScore);

            const dText = dScore === null
                ? (record.skill === "台上前転" ? "判定保留" : "-")
                : dScore.toFixed(1);

            const totalText = totalScore === null
                ? (record.skill === "台上前転" ? "判定保留" : "-")
                : totalScore.toFixed(1);

            return `
                <tr>
                    <td>${escapeHTML(getRecordClassName(record))}</td>
                    <td>${escapeHTML(record.date || "-")}</td>
                    <td>${escapeHTML(record.studentName || "-")}</td>
                    <td>${escapeHTML(record.skill || "-")}</td>
                    <td>${escapeHTML(dText)}</td>
                    <td>${eScore === null ? "-" : eScore.toFixed(1)}</td>
                    <td><strong>${escapeHTML(totalText)}</strong></td>
                    <td>
                        <button type="button" class="showSavedResult" data-id="${id}">
                            詳細
                        </button>
                        <button type="button" class="deleteSavedResult" data-id="${id}">
                            削除
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        savedResultsElement.innerHTML = `
            <p>
                表示件数：<strong>${results.length}件</strong>
                ／ 全記録：${allResults.length}件
            </p>

            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>クラス</th>
                            <th>実施日</th>
                            <th>生徒名</th>
                            <th>技</th>
                            <th>D</th>
                            <th>E</th>
                            <th>合計</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

    } catch (error) {
        console.error("一覧取得エラー:", error);

        savedResultsElement.textContent =
            "保存結果を読み込めませんでした：" + error.message;
    }
}


// ============================================================
// 一覧の条件変更
// ============================================================

[
    filterClassElement,
    searchStudentElement,
    filterSkillElement,
    sortResultsElement
].forEach(element => {
    if (!element) return;

    element.addEventListener("input", () => {
        renderSavedResults();
    });

    element.addEventListener("change", () => {
        renderSavedResults();
    });
});


// ============================================================
// 一覧更新ボタン
// ============================================================

if (refreshResultsBtn) {
    refreshResultsBtn.addEventListener("click", () => {
        renderSavedResults();
    });
}


// ============================================================
// 詳細表示・個別削除
// ============================================================

if (savedResultsElement) {
    savedResultsElement.addEventListener("click", async event => {
        const detailButton =
            event.target.closest(".showSavedResult");

        const deleteButton =
            event.target.closest(".deleteSavedResult");

        if (detailButton) {
            const id = Number(detailButton.dataset.id);

            try {
                const results =
                    await window.VaultStorage.getAllResults();

                const record = results.find(item =>
                    Number(item.id) === id
                );

                showSavedResultDetail(record);

            } catch (error) {
                console.error(error);

                alert(
                    "詳細を読み込めませんでした：" + error.message
                );
            }

            return;
        }

        if (!deleteButton) return;

        const id = Number(deleteButton.dataset.id);
        if (!Number.isFinite(id)) return;

        const confirmed = confirm(
            "この採点結果を削除しますか？\n削除した記録は元に戻せません。"
        );

        if (!confirmed) return;

        try {
            await window.VaultStorage.deleteResult(id);

            if (savedResultDetailElement) {
                savedResultDetailElement.innerHTML = "";
            }

            await renderSavedResults();

        } catch (error) {
            console.error("削除エラー:", error);

            alert("削除できませんでした：" + error.message);
        }
    });
}


// ============================================================
// Eスコア変更時
// ============================================================

if (eScoreElement) {
    eScoreElement.addEventListener("input", () => {
        updateTotal();
    });
}


// ============================================================
// 技の変更時
// ============================================================

if (skillElement) {
    skillElement.addEventListener("change", () => {
        currentScoringResult = null;
        analysisFinished = false;

        setSaveButtonEnabled(false);
        clearAnalysisDisplay();

        if (saveStatusElement) {
            saveStatusElement.textContent =
                "技を変更しました。動画を選び直して解析してください。";
        }

        setStatus(
            `${getCurrentSkill()}を選択しました。動画を選択して解析してください。`
        );
    });
}


// ============================================================
// 初期化・外部公開
// ============================================================

window.updateTotal = updateTotal;
window.showPhaseInfo = showPhaseInfo;
window.showForwardRollPhaseInfo = showForwardRollPhaseInfo;
window.renderSavedResults = renderSavedResults;
window.saveCurrentResult = saveCurrentResult;
window.showSavedResultDetail = showSavedResultDetail;

renderSavedResults();

const vaultDiagnostic =
    document.getElementById("vaultDiagnostic");

if (vaultDiagnostic) {
    if (
        typeof window.detectVaultBox === "function" &&
        typeof window.drawVaultBoxDetection === "function"
    ) {
        vaultDiagnostic.textContent =
            "跳び箱検出プログラム：読み込み成功";
    }
}

setAppDiagnostic(
    "跳び箱AI採点システム Ver10.0 読み込み成功！"
);

console.log(
    "跳び箱AI採点システム app.js Ver10.0 読み込み成功"
);
