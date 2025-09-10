/**
 * Chain Offset Module
 *
 * This module implements the main chain offsetting algorithm that:
 * 1. Generates offsets for all shapes in a chain
 * 2. Groups them by side (inner/outer for closed, left/right for open)
 * 3. Performs basic trimming and gap filling to create continuous chains
 */

import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import { isChainClosed } from '$lib/algorithms/part-detection';
import { generateId } from '$lib/utils/id';
import {
    validateSplineGeometry,
    type SplineValidationResult,
} from '$lib/utils/spline-validation-utils';
import type { Line, Circle, Polyline, Ellipse } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '$lib/types/geometry';
import { OffsetDirection } from '../offset/types';
import { findShapeIntersections } from '../intersect';
import { findPolylineSelfIntersections } from '../intersect/polyline/self';
import { polylineToPoints } from '$lib/geometry/polyline';
import { offsetShape } from '../offset/index';
import { trimConsecutiveShapes, pointDistance } from '../trim';
import type { TrimResult } from '../trim/types';
import { fillGapBetweenShapes } from '../fill';
import type { GapContext, FillResult } from '../fill/types';
import { detectChainSide } from './side-detection';
import {
    DEFAULT_CHAIN_OFFSET_PARAMETERS,
    type ChainOffsetParameters,
    type ChainOffsetResult,
    type IntersectionResult,
    type OffsetChain,
    type Shape,
    type TrimPoint,
    type GapFillingResult,
} from './types';

/**
 * Offset gap tolerance for gap filling calculations
 */
const OFFSET_GAP_TOLERANCE = 5.0;

/**
 * Polyline point scoring weight for optimization
 */
const POLYLINE_POINT_SCORING_WEIGHT = 10;

/**
 * Main entry point for chain offsetting
 *
 * @param chain - The original chain to offset
 * @param distance - Offset distance (positive = outward, negative = inward)
 * @param params - Parameters for the offset operation
 * @returns Result containing inner/outer or left/right offset chains
 */

/**
 * Process and validate offset shape before adding to results
 */
function processAndValidateOffsetShape(
    offsetShape: Shape,
    originalIndex: number,
    offset: number
): { shape: Shape; originalIndex: number; offset: number } {
    // Validate splines before adding to results
    if (offsetShape.type === 'spline') {
        const validation: SplineValidationResult = validateSplineGeometry(
            offsetShape.geometry as Spline
        );
        if (!validation.isValid && validation.repairedSpline) {
            offsetShape = {
                ...offsetShape,
                geometry: validation.repairedSpline,
            };
        }
    }

    return {
        shape: offsetShape,
        originalIndex: originalIndex,
        offset: offset,
    };
}

