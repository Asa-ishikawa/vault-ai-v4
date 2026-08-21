// ============================================================
// 跳び箱AI採点システム
// app.js 診断版
//
// 目的：
// 「取得フレーム数が19で止まる」原因を画面上で特定する
//
// 採点ロジック(score.js)は変更しない
// phase.jsも変更しない
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

let diagnosticTimer = null;
let lastFrameCount = 0;
let lastFrameChangeTime = 0;
let analysisStartTime = 0;
let lastVideoTime = 0;


// ============================================================
// 診断画面を作る
// ============================================================

function getDiagnosticElement() {

    let el = document.getElementById("diagnosticInfo");

    if (el) {
        return el;
    }

    el = document.createElement("div");

    el.id = "diagnosticInfo";

    el.style.marginTop = "15px";
    el.style.padding = "15px";
    el.style.border = "3px solid #1976d2";
    el.style.borderRadius = "10px";
    el.style.background = "#f5faff";
    el.style.fontSize = "16px";
    el.style.lineHeight = "1.8";

    const phaseInfo =
        document.getElementById("phaseInfo");

    if (phaseInfo && phaseInfo.parentElement) {

        phaseInfo.parentElement.appendChild(el);

    } else {

        document.body.appendChild(el);

    }

    return el;
}


// ============================================================
// フェーズ表示
// ============================================================

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

function updateDiagnostic() {

    const el =
        getDiagnosticElement();

    let frames = [];

    try {

        if (
            typeof getPoseFrames ===
            "function"
        ) {

            frames =
                getPoseFrames() || [];

        }

    } catch (error) {

        console.error(
            "診断用フレーム取得エラー:",
            error
        );

    }


    const frameCount =
        frames.length;


    // ----------------------------------------
    // フレーム数が増えたか確認
    // ----------------------------------------

    if (
        frameCount !==
        lastFrameCount
    ) {

        lastFrameCount =
            frameCount;

        lastFrameChangeTime =
            Date.now();

    }


    // ----------------------------------------
    // 動画情報
    // ----------------------------------------

    const duration =
        Number(video.duration);

    const currentTime =
        Number(video.currentTime);

    const readyState =
        video.readyState;

    const networkState =
        video.networkState;

    const paused =
        video.paused;

    const ended =
        video.ended;

    const seeking =
        video.seeking;


    // ----------------------------------------
    // フレーム停止時間
    // ----------------------------------------

    let stoppedSeconds = 0;

    if (lastFrameChangeTime > 0) {

        stoppedSeconds =
            (
                Date.now() -
                lastFrameChangeTime
            ) / 1000;

    }


    // ----------------------------------------
    // 動画再生時間の変化
    // ----------------------------------------

    const videoTimeChanged =
        currentTime !==
        lastVideoTime;

    lastVideoTime =
        currentTime;


    // ----------------------------------------
    // 原因判定
    // ----------------------------------------

    let diagnosis =
        "解析中";

    let diagnosisColor =
        "#1565c0";


    if (!video.src) {

        diagnosis =
            "動画が選択されていません";

        diagnosisColor =
            "#555";

    }

    else if (
        readyState < 2
    ) {

        diagnosis =
            "動画データの読み込み不足";

        diagnosisColor =
            "#c62828";

    }

    else if (
        ended &&
        frameCount < 20
    ) {

        diagnosis =
            "動画終了時点で骨格フレームが20未満です";

        diagnosisColor =
            "#c62828";

    }

    else if (
        !ended &&
        !paused &&
        stoppedSeconds >= 3 &&
        frameCount > 0
    ) {

        diagnosis =
            "動画は再生中ですが、骨格フレームが3秒以上増えていません";

        diagnosisColor =
            "#c62828";

    }

    else if (
        !ended &&
        paused &&
        frameCount > 0
    ) {

        diagnosis =
            "動画が一時停止しています";

        diagnosisColor =
            "#ef6c00";

    }

    else if (
        frameCount < 20
    ) {

        diagnosis =
            "骨格フレームを取得中です";

        diagnosisColor =
            "#ef6c00";

    }

    else {

        diagnosis =
            "骨格フレーム取得は進行しています";

        diagnosisColor =
            "#2e7d32";

    }


    // ----------------------------------------
    // readyState説明
    // ----------------------------------------

    let readyText = "";

    if (readyState === 0) {

        readyText =
            "0：未読み込み";

    } else if (readyState === 1) {

        readyText =
            "1：メタデータのみ";

    } else if (readyState === 2) {

        readyText =
            "2：現在位置を再生可能";

    } else if (readyState === 3) {

        readyText =
            "3：現在位置より先も再生可能";

    } else if (readyState === 4) {

        readyText =
            "4：十分に読み込み済み";

    }


    // ----------------------------------------
    // networkState説明
    // ----------------------------------------

    let networkText = "";

    if (networkState === 0) {

        networkText =
            "0：未初期化";

    } else if (networkState === 1) {

        networkText =
            "1：アイドル";

    } else if (networkState === 2) {

        networkText =
            "2：読み込み中";

    } else if (networkState === 3) {

        networkText =
            "3：読み込み停止";

    }


    // ----------------------------------------
    // 再生状態
    // ----------------------------------------

    let playState = "";

    if (ended) {

        playState =
            "動画終了";

    } else if (paused) {

        playState =
            "一時停止";

    } else {

        playState =
            "再生中";

    }


    // ----------------------------------------
    // 画面表示
    // ----------------------------------------

    el.innerHTML = `

        <div style="
            font-size:20px;
            font-weight:bold;
            border-bottom:1px solid #999;
            padding-bottom:6px;
            margin-bottom:8px;
        ">
            🔎 AI解析診断情報
        </div>

        <div>
            <strong>取得フレーム数：</strong>
            ${frameCount}
        </div>

        <div>
            <strong>動画の長さ：</strong>
            ${
                Number.isFinite(duration)
                ? duration.toFixed(2)
                : "-"
            }
            秒
        </div>

        <div>
            <strong>現在の再生時間：</strong>
            ${
                Number.isFinite(currentTime)
                ? currentTime.toFixed(2)
                : "-"
            }
            秒
        </div>

        <div>
            <strong>動画状態：</strong>
            ${playState}
        </div>

        <div>
            <strong>readyState：</strong>
            ${readyText}
        </div>

        <div>
            <strong>networkState：</strong>
            ${networkText}
        </div>

        <div>
            <strong>最後にフレームが増えてから：</strong>
            ${stoppedSeconds.toFixed(1)}
            秒
        </div>

        <div>
            <strong>動画時間は進んでいる：</strong>
            ${videoTimeChanged ? "はい" : "いいえ"}
        </div>

        <hr>

        <div style="
            font-size:18px;
            font-weight:bold;
            color:${diagnosisColor};
        ">
            原因診断：
            ${diagnosis}
        </div>

    `;

}


