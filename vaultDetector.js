
/* =========================================================
   跳び箱AI採点システム
   vaultDetector.js Ver8.0
   通常の木製跳び箱・白い天板の自動検出

   ・ブラウザ内のCanvasだけで画像処理
   ・外部API不要
   ・白い天板候補を抽出
   ・下側に茶色の木製本体があるか確認
   ・検出結果は採点にはまだ反映しない
========================================================= */

(function () {
    "use strict";

    const VERSION = "8.0";

    // 画像処理時の横幅
    const ANALYSIS_WIDTH = 320;

    // 白い天板の色判定
    function isWhiteTop(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        return (
            r >= 155 &&
            g >= 155 &&
            b >= 145 &&
            max - min <= 75 &&
            (r + g + b) / 3 >= 170
        );
    }

    // 茶色い木製本体の色判定
    function isBrownBody(r, g, b) {
        return (
            r >= 55 &&
            r <= 190 &&
            g >= 25 &&
            g <= 145 &&
            b <= 110 &&
            r > g * 1.18 &&
            g > b * 1.05
        );
    }

    // Canvasから画像を取得
    function createAnalysisImage(source) {
        if (!source) {
            throw new Error("画像が指定されていません。");
        }

        const sourceWidth =
            source.videoWidth || source.width;

        const sourceHeight =
            source.videoHeight || source.height;

        if (!sourceWidth || !sourceHeight) {
            throw new Error("動画の画像サイズを取得できません。");
        }

        const width = ANALYSIS_WIDTH;
        const height = Math.max(
            1,
            Math.round(
                sourceHeight * width / sourceWidth
            )
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });

        ctx.drawImage(source, 0, 0, width, height);

        return {
            canvas,
            ctx,
            width,
            height,
            sourceWidth,
            sourceHeight
        };
    }

    // 白色領域の連結成分を検出
    function findWhiteComponents(imageData, width, height) {
        const data = imageData.data;
        const length = width * height;

        const mask = new Uint8Array(length);
        const visited = new Uint8Array(length);

        for (let i = 0; i < length; i++) {
            const p = i * 4;

            if (
                isWhiteTop(
                    data[p],
                    data[p + 1],
                    data[p + 2]
                )
            ) {
                mask[i] = 1;
            }
        }

        const queue = new Int32Array(length);
        const components = [];

        // 8方向を調べる
        const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
        const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

        for (let start = 0; start < length; start++) {

            if (!mask[start] || visited[start]) {
                continue;
            }

            let head = 0;
            let tail = 0;

            queue[tail++] = start;
            visited[start] = 1;

            let minX = width;
            let minY = height;
            let maxX = 0;
            let maxY = 0;
            let area = 0;

            while (head < tail) {

                const index = queue[head++];

                const x = index % width;
                const y = Math.floor(index / width);

                area++;

                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);

                for (let d = 0; d < 8; d++) {

                    const nx = x + dx[d];
                    const ny = y + dy[d];

                    if (
                        nx < 0 ||
                        ny < 0 ||
                        nx >= width ||
                        ny >= height
                    ) {
                        continue;
                    }

                    const next = ny * width + nx;

                    if (
                        mask[next] &&
                        !visited[next]
                    ) {
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
            }

            const boxWidth = maxX - minX + 1;
            const boxHeight = maxY - minY + 1;

            if (boxHeight <= 0) {
                continue;
            }

            const aspect = boxWidth / boxHeight;
            const density =
                area / (boxWidth * boxHeight);

            components.push({
                x: minX,
                y: minY,
                width: boxWidth,
                height: boxHeight,
                area,
                aspect,
                density
            });
        }

        return components;
    }

    // 候補の下側に木製本体があるか調べる
    function checkBrownBody(
        imageData,
        width,
        height,
        candidate
    ) {
        const data = imageData.data;

        const x1 = Math.max(
            0,
            candidate.x +
            Math.round(candidate.width * 0.12)
        );

        const x2 = Math.min(
            width,
            candidate.x +
            Math.round(candidate.width * 0.88)
        );

        const y1 =
            candidate.y + candidate.height;

        const y2 = Math.min(
            height,
            y1 + Math.max(
                8,
                Math.round(height * 0.32)
            )
        );

        let sampled = 0;
        let brown = 0;

        // 一定間隔でサンプリング
        for (let y = y1; y < y2; y += 2) {
            for (let x = x1; x < x2; x += 2) {

                const p = (y * width + x) * 4;

                const r = data[p];
                const g = data[p + 1];
                const b = data[p + 2];

                sampled++;

                if (isBrownBody(r, g, b)) {
                    brown++;
                }
            }
        }

        return {
            sampled,
            brown,
            ratio: sampled > 0
                ? brown / sampled
                : 0
        };
    }

    // 木製跳び箱の天板を検出
    function detectVaultBox(source) {

        const image = createAnalysisImage(source);

        const imageData =
            image.ctx.getImageData(
                0,
                0,
                image.width,
                image.height
            );

        const components = findWhiteComponents(
            imageData,
            image.width,
            image.height
        );

        const candidates = [];

        for (const component of components) {

            const centerX =
                component.x + component.width / 2;

            const centerY =
                component.y + component.height / 2;

            const widthRatio =
                component.width / image.width;

            const heightRatio =
                component.height / image.height;

            const centerXRatio =
                centerX / image.width;

            const centerYRatio =
                centerY / image.height;

            // 天板らしい形状か確認
            if (component.aspect < 1.7) continue;
            if (component.aspect > 8.5) continue;

            if (widthRatio < 0.12) continue;
            if (widthRatio > 0.85) continue;

            if (heightRatio < 0.025) continue;
            if (heightRatio > 0.24) continue;

            if (centerXRatio < 0.12) continue;
            if (centerXRatio > 0.88) continue;

            if (centerYRatio < 0.10) continue;
            if (centerYRatio > 0.88) continue;

            if (component.density < 0.10) continue;

            const body = checkBrownBody(
                imageData,
                image.width,
                image.height,
                component
            );

            // 木製本体の色が下側にあることを確認
            if (body.ratio < 0.12) continue;

            const score =
                component.density * 25 +
                Math.min(widthRatio, 0.7) * 35 +
                Math.min(body.ratio, 0.7) * 40;

            candidates.push({
                component,
                body,
                score
            });
        }

        if (candidates.length === 0) {
            return {
                detected: false,
                type: "wooden",
                confidence: 0,
                message:
                    "白い天板と木製本体を確認できませんでした。",
                candidates: 0
            };
        }

        candidates.sort(
            (a, b) => b.score - a.score
        );

        const best = candidates[0];
        const c = best.component;

        const scaleX =
            image.sourceWidth / image.width;

        const scaleY =
            image.sourceHeight / image.height;

        const x = c.x * scaleX;
        const y = c.y * scaleY;
        const w = c.width * scaleX;
        const h = c.height * scaleY;

        // 信頼度は初期段階の参考値
        const confidence = Math.max(
            0,
            Math.min(1, best.score / 100)
        );

        return {
            detected: true,
            type: "wooden",
            confidence,
            message: "白い天板候補を検出しました。",
            candidates: candidates.length,

            // 元動画のピクセル座標
            x,
            y,
            width: w,
            height: h,

            // 0～1の正規化座標
            normalized: {
                x: x / image.sourceWidth,
                y: y / image.sourceHeight,
                width: w / image.sourceWidth,
                height: h / image.sourceHeight
            },

            bodyRatio: best.body.ratio,
            aspect: c.aspect,
            density: c.density
        };
    }

    // 指定時刻の動画フレームで検出
    async function detectVaultBoxAtTime(video, time) {

        if (!video) {
            throw new Error("動画が指定されていません。");
        }

        const targetTime = Number(time);

        if (!Number.isFinite(targetTime)) {
            throw new Error("検出する動画時刻が不正です。");
        }

        const duration = Number(video.duration);

        const safeTime = Number.isFinite(duration)
            ? Math.max(0, Math.min(targetTime, duration))
            : Math.max(0, targetTime);

        if (
            Math.abs(video.currentTime - safeTime) > 0.02
        ) {
            await new Promise((resolve, reject) => {

                const timeout = setTimeout(() => {
                    cleanup();
                    reject(
                        new Error("動画フレームの読み込みがタイムアウトしました。")
                    );
                }, 8000);

                function cleanup() {
                    clearTimeout(timeout);
                    video.removeEventListener(
                        "seeked",
                        onSeeked
                    );
                    video.removeEventListener(
                        "error",
                        onError
                    );
                }

                function onSeeked() {
                    cleanup();
                    resolve();
                }

                function onError() {
                    cleanup();
                    reject(
                        new Error("動画フレームを読み込めませんでした。")
                    );
                }

                video.addEventListener(
                    "seeked",
                    onSeeked,
                    { once: true }
                );

                video.addEventListener(
                    "error",
                    onError,
                    { once: true }
                );

                video.currentTime = safeTime;
            });
        }

        return detectVaultBox(video);
    }

    // 検出結果を映像上に表示
    function drawVaultBoxDetection(canvas, result) {

        if (!canvas || !result) return;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        if (!result.detected) return;

        const videoWidth = canvas.width;
        const videoHeight = canvas.height;

        const x =
            result.normalized.x * videoWidth;

        const y =
            result.normalized.y * videoHeight;

        const w =
            result.normalized.width * videoWidth;

        const h =
            result.normalized.height * videoHeight;

        ctx.save();

        ctx.strokeStyle = "#00E676";
        ctx.lineWidth = Math.max(
            3,
            videoWidth / 250
        );

        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = "#00E676";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(
            "跳び箱 天板候補",
            x,
            Math.max(22, y - 8)
        );

        ctx.restore();
    }

    // グローバル公開
    window.detectVaultBox =
        detectVaultBox;

    window.detectVaultBoxAtTime =
        detectVaultBoxAtTime;

    window.drawVaultBoxDetection =
        drawVaultBoxDetection;

    console.log(
        "vaultDetector.js Ver" + VERSION +
        " 読み込み成功"
    );

})();
