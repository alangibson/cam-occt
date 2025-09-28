import type { Point2D } from '$lib/types/geometry';
import type { Line } from '$lib/geometry/line';
import type { Arc } from '$lib/geometry/arc';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import { EPSILON, INTERSECTION_TOLERANCE } from '$lib/geometry/math/constants';
import {
    DEFAULT_EXTENSION_LENGTH_MM,
    PRECISION_TOLERANCE_MULTIPLIER,
} from '$lib/geometry/constants';
import { createExtendedLine } from '$lib/algorithms/offset-calculation/extend/line';
import { createExtendedArc } from '$lib/algorithms/offset-calculation/extend/arc';
import {
    calculateArcParameter,
    isPointOnArc,
} from '$lib/geometry/arc/functions';

/**
 * Segment position in a polyline
 */
export type SegmentPosition = 'first' | 'intermediate' | 'last' | 'only';

/**
 * Private function to validate intersection parameters
 */
function validateIntersectionParameters(
    t: number,
    segmentPosition?: SegmentPosition
): boolean {
    if (segmentPosition !== undefined) {
        return isParameterValidForSegment(t, segmentPosition);
    }
    // Default bounds check for core function
    return t >= -EPSILON && t <= 1 + EPSILON;
}

/**
 * Private function to calculate line-arc intersection using quadratic formula
 */
function calculateLineArcIntersection(
    line: Line,
    arc: Arc
): { discriminant: number; a: number; b: number; sqrtDisc: number } {
    const { center, radius } = arc;
    const { start, end } = line;

    // Translate line to arc's coordinate system (arc center at origin)
    const p1: Point2D = { x: start.x - center.x, y: start.y - center.y };
    const p2: Point2D = { x: end.x - center.x, y: end.y - center.y };

    const dx: number = p2.x - p1.x;
    const dy: number = p2.y - p1.y;

    // Quadratic equation coefficients for line-circle intersection
    const a = dx * dx + dy * dy;
    const b = 2 * (p1.x * dx + p1.y * dy);
    const c = p1.x * p1.x + p1.y * p1.y - radius * radius;

    // eslint-disable-next-line no-magic-numbers
    const discriminant = b * b - 4 * a * c;
    const sqrtDisc = Math.sqrt(Math.max(0, discriminant));

    return { discriminant, a, b, sqrtDisc };
}

/**
 * Process line-arc intersection with discriminant handling
 */
function processLineArcIntersection(
    line: Line,
    arc: Arc,
    swapParams: boolean,
    segmentPosition?: SegmentPosition,
    checkExtensions?: boolean,
    originalLine?: Line,
    originalArc?: Arc,
    extensionLength?: number
): IntersectionResult[] {
    const { discriminant, a, b, sqrtDisc } = calculateLineArcIntersection(
        line,
        arc
    );

    if (discriminant < -EPSILON) {
        return []; // No intersection
    }

    // Handle tangent case
    if (discriminant < EPSILON) {
        const t = -b / (2 * a);
        const tangentResults = checkExtensions
            ? processArcIntersectionResults(
                  line,
                  arc,
                  [t],
                  swapParams,
                  undefined,
                  checkExtensions,
                  originalLine,
                  originalArc,
                  extensionLength
              )
            : processArcIntersectionResults(
                  line,
                  arc,
                  [t],
                  swapParams,
                  segmentPosition
              );

        // Update type for tangent intersections
        tangentResults.forEach((result) => {
            result.type = 'tangent';
            if (!checkExtensions) {
                delete result.onExtension;
            }
        });

        return tangentResults;
    } else {
        // Two intersection points
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);

        const intersectionResults = checkExtensions
            ? processArcIntersectionResults(
                  line,
                  arc,
                  [t1, t2],
                  swapParams,
                  undefined,
                  checkExtensions,
                  originalLine,
                  originalArc,
                  extensionLength
              )
            : processArcIntersectionResults(
                  line,
                  arc,
                  [t1, t2],
                  swapParams,
                  segmentPosition
              );

        if (!checkExtensions) {
            // Remove onExtension property for segment-aware results
            intersectionResults.forEach((result) => {
                delete result.onExtension;
            });
        }

        return intersectionResults;
    }
}

/**
 * Private function to process arc intersection results
 */
function processArcIntersectionResults(
    line: Line,
    arc: Arc,
    tValues: number[],
    swapParams: boolean,
    segmentPosition?: SegmentPosition,
    checkExtensions: boolean = false,
    originalLine?: Line,
    originalArc?: Arc,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH_MM
): IntersectionResult[] {
    const results: IntersectionResult[] = [];
    const { start, end } = line;

    tValues.forEach((t) => {
        // Check if intersection is valid
        if (!validateIntersectionParameters(t, segmentPosition)) {
            return;
        }

        const point = {
            x: start.x + t * (end.x - start.x),
            y: start.y + t * (end.y - start.y),
        };

        if (isPointOnArc(point, arc)) {
            const arcParam = calculateArcParameter(point, arc);

            // Determine if intersection is on extension
            let onExtension = false;
            if (checkExtensions && (originalLine || originalArc)) {
                onExtension = isIntersectionOnExtension(
                    t,
                    arcParam,
                    originalLine,
                    originalArc,
                    extensionLength,
                    line,
                    arc,
                    point
                );
            }

            results.push({
                point,
                param1: swapParams ? arcParam : snapParameter(t),
                param2: swapParams ? snapParameter(t) : arcParam,
                distance: 0,
                type: 'exact',
                confidence: 1.0,
                onExtension: onExtension,
            });
        }
    });

    return results;
}

