
/* =========================================================
   forwardRollPhase.js Ver1.0
   台上前転専用・動作フェーズ検出
   既存の phase.js には影響しない独立ファイル
========================================================= */

(function () {
    "use strict";

    let lastForwardRollPhaseResult = null;

    const CONFIG = {
        MIN_FRAMES: 12,
        MIN_VISIBILITY: 0.35,
        SMOOTH_WINDOW: 3,
        HAND_Y_TOLERANCE: 0.18,
        HAND_X_MARGIN: 0.15,
        MIN_CONFIDENCE: 0.25
    };

    // -----------------------------------------------------
    // 基本データ取得
    // -----------------------------------------------------

    function getLandmark(frame, index) {
        if (!frame || !Array.isArray(frame.landmarks)) return null;

        const point = frame.landmarks[index];

        if (!point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)) {
            return null;
        }

        const visibility =
            Number.isFinite(point.visibility)
                ? point.visibility
                : 1;

        if (visibility < CONFIG.MIN_VISIBILITY) return null;

        return {
            x: point.x,
            y: point.y,
            visibility: visibility
        };
    }

    function averagePoints(points) {
        const valid = points.filter(Boolean);

        if (valid.length === 0) return null;

        const total = valid.reduce(function (sum, p) {
            sum.x += p.x;
            sum.y += p.y;
            sum.visibility += p.visibility;
            return sum;
        }, { x: 0, y: 0, visibility: 0 });

        return {
            x: total.x / valid.length,
            y: total.y / valid.length,
            visibility: total.visibility / valid.length
        };
    }

    function getHip(frame) {
        return averagePoints([
            getLandmark(frame, 23),
            getLandmark(frame, 24)
        ]);
    }

    function getShoulder(frame) {
        return averagePoints([
            getLandmark(frame, 11),
            getLandmark(frame, 12)
        ]);
    }

    function getKnee(frame) {
        return averagePoints([
            getLandmark(frame, 25),
            getLandmark(frame, 26)
        ]);
    }

    function getAnkle(frame) {
        return averagePoints([
            getLandmark(frame, 27),
            getLandmark(frame, 28)
        ]);
    }

    function getWrist(frame) {
        return averagePoints([
            getLandmark(frame, 15),
            getLandmark(frame, 16)
        ]);
    }

    function getVaultBox(frame) {
        if (!frame || !frame.vaultBox) return null;

        const box = frame.vaultBox;

        if (
            !Number.isFinite(box.x) ||
            !Number.isFinite(box.y) ||
            !Number.isFinite(box.width) ||
            !Number.isFinite(box.height)
        ) {
            return null;
        }

        if (box.width <= 0 || box.height <= 0) return null;

        return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            right: box.x + box.width,
            bottom: box.y + box.height
        };
    }

    function getFrameNumber(frame, index) {
        return Number.isFinite(frame.frame)
            ? frame.frame
            : index;
    }

    function getTime(frame, index) {
        return Number.isFinite(frame.time)
            ? frame.time
            : null;
    }

    function makeEvent(frames, index, confidence, reason) {
        if (!Number.isInteger(index) ||
            index < 0 ||
            index >= frames.length) {
            return {
                detected: false,
                frame: null,
                index: null,
                time: null,
                confidence: 0,
                reason: reason || "候補を検出できませんでした"
            };
        }

        return {
            detected: true,
            frame: getFrameNumber(frames[index], index),
            index: index,
            time: getTime(frames[index], index),
            confidence: round(confidence),
            reason: reason || ""
        };
    }

    function missingEvent(reason) {
        return {
            detected: false,
            frame: null,
            index: null,
            time: null,
            confidence: 0,
            reason: reason
        };
    }

    function round(value) {
        if (!Number.isFinite(value)) return 0;
        return Math.round(value * 100) / 100;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // -----------------------------------------------------
    // 骨格データの特徴量
    // -----------------------------------------------------

    function buildFeatures(frames) {
        return frames.map(function (frame, index) {
            const hip = getHip(frame);
            const shoulder = getShoulder(frame);
            const knee = getKnee(frame);
            const ankle = getAnkle(frame);
            const wrist = getWrist(frame);
            const box = getVaultBox(frame);

            let trunkAngle = null;

            if (hip && shoulder) {
                const dx = shoulder.x - hip.x;
                const dy = shoulder.y - hip.y;

                trunkAngle =
                    Math.atan2(dy, dx) * 180 / Math.PI;
            }

            let handNearBox = false;
            let handDistance = null;

            if (wrist && box) {
                const withinX =
                    wrist.x >= box.x - box.width * CONFIG.HAND_X_MARGIN &&
                    wrist.x <= box.right + box.width * CONFIG.HAND_X_MARGIN;

                handDistance = Math.abs(wrist.y - box.y);

                handNearBox =
                    withinX &&
                    handDistance <= box.height * CONFIG.HAND_Y_TOLERANCE;
            }

            return {
                index: index,
                frame: frame,
                hip: hip,
                shoulder: shoulder,
                knee: knee,
                ankle: ankle,
                wrist: wrist,
                box: box,
                trunkAngle: trunkAngle,
                handNearBox: handNearBox,
                handDistance: handDistance
            };
        });
    }

    // -----------------------------------------------------
    // 平滑化
    // -----------------------------------------------------

    function smoothValues(values, windowSize) {
        return values.map(function (_, index) {
            const start = Math.max(0, index - windowSize);
            const end = Math.min(values.length - 1, index + windowSize);

            const selected = values
                .slice(start, end + 1)
                .filter(Number.isFinite);

            if (selected.length === 0) return null;

            return selected.reduce(function (a, b) {
                return a + b;
            }, 0) / selected.length;
        });
    }

    function getVelocity(values, index) {
        if (index <= 0 || index >= values.length - 1) return 0;

        const before = values[index - 1];
        const after = values[index + 1];

        if (!Number.isFinite(before) ||
            !Number.isFinite(after)) {
            return 0;
        }

        return (after - before) / 2;
    }

    // -----------------------------------------------------
    // 踏切候補
    // -----------------------------------------------------

    function detectTakeOff(features, hipValues, ankleValues, handIndex) {
        const limit = handIndex >= 0
            ? Math.min(handIndex, Math.floor(features.length * 0.75))
            : Math.floor(features.length * 0.65);

        let bestIndex = -1;
        let bestScore = -Infinity;

        for (let i = 2; i < limit; i++) {
            const ankleVelocity = getVelocity(ankleValues, i);
            const hipVelocity = getVelocity(hipValues, i);

            // 画像上では上方向への移動がマイナス
            const upwardAnkle = -ankleVelocity;
            const upwardHip = -hipVelocity;

            const score =
                Math.max(0, upwardAnkle) * 0.6 +
                Math.max(0, upwardHip) * 0.4;

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex < 0 || bestScore < 0.001) {
            return missingEvent(
                "踏切候補を十分な精度で検出できませんでした"
            );
        }

        const confidence = clamp(bestScore * 15, 0.25, 0.75);

        return makeEvent(
            features.map(f => f.frame),
            bestIndex,
            confidence,
            "足・腰の上方向への移動から踏切候補を推定"
        );
    }

    // -----------------------------------------------------
    // 着手候補
    // -----------------------------------------------------

    function detectHandContact(features) {
        const candidates = [];

        features.forEach(function (f) {
            if (!f.handNearBox || !f.wrist || !f.box) return;

            const distanceRatio =
                f.handDistance / Math.max(f.box.height, 0.001);

            const confidence = clamp(
                0.85 - distanceRatio * 2,
                0.25,
                0.85
            );

            candidates.push({
                index: f.index,
                confidence: confidence,
                distance: distanceRatio
            });
        });

        if (candidates.length === 0) {
            return {
                event: missingEvent(
                    "手首と跳び箱上面の位置関係から着手候補を検出できませんでした"
                ),
                candidates: []
            };
        }

        candidates.sort(function (a, b) {
            return a.distance - b.distance;
        });

        const selected = candidates[0];

        return {
            event: makeEvent(
                features.map(f => f.frame),
                selected.index,
                selected.confidence,
                "手首が跳び箱上面付近にあるフレームを着手候補として検出"
            ),
            candidates: candidates.map(function (c) {
                return {
                    index: c.index,
                    frame: getFrameNumber(
                        features[c.index].frame,
                        c.index
                    ),
                    confidence: round(c.confidence)
                };
            })
        };
    }

    // -----------------------------------------------------
    // 回転開始・終了候補
    // -----------------------------------------------------

    function detectRotation(features, handIndex, landingIndex) {
        if (handIndex < 0) {
            return {
                start: missingEvent("着手候補がないため回転開始を推定できません"),
                end: missingEvent("着手候補がないため回転終了を推定できません")
            };
        }

        const endLimit = landingIndex >= 0
            ? landingIndex
            : features.length - 1;

        const angles = features.map(function (f) {
            return f.trunkAngle;
        });

        const validAngles = angles.filter(Number.isFinite);

        if (validAngles.length < 5) {
            return {
                start: missingEvent("肩・腰の位置情報が不足しています"),
                end: missingEvent("肩・腰の位置情報が不足しています")
            };
        }

        let startIndex = -1;
        let endIndex = -1;
        let maxChange = 0;

        const baseAngle = angles[handIndex];

        if (!Number.isFinite(baseAngle)) {
            return {
                start: missingEvent("着手時の体幹角度を取得できません"),
                end: missingEvent("着手時の体幹角度を取得できません")
            };
        }

        for (let i = handIndex + 1; i <= endLimit; i++) {
            if (!Number.isFinite(angles[i])) continue;

            let change = Math.abs(angles[i] - baseAngle);

            if (change > 180) change = 360 - change;

            if (change > maxChange) {
                maxChange = change;
                endIndex = i;
            }
        }

        // 角度変化が小さすぎる場合は無理に検出しない
        if (maxChange < 15 || endIndex < 0) {
            return {
                start: missingEvent(
                    "体幹の角度変化が小さく、回転開始を判定できません"
                ),
                end: missingEvent(
                    "体幹の角度変化が小さく、回転終了を判定できません"
                )
            };
        }

        startIndex = handIndex;

        const confidence = clamp(maxChange / 120, 0.25, 0.65);

        return {
            start: makeEvent(
                features.map(f => f.frame),
                startIndex,
                confidence,
                "着手後の体幹角度変化から回転開始候補を推定"
            ),
            end: makeEvent(
                features.map(f => f.frame),
                endIndex,
                confidence,
                "体幹角度の変化が最大となった位置を回転区間の候補として検出"
            )
        };
    }

    // -----------------------------------------------------
    // 腰・脚の通過候補
    // -----------------------------------------------------

    function detectBodyPass(features, handIndex, rotationEndIndex) {
        if (handIndex < 0) {
            return missingEvent("着手候補がないため通過を推定できません");
        }

        let bestIndex = -1;
        let bestScore = -Infinity;

        const start = handIndex + 1;
        const end = rotationEndIndex >= start
            ? rotationEndIndex
            : features.length - 1;

        for (let i = start; i <= end; i++) {
            const f = features[i];

            if (!f.hip || !f.knee || !f.ankle || !f.box) continue;

            const hipAboveBox =
                f.hip.y < f.box.y + f.box.height * 0.25;

            const legsAboveHip =
                f.knee.y < f.hip.y + 0.08 ||
                f.ankle.y < f.hip.y + 0.08;

            const score =
                (hipAboveBox ? 1 : 0) +
                (legsAboveHip ? 0.5 : 0);

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex < 0 || bestScore < 1) {
            return missingEvent(
                "腰・脚の位置関係から通過候補を検出できませんでした"
            );
        }

        return makeEvent(
            features.map(f => f.frame),
            bestIndex,
            bestScore >= 1.5 ? 0.65 : 0.4,
            "腰・膝・足首と跳び箱の位置関係から通過候補を推定"
        );
    }

    // -----------------------------------------------------
    // 着地候補
    // -----------------------------------------------------

    function detectLanding(features, ankleValues) {
        const start = Math.floor(features.length * 0.45);

        if (features.length - start < 3) {
            return missingEvent("着地判定に必要なフレーム数が不足しています");
        }

        let bestIndex = -1;
        let bestScore = -Infinity;

        for (let i = start + 1; i < features.length - 1; i++) {
            const ankle = features[i].ankle;

            if (!ankle) continue;

            const velocity = Math.abs(
                getVelocity(ankleValues, i)
            );

            const next = features[i + 1].ankle;

            if (!next) continue;

            const stability =
                Math.abs(next.y - ankle.y);

            const score =
                1 / (1 + velocity * 20 + stability * 20);

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex < 0 || bestScore < 0.2) {
            return missingEvent(
                "足首の位置が安定する着地候補を検出できませんでした"
            );
        }

        return makeEvent(
            features.map(f => f.frame),
            bestIndex,
            clamp(bestScore, 0.25, 0.65),
            "足首の移動が小さくなる位置から着地候補を推定"
        );
    }

    // -----------------------------------------------------
    // メイン処理
    // -----------------------------------------------------

    function detectForwardRollPhases(frames) {
        const warnings = [];

        if (!Array.isArray(frames) ||
            frames.length < CONFIG.MIN_FRAMES) {

            lastForwardRollPhaseResult = {
                version: "1.0",
                success: false,
                message: "骨格データが不足しています",
                frameCount: Array.isArray(frames) ? frames.length : 0,
                detected: {},
                warnings: ["12フレーム以上の骨格データが必要です"]
            };

            return lastForwardRollPhaseResult;
        }

        const features = buildFeatures(frames);

        const validVaultCount = features.filter(function (f) {
            return !!f.box;
        }).length;

        const validHipCount = features.filter(function (f) {
            return !!f.hip;
        }).length;

        if (validVaultCount < 3) {
            warnings.push(
                "跳び箱の検出が少ないため、着手・通過の判定精度が低い可能性があります"
            );
        }

        if (validHipCount < 5) {
            warnings.push(
                "腰の骨格データが不足しています"
            );
        }

        const hipValues = smoothValues(
            features.map(f => f.hip ? f.hip.y : null),
            CONFIG.SMOOTH_WINDOW
        );

        const ankleValues = smoothValues(
            features.map(f => f.ankle ? f.ankle.y : null),
            CONFIG.SMOOTH_WINDOW
        );

        const handResult = detectHandContact(features);
        const handIndex = handResult.event.detected
            ? handResult.event.index
            : -1;

        const takeOff = detectTakeOff(
            features,
            hipValues,
            ankleValues,
            handIndex
        );

        const landing = detectLanding(
            features,
            ankleValues
        );

        const landingIndex = landing.detected
            ? landing.index
            : -1;

        const rotation = detectRotation(
            features,
            handIndex,
            landingIndex
        );

        const rotationEndIndex = rotation.end.detected
            ? rotation.end.index
            : -1;

        const bodyPass = detectBodyPass(
            features,
            handIndex,
            rotationEndIndex
        );

        const success =
            takeOff.detected ||
            handResult.event.detected ||
            landing.detected;

        lastForwardRollPhaseResult = {
            version: "1.0",
            success: success,
            message: success
                ? "台上前転の動作候補を検出しました"
                : "動作候補を十分に検出できませんでした",

            frameCount: frames.length,

            detected: {
                takeOff: takeOff,
                handContact: handResult.event,
                rotationStart: rotation.start,
                rotationEnd: rotation.end,
                bodyPass: bodyPass,
                landing: landing
            },

            handCandidates: handResult.candidates,

            diagnostics: {
                vaultDetected: validVaultCount >= 3,
                vaultFrameCount: validVaultCount,
                hipFrameCount: validHipCount,
                totalFrameCount: frames.length
            },

            warnings: warnings.concat([
                "この結果は骨格位置から推定した動作候補です。実際の踏切・着手・回転・着地を確定するものではありません。",
                "頭部や首の接触、回転中の安全性は、この検出結果だけでは判定できません。",
                "採点前に必ず教師が動画を確認してください。"
            ])
        };

        return lastForwardRollPhaseResult;
    }

    // -----------------------------------------------------
    // 初期化・結果取得
    // -----------------------------------------------------

    function clearForwardRollPhase() {
        lastForwardRollPhaseResult = null;
    }

    function getLastForwardRollPhaseResult() {
        return lastForwardRollPhaseResult;
    }

    // -----------------------------------------------------
    // 外部公開
    // -----------------------------------------------------

    window.detectForwardRollPhases =
        detectForwardRollPhases;

    window.clearForwardRollPhase =
        clearForwardRollPhase;

    window.getLastForwardRollPhaseResult =
        getLastForwardRollPhaseResult;

})();