// ============================================================
// 診断監視開始
// ============================================================

function startDiagnosticMonitor() {

    if (diagnosticTimer) {

        clearInterval(
            diagnosticTimer
        );

    }

    lastFrameCount = 0;
    lastFrameChangeTime =
        Date.now();

    lastVideoTime =
        video.currentTime || 0;

    updateDiagnostic();

    diagnosticTimer =
        setInterval(
            updateDiagnostic,
            500
        );

}


// ============================================================
// 診断監視停止
// ============================================================

function stopDiagnosticMonitor() {

    if (diagnosticTimer) {

        clearInterval(
            diagnosticTimer
        );

        diagnosticTimer =
            null;

    }

    updateDiagnostic();

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

        analyzing = false;
        analysisFinished = false;

        dScore.textContent = "-";
        totalScore.textContent = "-";

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

        phaseInfo.innerHTML =
            "未解析";

        getDiagnosticElement().innerHTML = `
            <strong>🔎 AI解析診断情報</strong><br>
            動画を読み込み中...
        `;

    }
);


// ============================================================
// 動画メタデータ読み込み
// ============================================================

video.addEventListener(
    "loadedmetadata",
    () => {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        console.log(
            "動画幅:",
            video.videoWidth
        );

        console.log(
            "動画高さ:",
            video.videoHeight
        );

        console.log(
            "動画時間:",
            video.duration
        );

        updateDiagnostic();

    }
);


// ============================================================
// 動画データ読み込み完了
// ============================================================

video.addEventListener(
    "loadeddata",
    () => {

        canvas.style.width =
            video.clientWidth + "px";

        canvas.style.height =
            video.clientHeight + "px";

        status.textContent =
            "動画準備完了";

        updateDiagnostic();

    }
);


