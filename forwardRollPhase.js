
/* =========================================================
   forwardRollPhase.js Ver1.7
   台上前転専用・動作フェーズ検出

   Ver1.7 変更点
   ・Ver1.6の既存機能を維持
   ・踏切判定に足首・膝・腰の上下動を組み合わせる
   ・足首が重なって認識しにくい場合も、取得できた部位で推定
   ・複数部位の上方向への動きが一致する場合を優
   ・取得部位が少ない場合は信頼度を抑えて判定保留
   ・跳び箱検出が一時的に途切れたフレームを補完
   ・前後の検出位置から跳び箱位置を線形補間
   ・補完した位置を着手候補の検出にも使用
   ・長い検出欠損は無理に補完しない
   ・補完フレーム数を診断情報に保存
   ・開脚跳び用phase.jsには影響しない
========================================================= */

(function () {
    "use strict";

    const VERSION = "1.7";

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

        BODY_PASS_MARGIN_X: 0.80,
        BODY_PASS_MAX_RELATIVE_X: 2.10,
        BODY_PASS_MARGIN_Y: 0.75,
        BODY_PASS_MIN_SCORE: 0.55,
        BODY_PASS_AFTER_ROTATION: 1,

        BOX_MIN_DETECTIONS: 3,
        BOX_WIDTH_PERCENTILE: 0.75,

        // 一時的な検出欠損を補完する最大フレーム数
        BOX_MAX_INTERPOLATION_GAP: 18,

        // 前後どちらか一方しか検出がない場合の補完上限
        BOX_MAX_EDGE_GAP: 3
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
        return frame && Number.isFinite(frame.frame)
            ? frame.frame
            : index;
    }

    function getTime(frame) {
        return frame && Number.isFinite(frame.time)
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

    function median(values) {
        const valid = values
            .filter(Number.isFinite)
            .slice()
            .sort(function (a, b) {
                return a - b;
            });

        if (valid.length === 0) return null;

        const middle = Math.floor(valid.length / 2);

        if (valid.length % 2 === 0) {
            return (
                valid[middle - 1] +
                valid[middle]
            ) / 2;
        }

        return valid[middle];
    }

    function percentile(values, rate) {
        const valid = values
            .filter(Number.isFinite)
            .slice()
            .sort(function (a, b) {
                return a - b;
            });

        if (valid.length === 0) return null;

        const position =
            (valid.length - 1) * rate;

        const lower = Math.floor(position);
        const upper = Math.ceil(position);

        if (lower === upper) {
            return valid[lower];
        }

        const weight = position - lower;

        return (
            valid[lower] * (1 - weight) +
            valid[upper] * weight
        );
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
    // 跳び箱の基準位置を安定化
    // -----------------------------------------------------

    function buildStableVaultBox(features) {
        const boxes = features
            .map(function (f) {
                return f.box;
            })
            .filter(Boolean);

        if (boxes.length < CONFIG.BOX_MIN_DETECTIONS) {
            return {
                detected: false,
                reason: "跳び箱の検出フレームが不足しています",
                detectionCount: boxes.length
            };
        }

        const centersX = boxes.map(function (box) {
            return box.x + box.width / 2;
        });

        const centersY = boxes.map(function (box) {
            return box.y + box.height / 2;
        });

        const centerX = median(centersX);
        const centerY = median(centersY);

        const widths = boxes.map(function (box) {
            return box.width;
        });

        const heights = boxes.map(function (box) {
            return box.height;
        });

        const stableWidth = percentile(
            widths,
            CONFIG.BOX_WIDTH_PERCENTILE
        );

        const stableHeight = median(heights);

        if (
            !Number.isFinite(centerX) ||
            !Number.isFinite(centerY) ||
            !Number.isFinite(stableWidth) ||
            !Number.isFinite(stableHeight) ||
            stableWidth <= 0 ||
            stableHeight <= 0
        ) {
            return {
                detected: false,
                reason: "跳び箱の基準位置を計算できません",
                detectionCount: boxes.length
            };
        }

        const stableBox = {
            x: centerX - stableWidth / 2,
            y: centerY - stableHeight / 2,
            width: stableWidth,
            height: stableHeight,
            right: centerX + stableWidth / 2,
            bottom: centerY + stableHeight / 2,
            centerX: centerX,
            centerY: centerY
        };

        return {
            detected: true,
            box: stableBox,
            detectionCount: boxes.length,
            centerX: round(centerX),
            centerY: round(centerY),
            width: round(stableWidth),
            height: round(stableHeight),
            widthValues: widths.map(round),
            centerXValues: centersX.map(round)
        };
    }

    // -----------------------------------------------------
    // Ver1.6 新機能
    // 検出欠損フレームの跳び箱位置を補完
    // -----------------------------------------------------

    function cloneBox(box) {
        return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            right: box.x + box.width,
            bottom: box.y + box.height
        };
    }

    function interpolateBox(boxA, boxB, ratio) {
        const x =
            boxA.x + (boxB.x - boxA.x) * ratio;

        const y =
            boxA.y + (boxB.y - boxA.y) * ratio;

        const width =
            boxA.width +
            (boxB.width - boxA.width) * ratio;

        const height =
            boxA.height +
            (boxB.height - boxA.height) * ratio;

        return {
            x: x,
            y: y,
            width: width,
            height: height,
            right: x + width,
            bottom: y + height
        };
    }

    function buildInterpolatedVaultBoxes(features) {
        const detected = [];

        features.forEach(function (feature, index) {
            if (feature.box) {
                detected.push({
                    index: index,
                    box: cloneBox(feature.box)
                });

                feature.boxEstimated = false;
            } else {
                feature.boxEstimated = false;
            }
        });

        let interpolatedCount = 0;
        let maximumGap = 0;

        if (detected.length === 0) {
            return {
                interpolatedCount: 0,
                maximumGap: 0,
                detectedCount: 0
            };
        }

        for (let i = 0; i < features.length; i++) {
            if (features[i].box) continue;

            let previous = null;
            let next = null;

            for (let j = detected.length - 1; j >= 0; j--) {
                if (detected[j].index < i) {
                    previous = detected[j];
                    break;
                }
            }

            for (let j = 0; j < detected.length; j++) {
                if (detected[j].index > i) {
                    next = detected[j];
                    break;
                }
            }

            // 前後両方に実測値がある場合
            if (previous && next) {
                const gap =
                    next.index - previous.index - 1;

                maximumGap = Math.max(maximumGap, gap);

                if (
                    gap <= CONFIG.BOX_MAX_INTERPOLATION_GAP
                ) {
                    const ratio =
                        (i - previous.index) /
                        (next.index - previous.index);

                    features[i].box = interpolateBox(
                        previous.box,
                        next.box,
                        ratio
                    );

                    features[i].boxEstimated = true;
                    interpolatedCount++;
                }

                continue;
            }

            // 動画の先頭・末尾にある短い欠損だけ補完
            const nearest = previous || next;

            if (nearest) {
                const gap = Math.abs(i - nearest.index);

                maximumGap = Math.max(maximumGap, gap);

                if (gap <= CONFIG.BOX_MAX_EDGE_GAP) {
                    features[i].box = cloneBox(nearest.box);
                    features[i].boxEstimated = true;
                    interpolatedCount++;
                }
            }
        }

        return {
            interpolatedCount: interpolatedCount,
            maximumGap: maximumGap,
            detectedCount: detected.length
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
                boxEstimated: false,
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

    // 踏切判定用：前後の値が欠けている場合は「動きなし」ではなく未取得とする
    function getVelocityIfAvailable(values, index) {
        if (index <= 0 || index >= values.length - 1) {
            return null;
        }

        const before = values[index - 1];
        const after = values[index + 1];

        if (
            !Number.isFinite(before) ||
            !Number.isFinite(after)
        ) {
            return null;
        }

        return (after - before) / 2;
    }

    // -----------------------------------------------------
    // 踏切候補
    // -----------------------------------------------------

    function detectTakeOff(
        features,
        hipValues,
        kneeValues,
        ankleValues,
        handIndex
    ) {
        const limit = handIndex >= 0
            ? Math.min(handIndex, Math.floor(features.length * 0.75))
            : Math.floor(features.length * 0.65);

        let bestIndex = -1;
        let bestScore = -Infinity;
        let bestSignals = null;

        for (let i = 2; i < limit; i++) {
            // y座標は小さくなるほど上方向への移動を表す
            // 両足が重なって左右の足首を分離できない場合も、
            // 取得できた足首・膝・腰の中間位置を利用する
            const ankleVelocity = getVelocityIfAvailable(ankleValues, i);
            const kneeVelocity = getVelocityIfAvailable(kneeValues, i);
            const hipVelocity = getVelocityIfAvailable(hipValues, i);

            const signals = [
                {
                    name: "ankle",
                    velocity: ankleVelocity,
                    weight: 0.40
                },
                {
                    name: "knee",
                    velocity: kneeVelocity,
                    weight: 0.35
                },
                {
                    name: "hip",
                    velocity: hipVelocity,
                    weight: 0.25
                }
            ].filter(function (item) {
                return Number.isFinite(item.velocity);
            });

            if (signals.length === 0) continue;

            let totalWeight = 0;
            let weightedUpward = 0;
            let upwardJointCount = 0;

            signals.forEach(function (item) {
                const upward = Math.max(0, -item.velocity);

                totalWeight += item.weight;
                weightedUpward += upward * item.weight;

                if (upward > 0.001) {
                    upwardJointCount++;
                }
            });

            if (totalWeight <= 0) continue;

            const movementScore = weightedUpward / totalWeight;

            // 複数部位が同じタイミングで上方向へ動いている候補を優先
            const selectionScore =
                movementScore * (1 + upwardJointCount * 0.08);

            if (selectionScore > bestScore) {
                bestScore = selectionScore;
                bestIndex = i;

                bestSignals = {
                    ankleUpward: Number.isFinite(ankleVelocity)
                        ? Math.max(0, -ankleVelocity)
                        : null,
                    kneeUpward: Number.isFinite(kneeVelocity)
                        ? Math.max(0, -kneeVelocity)
                        : null,
                    hipUpward: Number.isFinite(hipVelocity)
                        ? Math.max(0, -hipVelocity)
                        : null,
                    validJointCount: signals.length,
                    upwardJointCount: upwardJointCount,
                    movementScore: movementScore
                };
            }
        }

        if (
            bestIndex < 0 ||
            !bestSignals ||
            bestSignals.movementScore < 0.001
        ) {
            return missingEvent(
                "足首・膝・腰の上方向への動きから踏切候補を十分に検出できませんでした"
            );
        }

        // 信頼度は複数部位の動きの一致を重視する。
        // 1部位しか取得できない場合は高い信頼度を付けず、判定を保留する。
        let confidence =
            0.38 +
            Math.min(0.25, bestSignals.movementScore * 10);

        if (bestSignals.upwardJointCount >= 2) {
            confidence += 0.12;
        }

        if (bestSignals.upwardJointCount >= 3) {
            confidence += 0.08;
        }

        if (
            bestSignals.validJointCount < 2 ||
            bestSignals.upwardJointCount < 2
        ) {
            confidence = Math.min(confidence, 0.58);
        }

        confidence = clamp(confidence, 0.25, 0.82);

        const event = makeEvent(
            features.map(f => f.frame),
            bestIndex,
            confidence,
            "足首・膝・腰の上方向への動きを組み合わせて踏切候補を推定"
        );

        event.takeOffSignals = {
            ankleUpward: round(bestSignals.ankleUpward),
            kneeUpward: round(bestSignals.kneeUpward),
            hipUpward: round(bestSignals.hipUpward),
            validJointCount: bestSignals.validJointCount,
            upwardJointCount: bestSignals.upwardJointCount,
            movementScore: round(bestSignals.movementScore)
        };

        return event;
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
                    visibility: hand.visibility,
                    boxEstimated: !!f.boxEstimated
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
                "手）" +
                (selected.boxEstimated
                    ? "（跳び箱位置は前後フレームから補完）"
                    : "")
        );

        event.handSide = selected.side;
        event.contactArea = selected.type;
        event.boxEstimated = selected.boxEstimated;

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
                    visibility: round(c.visibility),
                    boxEstimated: c.boxEstimated
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
    // 腰・脚の通過候補
    // -----------------------------------------------------

    function detectBodyPass(
        features,
        handIndex,
        rotationEndIndex,
        landingIndex,
        stableVault
    ) {
        if (handIndex < 0) {
            return missingEvent(
                "着手候補がないため通過を推定できません"
            );
        }

        if (!stableVault || !stableVault.detected) {
            return missingEvent(
                "跳び箱の安定した基準位置を作れないため通過を判定できません"
            );
        }

        const referenceBox = stableVault.box;
        const start = handIndex + 1;

        let end;

        if (
            rotationEndIndex >= start &&
            rotationEndIndex < features.length
        ) {
            end = Math.min(
                features.length - 1,
                rotationEndIndex +
                    CONFIG.BODY_PASS_AFTER_ROTATION
            );
        } else if (landingIndex >= start) {
            end = landingIndex;
        } else {
            end = Math.min(
                features.length - 1,
                Math.floor(features.length * 0.70)
            );
        }

        if (landingIndex >= start) {
            end = Math.min(end, landingIndex);
        }

        const relativeYByIndex =
            new Array(features.length).fill(null);

        const relativeXByIndex =
            new Array(features.length).fill(null);

        for (let i = start; i <= end; i++) {
            const f = features[i];

            if (!f || !f.hip) continue;

            relativeXByIndex[i] =
                (f.hip.x - referenceBox.x) /
                referenceBox.width;

            relativeYByIndex[i] =
                (f.hip.y - referenceBox.y) /
                referenceBox.width;
        }

        let bestIndex = -1;
        let bestScore = -Infinity;
        let candidateCount = 0;

        const diagnostics = [];

        for (let i = start; i <= end; i++) {
            const f = features[i];

            if (!f || !f.hip) continue;

            const relativeX = relativeXByIndex[i];
            const relativeY = relativeYByIndex[i];

            if (
                !Number.isFinite(relativeX) ||
                !Number.isFinite(relativeY)
            ) {
                continue;
            }

            const horizontalInside =
                relativeX >= -CONFIG.BODY_PASS_MARGIN_X &&
                relativeX <= CONFIG.BODY_PASS_MAX_RELATIVE_X;

            const verticalInside =
                relativeY >= -CONFIG.BODY_PASS_MARGIN_Y &&
                relativeY <= CONFIG.BODY_PASS_MARGIN_Y;

            if (!horizontalInside || !verticalInside) {
                diagnostics.push({
                    index: i,
                    frame: getFrameNumber(f.frame, i),
                    relativeX: round(relativeX),
                    relativeY: round(relativeY),
                    reason: !horizontalInside
                        ? "左右範囲外"
                        : "上下範囲外"
                });

                continue;
            }

            const legPoints = [
                f.knee,
                f.ankle
            ].filter(Boolean);

            if (legPoints.length === 0) {
                diagnostics.push({
                    index: i,
                    frame: getFrameNumber(f.frame, i),
                    relativeX: round(relativeX),
                    relativeY: round(relativeY),
                    reason: "膝・足首データなし"
                });

                continue;
            }

            candidateCount++;

            const horizontalScore = clamp(
                1 - Math.abs(relativeX - 0.45) / 1.25,
                0,
                1
            );

            const verticalScore = clamp(
                1 - Math.abs(relativeY) /
                    CONFIG.BODY_PASS_MARGIN_Y,
                0,
                1
            );

            const legsAboveHip = legPoints.some(function (point) {
                return point.y < f.hip.y;
            });

            const legScore = legsAboveHip ? 1 : 0;

            let previousRelativeY = null;

            for (
                let j = i - 1;
                j >= Math.max(start, i - 3);
                j--
            ) {
                if (
                    Number.isFinite(relativeYByIndex[j])
                ) {
                    previousRelativeY =
                        relativeYByIndex[j];
                    break;
                }
            }

            let trajectoryScore = 0;

            if (Number.isFinite(previousRelativeY)) {
                const upwardMovement =
                    previousRelativeY - relativeY;

                if (upwardMovement > 0.02) {
                    trajectoryScore = 0.5;
                }

                if (
                    previousRelativeY >= 0 &&
                    relativeY <= 0 &&
                    Math.abs(relativeY) <= 0.30
                ) {
                    trajectoryScore = 1;
                }
            }

            const score =
                horizontalScore * 0.25 +
                verticalScore * 0.35 +
                legScore * 0.25 +
                trajectoryScore * 0.15;

            const diagnostic = {
                index: i,
                frame: getFrameNumber(f.frame, i),
                time: getTime(f.frame),
                relativeX: round(relativeX),
                relativeY: round(relativeY),
                horizontalScore: round(horizontalScore),
                verticalScore: round(verticalScore),
                legsAboveHip: legsAboveHip,
                legPointCount: legPoints.length,
                trajectoryScore: round(trajectoryScore),
                previousRelativeY:
                    Number.isFinite(previousRelativeY)
                        ? round(previousRelativeY)
                        : null,
                score: round(score),
                reason: "位置条件OK"
            };

            diagnostics.push(diagnostic);

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        diagnostics.sort(function (a, b) {
            return (b.score || 0) - (a.score || 0);
        });

        if (
            bestIndex < 0 ||
            bestScore < CONFIG.BODY_PASS_MIN_SCORE
        ) {
            const event = missingEvent(
                candidateCount === 0
                    ? "回転中に腰・脚と天板の位置条件を満たす候補がありませんでした"
                    : "腰・脚の通過候補はありますが、評価点が不足しています"
            );

            event.candidateCount = candidateCount;
            event.bestScore = round(
                Number.isFinite(bestScore) ? bestScore : 0
            );

            event.searchStartIndex = start;
            event.searchEndIndex = end;

            event.stableVaultBox = {
                x: round(referenceBox.x),
                y: round(referenceBox.y),
                width: round(referenceBox.width),
                height: round(referenceBox.height)
            };

            event.candidates = diagnostics.slice(0, 15);

            return event;
        }

        const event = makeEvent(
            features.map(f => f.frame),
            bestIndex,
            clamp(0.35 + bestScore * 0.30, 0.35, 0.65),
            "安定化した天板位置と回転中の腰・脚の位置関係から通過候補を推定"
        );

        event.candidateCount = candidateCount;
        event.bestScore = round(bestScore);
        event.searchStartIndex = start;
        event.searchEndIndex = end;

        event.stableVaultBox = {
            x: round(referenceBox.x),
            y: round(referenceBox.y),
            width: round(referenceBox.width),
            height: round(referenceBox.height)
        };

        event.candidates = diagnostics.slice(0, 15);

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
                version: VERSION,
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

        if (validVaultCount < CONFIG.BOX_MIN_DETECTIONS) {
            warnings.push(
                "跳び箱の検出フレームが少ないため、通過判定の精度が低い可能性があります"
            );
        }

        if (validHipCount < 5) {
            warnings.push(
                "腰の骨格データが不足しています"
            );
        }

        // 実測された跳び箱位置から基準位置を作成
        const stableVault = buildStableVaultBox(features);

        if (!stableVault.detected) {
            warnings.push(stableVault.reason);
        }

        // Ver1.6：検出が途切れたフレームの位置を補完
        const boxInterpolation =
            buildInterpolatedVaultBoxes(features);

        if (boxInterpolation.interpolatedCount > 0) {
            warnings.push(
                "跳び箱が一時的に検出できなかった " +
                boxInterpolation.interpolatedCount +
                " フレームについて、前後の検出位置から補完しました。"
            );
        }

        if (
            boxInterpolation.maximumGap >
            CONFIG.BOX_MAX_INTERPOLATION_GAP
        ) {
            warnings.push(
                "跳び箱の検出欠損が長いため、一部フレームは補完していません。"
            );
        }

        // 補完後の跳び箱位置を使って手首候補を再計算
        features.forEach(function (f) {
            f.handCandidates = [];

            if (!f.box) return;

            const wrists = getWristCandidates(f.frame);

            wrists.forEach(function (item) {
                const position = evaluateHandPosition(
                    item.point,
                    f.box
                );

                if (!position) return;

                f.handCandidates.push({
                    side: item.side,
                    point: item.point,
                    position: position,
                    visibility: item.point.visibility
                });
            });
        });

        const hipValues = smoothValues(
            features.map(f => f.hip ? f.hip.y : null),
            CONFIG.SMOOTH_WINDOW
        );

        const kneeValues = smoothValues(
            features.map(f => f.knee ? f.knee.y : null),
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
            kneeValues,
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
            landingIndex,
            stableVault
        );

        const success =
            takeOff.detected ||
            handResult.event.detected ||
            landing.detected;

        lastForwardRollPhaseResult = {
            version: VERSION,
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
                vaultDetected:
                    stableVault.detected,

                vaultFrameCount:
                    validVaultCount,

                vaultInterpolatedFrameCount:
                    boxInterpolation.interpolatedCount,

                vaultMaximumGap:
                    boxInterpolation.maximumGap,

                hipFrameCount:
                    validHipCount,

                totalFrameCount:
                    frames.length,

                handCandidateCount:
                    handResult.candidates.length,

                takeOffSignals:
                    takeOff.takeOffSignals || null,

                bodyPassCandidateCount:
                    bodyPass.candidateCount || 0,

                bodyPassBestScore:
                    bodyPass.bestScore || 0,

                stableVaultBox:
                    stableVault.detected
                        ? {
                            x: stableVault.box.x,
                            y: stableVault.box.y,
                            width: stableVault.box.width,
                            height: stableVault.box.height,
                            centerX: stableVault.centerX,
                            centerY: stableVault.centerY,
                            detectionCount:
                                stableVault.detectionCount
                        }
                        : null,

                rotationSearchEndIndex:
                    rotationEndIndex,

                landingIndex:
                    landingIndex
            },

            warnings: warnings.concat([
                "この結果は骨格位置から推定した動作候補です。実際の手や身体の接触を確定するものではありません。",
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
        "forwardRollPhase.js Ver" +
        VERSION +
        " 読み込み成功"
    );

})();