export function offsetChain(
    chain: Chain,
    distance: number,
    params: ChainOffsetParameters = DEFAULT_CHAIN_OFFSET_PARAMETERS
): ChainOffsetResult {
    const startTime: number = performance.now();
    const result: ChainOffsetResult = {
        success: false,
        warnings: [],
        errors: [],
    };

    try {
        // Step 1: Generate all possible shape offsets
        const allOffsets: Array<{
            shape: Shape;
            originalIndex: number;
            offset: number;
        }> = generateAllOffsets(chain, distance);

        if (allOffsets.length === 0) {
            result.errors.push('No valid offsets could be generated');
            return result;
        }

        // Step 2: Determine closure first (before grouping)
        // Check if input is a polyline with explicit closed flag - if so, respect it
        // Otherwise, use geometric analysis to determine closure
        let isClosed: boolean;
        if (
            'closed' in chain &&
            typeof (chain as Polyline).closed === 'boolean'
        ) {
            // Input is a polyline with explicit closed flag - respect it
            isClosed = (chain as Polyline).closed;
        } else {
            // Input is a regular chain - use geometric analysis
            isClosed = isChainClosed(chain, params.tolerance);
        }

        // Step 3: Group offsets by side using the corrected closure determination
        const groupedOffsets: {
            inner: Shape[];
            outer: Shape[];
            left: Shape[];
            right: Shape[];
        } = groupOffsetsBySide(allOffsets, chain, params.tolerance, isClosed);

        // Step 4: Process each group into continuous chains

        if (isClosed) {
            // For closed chains: inner and outer
            if (groupedOffsets.inner.length > 0) {
                result.innerChain = processOffsetGroup(
                    groupedOffsets.inner,
                    chain,
                    'inner',
                    params,
                    isClosed
                );
            }
            if (groupedOffsets.outer.length > 0) {
                result.outerChain = processOffsetGroup(
                    groupedOffsets.outer,
                    chain,
                    'outer',
                    params,
                    isClosed
                );
            }
        } else {
            // For open chains: left and right
            if (groupedOffsets.left.length > 0) {
                result.innerChain = processOffsetGroup(
                    groupedOffsets.left,
                    chain,
                    'left',
                    params,
                    isClosed
                );
            }
            if (groupedOffsets.right.length > 0) {
                result.outerChain = processOffsetGroup(
                    groupedOffsets.right,
                    chain,
                    'right',
                    params,
                    isClosed
                );
            }
        }

        result.success = true;

        // Add performance metrics
        const totalGapsFilled: number =
            (result.innerChain?.gapFills?.length || 0) +
            (result.outerChain?.gapFills?.length || 0);
        const totalIntersections: number =
            (result.innerChain?.intersectionPoints?.length || 0) +
            (result.outerChain?.intersectionPoints?.length || 0);

        result.metrics = {
            totalShapes: chain.shapes.length,
            intersectionsFound: totalIntersections,
            gapsFilled: totalGapsFilled,
            processingTimeMs: performance.now() - startTime,
        };
    } catch {
        result.errors.push(`Chain offset failed`);
    }

    return result;
}

/**
 * Generates all possible offsets for shapes in a chain
 */
export function generateAllOffsets(
    chain: Chain,
    distance: number
): Array<{ shape: Shape; originalIndex: number; offset: number }> {
    const allOffsets: Array<{
        shape: Shape;
        originalIndex: number;
        offset: number;
    }> = [];

    for (let i: number = 0; i < chain.shapes.length; i++) {
        const shape: Shape = chain.shapes[i];

        // For clockwise arcs in chains, we need to flip the offset directions
        // because clockwise arcs curve opposite to counter-clockwise arcs
        let positiveDirection: OffsetDirection = OffsetDirection.OUTSET;
        let negativeDirection: OffsetDirection = OffsetDirection.INSET;

        if (
            shape.type === 'arc' &&
            (shape.geometry as Arc).clockwise === true
        ) {
            // Flip directions for clockwise arcs
            positiveDirection = OffsetDirection.INSET;
            negativeDirection = OffsetDirection.OUTSET;
        }

        // Generate both positive and negative offsets
        const positiveResult: { success: boolean; shapes: Shape[] } =
            offsetShape(shape, Math.abs(distance), positiveDirection);
        const negativeResult: { success: boolean; shapes: Shape[] } =
            offsetShape(shape, Math.abs(distance), negativeDirection);

        // Validate and repair positive offset result
        if (positiveResult.success && positiveResult.shapes.length > 0) {
            const offsetData = processAndValidateOffsetShape(
                positiveResult.shapes[0],
                i,
                Math.abs(distance)
            );
            allOffsets.push(offsetData);
        }

        // Validate and repair negative offset result
        if (negativeResult.success && negativeResult.shapes.length > 0) {
            const offsetData = processAndValidateOffsetShape(
                negativeResult.shapes[0],
                i,
                -Math.abs(distance)
            );
            allOffsets.push(offsetData);
        }
    }

    return allOffsets;
}

/**
 * Groups offset shapes by their side relative to the original chain
 */