// ============================================================
// 再生開始
// ============================================================

video.addEventListener(
    "play",
    () => {

        console.log(
            "動画 play イベント"
        );

        updateDiagnostic();

    }
);


// ============================================================
// 一時停止
// ============================================================

video.addEventListener(
    "pause",
    () => {

        console.log(
            "動画 pause イベント"
        );

        updateDiagnostic();

    }
);


// ============================================================
// 時間更新
// ============================================================

video.addEventListener(
    "timeupdate",
    () => {

        updateDiagnostic();

    }
);


// ============================================================
// 動画終了
// ============================================================

video.addEventListener(
    "ended",
    () => {

        console.log(
            "================================"
        );

        console.log(
            "動画終了"
        );

        console.log(
            "終了時フレーム数:",
            getPoseFrameCount()
        );

        console.log(
            "動画時間:",
            video.duration
        );

        console.log(
            "現在時間:",
            video.currentTime
        );

        console.log(
            "================================"
        );

        updateDiagnostic();

        if (!analyzing) {

            return;

        }

        finishAnalysis();

    }
);


// ============================================================
// エラー監視
// ============================================================

video.addEventListener(
    "error",
    () => {

        console.error(
            "動画エラー:",
            video.error
        );

        const el =
            getDiagnosticElement();

        el.innerHTML += `
            <hr>
            <strong style="color:#c62828;">
                ⚠ 動画読み込みエラー
            </strong>
        `;

        status.textContent =
            "動画読み込みエラー";

    }
);


// ============================================================
// フレーム数取得
// ============================================================

