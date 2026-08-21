// ============================================================
// 跳び箱AI採点システム
// app.js 診断版
// ============================================================
// 目的
// ・取得フレーム数を画面に表示
// ・phase判定結果を画面に表示
// ・着手候補数を画面に表示
// ・選択着手フレームを画面に表示
// ・着手位置実測値を画面に表示
// ・DevTools / Console 不要
// ============================================================

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


// ============================================================
// 診断表示エリア
// ============================================================

function getDiagnosticElement() {

    let diagnostic =
        document.getElementById("analysisDiagnostic");

    if (!diagnostic) {

        diagnostic =
            document.createElement("div");

        diagnostic.id =
            "analysisDiagnostic";

        diagnostic.style.marginTop =
            "15px";

        diagnostic.style.padding =
            "15px";

        diagnostic.style.border =
            "2px solid #1976d2";

        diagnostic.style.borderRadius =
            "10px";

        diagnostic.style.background =
            "#f5f9ff";

        diagnostic.style.fontSize =
            "16px";

        diagnostic.style.lineHeight =
            "1.8";

        const phaseInfo =
            document.getElementById("phaseInfo");

        if (phaseInfo && phaseInfo.parentElement) {

            phaseInfo.parentElement.appendChild(
                diagnostic
            );

        } else {

            document.body.appendChild(
                diagnostic
            );

        }

    }

    return diagnostic;
}


// ============================================================
// フェーズ表示エリア
// ============================================================

function getPhaseInfoElement() {

    let phaseInfo =
        document.getElementById("phaseInfo");

    if (!phaseInfo) {

        phaseInfo =
            document.createElement("div");

        phaseInfo.id =
            "phaseInfo";

        phaseInfo.style.marginTop =
            "10px";

        phaseInfo.style.padding =
            "10px";

        phaseInfo.style.borderRadius =
            "8px";

        const parent =
            status.closest(".card");

        if (parent) {

            parent.appendChild(
                phaseInfo
            );

        } else {

            document.body.appendChild(
                phaseInfo
            );

        }

    }

    return phaseInfo;
}


// ============================================================
// 診断情報を画面に表示
// ============================================================

function showDiagnostic(data) {

    const diagnostic =
        getDiagnosticElement();

    diagnostic.innerHTML = `

        <strong>🔎 AI解析診断情報</strong>

        <hr>

        <div>
            <strong>取得フレーム数：</strong>
            ${data.frameCount ?? "不明"}
        </div>

        <div>
            <strong>phase判定：</strong>
            ${data.phaseStatus ?? "未解析"}
        </div>

        <div>
            <strong>踏切フレーム：</strong>
            ${data.takeOff ?? "―"}
        </div>

        <div>
            <strong>着手フレーム：</strong>
            ${data.handContact ?? "―"}
        </div>

        <div>
            <strong>最高点フレーム：</strong>
            ${data.highestHip ?? "―"}
        </div>

        <div>
            <strong>着地フレーム：</strong>
            ${data.landing ?? "―"}
        </div>

        <hr>

        <div>
            <strong>着手候補数：</strong>
            ${data.candidateCount ?? "―"}
        </div>

        <div>
            <strong>選択着手フレーム：</strong>
            ${data.selectedHandFrame ?? "―"}
        </div>

        <div>
            <strong>着手位置（実測値）：</strong>
            ${data.handValue ?? "―"}
        </div>

    `;
}


// ============================================================
// 着手候補数を安全に取得
// ============================================================

function getCandidateCount(phase, result) {

    // --------------------------------------------------------
    // ① phase.handCandidates
    // --------------------------------------------------------

    if (
        phase &&
        Array.isArray(
            phase.handCandidates
        )
    ) {

        return phase.handCandidates.length;

    }


    // --------------------------------------------------------
    // ② phase.candidates
    // --------------------------------------------------------

    if (
        phase &&
        Array.isArray(
            phase.candidates
        )
    ) {

        return phase.candidates.length;

    }


    // --------------------------------------------------------
    // ③ phase.handContactCandidates
    // --------------------------------------------------------

    if (
        phase &&
        Array.isArray(
            phase.handContactCandidates
        )
    ) {

        return phase.handContactCandidates.length;

    }


    // --------------------------------------------------------
    // ④ result.handCandidates
    // --------------------------------------------------------

    if (
        result &&
        Array.isArray(
            result.handCandidates
        )
    ) {

        return result.handCandidates.length;

    }


    // --------------------------------------------------------
    // ⑤ result.candidates
    // --------------------------------------------------------

    if (
        result &&
        Array.isArray(
            result.candidates
        )
    ) {

        return result.candidates.length;

    }


    // --------------------------------------------------------
    // ⑥ 数値として保存されている場合
    // --------------------------------------------------------

    if (
        phase &&
        Number.isFinite(
            Number(
                phase.candidateCount
            )
        )
    ) {

        return Number(
            phase.candidateCount
        );

    }


    if (
        phase &&
        Number.isFinite(
            Number(
                phase.handCandidateCount
            )
        )
    ) {

        return Number(
            phase.handCandidateCount
        );

    }


    return null;

}


