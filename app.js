
// ============================================================
// 跳び箱AI採点システム
// app.js Ver9.1
// 完全置き換え版
//
// Ver9.0の機能を維持
// ・MediaPipe骨格検出
// ・動作フェーズ検出
// ・跳び箱検出
// ・Dスコア計算
// ・AI評価コメント
// ・Eスコアと総合得点
// ・採点結果保存
//
// Ver9.1追加機能
// ・クラス名の保存
// ・クラス別一覧
// ・生徒名検索
// ・技による絞り込み
// ・得点順、日付順、氏名順の並べ替え
// ・クラス集計
// ・保存結果の詳細表示
// ・個別削除
//
// ※score.js、feedback.jsの採点ロジックは変更しない
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
// 状態表示
// ============================================================

function setStatus(message) {

    if (statusElement) {
        statusElement.textContent = message;
    }

}


// ============================================================
// 診断表示
// ============================================================

function setAppDiagnostic(message, success = true) {

    const element = document.getElementById("appDiagnostic");

    if (!element) return;

    element.textContent = message;

    element.style.background = success
        ? "#d8f3dc"
        : "#fff3cd";

}


// ============================================================
// 総合得点
// ============================================================

function updateTotal() {

    const d = Number(dScoreElement?.textContent);

    const e = Number(
        eScoreElement?.value ??
        eScoreElement?.textContent
    );

    if (
        Number.isFinite(d) &&
        Number.isFinite(e) &&
        totalScoreElement
    ) {

        totalScoreElement.textContent =
            (d + e).toFixed(1);

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
            "必要な関数が読み込まれていません：" +
            missing.join(", ")
        );

    }

    if (
        typeof window.Pose !== "function" &&
        typeof Pose !== "function"
    ) {

        throw new Error(
            "MediaPipe Poseが読み込まれていません。"
        );

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

            if (dScoreElement) {
                dScoreElement.textContent = "-";
            }

            if (totalScoreElement) {
                totalScoreElement.textContent = "-";
            }

            const feedback =
                document.getElementById("feedback");

            if (feedback) {
                feedback.textContent = "";
            }

            const phaseInfo =
                document.getElementById("phaseInfo");

            if (phaseInfo) {
                phaseInfo.textContent = "未解析";
            }

            video.src = URL.createObjectURL(file);
            video.load();

            setStatus(
                "動画を読み込みました。解析ボタンを押してください。"
            );

        } catch (error) {

            setStatus(
                "動画選択エラー：" + error.message
            );

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
// ============================================================

function showPhaseInfo(phase) {

    const element =
        document.getElementById("phaseInfo");

    if (!element) return;

    element.innerHTML = `
        <strong>動作フェーズ検出結果</strong><br>
        踏切フレーム：${phase.takeOff ?? "-"}<br>
        着手フレーム：${phase.handContact ?? "-"}<br>
        腰最高点フレーム：${phase.highestHip ?? "-"}<br>
        着地フレーム：${phase.landing ?? "-"}<br>
        着手候補数：${
            Array.isArray(phase.handCandidates)
                ? phase.handCandidates.length
                : "-"
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

        setStatus(
            "解析ボタンを受け付けました。準備中です..."
        );


        if (!video || !video.src) {

            setStatus(
                "先に動画を選択してください。"
            );

            return;

        }


        if (analyzing) {

            setStatus(
                "すでに解析中です。"
            );

            return;

        }


        const analysisId = ++currentAnalysisId;

        analyzing = true;
        analysisFinished = false;
        currentScoringResult = null;

        setSaveButtonEnabled(false);

        detectBtn.disabled = true;


        try {

            setStatus(
                "必要なプログラムを確認しています..."
            );

            checkRequiredFunctions();

            setAppDiagnostic(
                "診断：必要なプログラムの確認が完了しました！"
            );


            setStatus(
                "解析データを初期化しています..."
            );

            clearPoseFrames();

            if (typeof clearPhase === "function") {
                clearPhase();
            }

            if (dScoreElement) {
                dScoreElement.textContent = "-";
            }

            if (totalScoreElement) {
                totalScoreElement.textContent = "-";
            }

            const feedback =
                document.getElementById("feedback");

            if (feedback) {
                feedback.textContent = "";
            }

            const phaseInfo =
                document.getElementById("phaseInfo");

            if (phaseInfo) {
                phaseInfo.textContent = "解析準備中";
            }


            video.pause();
            video.currentTime = 0;

            setStatus(
                "動画データを読み込んでいます..."
            );


            if (video.readyState < 2) {

                setStatus(
                    "動画データを再読み込みしています..."
                );

                await new Promise((resolve, reject) => {

                    let completed = false;

                    const finish = (error = null) => {

                        if (completed) return;

                        completed = true;

                        clearTimeout(timer);

                        video.removeEventListener(
                            "loadeddata",
                            onLoaded
                        );

                        video.removeEventListener(
                            "canplay",
                            onLoaded
                        );

                        video.removeEventListener(
                            "error",
                            onError
                        );

                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }

                    };

                    const onLoaded = () => {
                        finish();
                    };

                    const onError = () => {

                        finish(
                            new Error(
                                "動画データの読み込みに失敗しました。"
                            )
                        );

                    };

                    const timer = setTimeout(() => {

                        finish(
                            new Error(
                                "動画の読み込みが10秒以内に完了しませんでした。"
                            )
                        );

                    }, 10000);


                    video.addEventListener(
                        "loadeddata",
                        onLoaded
                    );

                    video.addEventListener(
                        "canplay",
                        onLoaded
                    );

                    video.addEventListener(
                        "error",
                        onError
                    );


                    if (video.readyState >= 2) {
                        finish();
                    }

                });

            }


            if (analysisId !== currentAnalysisId) return;


            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;


            setStatus(
                "AI骨格検出を初期化しています..."
            );

            setAppDiagnostic(
                "診断：Pose初期化を開始しました..."
            );

            await startPose(video, canvas, ctx);

            setAppDiagnostic(
                "診断：Pose初期化が完了しました！"
            );


            if (analysisId !== currentAnalysisId) return;


            setStatus(
                "動画を再生しながら骨格を検出しています..."
            );

            await video.play();

        } catch (error) {

            console.error(
                "解析開始エラー:",
                error
            );

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

    setStatus(
        "エラー：AI骨格検出開始ボタンが見つかりません。"
    );

}


// ============================================================
// 解析終了
// ============================================================

async function finishAnalysis(analysisId) {

    if (analysisId !== currentAnalysisId) return;
    if (analysisFinished) return;

    analysisFinished = true;

    setStatus(
        "骨格検出の最終処理を待っています..."
    );


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


        setStatus(
            "動作フェーズを判定しています..."
        );

        const phase = detectPhases(frames);

        if (!phase) {

            setStatus(
                "動作フェーズを検出できませんでした。"
            );

            return;

        }


        showPhaseInfo(phase);


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

            console.log(
                "着手位置：取得できませんでした"
            );

        }


        const vaultDiagnostic =
            document.getElementById("vaultDiagnostic");

        const box =
            handContactFrame &&
            handContactFrame.vaultBox;

        const leftHand =
            handContactFrame &&
            handContactFrame.leftHandPositionRelativeToVault;

        const rightHand =
            handContactFrame &&
            handContactFrame.rightHandPositionRelativeToVault;

        const centerHand =
            handContactFrame &&
            handContactFrame.handPositionRelativeToVault;


        if (vaultDiagnostic) {

            const formatPoint = (point) => {

                if (
                    !point ||
                    !Number.isFinite(point.x) ||
                    !Number.isFinite(point.y)
                ) {

                    return "取得できません";

                }

                return (
                    `X=${point.x.toFixed(3)} / Y=${point.y.toFixed(3)}`
                );

            };


            const formatBox = (value) => {

                if (!value) {
                    return "検出できません";
                }

                return (
                    `X=${value.x.toFixed(3)} / Y=${value.y.toFixed(3)}\n` +
                    `幅=${value.width.toFixed(3)} / 高さ=${value.height.toFixed(3)}`
                );

            };


            vaultDiagnostic.textContent =
                `【着手位置診断】
跳び箱：${formatBox(box)}
左手：${formatPoint(leftHand)}
右手：${formatPoint(rightHand)}
手の中心：${formatPoint(centerHand)}`;

        }


        // Dスコア計算は既存のscore.jsを使用
        const result = calculateDScore(
            frames,
            phase
        );


        if (result) {

            result.phase = phase;

            if (!result.details) {
                result.details = {};
            }

            if (!result.details.hand) {
                result.details.hand = {};
            }

            result.details.hand.measured =
                phase.handMeasured;

            result.details.hand.candidateCount =
                Array.isArray(phase.handCandidates)
                    ? phase.handCandidates.length
                    : 0;

            result.details.hand.selectedFrame =
                phase.handContact;

        }


        if (
            !result ||
            !Number.isFinite(Number(result.score))
        ) {

            setStatus(
                "採点結果を取得できませんでした。"
            );

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
            "Ver9.1：解析・採点が正常に完了しました！"
        );


    } catch (error) {

        console.error(
            "解析終了エラー:",
            error
        );

        setStatus(
            "解析終了エラー：" + error.message
        );

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

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


// ============================================================
// 保存用の評価項目を作成
// ============================================================

function createSavedDetails(result) {

    const details = result.details || {};

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

    const output = {};

    keys.forEach(key => {

        const item = details[key] || {};

        output[key] = {

            label: labels[key],

            score: Number.isFinite(Number(item.score))
                ? Number(item.score)
                : 0,

            value: item.value ?? null,

            measured: item.measured ?? null,

            text: item.text ?? "",

            candidateCount:
                item.candidateCount ?? null,

            selectedFrame:
                item.selectedFrame ?? null

        };

    });

    return output;

}


// ============================================================
// 採点結果を保存
// ============================================================

async function saveCurrentResult() {

    if (!currentScoringResult) {

        throw new Error(
            "保存できる採点結果がありません。"
        );

    }

    if (!window.VaultStorage) {

        throw new Error(
            "保存プログラムが読み込まれていません。"
        );

    }


    const className =
        classNameElement?.value.trim() || "";

    const studentName =
        studentNameElement?.value.trim() || "";

    const skill =
        skillElement?.value || "開脚跳び";


    if (!className) {

        throw new Error(
            "クラス名を入力してください。"
        );

    }

    if (!studentName) {

        throw new Error(
            "生徒名を入力してください。"
        );

    }


    const dScore =
        Number(currentScoringResult.score);

    const eScore =
        Number(eScoreElement?.value);

    if (
        !Number.isFinite(dScore) ||
        !Number.isFinite(eScore) ||
        eScore < 0 ||
        eScore > 10
    ) {

        throw new Error(
            "DスコアまたはEスコアを確認してください。"
        );

    }


    updateTotal();

    const totalScore =
        Number(totalScoreElement?.textContent);

    if (!Number.isFinite(totalScore)) {

        throw new Error(
            "総合得点を計算できませんでした。"
        );

    }


    const phase =
        currentScoringResult.phase || {};


    const record = {

        className: className,

        studentName: studentName,

        skill: skill,

        date: getTodayString(),

        savedAt: new Date().toISOString(),

        dScore: Number(dScore.toFixed(1)),

        eScore: Number(eScore.toFixed(1)),

        totalScore: Number(totalScore.toFixed(1)),

        details: createSavedDetails(
            currentScoringResult
        ),

        phase: {

            takeOff: phase.takeOff ?? null,

            handContact: phase.handContact ?? null,

            highestHip: phase.highestHip ?? null,

            landing: phase.landing ?? null,

            handMeasured: phase.handMeasured ?? null,

            handCandidates: Array.isArray(phase.handCandidates)
                ? phase.handCandidates.length
                : 0,

            selectionScore: phase.selectionScore ?? null

        },

        totalComment:
            typeof createTotalComment === "function"
                ? createTotalComment(currentScoringResult)
                : ""

    };


    const id =
        await window.VaultStorage.saveResult(record);

    return id;

}


// ============================================================
// 保存ボタン
// ============================================================

if (saveResultBtn) {

    saveResultBtn.addEventListener("click", async () => {

        saveResultBtn.disabled = true;

        if (saveStatusElement) {

            saveStatusElement.textContent =
                "採点結果を保存しています...";

        }

        try {

            const id = await saveCurrentResult();

            if (saveStatusElement) {

                saveStatusElement.textContent =
                    `保存しました。保存番号：${id}`;

            }

            await renderSavedResults();

        } catch (error) {

            console.error(
                "保存エラー:",
                error
            );

            if (saveStatusElement) {

                saveStatusElement.textContent =
                    "保存できませんでした：" + error.message;

            }

            alert(
                "保存できませんでした。\n" + error.message
            );

        } finally {

            saveResultBtn.disabled =
                !currentScoringResult;

        }

    });

}


// ============================================================
// HTML表示用エスケープ
// ============================================================

function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => {

            const map = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return map[character];

        }
    );

}


// ============================================================
// 保存記録のクラス名を取得
// Ver9.0以前の記録は「未設定」として扱う
// ============================================================

function getRecordClassName(record) {

    const value = String(
        record.className ?? ""
    ).trim();

    return value || "未設定";

}


// ============================================================
// クラス選択欄を更新
// ============================================================

function updateClassOptions(results) {

    if (!filterClassElement) return;

    const previousValue =
        filterClassElement.value;

    const classNames = [
        ...new Set(
            results.map(getRecordClassName)
        )
    ].sort((a, b) => a.localeCompare(b, "ja"));

    filterClassElement.innerHTML = `
        <option value="">すべてのクラス</option>
        ${classNames.map(name => `
            <option value="${escapeHTML(name)}">
                ${escapeHTML(name)}
            </option>
        `).join("")}
    `;

    if (
        previousValue &&
        classNames.includes(previousValue)
    ) {

        filterClassElement.value = previousValue;

    }

}


// ============================================================
// 一覧の絞り込みと並べ替え
// ============================================================

function filterAndSortResults(results) {

    const selectedClass =
        filterClassElement?.value || "";

    const searchName =
        searchStudentElement?.value.trim().toLowerCase() || "";

    const selectedSkill =
        filterSkillElement?.value || "";

    const sortMode =
        sortResultsElement?.value || "dateDesc";


    let filtered = results.filter(record => {

        const className = getRecordClassName(record);

        if (
            selectedClass &&
            className !== selectedClass
        ) {
            return false;
        }

        if (
            searchName &&
            !String(record.studentName || "")
                .toLowerCase()
                .includes(searchName)
        ) {
            return false;
        }

        if (
            selectedSkill &&
            record.skill !== selectedSkill
        ) {
            return false;
        }

        return true;

    });


    filtered.sort((a, b) => {

        switch (sortMode) {

            case "dateAsc":
                return String(a.savedAt || a.date || "")
                    .localeCompare(String(b.savedAt || b.date || ""));

            case "scoreDesc":
                return Number(b.totalScore || 0) -
                       Number(a.totalScore || 0);

            case "scoreAsc":
                return Number(a.totalScore || 0) -
                       Number(b.totalScore || 0);

            case "nameAsc":
                return String(a.studentName || "")
                    .localeCompare(
                        String(b.studentName || ""),
                        "ja"
                    );

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
// ============================================================

function renderClassSummary(results) {

    if (!classSummaryElement) return;

    const studentNames = new Set(
        results.map(record =>
            String(record.studentName || "").trim()
        ).filter(Boolean)
    );

    const recordCount = results.length;

    const total = results.reduce((sum, record) => {

        const score = Number(record.totalScore);

        return sum + (
            Number.isFinite(score) ? score : 0
        );

    }, 0);

    const average = recordCount > 0
        ? (total / recordCount).toFixed(1)
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
                <br><small>平均得点</small>
            </div>
        </div>
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

    const keys = [
        "takeOff",
        "hand",
        "hip",
        "knee",
        "landing"
    ];

    const rows = keys.map(key => {

        const item = details[key] || {};

        const label = item.label || key;

        const score = Number(item.score);

        const scoreText = Number.isFinite(score)
            ? `${score.toFixed(1)} 点`
            : "-";

        return `
            <tr>
                <th>${escapeHTML(label)}</th>
                <td>${escapeHTML(scoreText)}</td>
                <td>${escapeHTML(item.text || "評価コメントなし")}</td>
            </tr>
        `;

    }).join("");


    savedResultDetailElement.innerHTML = `
        <div style="
            padding:14px;
            border:1px solid #ccc;
            border-radius:8px;
            background:#fff;
        ">
            <h3>採点記録の詳細</h3>

            <p>
                <strong>クラス：</strong>
                ${escapeHTML(getRecordClassName(record))}
            </p>

            <p>
                <strong>生徒名：</strong>
                ${escapeHTML(record.studentName)}
            </p>

            <p>
                <strong>技：</strong>
                ${escapeHTML(record.skill)}
            </p>

            <p>
                <strong>実施日：</strong>
                ${escapeHTML(record.date)}
            </p>

            <p>
                <strong>総合得点：</strong>
                ${Number(record.totalScore).toFixed(1)} 点
            </p>

            <h4>評価項目別の結果</h4>

            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>評価項目</th>
                            <th>得点</th>
                            <th>評価内容</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <h4>総合コメント</h4>

            <p style="white-space:pre-wrap;">
                ${escapeHTML(record.totalComment || "総合コメントなし")}
            </p>

            <button
                type="button"
                id="closeSavedDetailBtn">
                詳細を閉じる
            </button>
        </div>
    `;

    const closeButton =
        document.getElementById("closeSavedDetailBtn");

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

        const results =
            filterAndSortResults(allResults);


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

            const dScore = Number(record.dScore);
            const eScore = Number(record.eScore);
            const totalScore = Number(record.totalScore);

            return `
                <tr>
                    <td>${escapeHTML(getRecordClassName(record))}</td>
                    <td>${escapeHTML(record.date || "-")}</td>
                    <td>${escapeHTML(record.studentName || "-")}</td>
                    <td>${escapeHTML(record.skill || "-")}</td>
                    <td>${Number.isFinite(dScore) ? dScore.toFixed(1) : "-"}</td>
                    <td>${Number.isFinite(eScore) ? eScore.toFixed(1) : "-"}</td>
                    <td><strong>${Number.isFinite(totalScore) ? totalScore.toFixed(1) : "-"}</strong></td>
                    <td>
                        <button
                            type="button"
                            class="showSavedResult"
                            data-id="${id}">
                            詳細
                        </button>

                        <button
                            type="button"
                            class="deleteSavedResult"
                            data-id="${id}">
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

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;


    } catch (error) {

        console.error(
            "一覧取得エラー:",
            error
        );

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


        const id =
            Number(deleteButton.dataset.id);

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

            console.error(
                "削除エラー:",
                error
            );

            alert(
                "削除できませんでした：" + error.message
            );

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
// 初期化
// ============================================================

window.updateTotal = updateTotal;

window.showPhaseInfo = showPhaseInfo;

window.renderSavedResults = renderSavedResults;

window.saveCurrentResult = saveCurrentResult;

window.showSavedResultDetail = showSavedResultDetail;


// 保存結果を読み込む
renderSavedResults();


// 跳び箱検出プログラムの確認
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
    "跳び箱AI採点システム Ver9.1 読み込み成功！"
);


console.log(
    "跳び箱AI採点システム app.js Ver9.1 読み込み成功"
);