export function groupOffsetsBySide(
    offsets: Array<{ shape: Shape; originalIndex: number; offset: number }>,
    chain: Chain,
    tolerance: number,
    isClosed: boolean
): { inner: Shape[]; outer: Shape[]; left: Shape[]; right: Shape[] } {
    const groups: {
        inner: Shape[];
        outer: Shape[];
        left: Shape[];
        right: Shape[];
    } = {
        inner: [] as Shape[],
        outer: [] as Shape[],
        left: [] as Shape[],
        right: [] as Shape[],
    };

    // Group offsets by original shape index to ensure we have at most one per side
    const offsetsByShape: Map<
        number,
        Array<{ shape: Shape; originalIndex: number; offset: number }>
    > = new Map<
        number,
        Array<{ shape: Shape; originalIndex: number; offset: number }>
    >();

    for (const offsetData of offsets) {
        if (!offsetsByShape.has(offsetData.originalIndex)) {
            offsetsByShape.set(offsetData.originalIndex, []);
        }
        offsetsByShape.get(offsetData.originalIndex)!.push(offsetData);
    }

    // Process each original shape's offsets
    for (const [, shapeOffsets] of offsetsByShape) {
        // Sort by offset value (positive first, then negative)
        shapeOffsets.sort((a, b) => b.offset - a.offset);

        if (shapeOffsets.length >= 2) {
            // We have both positive and negative offsets
            const positiveOffset:
                | { shape: Shape; originalIndex: number; offset: number }
                | undefined = shapeOffsets.find((o) => o.offset > 0);
            const negativeOffset:
                | { shape: Shape; originalIndex: number; offset: number }
                | undefined = shapeOffsets.find((o) => o.offset < 0);

            if (positiveOffset && negativeOffset) {
                // Classify based on spatial detection, but ensure they go to different sides
                const positiveSide: {
                    side: 'inner' | 'outer' | 'left' | 'right';
                    confidence: number;
                } = detectChainSide(
                    positiveOffset.shape,
                    positiveOffset.offset,
                    chain,
                    tolerance,
                    isClosed
                );
                const negativeSide: {
                    side: 'inner' | 'outer' | 'left' | 'right';
                    confidence: number;
                } = detectChainSide(
                    negativeOffset.shape,
                    negativeOffset.offset,
                    chain,
                    tolerance,
                    isClosed
                );

                // CRITICAL: Ensure both offsets don't get classified as the same side
                // If both are classified as the same side, fix it by using the higher confidence one
                // and flipping the lower confidence one to the opposite side
                if (isClosed && positiveSide.side === negativeSide.side) {
                    if (positiveSide.confidence >= negativeSide.confidence) {
                        // Keep positive side, flip negative to opposite
                        const flippedNegativeSide: 'inner' | 'outer' =
                            positiveSide.side === 'inner' ? 'outer' : 'inner';
                        addToGroup(
                            groups,
                            positiveOffset.shape,
                            positiveSide.side
                        );
                        addToGroup(
                            groups,
                            negativeOffset.shape,
                            flippedNegativeSide
                        );
                    } else {
                        // Keep negative side, flip positive to opposite
                        const flippedPositiveSide: 'inner' | 'outer' =
                            negativeSide.side === 'inner' ? 'outer' : 'inner';
                        addToGroup(
                            groups,
                            positiveOffset.shape,
                            flippedPositiveSide
                        );
                        addToGroup(
                            groups,
                            negativeOffset.shape,
                            negativeSide.side
                        );
                    }
                } else {
                    // Use the detected sides as-is
                    addToGroup(groups, positiveOffset.shape, positiveSide.side);
                    addToGroup(groups, negativeOffset.shape, negativeSide.side);
                }
            }
        } else if (shapeOffsets.length === 1) {
            // Only one offset for this shape
            const offsetData: {
                shape: Shape;
                originalIndex: number;
                offset: number;
            } = shapeOffsets[0];
            const sideResult: {
                side: 'inner' | 'outer' | 'left' | 'right';
                confidence: number;
            } = detectChainSide(
                offsetData.shape,
                offsetData.offset,
                chain,
                tolerance,
                isClosed
            );
            addToGroup(groups, offsetData.shape, sideResult.side);
        }
    }

    return groups;
}

function addToGroup(
    groups: { inner: Shape[]; outer: Shape[]; left: Shape[]; right: Shape[] },
    shape: Shape,
    side: 'inner' | 'outer' | 'left' | 'right'
) {
    switch (side) {
        case 'inner':
            groups.inner.push(shape);
            break;
        case 'outer':
            groups.outer.push(shape);
            break;
        case 'left':
            groups.left.push(shape);
            break;
        case 'right':
            groups.right.push(shape);
            break;
    }
}

