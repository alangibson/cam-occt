/**
 * Cut Normal Calculation
 *
 * Calculates the normal direction for cuts based on:
 * - Cut direction (CW/CCW)
 * - Part context (hole vs shell)
 * - Kerf compensation direction
 *
 * Base Rules:
 * - Shell + CW → left normal
 * - Shell + CCW → right normal
 * - Hole + CW → right normal
 * - Hole + CCW → left normal
 *
 * Kerf Compensation Adjustments:
 * - Shell + INNER kerf → flip normal (point inward)
 * - Hole + OUTER kerf → flip normal (point outward)
 *
 * This normal is used by both cut visualization and lead placement.
 */

import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { PartData } from '$lib/cam/part/interfaces';
import { CutDirection, NormalSide } from './enums';
import {
    getChainStartPoint,
    getChainTangent,
} from '$lib/geometry/chain/functions';
import { isChainShellInPart } from '$lib/cam/lead/part-lookup-utils';
import { OffsetDirection } from '$lib/cam/offset/types';

/**
 * Result of cut normal calculation
 */
interface CutNormalResult {
    /** Normalized normal vector perpendicular to cut path */
    normal: Point2D;
    /** Point where the normal is calculated (cut start point) */
    connectionPoint: Point2D;
    /** Which side the normal is on (left/right relative to cut direction) */
    normalSide: NormalSide;
}

/**
 * Calculate the normal direction for a cut.
 * This determines which side of the cut tangent the normal points to,
 * accounting for cut direction, hole/shell context, and kerf compensation.
 *
 * @param chain - The chain to calculate normal for (can be offset or original)
 * @param cutDirection - The cut direction (CW/CCW/NONE)
 * @param part - Optional part containing the chain (for hole/shell detection)
 * @param kerfCompensation - Optional kerf compensation direction (affects normal for INNER shells and OUTER holes)
 * @returns Normal vector and connection point
 */
export function calculateCutNormal(
    chain: Chain,
    cutDirection: CutDirection,
    part?: PartData,
    kerfCompensation?: OffsetDirection
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
    let normalSide: NormalSide;

    if (part && cutDirection !== CutDirection.NONE) {
        const isShell = isChainShellInPart(chain, part);

        if (isShell) {
            // Shell: CW → left, CCW → right
            // BUT: if INNER kerf compensation is used, flip the normal
            const shouldFlip = kerfCompensation === OffsetDirection.INSET;
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? shouldFlip
                        ? rightNormal
                        : leftNormal
                    : shouldFlip
                      ? leftNormal
                      : rightNormal;
            normalSide =
                cutDirection === CutDirection.CLOCKWISE
                    ? shouldFlip
                        ? NormalSide.RIGHT
                        : NormalSide.LEFT
                    : shouldFlip
                      ? NormalSide.LEFT
                      : NormalSide.RIGHT;
        } else {
            // Hole: CW → right, CCW → left
            // BUT: if OUTER kerf compensation is used, flip the normal
            const shouldFlip = kerfCompensation === OffsetDirection.OUTSET;
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? shouldFlip
                        ? leftNormal
                        : rightNormal
                    : shouldFlip
                      ? rightNormal
                      : leftNormal;
            normalSide =
                cutDirection === CutDirection.CLOCKWISE
                    ? shouldFlip
                        ? NormalSide.LEFT
                        : NormalSide.RIGHT
                    : shouldFlip
                      ? NormalSide.RIGHT
                      : NormalSide.LEFT;
        }
    } else if (cutDirection !== CutDirection.NONE) {
        // No part context but have cut direction: apply direction-based rule
        // This ensures leads flip consistently even without part context
        selectedDirection =
            cutDirection === CutDirection.CLOCKWISE ? leftNormal : rightNormal;
        normalSide =
            cutDirection === CutDirection.CLOCKWISE
                ? NormalSide.LEFT
                : NormalSide.RIGHT;
    } else {
        // No part context and no cut direction: default to left normal
        selectedDirection = leftNormal;
        normalSide = NormalSide.LEFT;
    }

    return {
        normal: selectedDirection,
        connectionPoint,
        normalSide,
    };
}
