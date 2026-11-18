
/* =========================================================
   forwardRollPhase.js Ver1.3
   台上前転専用・動作フェーズ検出

   Ver1.3 変更点
   ・腰・脚の通過判定を改善
   ・回転終了フレームで探索を打ち切らない
   ・着手後から着地までを探索
   ・天板の幅を基準に腰の通過位置を評価
   ・片側の膝・足首のデータでも評価
   ・通過候補の詳細を診断情報に保存
   ・既存の開脚跳び用phase.jsには影響しない
========================================================= */

(function () {
    "use strict";

    let lastForwardRollPhaseResult = null;

    const CONFIG = {
        MIN_FRAMES: 12,
        MIN_VISIBILITY: 0.35,
        SMOOTH_WINDOW: 3,

        HAND_TOP_MARGIN_X: 0.35,
        HAND_TOP_MARGIN_Y: 0.25,
        HAND_CORNER_MARGIN_Y: 0.45,
        HAND_SIDE_MARGIN_X: 0.30,
        HAND_SIDE_MARGIN_Y: 0.25,
        HAND_CONTINUITY_WINDOW: 2,
        MIN_HAND_CONFIDENCE: 0.35,

        // 腰・脚の通過判定
        BODY_PASS_MARGIN_X: 0.30,
        BODY_PASS_MARGIN_Y: 0.45,
        BODY_PASS_MIN_SCORE: 0.75
    };

    // -----------------------------------------------------
    // 基本データ取得
    // -----------------------------------------------------

    function getLandmark(frame, index) {
        if (!frame || !Array.isArray(frame.landmarks)) {
            return null;
        }

        const point = frame.landmarks[index];

        if (
            !point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
        ) {
            return null;
        }

        const visibility = Number.isFinite(point.visibility)
            ? point.visibility
            : 1;

        if (visibility < CONFIG.MIN_VISIBILITY) {
            return null;
        }

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
        }, {
            x: 0,
            y: 0,
            visibility: 0
        });

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
        return Math.round(value * 1000) / 1000;
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
    // 手首の取得
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
    // 着手位置の評価
    // -----------------------------------------------------

    function evaluateHandPosition(wrist, box) {
        if (!wrist || !box) return null;

        const relativeX =
            (wrist.x - box.x) / box.width;

        const relativeY =
            (wrist.y - box.y) / box.height;

        const topDistance =
            Math.abs(wrist.y - box.y) / box.height;

        const withinTopX =
            relativeX >= -CONFIG.HAND_TOP_MARGIN_X &&
            relativeX <= 1 + CONFIG.HAND_TOP_MARGIN_X;

        const nearTop =
            withinTopX &&
            topDistance <= CONFIG.HAND_TOP_MARGIN_Y;

        const cornerVerticalDistance =
            Math.abs(wrist.y - box.y) / box.width;

        const nearCorner =
            withinTopX &&
            cornerVerticalDistance <=
                CONFIG.HAND_CORNER_MARGIN_Y;

        const horizontalDistance = Math.min(
            Math.abs(wrist.x - box.x),
            Math.abs(wrist.x - box.right)
        ) / box.width;

        const withinSideY =
            wrist.y >=
                box.y - box.height * CONFIG.HAND_SIDE_MARGIN_Y &&
            wrist.y <=
                box.bottom + box.height * CONFIG.HAND_SIDE_MARGIN_Y;

        const nearSide =
            horizontalDistance <= CONFIG.HAND_SIDE_MARGIN_X &&
            withinSideY;

        if (!nearTop && !nearCorner && !nearSide) {
            return null;
        }

        const topScore = nearTop
            ? 1 - topDistance / CONFIG.HAND_TOP_MARGIN_Y
            : 0;

        const cornerScore = nearCorner
            ? 1 - cornerVerticalDistance /
                CONFIG.HAND_CORNER_MARGIN_Y
            : 0;

        const sideScore = nearSide
            ? 1 - horizontalDistance /
                CONFIG.HAND_SIDE_MARGIN_X
            : 0;

        const positionScore = Math.max(
            topScore,
            cornerScore,
            sideScore
        );

        let type = "角付近";

        if (nearTop && (nearCorner || nearSide)) {
            type = "上面・手前側の角付近";
        } else if (nearTop) {
            type = "上面付近";
        } else if (nearSide) {
            type = "側面境界付近";
        }

        return {
            type: type,
            score: clamp(positionScore, 0, 1),
            relativeX: round(relativeX),
            relativeY: round(relativeY),
            topDistance: round(topDistance),
            cornerVerticalDistance: round(cornerVerticalDistance),
            sideDistance: round(horizontalDistance),
            nearTop: nearTop,
            nearCorner: nearCorner,
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

            const end = Math.min(
                values.length - 1,
                index + windowSize
            );

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
        if (index <= 0 || index >= values.length - 1) {
            return 0;
        }

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
    // 着手候補
    // -----------------------------------------------------

    function detectHandContact(features) {
        const candidates = [];

        features.forEach(function (f) {
            f.handCandidates.forEach(function (hand) {
                const nearby = features.slice(
                    Math.max(
                        0,
                        f.index - CONFIG.HAND_CONTINUITY_WINDOW
                    ),
                    Math.min(
                        features.length,
                        f.index + CONFIG.HAND_CONTINUITY_WINDOW + 1
                    )
                );

                const continuity = nearby.filter(function (nearFrame) {
                    return nearFrame.handCandidates.some(function (other) {
                        return other.side === hand.side;
                    });
                }).length;

                const continuityScore = clamp(
                    continuity /
                        (CONFIG.HAND_CONTINUITY_WINDOW * 2 + 1),
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
                    relativeX: hand.position.relativeX,
                    relativeY: hand.position.relativeY,
                    topDistance: hand.position.topDistance,
                    cornerDistance:
                        hand.position.cornerVerticalDistance,
                    sideDistance: hand.position.sideDistance,
                    visibility: hand.visibility
                });
            });
        });

        if (candidates.length === 0) {
            return {
                event: missingEvent(
                    "左右の手首が跳び箱の上面・角・側面境界の候補範囲に入りませんでした"
                ),
                candidates: [],
                nearestCandidates: []
            };
        }

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

        if (selected.confidence < CONFIG.MIN_HAND_CONFIDENCE) {
            event.detected = false;
            event.reason =
                "着手候補はありますが信頼度が不足しています。教師による動画確認が必要です";
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
                    continuity: c.continuity,
                    relativeX: c.relativeX,
                    relativeY: c.relativeY,
                    visibility: round(c.visibility)
                };
            }),
            nearestCandidates: candidates.slice(0, 10)
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
    // 腰・脚の通過候補 Ver1.3
    // -----------------------------------------------------

    function detectBodyPass(
        features,
        handIndex,
        rotationEndIndex,
        landingIndex
    ) {
        if (handIndex < 0) {
            return missingEvent(
                "着手候補がないため通過を推定できません"
            );
        }

        let bestIndex = -1;
        let bestScore = -Infinity;
        let candidateCount = 0;

        // 回転終了ではなく、着地まで調べる
        const start = handIndex + 1;

        const end = landingIndex >= start
            ? landingIndex
            : features.length - 1;

        const diagnostics = [];

        for (let i = start; i <= end; i++) {
            const f = features[i];

            if (!f.hip || !f.box) continue;

            // 腰の水平位置
            const relativeX =
                (f.hip.x - f.box.x) / f.box.width;

            // 腰の天板からの垂直距離
            // 天板の高さだけでなく幅も基準にする
            const relativeY =
                (f.hip.y - f.box.y) / f.box.width;

            // 跳び箱の横方向に腰が重なっているか
            const horizontalInside =
                relativeX >= -CONFIG.BODY_PASS_MARGIN_X &&
                relativeX <= 1 + CONFIG.BODY_PASS_MARGIN_X;

            // 腰が天板付近またはその上方にあるか
            const verticalInside =
                relativeY >= -CONFIG.BODY_PASS_MARGIN_Y &&
                relativeY <= CONFIG.BODY_PASS_MARGIN_Y;

            if (!horizontalInside || !verticalInside) {
                continue;
            }

            // 膝・足首は片方のデータでも利用する
            const knee = f.knee;
            const ankle = f.ankle;

            const legPoints = [knee, ankle].filter(Boolean);

            if (legPoints.length === 0) continue;

            candidateCount++;

            // 水平方向の中央に近いほど高評価
            const horizontalCenterDistance =
                Math.abs(relativeX - 0.5);

            const horizontalScore = clamp(
                1 - horizontalCenterDistance / 0.8,
                0,
                1
            );

            // 天板に対して腰が適切な高さにあるか
            const verticalScore = clamp(
                1 - Math.abs(relativeY) /
                    CONFIG.BODY_PASS_MARGIN_Y,
                0,
                1
            );

            // 膝または足首が腰より上側にあるか
            const legsAboveHip = legPoints.some(function (point) {
                return point.y < f.hip.y + 0.08;
            });

            const legScore = legsAboveHip ? 1 : 0;

            const score =
                horizontalScore * 0.35 +
                verticalScore * 0.45 +
                legScore * 0.20;

            diagnostics.push({
                index: i,
                frame: getFrameNumber(f.frame, i),
                relativeX: round(relativeX),
                relativeY: round(relativeY),
                horizontalScore: round(horizontalScore),
                verticalScore: round(verticalScore),
                legsAboveHip: legsAboveHip,
                score: round(score)
            });

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (
            bestIndex < 0 ||
            bestScore < CONFIG.BODY_PASS_MIN_SCORE
        ) {
            const event = missingEvent(
                candidateCount === 0
                    ? "着手後から着地までに、腰が跳び箱付近を通過する候補を検出できませんでした"
                    : "腰の通過候補はありますが、位置関係の信頼度が不足しています"
            );

            event.candidateCount = candidateCount;
            event.bestScore = round(
                Number.isFinite(bestScore) ? bestScore : 0
            );

            event.candidates = diagnostics.slice(0, 10);

            return event;
        }

        const event = makeEvent(
            features.map(f => f.frame),
            bestIndex,
            clamp(0.35 + bestScore * 0.30, 0.35, 0.65),
            "腰・膝・足首と跳び箱の位置関係から通過候補を推定"
        );

        event.candidateCount = candidateCount;
        event.bestScore = round(bestScore);
        event.candidates = diagnostics.slice(0, 10);

        return event;
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
                version: "1.3",
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
            rotationEndIndex,
            landingIndex
        );

        const success =
            takeOff.detected ||
            handResult.event.detected ||
            landing.detected;

        lastForwardRollPhaseResult = {
            version: "1.3",
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
                totalFrameCount: frames.length,
                handCandidateCount: handResult.candidates.length,
                bodyPassCandidateCount:
                    bodyPass.candidateCount || 0,
                bodyPassBestScore:
                    bodyPass.bestScore || 0
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

    console.log(
        "forwardRollPhase.js Ver1.3 読み込み成功"
    );

})();