/**
 * Collects all intersections between consecutive offset shapes
 * This step is separated to ensure all intersections are found before any trimming operations
 */
function collectIntersections(
    shapes: Shape[],
    originalChain: Chain,
    params: ChainOffsetParameters,
    isClosed: boolean
): {
    allIntersections: Array<{
        index1: number;
        index2: number;
        intersections: IntersectionResult[];
    }>;
    intersectionPoints: IntersectionResult[];
} {
    const allIntersections: Array<{
        index1: number;
        index2: number;
        intersections: IntersectionResult[];
    }> = [];
    const intersectionPoints: IntersectionResult[] = [];

    // Find intersections for consecutive pairs
    for (let i: number = 0; i < shapes.length - 1; i++) {
        const shape1: Shape = shapes[i];
        const shape2: Shape = shapes[i + 1];

        const intersections: IntersectionResult[] = findShapeIntersections(
            shape1,
            shape2,
            params.tolerance,
            true,
            params.maxExtension,
            params.intersectionType || 'infinite'
        );

        allIntersections.push({ index1: i, index2: i + 1, intersections });
        intersectionPoints.push(...intersections);
    }

    // For closed chains, also find intersection between last and first shape
    if (isClosed && shapes.length > 2) {
        const lastShape: Shape = shapes[shapes.length - 1];
        const firstShape: Shape = shapes[0];

        const intersections: IntersectionResult[] = findShapeIntersections(
            lastShape,
            firstShape,
            params.tolerance,
            true,
            params.maxExtension,
            params.intersectionType || 'infinite'
        );

        allIntersections.push({
            index1: shapes.length - 1,
            index2: 0,
            intersections,
        });
        intersectionPoints.push(...intersections);
    }

    // If polylineIntersections flag is enabled, find self-intersections within polylines
    if (params.polylineIntersections) {
        for (let i: number = 0; i < shapes.length; i++) {
            const shape: Shape = shapes[i];
            if (shape.type === 'polyline') {
                const selfIntersections: IntersectionResult[] =
                    findPolylineSelfIntersections(
                        shape,
                        params.intersectionType
                    );
                intersectionPoints.push(...selfIntersections);
            }
        }
    }

    return { allIntersections, intersectionPoints };
}

/**
 * Applies trimming to offset shapes based on their intersections
 * This step creates sharp corners by trimming overlapping shapes
 */
function applyTrimming(
    shapes: Shape[],
    allIntersections: Array<{
        index1: number;
        index2: number;
        intersections: IntersectionResult[];
    }>,
    params: ChainOffsetParameters
): {
    processedShapes: Shape[];
    trimPoints: TrimPoint[];
    continuous: boolean;
} {
    const processedShapes: Shape[] = [...shapes];
    const trimPoints: TrimPoint[] = [];
    let continuous: boolean = true;

    // Apply trimming using the collected intersections
    for (const { index1, index2, intersections } of allIntersections) {
        if (intersections.length > 0) {
            // Apply trimming to create sharp corners
            const shape1: Shape = processedShapes[index1];
            const shape2: Shape = processedShapes[index2];
            const trimResult: {
                shape1Result: TrimResult;
                shape2Result: TrimResult;
            } = trimConsecutiveShapes(
                shape1,
                shape2,
                intersections,
                params.tolerance
            );

            if (
                trimResult.shape1Result.success &&
                trimResult.shape2Result.success
            ) {
                // Calculate trim amounts before replacing shapes
                const trim1Amount: number = calculateTrimAmount(
                    shape1,
                    trimResult.shape1Result.shape!
                );
                const trim2Amount: number = calculateTrimAmount(
                    shape2,
                    trimResult.shape2Result.shape!
                );

                // Replace shapes with trimmed versions
                processedShapes[index1] = trimResult.shape1Result.shape!;
                processedShapes[index2] = trimResult.shape2Result.shape!;

                // Record the trim point with actual trim amounts
                const intersection: IntersectionResult = intersections[0]; // Use first intersection for recording
                trimPoints.push({
                    point: intersection.point,
                    shape1Index: index1,
                    shape2Index: index2,
                    trim1Amount,
                    trim2Amount,
                    cornerType:
                        intersection.type === 'tangent' ? 'tangent' : 'sharp',
                });
            } else {
                // Trimming failed
                continuous = false;
            }
        } else {
            // No intersections found - shapes don't connect properly
            continuous = false;
        }
    }

    return { processedShapes, trimPoints, continuous };
}

