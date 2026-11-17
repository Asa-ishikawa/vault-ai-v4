
/* =========================================================
   跳び箱AI採点システム
   vaultDetector.js Ver8.1
   白い天板＋直下の木製本体の位置関係で検出する修正版
========================================================= */

(function () {
    "use strict";

    const VERSION = "8.1";
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

    // Canvasから解析用画像を取得
    function createAnalysisImage(source) {
        if (!source) {
            throw new Error("画像が指定されていません。");
        }

        const sourceWidth = source.videoWidth || source.width;
        const sourceHeight = source.videoHeight || source.height;

        if (!sourceWidth || !sourceHeight) {
            throw new Error("動画の画像サイズを取得できません。");
        }

        const width = ANALYSIS_WIDTH;
        const height = Math.max(
            1,
            Math.round(sourceHeight * width / sourceWidth)
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });

        if (!ctx) {
            throw new Error("画像解析用Canvasを作成できません。");
        }

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

            if (isWhiteTop(data[p], data[p + 1], data[p + 2])) {
                mask[i] = 1;
            }
        }

        const queue = new Int32Array(length);
        const components = [];

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

                    if (mask[next] && !visited[next]) {
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

            components.push({
                x: minX,
                y: minY,
                width: boxWidth,
                height: boxHeight,
                area,
                aspect: boxWidth / boxHeight,
                density: area / (boxWidth * boxHeight)
            });
        }

        return components;
    }

    /*
     * 天板のすぐ下に木製本体があるか確認する。
     * 天板直下の狭い範囲を調べ、離れた場所の茶色を除外する。
     */
    function checkBrownBody(imageData, width, height, candidate) {
        const data = imageData.data;

        const x1 = Math.max(
            0,
            candidate.x + Math.round(candidate.width * 0.08)
        );

        const x2 = Math.min(
            width,
            candidate.x + Math.round(candidate.width * 0.92)
        );

        const y1 = candidate.y + candidate.height;

        const bandHeight = Math.max(
            10,
            Math.min(
                Math.round(height * 0.28),
                Math.round(candidate.width * 0.55)
            )
        );

        const y2 = Math.min(height, y1 + bandHeight);

        let sampled = 0;
        let brown = 0;
        let rowsChecked = 0;
        let rowsWithBrown = 0;
        let bestRowCoverage = 0;
        let brownXTotal = 0;
        let brownYTotal = 0;

        for (let y = y1; y < y2; y += 2) {
            let rowSampled = 0;
            let rowBrown = 0;

            for (let x = x1; x < x2; x += 2) {
                const p = (y * width + x) * 4;

                const r = data[p];
                const g = data[p + 1];
                const b = data[p + 2];

                sampled++;
                rowSampled++;

                if (isBrownBody(r, g, b)) {
                    brown++;
                    rowBrown++;
                    brownXTotal += x;
                    brownYTotal += y;
                }
            }

            if (rowSampled > 0) {
                rowsChecked++;

                const rowCoverage = rowBrown / rowSampled;

                bestRowCoverage = Math.max(
                    bestRowCoverage,
                    rowCoverage
                );

                if (rowCoverage >= 0.28) {
                    rowsWithBrown++;
                }
            }
        }

        const ratio = sampled > 0 ? brown / sampled : 0;

        const brownCenterX =
            brown > 0 ? brownXTotal / brown : null;

        const brownCenterY =
            brown > 0 ? brownYTotal / brown : null;

        const candidateCenterX =
            candidate.x + candidate.width / 2;

        const centerOffsetRatio =
            brownCenterX === null
                ? 1
                : Math.abs(brownCenterX - candidateCenterX) /
                  Math.max(1, candidate.width);

        const rowCoverageRatio =
            rowsChecked > 0 ? rowsWithBrown / rowsChecked : 0;

        const valid =
            ratio >= 0.16 &&
            rowsWithBrown >= 3 &&
            rowCoverageRatio >= 0.25 &&
            bestRowCoverage >= 0.30 &&
            centerOffsetRatio <= 0.38;

        return {
            sampled,
            brown,
            ratio,
            rowsChecked,
            rowsWithBrown,
            rowCoverageRatio,
            bestRowCoverage,
            brownCenterX,
            brownCenterY,
            centerOffsetRatio,
            valid
        };
    }

    // 白い天板と、その直下の木製本体を組み合わせて検出
    function detectVaultBox(source) {
        const image = createAnalysisImage(source);

        const imageData = image.ctx.getImageData(
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

        const edgeMarginX = image.width * 0.025;
        const edgeMarginY = image.height * 0.015;

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

            // 画像端に接する候補は除外
            if (component.x <= edgeMarginX) continue;

            if (
                component.x + component.width >=
                image.width - edgeMarginX
            ) continue;

            if (component.y <= edgeMarginY) continue;

            if (
                component.y + component.height >=
                image.height - edgeMarginY
            ) continue;

            // 天板らしい横長形状
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

            // 天板直下に連続した木製本体がなければ除外
            if (!body.valid) continue;

            const score =
                component.density * 20 +
                Math.min(widthRatio, 0.7) * 25 +
                Math.min(body.ratio, 0.7) * 20 +
                body.rowCoverageRatio * 25 +
                body.bestRowCoverage * 10;

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
                    "白い天板と、その直下の木製本体を確認できませんでした。",
                candidates: 0
            };
        }

        candidates.sort((a, b) => b.score - a.score);

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

        const confidence = Math.max(
            0,
            Math.min(1, best.score / 100)
        );

        return {
            detected: true,
            type: "wooden",
            confidence,
            message:
                "天板と木製本体の位置関係を確認しました。",
            candidates: candidates.length,

            x,
            y,
            width: w,
            height: h,

            normalized: {
                x: x / image.sourceWidth,
                y: y / image.sourceHeight,
                width: w / image.sourceWidth,
                height: h / image.sourceHeight
            },

            bodyRatio: best.body.ratio,
            bodyRowsWithBrown: best.body.rowsWithBrown,
            bodyRowCoverage: best.body.rowCoverageRatio,
            bodyCenterOffset: best.body.centerOffsetRatio,
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

        if (Math.abs(video.currentTime - safeTime) > 0.02) {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    cleanup();

                    reject(
                        new Error(
                            "動画フレームの読み込みがタイムアウトしました。"
                        )
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
                        new Error(
                            "動画フレームを読み込めませんでした。"
                        )
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
        if (!canvas || !result || !result.detected) return;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

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

    // グローバル公開（既存の呼び出し名を維持）
    window.detectVaultBox = detectVaultBox;

    window.detectVaultBoxAtTime =
        detectVaultBoxAtTime;

    window.drawVaultBoxDetection =
        drawVaultBoxDetection;

    console.log(
        "vaultDetector.js Ver" + VERSION +
        " 読み込み成功"
    );

})();