/**
 * Find intersections between a line and an arc using quadratic formula
 * Supports bidirectional extension for gap intersection detection
 */
export function findLineArcIntersections(
    line: Line,
    arc: Arc,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH_MM
): IntersectionResult[] {
    // First try intersection with original shapes
    const originalResults: IntersectionResult[] = findLineArcIntersectionsCore(
        line,
        arc,
        swapParams
    );

    if (originalResults.length > 0 || !allowExtensions) {
        return originalResults;
    }

    // No intersections with original shapes and extensions allowed
    // Try all combinations of extended shapes
    const allExtensionResults: IntersectionResult[] = [];

    // Try 1: Extended line vs original arc
    try {
        const extendedLine: Line = createExtendedLine(line, extensionLength);
        const extendedLineResults: IntersectionResult[] =
            findLineArcIntersectionsCore(
                extendedLine,
                arc,
                swapParams,
                true,
                extensionLength,
                line
            );
        allExtensionResults.push(...extendedLineResults);
    } catch {
        // Line extension failed, skip
    }

    // Try 2: Original line vs extended arc
    try {
        const extendedArc: Arc = createExtendedArc(arc, extensionLength);
        const extendedArcResults: IntersectionResult[] =
            findLineArcIntersectionsCore(
                line,
                extendedArc,
                swapParams,
                true,
                extensionLength,
                undefined,
                arc
            );
        allExtensionResults.push(...extendedArcResults);
    } catch {
        // Arc extension failed, skip
    }

    // Try 3: Extended line vs extended arc (for maximum gap coverage)
    try {
        const extendedLine: Line = createExtendedLine(line, extensionLength);
        const extendedArc: Arc = createExtendedArc(arc, extensionLength);
        const bothExtendedResults: IntersectionResult[] =
            findLineArcIntersectionsCore(
                extendedLine,
                extendedArc,
                swapParams,
                true,
                extensionLength,
                line,
                arc
            );
        allExtensionResults.push(...bothExtendedResults);
    } catch {
        // Extension failed, skip
    }

    return allExtensionResults;
}

/**
 * Core intersection calculation between a line and an arc
 */
function findLineArcIntersectionsCore(
    line: Line,
    arc: Arc,
    swapParams: boolean = false,
    checkExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH_MM,
    originalLine?: Line,
    originalArc?: Arc
): IntersectionResult[] {
    return processLineArcIntersection(
        line,
        arc,
        swapParams,
        undefined,
        checkExtensions,
        originalLine,
        originalArc,
        extensionLength
    );
}

/**
 * Snap parameter to 0 or 1 if very close to endpoints
 */
export function snapParameter(t: number): number {
    if (t < EPSILON) return 0;
    if (t > 1 - EPSILON) return 1;
    return t;
}

/**
 * Check if an intersection is on an extension of the original shapes
 */
function isIntersectionOnExtension(
    lineParam: number,
    arcParam: number,
    originalLine?: Line,
    originalArc?: Arc,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH_MM,
    currentLine?: Line,
    currentArc?: Arc,
    intersectionPoint?: { x: number; y: number }
): boolean {
    const tolerance: number = INTERSECTION_TOLERANCE;
    let onExtension: boolean = false;

    // Check if on line extension
    if (originalLine && currentLine && currentLine !== originalLine) {
        const originalLineLength: number = Math.sqrt(
            Math.pow(originalLine.end.x - originalLine.start.x, 2) +
                Math.pow(originalLine.end.y - originalLine.start.y, 2)
        );
        const totalExtendedLength: number =
            2 * extensionLength + originalLineLength;
        const originalLineStart: number = extensionLength / totalExtendedLength;
        const originalLineEnd: number =
            (extensionLength + originalLineLength) / totalExtendedLength;

        const onLineExtension: boolean =
            lineParam < originalLineStart - tolerance ||
            lineParam > originalLineEnd + tolerance;
        onExtension = onExtension || onLineExtension;
    }

    // Check if on arc extension by checking if intersection point is on original arc
    if (
        originalArc &&
        currentArc &&
        currentArc !== originalArc &&
        intersectionPoint
    ) {
        const onOriginalArc: boolean = isPointOnArc(
            intersectionPoint,
            originalArc
        );
        onExtension = onExtension || !onOriginalArc;
    }

    return onExtension;
}

/**
 * Check if a parameter value is valid for a given segment position
 */
function isParameterValidForSegment(
    t: number,
    position: SegmentPosition
): boolean {
    const tolerance: number = EPSILON * PRECISION_TOLERANCE_MULTIPLIER; // Small tolerance for floating point precision

    switch (position) {
        case 'only':
            // Standalone segment - allow slight extension on both ends for chain offset
            return true;

        case 'first':
            // First segment - allow extension before start (t < 0), but not past end (t > 1)
            return t <= 1 + tolerance;

        case 'intermediate':
            // Intermediate segment - only allow intersections within bounds
            return t >= -tolerance && t <= 1 + tolerance;

        case 'last':
            // Last segment - allow extension past end (t > 1), but not before start (t < 0)
            return t >= -tolerance;

        default:
            return t >= -tolerance && t <= 1 + tolerance;
    }
}

/**
 * Find intersections between a line and an arc with segment position awareness
 */
export function findLineArcIntersectionsSegmentAware(
    line: Line,
    arc: Arc,
    segmentPosition: SegmentPosition = 'only',
    swapParams: boolean = false
): IntersectionResult[] {
    return processLineArcIntersection(line, arc, swapParams, segmentPosition);
}