function getPoseFrameCount() {

    try {

        if (
            typeof getPoseFrames ===
            "function"
        ) {

            const frames =
                getPoseFrames();

            if (
                Array.isArray(frames)
            ) {

                return frames.length;

            }

        }

    } catch (error) {

        console.error(
            "フレーム数取得エラー:",
            error
        );

    }

    return 0;

}


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


        analyzing = true;
        analysisFinished = false;


        console.log(
            "================================"
        );

        console.log(
            "AI解析開始"
        );

        console.log(
            "動画時間:",
            video.duration
        );

        console.log(
            "video.readyState:",
            video.readyState
        );

        console.log(
            "video.networkState:",
            video.networkState
        );

        console.log(
            "================================"
        );


        // --------------------------------
        // データ初期化
        // --------------------------------

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
                "AI解析中...";

        }


        const phaseInfo =
            getPhaseInfoElement();

        phaseInfo.innerHTML =
            "解析中...";


        status.textContent =
            "AI解析中...";


        // --------------------------------
        // 診断開始
        // --------------------------------

        analysisStartTime =
            Date.now();

        startDiagnosticMonitor();


        // --------------------------------
        // 動画を最初に戻す
        // --------------------------------

        video.pause();

        try {

            video.currentTime = 0;

        } catch (error) {

            console.error(
                "currentTime設定エラー:",
                error
            );

        }


        // --------------------------------
        // AI開始
        // --------------------------------

        try {

            if (
                typeof startPose !==
                "function"
            ) {

                throw new Error(
                    "startPose が見つかりません"
                );

            }


            /*
             * 重要
             *
             * startPoseを先に呼び、
             * その後に動画を再生する。
             *
             * これによって、動画再生開始直後の
             * フレーム取りこぼしを減らす。
             */

            startPose(
                video,
                canvas,
                ctx
            );


            await video.play();


            status.textContent =
                "AI解析中：骨格フレーム取得中";


            updateDiagnostic();

        }

        catch (error) {

            console.error(
                "AI開始エラー:",
                error
            );

            analyzing = false;

            stopDiagnosticMonitor();

            status.textContent =
                "AI解析を開始できませんでした";


            const el =
                getDiagnosticElement();

            el.innerHTML += `
                <hr>
                <strong style="color:#c62828;">
                    AI開始エラー
                </strong><br>
                ${error.message}
            `;

        }

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


    console.log(
        "========== 解析終了 =========="
    );


    analysisFinished = true;
    analyzing = false;


    // --------------------------------
    // 診断監視終了
    // --------------------------------

    stopDiagnosticMonitor();


    // --------------------------------
    // フレーム取得
    // --------------------------------

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
            getPoseFrames() || [];

    }

    catch (error) {

        console.error(
            "フレーム取得エラー:",
            error
        );

        status.textContent =
            "骨格データ取得に失敗しました";

        getPhaseInfoElement()
            .innerHTML =
            "解析失敗";

        return;

    }


    const frameCount =
        frames.length;


    console.log(
        "最終取得フレーム数:",
        frameCount
    );


    // --------------------------------
    // 最終診断
    // --------------------------------

    const diagnostic =
        getDiagnosticElement();

    const duration =
        Number(video.duration);

    const currentTime =
        Number(video.currentTime);

    let finalMessage = "";


    if (frameCount < 20) {

        finalMessage = `
            <div style="
                margin-top:10px;
                padding:10px;
                background:#ffebee;
                border-radius:8px;
                color:#b71c1c;
            ">
                <strong>
                    ⚠ フレーム不足
                </strong><br>

                最終取得フレーム：
                ${frameCount} フレーム<br>

                動画の長さ：
                ${
                    Number.isFinite(duration)
                    ? duration.toFixed(2)
                    : "-"
                } 秒<br>

                終了時刻：
                ${
                    Number.isFinite(currentTime)
                    ? currentTime.toFixed(2)
                    : "-"
                } 秒<br>

                phase.jsへ渡す前に
                フレーム数が不足しています。
            </div>
        `;

    } else {

        finalMessage = `
            <div style="
                margin-top:10px;
                padding:10px;
                background:#e8f5e9;
                border-radius:8px;
                color:#1b5e20;
            ">
                <strong>
                    ✓ フレーム数は十分です
                </strong><br>

                最終取得フレーム：
                ${frameCount} フレーム
            </div>
        `;

    }


    diagnostic.innerHTML +=
        finalMessage;


    // --------------------------------
    // 20フレーム未満なら
    // phase.jsを実行しない
    // --------------------------------

    if (
        !frames ||
        frames.length < 20
    ) {

        getPhaseInfoElement()
            .innerHTML = `
                <strong>解析失敗</strong><br>
                フレーム不足
            `;

        status.textContent =
            "骨格データが不足しています";

        return;

    }


    // ========================================================
    // phase判定
    // ========================================================

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
            "phase判定結果:",
            phase
        );

    }

    catch (error) {

        console.error(
            "phase検出エラー:",
            error
        );

        getPhaseInfoElement()
            .innerHTML =
            "phase検出エラー";

        status.textContent =
            "phase検出に失敗しました";

        return;

    }


    if (!phase) {

        getPhaseInfoElement()
            .innerHTML =
            "phase検出に失敗しました";

        status.textContent =
            "phase検出に失敗しました";

        return;

    }


    // ========================================================
    // phase表示
    // ========================================================

    const phaseInfo =
        getPhaseInfoElement();


    phaseInfo.innerHTML = `

        <strong>動作フェーズ</strong><br>

        踏切：
        ${phase.takeOff ?? "—"}
        フレーム<br>

        着手：
        ${phase.handContact ?? "—"}
        フレーム<br>

        最高点：
        ${phase.highestHip ?? "—"}
        フレーム<br>

        着地：
        ${phase.landing ?? "—"}
        フレーム

    `;


    // ========================================================
    // Dスコア
    // ========================================================

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


    // ========================================================
    // Dスコア表示
    // ========================================================

    const score =
        Number(result.score);


    if (
        Number.isFinite(score)
    ) {

        dScore.textContent =
            score.toFixed(1);

    } else {

        dScore.textContent =
            "-";

    }


    // ========================================================
    // フィードバック
    // ========================================================

    try {

        if (
            typeof showFeedback ===
            "function"
        ) {

            showFeedback(result);

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


    console.log(
        "========== 解析完了 =========="
    );

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
// 外部公開
// ============================================================

window.finishAnalysis =
    finishAnalysis;

window.updateTotal =
    updateTotal;

window.updateDiagnostic =
    updateDiagnostic;

window.startDiagnosticMonitor =
    startDiagnosticMonitor;


// ============================================================
// 読み込み確認
// ============================================================

console.log(
    "================================"
);

console.log(
    "app.js 診断版 読み込み成功"
);

console.log(
    "取得フレーム数・動画状態・phase診断を画面表示します"
);

console.log(
    "================================"
);