// ============================================================
// 選択着手フレームを安全に取得
// ============================================================

function getSelectedHandFrame(phase, result) {

    const keys = [

        "handContact",

        "selectedHandFrame",

        "selectedHandContact",

        "handContactFrame",

        "selectedFrame"

    ];

    for (
        let i = 0;
        i < keys.length;
        i++
    ) {

        const key =
            keys[i];

        if (
            phase &&
            phase[key] !== undefined &&
            phase[key] !== null &&
            Number.isFinite(
                Number(
                    phase[key]
                )
            )
        ) {

            return Number(
                phase[key]
            );

        }

    }


    for (
        let i = 0;
        i < keys.length;
        i++
    ) {

        const key =
            keys[i];

        if (
            result &&
            result[key] !== undefined &&
            result[key] !== null &&
            Number.isFinite(
                Number(
                    result[key]
                )
            )
        ) {

            return Number(
                result[key]
            );

        }

    }


    return null;

}


// ============================================================
// 着手位置実測値を安全に取得
// ============================================================

function getHandValue(result) {

    const keys = [

        "handValue",

        "handPosition",

        "handPositionValue",

        "handDistance",

        "handPlacement",

        "handScoreValue",

        "着手位置"

    ];


    for (
        let i = 0;
        i < keys.length;
        i++
    ) {

        const key =
            keys[i];

        if (
            result &&
            result[key] !== undefined &&
            result[key] !== null &&
            Number.isFinite(
                Number(
                    result[key]
                )
            )
        ) {

            return Number(
                result[key]
            ).toFixed(3);

        }

    }


    return null;

}


// ============================================================
// 動画選択
// ============================================================

videoFile.addEventListener(
    "change",
    () => {

        const file =
            videoFile.files[0];

        if (!file) {

            return;

        }


        video.src =
            URL.createObjectURL(file);


        analyzing =
            false;

        analysisFinished =
            false;


        dScore.textContent =
            "-";

        totalScore.textContent =
            "-";


        status.textContent =
            "動画を読み込み中...";


        const feedback =
            document.getElementById(
                "feedback"
            );


        if (feedback) {

            feedback.innerHTML =
                "解析するとAI評価が表示されます";

        }


        const phaseInfo =
            getPhaseInfoElement();


        phaseInfo.textContent =
            "未解析";


        showDiagnostic({

            frameCount:
                "未解析",

            phaseStatus:
                "未解析",

            takeOff:
                "―",

            handContact:
                "―",

            highestHip:
                "―",

            landing:
                "―",

            candidateCount:
                "―",

            selectedHandFrame:
                "―",

            handValue:
                "―"

        });

    }
);


// ============================================================
// 動画準備
// ============================================================

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


// ============================================================
// AI解析開始
// ============================================================

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


        analyzing =
            true;

        analysisFinished =
            false;


        // ----------------------------------------------------
        // データ初期化
        // ----------------------------------------------------

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


        dScore.textContent =
            "-";

        totalScore.textContent =
            "-";


        const feedback =
            document.getElementById(
                "feedback"
            );


        if (feedback) {

            feedback.innerHTML =
                "AI解析中...";

        }


        const phaseInfo =
            getPhaseInfoElement();


        phaseInfo.textContent =
            "解析中...";


        showDiagnostic({

            frameCount:
                "解析中...",

            phaseStatus:
                "解析中...",

            takeOff:
                "―",

            handContact:
                "―",

            highestHip:
                "―",

            landing:
                "―",

            candidateCount:
                "―",

            selectedHandFrame:
                "―",

            handValue:
                "―"

        });


        status.textContent =
            "AI解析中...";


        // ----------------------------------------------------
        // 動画を最初に戻す
        // ----------------------------------------------------

        video.pause();

        video.currentTime =
            0;


        try {

            await video.play();


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


            analyzing =
                false;


            status.textContent =
                "AI解析を開始できませんでした";


            showDiagnostic({

                frameCount:
                    "開始失敗",

                phaseStatus:
                    "―",

                takeOff:
                    "―",

                handContact:
                    "―",

                highestHip:
                    "―",

                landing:
                    "―",

                candidateCount:
                    "―",

                selectedHandFrame:
                    "―",

                handValue:
                    "―"

            });

        }

    }
);


