
/* =========================================================
   forwardRollPhase.js Ver1.1
   台上前転専用・動作フェーズ検出

   Ver1.1 変更点
   ・左右の手首を独立して評価
   ・上面と手前側面の両方を候補範囲にする
   ・複数フレームの連続性を評価
   ・手首のvisibilityを信頼度に反映
   ・既存のphase.jsには影響しない
========================================================= */

(function () {
    "use strict";

    let lastForwardRollPhaseResult = null;

    const CONFIG = {
        MIN_FRAMES: 12,
        MIN_VISIBILITY: 0.35,
        SMOOTH_WINDOW: 3,

        // 着手候補の範囲
        HAND_TOP_MARGIN_X: 0.35,
        HAND_TOP_MARGIN_Y: 0.25,
        HAND_SIDE_MARGIN_X: 0.30,
        HAND_SIDE_MARGIN_Y: 0.25,

        // 候補の連続性
        HAND_CONTINUITY_WINDOW: 2,

        MIN_CONFIDENCE: 0.25
    };

    // -----------------------------------------------------
    // 基本データ取得
    // -----------------------------------------------------

    function getLandmark(frame, index) {
        if (!frame || !Array.isArray(frame.landmarks)) return null;

        const point = frame.landmarks[index];

        if (
            !point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
        ) {
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

    function getVaultBox(frame) {
        if (!frame || !frame.vaultBox) return null;

        const box = frame.vaultBox;

        if (
            !Number.isFinite(box.x) ||
            !Number.isFinite(box.y) ||
            !Number.isFinite(box.width) ||
            !Number.isFinite(box.height) ||
            box.width <= 0 ||
            box.height <= 0
        ) {
            return null;
        }

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

    function getTime(frame) {
        return Number.isFinite(frame.time)
            ? frame.time
            : null;
    }

    function round(value) {
        if (!Number.isFinite(value)) return 0;
        return Math.round(value * 100) / 100;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
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

    function makeEvent(frames, index, confidence, reason) {
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= frames.length
        ) {
            return missingEvent(reason);
        }

        return {
            detected: true,
            frame: getFrameNumber(frames[index], index),
            index: index,
            time: getTime(frames[index]),
            confidence: round(confidence),
            reason: reason
        };
    }

    // -----------------------------------------------------
    // 手首を左右別々に取得
    // -----------------------------------------------------

    function getWristCandidates(frame) {
        return [
            {
                side: "left",
                point: getLandmark(frame, 15)
            },
            {
                side: "right",
                point: getLandmark(frame, 16)
            }
        ].filter(function (item) {
            return !!item.point;
        });
    }

    // -----------------------------------------------------
    // 跳び箱との位置関係
    // -----------------------------------------------------

    function evaluateHandPosition(wrist, box) {
        if (!wrist || !box) return null;

        const topDistance =
            Math.abs(wrist.y - box.y) / box.height;

        const withinTopX =
            wrist.x >= box.x - box.width * CONFIG.HAND_TOP_MARGIN_X &&
            wrist.x <= box.right + box.width * CONFIG.HAND_TOP_MARGIN_X;

        const nearTop =
            withinTopX &&
            topDistance <= CONFIG.HAND_TOP_MARGIN_Y;

        // 手前側面候補。
        // 横から見た画像では手前側面が左右どちらに映るか
        // カメラ配置によって変わるため、箱の前後方向を
        // 固定せず、境界付近を広く候補にする。
        const horizontalDistance = Math.min(
            Math.abs(wrist.x - box.x),
            Math.abs(wrist.x - box.right)
        ) / box.width;

        const withinSideY =
            wrist.y >= box.y - box.height * CONFIG.HAND_SIDE_MARGIN_Y &&
            wrist.y <= box.bottom + box.height * CONFIG.HAND_SIDE_MARGIN_Y;

        const nearSide =
            horizontalDistance <= CONFIG.HAND_SIDE_MARGIN_X &&
            withinSideY;

        if (!nearTop && !nearSide) return null;

        const topScore = nearTop
            ? 1 - topDistance / CONFIG.HAND_TOP_MARGIN_Y
            : 0;

        const sideScore = nearSide
            ? 1 - horizontalDistance / CONFIG.HAND_SIDE_MARGIN_X
            : 0;

        const positionScore = Math.max(topScore, sideScore);

        return {
            type: nearTop && nearSide
                ? "上面・側面境界"
                : nearTop
                    ? "上面付近"
                    : "側面付近",

            score: clamp(positionScore, 0, 1),

            topDistance: round(topDistance),
            sideDistance: round(horizontalDistance),

            nearTop: nearTop,
            nearSide: nearSide
        };
    }

    // -----------------------------------------------------
    // 骨格特徴量
    // -----------------------------------------------------

    function buildFeatures(frames) {
        return frames.map(function (frame, index) {
            const hip = getHip(frame);
            const shoulder = getShoulder(frame);
            const knee = getKnee(frame);
            const ankle = getAnkle(frame);
            const box = getVaultBox(frame);

            let trunkAngle = null;

            if (hip && shoulder) {
                const dx = shoulder.x - hip.x;
                const dy = shoulder.y - hip.y;

                trunkAngle =
                    Math.atan2(dy, dx) * 180 / Math.PI;
            }

            const wrists = getWristCandidates(frame);

            const handCandidates = [];

            wrists.forEach(function (item) {
                if (!box) return;

                const position = evaluateHandPosition(
                    item.point,
                    box
                );

                if (!position) return;

                handCandidates.push({
                    side: item.side,
                    point: item.point,
                    position: position,
                    visibility: item.point.visibility
                });
            });

            return {
                index: index,
                frame: frame,
                hip: hip,
                shoulder: shoulder,
                knee: knee,
                ankle: ankle,
                box: box,
                trunkAngle: trunkAngle,
                handCandidates: handCandidates
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

        if (
            !Number.isFinite(before) ||
            !Number.isFinite(after)
        ) {
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

            const score =
                Math.max(0, -ankleVelocity) * 0.6 +
                Math.max(0, -hipVelocity) * 0.4;

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

        return makeEvent(
            features.map(f => f.frame),
            bestIndex,
            clamp(bestScore * 15, 0.25, 0.75),
            "足・腰の上方向への移動から踏切候補を推定"
        );
    }

    // -----------------------------------------------------
    // 着手候補 Ver1.1
    // -----------------------------------------------------

    function detectHandContact(features) {
        const candidates = [];

        features.forEach(function (f) {
            f.handCandidates.forEach(function (hand) {
                const continuity = features
                    .slice(
                        Math.max(
                            0,
                            f.index - CONFIG.HAND_CONTINUITY_WINDOW
                        ),
                        Math.min(
                            features.length,
                            f.index + CONFIG.HAND_CONTINUITY_WINDOW + 1
                        )
                    )
                    .filter(function (nearFrame) {
                        return nearFrame.handCandidates.some(function (other) {
                            return other.side === hand.side;
                        });
                    }).length;

                const continuityScore = clamp(
                    continuity / (
                        CONFIG.HAND_CONTINUITY_WINDOW * 2 + 1
                    ),
                    0,
                    1
                );

                const confidence = clamp(
                    hand.position.score * 0.45 +
                    hand.visibility * 0.30 +
                    continuityScore * 0.25,
                    0,
                    0.90
                );

                candidates.push({
                    index: f.index,
                    side: hand.side,
                    type: hand.position.type,
                    confidence: confidence,
                    continuity: continuity,
                    topDistance: hand.position.topDistance,
                    sideDistance: hand.position.sideDistance
                });
            });
        });

        if (candidates.length === 0) {
            return {
                event: missingEvent(
                    "左右の手首が跳び箱の上面・側面付近にある候補を検出できませんでした"
                ),
                candidates: []
            };
        }

        // 信頼度が高い順に選ぶ
        candidates.sort(function (a, b) {
            return b.confidence - a.confidence;
        });

        const selected = candidates[0];

        const event = makeEvent(
            features.map(f => f.frame),
            selected.index,
            selected.confidence,
            selected.type +
            "にある手首を着手候補として検出（" +
            selected.side +
            "手）"
        );

        event.handSide = selected.side;
        event.contactArea = selected.type;

        // 低信頼度の場合は候補としてのみ表示
        if (selected.confidence < 0.35) {
            event.detected = false;
            event.reason =
                "着手候補はありますが、信頼度が不足しているため教師確認が必要です";
        }

        return {
            event: event,
            candidates: candidates.slice(0, 10).map(function (c) {
                return {
                    index: c.index,
                    frame: getFrameNumber(
                        features[c.index].frame,
                        c.index
                    ),
                    side: c.side,
                    contactArea: c.type,
                    confidence: round(c.confidence),
                    continuity: c.continuity
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
                start: missingEvent(
                    "着手候補がないため回転開始を推定できません"
                ),
                end: missingEvent(
                    "着手候補がないため回転終了を推定できません"
                )
            };
        }

        const endLimit = landingIndex >= 0
            ? landingIndex
            : features.length - 1;

        const angles = features.map(f => f.trunkAngle);
        const validAngles = angles.filter(Number.isFinite);

        if (validAngles.length < 5) {
            return {
                start: missingEvent("肩・腰の位置情報が不足しています"),
                end: missingEvent("肩・腰の位置情報が不足しています")
            };
        }

        const baseAngle = angles[handIndex];

        if (!Number.isFinite(baseAngle)) {
            return {
                start: missingEvent("着手時の体幹角度を取得できません"),
                end: missingEvent("着手時の体幹角度を取得できません")
            };
        }

        let endIndex = -1;
        let maxChange = 0;

        for (let i = handIndex + 1; i <= endLimit; i++) {
            if (!Number.isFinite(angles[i])) continue;

            let change = Math.abs(angles[i] - baseAngle);

            if (change > 180) change = 360 - change;

            if (change > maxChange) {
                maxChange = change;
                endIndex = i;
            }
        }

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

        const confidence = clamp(maxChange / 120, 0.25, 0.65);

        return {
            start: makeEvent(
                features.map(f => f.frame),
                handIndex,
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
            return missingEvent(
                "着手候補がないため通過を推定できません"
            );
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
            return missingEvent(
                "着地判定に必要なフレーム数が不足しています"
            );
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

            const stability = Math.abs(next.y - ankle.y);

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

        if (
            !Array.isArray(frames) ||
            frames.length < CONFIG.MIN_FRAMES
        ) {
            lastForwardRollPhaseResult = {
                version: "1.1",
                success: false,
                message: "骨格データが不足しています",
                frameCount: Array.isArray(frames) ? frames.length : 0,
                detected: {},
                warnings: [
                    "12フレーム以上の骨格データが必要です"
                ]
            };

            return lastForwardRollPhaseResult;
        }

        const features = buildFeatures(frames);

        const validVaultCount = features.filter(
            f => !!f.box
        ).length;

        const validHipCount = features.filter(
            f => !!f.hip
        ).length;

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
            version: "1.1",
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
                "この結果は骨格位置から推定した動作候補です。実際の接触を確定するものではありません。",
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
