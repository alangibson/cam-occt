import type { Arc } from '../../../../geometry/arc';
import type { Point2D } from '../../../../../lib/types/geometry';
import type { IntersectionResult } from '../../chain/types';
import { EPSILON } from '$lib/geometry/math';
import {
    isPointOnArc,
    calculateArcParameter,
} from '../../../intersection-arc-utils';
import {
    createExtendedArc,
    isIntersectionOnArcExtension,
} from '../../extend/arc';
import { calculateSquaredDistance } from '$lib/geometry/math';
import { removeDuplicateIntersections } from '../../../intersection-base';
import { MAX_ITERATIONS } from '../../../../geometry/constants';

/**
 * Find intersections between two arcs using radical axis method
 * Supports bidirectional extension for gap intersection detection
 */
export function findArcArcIntersections(
    arc1: Arc,
    arc2: Arc,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = MAX_ITERATIONS
): IntersectionResult[] {
    // First try intersection with original shapes
    const originalResults: IntersectionResult[] = findArcArcIntersectionsCore(
        arc1,
        arc2,
        swapParams
    );

    if (originalResults.length > 0 || !allowExtensions) {
        return originalResults;
    }

    // No intersections with original shapes and extensions allowed
    // Try all combinations of extended shapes
    const allExtensionResults: IntersectionResult[] = [];

    // Try 1: Extended arc1 vs original arc2
    try {
        const extendedArc1: Arc = createExtendedArc(arc1, extensionLength);
        const extendedArc1Results: IntersectionResult[] =
            findArcArcIntersectionsCore(
                extendedArc1,
                arc2,
                swapParams,
                true,
                arc1,
                undefined
            );
        allExtensionResults.push(...extendedArc1Results);
    } catch {
        // Arc1 extension failed, skip
    }

    // Try 2: Original arc1 vs extended arc2
    try {
        const extendedArc2: Arc = createExtendedArc(arc2, extensionLength);
        const extendedArc2Results: IntersectionResult[] =
            findArcArcIntersectionsCore(
                arc1,
                extendedArc2,
                swapParams,
                true,
                undefined,
                arc2
            );
        allExtensionResults.push(...extendedArc2Results);
    } catch {
        // Arc2 extension failed, skip
    }

    // Try 3: Extended arc1 vs extended arc2 (for maximum gap coverage)
    try {
        const extendedArc1: Arc = createExtendedArc(arc1, extensionLength);
        const extendedArc2: Arc = createExtendedArc(arc2, extensionLength);
        const bothExtendedResults: IntersectionResult[] =
            findArcArcIntersectionsCore(
                extendedArc1,
                extendedArc2,
                swapParams,
                true,
                arc1,
                arc2
            );
        allExtensionResults.push(...bothExtendedResults);
    } catch {
        // Extension failed, skip
    }

    // Filter out duplicates
    return removeDuplicateIntersections(allExtensionResults);
}

/**
 * Core intersection calculation between two arcs
 */
function findArcArcIntersectionsCore(
    arc1: Arc,
    arc2: Arc,
    swapParams: boolean = false,
    checkExtensions: boolean = false,
    originalArc1?: Arc,
    originalArc2?: Arc
): IntersectionResult[] {
    const { center: c1, radius: r1 } = arc1;
    const { center: c2, radius: r2 } = arc2;

    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = calculatePointDistance(c1, c2);

    // Handle concentric arcs (same center)
    if (d < EPSILON) {
        return [];
    }

    // Handle tangent cases
    if (
        Math.abs(d - (r1 + r2)) < EPSILON ||
        Math.abs(d - Math.abs(r1 - r2)) < EPSILON
    ) {
        const tangentPoint = calculateTangentPoint(c1, c2, r1, d, dx, dy);

        if (
            isPointOnArc(tangentPoint, arc1) &&
            isPointOnArc(tangentPoint, arc2)
        ) {
            const param1 = calculateArcParameter(tangentPoint, arc1);
            const param2 = calculateArcParameter(tangentPoint, arc2);

            return [
                createIntersectionResult(
                    tangentPoint,
                    param1,
                    param2,
                    swapParams,
                    'tangent',
                    checkExtensions,
                    originalArc1,
                    originalArc2
                ),
            ];
        }
        return [];
    }

    // Calculate intersection points using radical axis
    const a: number = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const hSquared: number = r1 * r1 - a * a;

    // Check for valid intersection geometry
    if (hSquared < 0) {
        return [];
    }

    const h: number = Math.sqrt(hSquared);

    const px: number = c1.x + (a * dx) / d;
    const py: number = c1.y + (a * dy) / d;

    const results: IntersectionResult[] = [];

    // Two intersection points
    const offset1: { x: number; y: number } = {
        x: (-h * dy) / d,
        y: (h * dx) / d,
    };
    const offset2: { x: number; y: number } = {
        x: (h * dy) / d,
        y: (-h * dx) / d,
    };

    [offset1, offset2].forEach((offset) => {
        const point: Point2D = { x: px + offset.x, y: py + offset.y };

        if (isPointOnArc(point, arc1) && isPointOnArc(point, arc2)) {
            const param1: number = calculateArcParameter(point, arc1);
            const param2: number = calculateArcParameter(point, arc2);

            results.push(
                createIntersectionResult(
                    point,
                    param1,
                    param2,
                    swapParams,
                    'exact',
                    checkExtensions,
                    originalArc1,
                    originalArc2
                )
            );
        }
    });

    return results;
}

/**
 * Create an intersection result with consistent parameter handling
 */
function createIntersectionResult(
    point: Point2D,
    param1: number,
    param2: number,
    swapParams: boolean,
    type: 'tangent' | 'exact',
    checkExtensions: boolean = false,
    originalArc1?: Arc,
    originalArc2?: Arc
): IntersectionResult {
    // Determine if intersection is on extension
    let onExtension = false;
    if (checkExtensions && (originalArc1 || originalArc2)) {
        onExtension = isIntersectionOnArcExtension(
            param1,
            param2,
            originalArc1,
            originalArc2
        );
    }

    return {
        point,
        param1: swapParams ? param2 : param1,
        param2: swapParams ? param1 : param2,
        distance: 0,
        type,
        confidence: 1.0,
        onExtension,
    };
}

/**
 * Calculate distance between two points
 */
function calculatePointDistance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(calculateSquaredDistance(p1, p2));
}

/**
 * Calculate tangent point between two arcs
 */
function calculateTangentPoint(
    c1: Point2D,
    c2: Point2D,
    r1: number,
    d: number,
    dx: number,
    dy: number
): Point2D {
    const t = r1 / d;
    return {
        x: c1.x + t * dx,
        y: c1.y + t * dy,
    };
}
