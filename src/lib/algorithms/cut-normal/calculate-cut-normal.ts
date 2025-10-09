/**
 * Cut Normal Calculation
 *
 * Calculates the normal direction for cuts based on:
 * - Cut direction (CW/CCW)
 * - Part context (hole vs shell)
 *
 * Rules:
 * - Shell + CW → left normal
 * - Shell + CCW → right normal
 * - Hole + CW → right normal
 * - Hole + CCW → left normal
 *
 * This normal is used by both cut visualization and lead placement.
 */

import type { Point2D } from '$lib/types/geometry';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { CutDirection } from '$lib/types/direction';
import {
    getChainStartPoint,
    getChainTangent,
    isChainClosed,
} from '$lib/geometry/chain/functions';
import {
    isPointInsidePart,
    isPointInsideChainExact,
} from '$lib/algorithms/raytracing/point-in-chain';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import { isChainShellInPart } from '$lib/algorithms/leads/part-lookup-utils';

/**
 * Result of cut normal calculation
 */
export interface CutNormalResult {
    /** Normalized normal vector perpendicular to cut path */
    normal: Point2D;
    /** Point where the normal is calculated (cut start point) */
    connectionPoint: Point2D;
}

/**
 * Calculate the normal direction for a cut.
 * This determines which side of the cut tangent the normal points to,
 * accounting for cut direction and hole/shell context.
 *
 * @param chain - The chain to calculate normal for (can be offset or original)
 * @param cutDirection - The cut direction (CW/CCW/NONE)
 * @param part - Optional part containing the chain (for hole/shell detection)
 * @returns Normal vector and connection point
 */
export function calculateCutNormal(
    chain: Chain,
    cutDirection: CutDirection,
    part?: DetectedPart
): CutNormalResult {
    // Get the cut start point
    const connectionPoint = getChainStartPoint(chain);
    if (!connectionPoint) {
        throw new Error(
            'Cannot calculate cut normal: chain has no start point'
        );
    }

    // Get the tangent at the start point
    const tangent = getChainTangent(chain, connectionPoint, true);

    // Calculate base normal directions (perpendicular to tangent)
    const leftNormal: Point2D = { x: -tangent.y, y: tangent.x }; // 90° counterclockwise
    const rightNormal: Point2D = { x: tangent.y, y: -tangent.x }; // 90° clockwise

    // Determine normal direction based on part context
    let selectedDirection: Point2D;

    if (part && cutDirection !== CutDirection.NONE) {
        const isShell = isChainShellInPart(chain, part);

        if (isShell) {
            // Shell: CW → left, CCW → right
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? leftNormal
                    : rightNormal;
        } else {
            // Hole: CW → right, CCW → left
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? rightNormal
                    : leftNormal;
        }
    } else if (cutDirection !== CutDirection.NONE) {
        // No part context but have cut direction: apply direction-based rule
        // This ensures leads flip consistently even without part context
        selectedDirection =
            cutDirection === CutDirection.CLOCKWISE ? leftNormal : rightNormal;
    } else {
        // No part context and no cut direction: default to left normal
        selectedDirection = leftNormal;
    }

    return {
        normal: selectedDirection,
        connectionPoint,
    };
}

/**
 * Unified material avoidance direction calculation that works consistently
 * for both original chains and offset chains.
 *
 * This function determines which normal direction (left or right) best avoids
 * solid material, using the same logic regardless of chain type.
 */
export function getMaterialAvoidanceDirection(
    chain: Chain,
    point: Point2D,
    leftNormal: Point2D,
    rightNormal: Point2D,
    part?: DetectedPart
): { direction: Point2D; confidence: 'high' | 'medium' | 'low' } {
    // Test distances for material detection
    const CLOSE_DISTANCE = 1.0;
    const MEDIUM_DISTANCE = 5.0;
    const FAR_DISTANCE = 20.0;
    const distances = [CLOSE_DISTANCE, MEDIUM_DISTANCE, FAR_DISTANCE]; // Close, medium, far

    let leftAvoidanceScore = 0;
    let rightAvoidanceScore = 0;

    // If no part provided but chain has originalChainId, try to find part context
    // This helps offset chains get proper part context automatically
    const effectivePart = part;
    if (!effectivePart && chain.originalChainId) {
        // Note: This would require access to parts array, which we don't have here
        // This could be improved by passing parts array or using a context system
    }

    // Test each distance to build confidence in material avoidance
    for (let i = 0; i < distances.length; i++) {
        const testDistance = distances[i];
        const weight = distances.length - i; // Closer tests have higher weight

        const leftTest: Point2D = {
            x: point.x + leftNormal.x * testDistance,
            y: point.y + leftNormal.y * testDistance,
        };
        const rightTest: Point2D = {
            x: point.x + rightNormal.x * testDistance,
            y: point.y + rightNormal.y * testDistance,
        };

        let leftInSolid = false;
        let rightInSolid = false;

        if (effectivePart) {
            // Use part-based material detection (most accurate)
            // This works for both original chains and offset chains
            leftInSolid = isPointInsidePart(leftTest, effectivePart);
            rightInSolid = isPointInsidePart(rightTest, effectivePart);
        } else if (isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE)) {
            // Fall back to chain-based detection for closed chains
            // For offset chains, this tests against the offset geometry
            // For original chains, this tests against the original geometry
            leftInSolid = isPointInsideChainExact(leftTest, chain);
            rightInSolid = isPointInsideChainExact(rightTest, chain);
        }
        // For open chains without part context, we can't meaningfully test material avoidance

        // Award points for avoiding material
        if (!leftInSolid) leftAvoidanceScore += weight;
        if (!rightInSolid) rightAvoidanceScore += weight;
    }

    // Determine best direction and confidence level
    let selectedDirection: Point2D;
    let confidence: 'high' | 'medium' | 'low';

    const totalScore = leftAvoidanceScore + rightAvoidanceScore;
    const scoreDifference = Math.abs(leftAvoidanceScore - rightAvoidanceScore);

    if (leftAvoidanceScore > rightAvoidanceScore) {
        selectedDirection = leftNormal;
    } else if (rightAvoidanceScore > leftAvoidanceScore) {
        selectedDirection = rightNormal;
    } else {
        // Tie or no material information - fall back to leftNormal for backward compatibility
        // This maintains the original behavior when there's no clear material preference
        selectedDirection = leftNormal;
    }

    // Calculate confidence based on score difference and total coverage
    const HIGH_CONFIDENCE_THRESHOLD = 4;
    const MEDIUM_CONFIDENCE_THRESHOLD = 2;

    if (scoreDifference >= HIGH_CONFIDENCE_THRESHOLD && totalScore > 0) {
        confidence = 'high'; // Clear winner with good coverage
    } else if (
        scoreDifference >= MEDIUM_CONFIDENCE_THRESHOLD ||
        totalScore > 0
    ) {
        confidence = 'medium'; // Some differentiation or partial coverage
    } else {
        confidence = 'low'; // No clear winner or no material detection possible
    }

    return { direction: selectedDirection, confidence };
}