/**
 * Apply gap filling to offset shapes where gaps exist between consecutive shapes
 * This step extends shapes to their intersection points to eliminate gaps
 */
function applyGapFilling(
    shapes: Shape[],
    params: ChainOffsetParameters,
    isClosed: boolean
): {
    processedShapes: Shape[];
    gapFills: GapFillingResult[];
    continuous: boolean;
} {
    const processedShapes: Shape[] = [...shapes];
    const gapFills: GapFillingResult[] = [];
    let continuous: boolean = true;

    // Process consecutive pairs of shapes
    for (let i: number = 0; i < shapes.length - 1; i++) {
        const shape1: Shape = processedShapes[i];
        const shape2: Shape = processedShapes[i + 1];

        const gapInfo: {
            hasGap: boolean;
            gapSize: number;
            endpoint1: { x: number; y: number };
            startpoint2: { x: number; y: number };
        } = detectGap(shape1, shape2, params.tolerance);
        if (gapInfo.hasGap && gapInfo.gapSize <= params.maxExtension) {
            // Try to fill the gap
            const gapContext: GapContext = {
                shape1,
                shape2,
                gapSize: gapInfo.gapSize,
                gapLocation: {
                    point1: gapInfo.endpoint1,
                    point2: gapInfo.startpoint2,
                },
                shape1Index: i,
                shape2Index: i + 1,
                isClosedChain: isClosed,
            };

            const fillResult: {
                shape1Result: FillResult;
                shape2Result: FillResult;
            } = fillGapBetweenShapes(gapContext, {
                maxExtension: params.maxExtension,
                tolerance: params.tolerance,
                extendDirection: 'auto',
            });

            if (
                fillResult.shape1Result.success &&
                fillResult.shape2Result.success
            ) {
                // Update shapes with filled versions
                processedShapes[i] = fillResult.shape1Result.extendedShape!;
                processedShapes[i + 1] = fillResult.shape2Result.extendedShape!;

                // Record the gap fill
                gapFills.push({
                    method: 'extend',
                    fillerShape: undefined, // No new shape created, existing shapes extended
                    modifiedShapes: [
                        { original: shape1, modified: processedShapes[i] },
                        { original: shape2, modified: processedShapes[i + 1] },
                    ],
                    gapSize: gapInfo.gapSize,
                    gapLocation: {
                        shape1Index: i,
                        shape2Index: i + 1,
                        point: {
                            x:
                                (gapInfo.endpoint1.x + gapInfo.startpoint2.x) /
                                2,
                            y:
                                (gapInfo.endpoint1.y + gapInfo.startpoint2.y) /
                                2,
                        },
                    },
                });
            } else {
                // Gap filling failed
                continuous = false;
            }
        } else if (gapInfo.hasGap) {
            // Gap too large to fill
            continuous = false;
        }
    }

    // For closed chains, also check gap between last and first shape
    if (isClosed && shapes.length > 2) {
        const lastShape: Shape = processedShapes[processedShapes.length - 1];
        const firstShape: Shape = processedShapes[0];

        const gapInfo: {
            hasGap: boolean;
            gapSize: number;
            endpoint1: { x: number; y: number };
            startpoint2: { x: number; y: number };
        } = detectGap(lastShape, firstShape, params.tolerance);
        if (gapInfo.hasGap && gapInfo.gapSize <= params.maxExtension) {
            const gapContext: GapContext = {
                shape1: lastShape,
                shape2: firstShape,
                gapSize: gapInfo.gapSize,
                gapLocation: {
                    point1: gapInfo.endpoint1,
                    point2: gapInfo.startpoint2,
                },
                shape1Index: shapes.length - 1,
                shape2Index: 0,
                isClosedChain: isClosed,
            };

            const fillResult: {
                shape1Result: FillResult;
                shape2Result: FillResult;
            } = fillGapBetweenShapes(gapContext, {
                maxExtension: params.maxExtension,
                tolerance: params.tolerance,
                extendDirection: 'auto',
            });

            if (
                fillResult.shape1Result.success &&
                fillResult.shape2Result.success
            ) {
                processedShapes[shapes.length - 1] =
                    fillResult.shape1Result.extendedShape!;
                processedShapes[0] = fillResult.shape2Result.extendedShape!;

                gapFills.push({
                    method: 'extend',
                    fillerShape: undefined,
                    modifiedShapes: [
                        {
                            original: lastShape,
                            modified: processedShapes[shapes.length - 1],
                        },
                        { original: firstShape, modified: processedShapes[0] },
                    ],
                    gapSize: gapInfo.gapSize,
                    gapLocation: {
                        shape1Index: shapes.length - 1,
                        shape2Index: 0,
                        point: {
                            x:
                                (gapInfo.endpoint1.x + gapInfo.startpoint2.x) /
                                2,
                            y:
                                (gapInfo.endpoint1.y + gapInfo.startpoint2.y) /
                                2,
                        },
                    },
                });
            } else {
                continuous = false;
            }
        } else if (gapInfo.hasGap) {
            continuous = false;
        }
    }

    return { processedShapes, gapFills, continuous };
}