// ============================================================
// 動画終了
// ============================================================

video.addEventListener(
    "ended",
    () => {

        if (!analyzing) {

            return;

        }


        finishAnalysis();

    }
);


// ============================================================
// AI解析終了
// ============================================================

function finishAnalysis() {

    if (!analyzing) {

        return;

    }


    if (analysisFinished) {

        return;

    }


    analysisFinished =
        true;

    analyzing =
        false;


    // ========================================================
    // 骨格フレーム取得
    // ========================================================

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


        showDiagnostic({

            frameCount:
                "取得エラー",

            phaseStatus:
                "未判定",

            takeOff:
                "―",

            handContact:
                "―",

            highestHip:
                "―",

            landing:
                "―",

            candidateCount:
                "―",

            selectedHandFrame:
                "―",

            handValue:
                "―"

        });


        return;

    }


    // --------------------------------------------------------
    // 取得フレーム数を即表示
    // --------------------------------------------------------

    const frameCount =
        Array.isArray(frames)
            ? frames.length
            : 0;


    showDiagnostic({

        frameCount:
            frameCount,

        phaseStatus:
            "判定中...",

        takeOff:
            "―",

        handContact:
            "―",

        highestHip:
            "―",

        landing:
            "―",

        candidateCount:
            "―",

        selectedHandFrame:
            "―",

        handValue:
            "―"

    });


    // ========================================================
    // フレーム不足
    // ========================================================

    if (
        !Array.isArray(frames) ||
        frames.length < 20
    ) {

        status.textContent =
            "骨格データが不足しています";


        getPhaseInfoElement()
            .innerHTML = `

                <strong>解析失敗</strong><br>

                取得フレーム数：
                ${frameCount}

            `;


        showDiagnostic({

            frameCount:
                frameCount,

            phaseStatus:
                "フレーム不足",

            takeOff:
                "―",

            handContact:
                "―",

            highestHip:
                "―",

            landing:
                "―",

            candidateCount:
                "―",

            selectedHandFrame:
                "―",

            handValue:
                "―"

        });


        return;

    }


    // ========================================================
    // フェーズ検出
    // ========================================================

    let phase =
        null;


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

    }

    catch (error) {

        console.error(
            "フェーズ検出エラー:",
            error
        );


        getPhaseInfoElement()
            .textContent =
            "フェーズ検出エラー";


        status.textContent =
            "フェーズ検出に失敗しました";


        showDiagnostic({

            frameCount:
                frameCount,

            phaseStatus:
                "エラー",

            takeOff:
                "―",

            handContact:
                "―",

            highestHip:
                "―",

            landing:
                "―",

            candidateCount:
                "―",

            selectedHandFrame:
                "―",

            handValue:
                "―"

        });


        return;

    }


    // ========================================================
    // phaseがnullの場合
    // ========================================================

    if (!phase) {

        getPhaseInfoElement()
            .textContent =
            "フェーズ検出に失敗しました";


        status.textContent =
            "フェーズ検出に失敗しました";


        showDiagnostic({

            frameCount:
                frameCount,

            phaseStatus:
                "null / 検出失敗",

            takeOff:
                "―",

            handContact:
                "―",

            highestHip:
                "―",

            landing:
                "―",

            candidateCount:
                "0",

            selectedHandFrame:
                "―",

            handValue:
                "―"

        });


        return;

    }


    // ========================================================
    // フェーズ情報取得
    // ========================================================

    const takeOff =
        phase.takeOff ??
        "―";


    const handContact =
        getSelectedHandFrame(
            phase,
            null
        ) ?? "―";


    const highestHip =
        phase.highestHip ??
        "―";


    const landing =
        phase.landing ??
        "―";


    const candidateCount =
        getCandidateCount(
            phase,
            null
        );


    // ========================================================
    // フェーズ画面表示
    // ========================================================

    const phaseInfo =
        getPhaseInfoElement();


    phaseInfo.innerHTML = `

        <strong>動作フェーズ</strong><br>

        踏切：
        ${takeOff}
        フレーム<br>

        着手：
        ${handContact}
        フレーム<br>

        最高点：
        ${highestHip}
        フレーム<br>

        着地：
        ${landing}
        フレーム

    `;


    // ========================================================
    // 一度フェーズ情報を診断表示
    // ========================================================

    showDiagnostic({

        frameCount:
            frameCount,

        phaseStatus:
            "検出成功",

        takeOff:
            takeOff,

        handContact:
            handContact,

        highestHip:
            highestHip,

        landing:
            landing,

        candidateCount:
            candidateCount !== null
                ? candidateCount
                : "取得不可",

        selectedHandFrame:
            handContact,

        handValue:
            "採点待ち"

    });


    // ========================================================
    // Dスコア計算
    // ========================================================

    let result =
        null;


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

    }

    catch (error) {

        console.error(
            "Dスコア計算エラー:",
            error
        );


        status.textContent =
            "Dスコア計算に失敗しました";


        showDiagnostic({

            frameCount:
                frameCount,

            phaseStatus:
                "検出成功・採点失敗",

            takeOff:
                takeOff,

            handContact:
                handContact,

            highestHip:
                highestHip,

            landing:
                landing,

            candidateCount:
                candidateCount !== null
                    ? candidateCount
                    : "取得不可",

            selectedHandFrame:
                handContact,

            handValue:
                "採点失敗"

        });


        return;

    }


    // ========================================================
    // resultがない場合
    // ========================================================

    if (!result) {

        status.textContent =
            "採点結果を取得できませんでした";


        showDiagnostic({

            frameCount:
                frameCount,

            phaseStatus:
                "検出成功・resultなし",

            takeOff:
                takeOff,

            handContact:
                handContact,

            highestHip:
                highestHip,

            landing:
                landing,

            candidateCount:
                candidateCount !== null
                    ? candidateCount
                    : "取得不可",

            selectedHandFrame:
                handContact,

            handValue:
                "―"

        });


        return;

    }


    // ========================================================
    // resultから着手情報を取得
    // ========================================================

    const resultCandidateCount =
        getCandidateCount(
            phase,
            result
        );


    const finalCandidateCount =
        resultCandidateCount !== null
            ? resultCandidateCount
            : candidateCount;


    const selectedFrame =
        getSelectedHandFrame(
            phase,
            result
        );


    const handValue =
        getHandValue(
            result
        );


    // ========================================================
    // Dスコア表示
    // ========================================================

    const score =
        Number(
            result.score
        );


    if (
        Number.isFinite(score)
    ) {

        dScore.textContent =
            score.toFixed(1);

    }

    else {

        dScore.textContent =
            "-";

    }


    // ========================================================
    // 最終診断表示
    // ========================================================

    showDiagnostic({

        frameCount:
            frameCount,

        phaseStatus:
            "検出成功・採点完了",

        takeOff:
            takeOff,

        handContact:
            selectedFrame ??
            handContact,

        highestHip:
            highestHip,

        landing:
            landing,

        candidateCount:
            finalCandidateCount !== null
                ? finalCandidateCount
                : "取得不可",

        selectedHandFrame:
            selectedFrame ??
            handContact,

        handValue:
            handValue ??
            "取得不可"

    });


    // ========================================================
    // フィードバック
    // ========================================================

    try {

        if (
            typeof showFeedback ===
            "function"
        ) {

            showFeedback(
                result
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
                "AI評価の表示中にエラーが発生しました。";

        }

    }


    // ========================================================
    // 合計点
    // ========================================================

    updateTotal();


    // ========================================================
    // 完了
    // ========================================================

    status.textContent =
        "解析完了";

}


// ============================================================
// 合計点
// ============================================================

eScore.addEventListener(
    "input",
    updateTotal
);


function updateTotal() {

    const d =
        Number(
            dScore.textContent
        );


    const e =
        Number(
            eScore.value
        );


    if (
        !Number.isFinite(d) ||
        !Number.isFinite(e)
    ) {

        totalScore.textContent =
            "-";

        return;

    }


    totalScore.textContent =
        (
            d + e
        ).toFixed(1);

}


// ============================================================
// グローバル公開
// ============================================================

window.finishAnalysis =
    finishAnalysis;

window.updateTotal =
    updateTotal;


// ============================================================
// 起動確認
// ============================================================

console.log(
    "app.js 診断版 読み込み"
);