
/* =========================================================
   跳び箱AI採点システム
   box-detection.js Ver1.0

   役割：
   1. 動画から画像を定期的に取得
   2. AIサーバーへ画像を送信
   3. 跳び箱の上面四隅を受信
   4. 動画上に検出結果を表示

   ※AIサーバーの接続先は後から設定します。
========================================================= */

(function () {
    "use strict";

    const CONFIG = {
        API_URL: "",
        INTERVAL_MS: 700,
        IMAGE_MAX_WIDTH: 960,
        JPEG_QUALITY: 0.75
    };

    let video = null;
    let overlay = null;
    let context = null;
    let diagnostic = null;

    let running = false;
    let requesting = false;
    let lastRequestTime = 0;
    let requestCount = 0;
    let detectedCount = 0;

    let lastDetection = null;

    // -----------------------------------------------------
    // 診断表示
    // -----------------------------------------------------

    function showMessage(message, color = "#333") {
        if (!diagnostic) return;

        diagnostic.textContent = message;
        diagnostic.style.color = color;
    }

    // -----------------------------------------------------
    // 表示領域作成
    // -----------------------------------------------------

    function createOverlay() {
        const container =
            document.getElementById("videoContainer");

        if (!container || !video) return;

        container.style.position = "relative";

        overlay = document.getElementById(
            "boxDetectionOverlay"
        );

        if (!overlay) {
            overlay = document.createElement("canvas");
            overlay.id = "boxDetectionOverlay";

            overlay.style.position = "absolute";
            overlay.style.pointerEvents = "none";
            overlay.style.zIndex = "20";

            container.appendChild(overlay);
        }

        context = overlay.getContext("2d");

        diagnostic = document.getElementById(
            "boxDetectionDiagnostic"
        );

        if (!diagnostic) {
            diagnostic = document.createElement("div");
            diagnostic.id = "boxDetectionDiagnostic";

            diagnostic.style.cssText = `
                margin-top: 10px;
                padding: 12px;
                background: #eef5ff;
                border-radius: 8px;
                font-size: 14px;
                line-height: 1.7;
            `;

            container.parentElement.appendChild(
                diagnostic
            );
        }

        resizeOverlay();
    }

    // -----------------------------------------------------
    // Canvasサイズ調整
    // -----------------------------------------------------

    function resizeOverlay() {
        if (!video || !overlay) return;

        const container =
            document.getElementById("videoContainer");

        const videoRect = video.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();

        if (!video.videoWidth || !video.videoHeight) {
            return;
        }

        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;

        overlay.style.left =
            (videoRect.left - parentRect.left) + "px";

        overlay.style.top =
            (videoRect.top - parentRect.top) + "px";

        overlay.style.width =
            videoRect.width + "px";

        overlay.style.height =
            videoRect.height + "px";

        drawLastDetection();
    }

    // -----------------------------------------------------
    // 動画画像をJPEG化
    // -----------------------------------------------------

    async function captureFrame() {
        if (!video || !video.videoWidth) {
            throw new Error("動画画像を取得できません");
        }

        const scale = Math.min(
            1,
            CONFIG.IMAGE_MAX_WIDTH / video.videoWidth
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.round(
            video.videoWidth * scale
        );

        canvas.height = Math.round(
            video.videoHeight * scale
        );

        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => {
                    if (!blob) {
                        reject(
                            new Error("画像変換に失敗しました")
                        );
                        return;
                    }

                    resolve(blob);
                },
                "image/jpeg",
                CONFIG.JPEG_QUALITY
            );
        });
    }

    // -----------------------------------------------------
    // AIサーバーへ画像送信
    // -----------------------------------------------------

    async function requestBoxDetection() {
        if (!CONFIG.API_URL) {
            showMessage(
                "AIサーバー未接続：接続先URLの設定が必要です。",
                "#c62828"
            );
            return;
        }

        if (requesting || !running || video.paused) {
            return;
        }

        requesting = true;
        requestCount++;

        try {
            const blob = await captureFrame();

            const formData = new FormData();

            formData.append(
                "image",
                blob,
                "vault-frame.jpg"
            );

            const response = await fetch(
                CONFIG.API_URL,
                {
                    method: "POST",
                    body: formData
                }
            );

            if (!response.ok) {
                throw new Error(
                    "サーバー応答エラー：" +
                    response.status
                );
            }

            const result = await response.json();

            if (
                !result ||
                typeof result.detected !== "boolean"
            ) {
                throw new Error(
                    "AI応答データの形式が違います"
                );
            }

            if (result.detected) {
                validateDetection(result);

                lastDetection = result;
                detectedCount++;

                drawLastDetection();

                showMessage(
                    `跳び箱を検出しました。` +
                    ` 検出回数：${detectedCount}` +
                    ` / 信頼度：${(result.confidence * 100).toFixed(1)}%`,
                    "#16803c"
                );

            } else {
                lastDetection = null;
                clearOverlay();

                showMessage(
                    `跳び箱を検出できません。` +
                    ` 解析画像数：${requestCount}`,
                    "#b26a00"
                );
            }

        } catch (error) {
            console.error(
                "跳び箱検出エラー:",
                error
            );

            showMessage(
                "跳び箱検出エラー：" + error.message,
                "#c62828"
            );

        } finally {
            requesting = false;
        }
    }

    // -----------------------------------------------------
    // 検出結果の形式確認
    // -----------------------------------------------------

    function validateDetection(result) {
        if (
            !Array.isArray(result.top_surface) ||
            result.top_surface.length !== 4
        ) {
            throw new Error(
                "上面四隅のデータがありません"
            );
        }

        result.top_surface.forEach(point => {
            if (
                !Number.isFinite(point.x) ||
                !Number.isFinite(point.y) ||
                point.x < 0 || point.x > 1 ||
                point.y < 0 || point.y > 1
            ) {
                throw new Error(
                    "上面座標が不正です"
                );
            }
        });

        if (
            !Number.isFinite(result.confidence) ||
            result.confidence < 0 ||
            result.confidence > 1
        ) {
            throw new Error(
                "検出信頼度が不正です"
            );
        }
    }

    // -----------------------------------------------------
    // 検出枠の描画
    // -----------------------------------------------------

    function clearOverlay() {
        if (!context || !overlay) return;

        context.clearRect(
            0,
            0,
            overlay.width,
            overlay.height
        );
    }

    function drawLastDetection() {
        if (!context || !overlay) return;

        clearOverlay();

        if (!lastDetection) return;

        const points = lastDetection.top_surface;

        context.beginPath();

        points.forEach((point, index) => {
            const x = point.x * overlay.width;
            const y = point.y * overlay.height;

            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });

        context.closePath();

        context.fillStyle =
            "rgba(0, 180, 80, 0.18)";

        context.fill();

        context.strokeStyle = "#00c853";
        context.lineWidth = Math.max(
            3,
            overlay.width * 0.004
        );

        context.stroke();

        points.forEach(point => {
            const x = point.x * overlay.width;
            const y = point.y * overlay.height;

            context.beginPath();
            context.arc(x, y, 7, 0, Math.PI * 2);

            context.fillStyle = "#ff1744";
            context.fill();
        });
    }

    // -----------------------------------------------------
    // 動画フレーム監視
    // -----------------------------------------------------

    function monitorVideo() {
        if (!running) return;

        const now = performance.now();

        if (
            !video.paused &&
            !video.ended &&
            now - lastRequestTime >= CONFIG.INTERVAL_MS
        ) {
            lastRequestTime = now;
            requestBoxDetection();
        }

        requestAnimationFrame(monitorVideo);
    }

    // -----------------------------------------------------
    // 開始
    // -----------------------------------------------------

    function start(targetVideo) {
        stop();

        video = targetVideo;

        createOverlay();

        if (!video) {
            showMessage("動画が見つかりません", "#c62828");
            return;
        }

        if (!CONFIG.API_URL) {
            showMessage(
                "準備完了。ただしAIサーバーの接続先が未設定です。",
                "#b26a00"
            );
        }

        running = true;
        lastRequestTime = 0;
        requestCount = 0;
        detectedCount = 0;
        lastDetection = null;

        resizeOverlay();
        monitorVideo();
    }

    // -----------------------------------------------------
    // 停止
    // -----------------------------------------------------

    function stop() {
        running = false;
        requesting = false;
        lastDetection = null;

        clearOverlay();
    }

    // -----------------------------------------------------
    // 外部公開
    // -----------------------------------------------------

    window.BoxDetection = {
        start,
        stop,
        resize: resizeOverlay,
        getLastDetection: () => lastDetection,
        setApiUrl: url => {
            CONFIG.API_URL = String(url || "").trim();
        }
    };

    // -----------------------------------------------------
    // 既存アプリとの接続
    // -----------------------------------------------------

    document.addEventListener("DOMContentLoaded", () => {
        const detectButton =
            document.getElementById("detectBtn");

        const targetVideo =
            document.getElementById("video");

        const fileInput =
            document.getElementById("videoFile");

        if (detectButton && targetVideo) {
            detectButton.addEventListener(
                "click",
                () => {
                    window.BoxDetection.start(
                        targetVideo
                    );
                }
            );
        }

        if (fileInput) {
            fileInput.addEventListener(
                "change",
                () => {
                    window.BoxDetection.stop();
                }
            );
        }

        window.addEventListener(
            "resize",
            resizeOverlay
        );
    });

    console.log(
        "box-detection.js Ver1.0 読み込み成功"
    );

})();