/**
 * Detect if there's a gap between two consecutive shapes
 */
function detectGap(
    shape1: Shape,
    shape2: Shape,
    tolerance: number
): {
    hasGap: boolean;
    gapSize: number;
    endpoint1: { x: number; y: number };
    startpoint2: { x: number; y: number };
} {
    const endpoint1: { x: number; y: number } = getShapeEndpoint(shape1, 'end');
    const startpoint2: { x: number; y: number } = getShapeEndpoint(
        shape2,
        'start'
    );

    const distance: number = pointDistance(endpoint1, startpoint2);

    return {
        hasGap: distance > tolerance,
        gapSize: distance,
        endpoint1,
        startpoint2,
    };
}

/**
 * Get the start or end point of any shape type
 */
function getShapeEndpoint(
    shape: Shape,
    endpoint: 'start' | 'end'
): { x: number; y: number } {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return endpoint === 'start' ? line.start : line.end;
        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            const angle: number =
                endpoint === 'start' ? arc.startAngle : arc.endAngle;
            return {
                x: arc.center.x + arc.radius * Math.cos(angle),
                y: arc.center.y + arc.radius * Math.sin(angle),
            };
        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            // For circles, return a point on the circle (arbitrary choice)
            return {
                x: circle.center.x + circle.radius,
                y: circle.center.y,
            };
        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            const points: Array<{ x: number; y: number }> =
                polylineToPoints(polyline);
            return endpoint === 'start' ? points[0] : points[points.length - 1];
        case GeometryType.SPLINE:
            // For splines, use the first or last control point as approximation
            const spline: Spline = shape.geometry as Spline;
            const controlPoints: Array<{ x: number; y: number }> =
                spline.controlPoints || [];
            if (controlPoints.length === 0) return { x: 0, y: 0 };
            return endpoint === 'start'
                ? controlPoints[0]
                : controlPoints[controlPoints.length - 1];
        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // For ellipses, return a point on the ellipse (arbitrary choice)
            // Calculate major axis radius from the majorAxisEndpoint vector
            const majorAxisRadius: number = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            return {
                x: ellipse.center.x + majorAxisRadius,
                y: ellipse.center.y,
            };
        default:
            // For unsupported types, return origin
            return { x: 0, y: 0 };
    }
}

/**
 * Calculate the amount of geometry removed during trimming
 * Returns a rough estimate of the trimmed amount in units
 */
function calculateTrimAmount(
    originalShape: Shape,
    trimmedShape: Shape
): number {
    try {
        switch (originalShape.type) {
            case GeometryType.LINE: {
                const original: Line = originalShape.geometry as Line;
                const trimmed: Line = trimmedShape.geometry as Line;

                const originalLength: number = Math.sqrt(
                    Math.pow(original.end.x - original.start.x, 2) +
                        Math.pow(original.end.y - original.start.y, 2)
                );

                const trimmedLength: number = Math.sqrt(
                    Math.pow(trimmed.end.x - trimmed.start.x, 2) +
                        Math.pow(trimmed.end.y - trimmed.start.y, 2)
                );

                return Math.abs(originalLength - trimmedLength);
            }

            case GeometryType.ARC: {
                const original: Arc = originalShape.geometry as Arc;
                const trimmed: Arc = trimmedShape.geometry as Arc;

                const originalAngleRange: number = Math.abs(
                    original.endAngle - original.startAngle
                );
                const trimmedAngleRange: number = Math.abs(
                    trimmed.endAngle - trimmed.startAngle
                );

                const arcLengthDiff: number =
                    Math.abs(originalAngleRange - trimmedAngleRange) *
                    original.radius;
                return arcLengthDiff;
            }

            case GeometryType.POLYLINE: {
                const original: Polyline = originalShape.geometry as Polyline;
                const trimmed: Polyline = trimmedShape.geometry as Polyline;

                // Rough estimate based on point count difference
                const originalPoints: Array<{ x: number; y: number }> =
                    polylineToPoints(original);
                const trimmedPoints: Array<{ x: number; y: number }> =
                    polylineToPoints(trimmed);
                const pointCountDiff: number = Math.abs(
                    originalPoints.length - trimmedPoints.length
                );
                return pointCountDiff * POLYLINE_POINT_SCORING_WEIGHT; // Arbitrary units
            }

            default:
                // For other shape types (spline, ellipse, circle), return a conservative estimate
                return OFFSET_GAP_TOLERANCE;
        }
    } catch {
        // If calculation fails, return a default value
        return 1.0;
    }
}

/**
 * Processes a group of offset shapes into a continuous chain
 * Enhanced implementation with intersection detection and optional trimming for sharp corners
 */
function processOffsetGroup(
    shapes: Shape[],
    originalChain: Chain,
    side: 'inner' | 'outer' | 'left' | 'right',
    params: ChainOffsetParameters,
    isClosed: boolean
): OffsetChain {
    let processedShapes: Shape[] = [...shapes]; // Copy to avoid modifying input
    let trimPoints: TrimPoint[] = [];
    let continuous: boolean = true; // Assume continuous until proven otherwise

    try {
        // Step 1: Collect all intersections between consecutive offset shapes
        const {
            allIntersections,
            intersectionPoints,
        }: {
            allIntersections: Array<{
                index1: number;
                index2: number;
                intersections: IntersectionResult[];
            }>;
            intersectionPoints: IntersectionResult[];
        } = collectIntersections(shapes, originalChain, params, isClosed);

        // Step 2: Apply trimming to create sharp corners
        const trimmingResult: {
            processedShapes: Shape[];
            trimPoints: TrimPoint[];
            continuous: boolean;
        } = applyTrimming(processedShapes, allIntersections, params);
        processedShapes = trimmingResult.processedShapes;
        trimPoints = trimmingResult.trimPoints;
        continuous = trimmingResult.continuous;

        // Step 3: Apply gap filling where trimming failed or gaps exist
        const gapFillingResult: {
            processedShapes: Shape[];
            gapFills: GapFillingResult[];
            continuous: boolean;
        } = applyGapFilling(processedShapes, params, isClosed);
        processedShapes = gapFillingResult.processedShapes;
        continuous = continuous && gapFillingResult.continuous;

        return {
            id: generateId(),
            originalChainId: originalChain.id,
            side,
            shapes: processedShapes,
            closed: isClosed,
            continuous,
            gapFills: gapFillingResult.gapFills,
            trimPoints,
            intersectionPoints,
        };
    } catch {
        // If intersection collection fails, fallback to using original shapes
        continuous = false;

        return {
            id: generateId(),
            originalChainId: originalChain.id,
            side,
            shapes: processedShapes,
            closed: isClosed,
            continuous,
            gapFills: [], // Will be populated in Phase 3.2 (Stitching)
            trimPoints,
            intersectionPoints: [], // Empty intersection points on error
        };
    }
}
