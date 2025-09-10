import type { Polyline } from '$lib/geometry/polyline';
import type { Line } from '$lib/geometry/line';
import type { Arc } from '$lib/geometry/arc';
import type { IntersectionResult } from '../../chain/types';
import { createExtendedPolyline } from '../../extend/polyline';
import { createExtendedArc } from '../../extend/arc';
import { findLineArcIntersections } from '../line-arc';
import { isPointOnArc } from '../../../intersection-arc-utils';
import { EPSILON, INTERSECTION_TOLERANCE } from '../../../../constants';
import { DEFAULT_EXTENSION_LENGTH } from '../../../../geometry/constants';

/**
 * Type guard to check if a segment is a Line
 */
function isLine(segment: Line | Arc): segment is Line {
    return 'start' in segment && 'end' in segment;
}

/**
 * Type guard to check if a segment is an Arc
 */
function isArc(segment: Line | Arc): segment is Arc {
    return 'center' in segment && 'radius' in segment;
}

/**
 * Find intersections between a polyline and an arc
 * Supports bidirectional extension for gap intersection detection
 */
export function findPolylineArcIntersections(
    polyline: Polyline,
    arc: Arc,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    // First try intersection with original shapes
    const originalResults: IntersectionResult[] =
        findPolylineArcIntersectionsCore(polyline, arc, swapParams);

    if (originalResults.length > 0 || !allowExtensions) {
        return originalResults;
    }

    // No intersections with original shapes and extensions allowed
    // Try all combinations of extended shapes
    const allExtensionResults: IntersectionResult[] = [];

    // Try 1: Extended polyline vs original arc
    try {
        const extendedPolyline: Polyline = createExtendedPolyline(
            polyline,
            true,
            true,
            extensionLength
        );
        const extendedPolylineResults: IntersectionResult[] =
            findPolylineArcIntersectionsCore(
                extendedPolyline,
                arc,
                swapParams,
                true,
                extensionLength,
                polyline
            );
        allExtensionResults.push(...extendedPolylineResults);
    } catch {
        // Polyline extension failed, skip
    }

    // Try 2: Original polyline vs extended arc
    try {
        const extendedArc: Arc = createExtendedArc(arc, extensionLength);
        const extendedArcResults: IntersectionResult[] =
            findPolylineArcIntersectionsCore(
                polyline,
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

    // Try 3: Extended polyline vs extended arc (for maximum gap coverage)
    try {
        const extendedPolyline: Polyline = createExtendedPolyline(
            polyline,
            true,
            true,
            extensionLength
        );
        const extendedArc: Arc = createExtendedArc(arc, extensionLength);
        const bothExtendedResults: IntersectionResult[] =
            findPolylineArcIntersectionsCore(
                extendedPolyline,
                extendedArc,
                swapParams,
                true,
                extensionLength,
                polyline,
                arc
            );
        allExtensionResults.push(...bothExtendedResults);
    } catch {
        // Extension failed, skip
    }

    return allExtensionResults;
}

/**
 * Core intersection calculation between a polyline and an arc
 */
function findPolylineArcIntersectionsCore(
    polyline: Polyline,
    arc: Arc,
    swapParams: boolean = false,
    checkExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH,
    originalPolyline?: Polyline,
    originalArc?: Arc
): IntersectionResult[] {
    const results: IntersectionResult[] = [];
    const segments: (Line | Arc)[] =
        polyline.shapes?.map((shape) => shape.geometry as Line | Arc) || [];

    // Find intersections between each polyline segment and the arc
    segments.forEach((segment, segmentIndex) => {
        let segmentIntersections: IntersectionResult[];

        if (isLine(segment)) {
            if (checkExtensions) {
                // For extensions, use the full extension-aware method
                segmentIntersections = findLineArcIntersections(
                    segment,
                    arc,
                    false, // We'll handle parameter swapping ourselves
                    false, // Don't do more extensions
                    extensionLength
                );
            } else {
                // For non-extensions, use strict bounds checking
                segmentIntersections = findLineArcIntersections(
                    segment,
                    arc,
                    false, // We'll handle parameter swapping ourselves
                    false, // No extensions
                    0
                ).filter((intersection) => {
                    // Only include intersections within strict [0,1] bounds
                    return (
                        intersection.param1 >= -EPSILON &&
                        intersection.param1 <= 1 + EPSILON
                    );
                });
            }
        } else if (isArc(segment)) {
            // For arc segments, use arc-arc intersection (would need to implement this separately)
            // For now, treat as line by using segment endpoints
            const lineSegment: Line = {
                start: getArcStartPoint(segment),
                end: getArcEndPoint(segment),
            };

            if (checkExtensions) {
                segmentIntersections = findLineArcIntersections(
                    lineSegment,
                    arc,
                    false,
                    false,
                    extensionLength
                );
            } else {
                segmentIntersections = findLineArcIntersections(
                    lineSegment,
                    arc,
                    false,
                    false,
                    0
                ).filter((intersection) => {
                    // Only include intersections within strict [0,1] bounds
                    return (
                        intersection.param1 >= -EPSILON &&
                        intersection.param1 <= 1 + EPSILON
                    );
                });
            }
        } else {
            // Unsupported segment type
            segmentIntersections = [];
        }

        // Adjust parameters for polyline context and check extensions
        segmentIntersections.forEach((intersection) => {
            // Calculate parameter on the polyline (across all segments)
            const polylineParam: number = calculatePolylineParameter(
                segmentIndex,
                intersection.param1,
                segments.length
            );

            // Determine if intersection is on extension
            let onExtension: boolean = false;
            if (checkExtensions && (originalPolyline || originalArc)) {
                onExtension = isIntersectionOnExtension(
                    polylineParam,
                    intersection.param2,
                    originalPolyline,
                    originalArc,
                    polyline,
                    arc,
                    intersection.point
                );
            }

            results.push({
                ...intersection,
                param1: swapParams ? intersection.param2 : polylineParam,
                param2: swapParams ? polylineParam : intersection.param2,
                onExtension: onExtension,
            });
        });
    });

    return results;
}

/**
 * Calculate parameter position on polyline from segment index and segment parameter
 */
function calculatePolylineParameter(
    segmentIndex: number,
    segmentParam: number,
    totalSegments: number
): number {
    // Simple approach: distribute parameters evenly across segments
    const baseParam: number = segmentIndex / totalSegments;
    const segmentLength: number = 1.0 / totalSegments;
    return baseParam + segmentParam * segmentLength;
}

/**
 * Check if an intersection is on an extension of the original shapes
 */
function isIntersectionOnExtension(
    polylineParam: number,
    arcParam: number,
    originalPolyline?: Polyline,
    originalArc?: Arc,
    currentPolyline?: Polyline,
    currentArc?: Arc,
    intersectionPoint?: { x: number; y: number }
): boolean {
    const tolerance: number = INTERSECTION_TOLERANCE;
    let onExtension: boolean = false;

    // Check if on polyline extension
    if (
        originalPolyline &&
        currentPolyline &&
        currentPolyline !== originalPolyline
    ) {
        // For extended polylines, check if parameter is outside original bounds
        // Original polyline occupies the middle portion of the extended polyline
        const originalSegments: (Line | Arc)[] = originalPolyline.shapes.map(
            (shape) => shape.geometry as Line | Arc
        );
        const extendedSegments: (Line | Arc)[] = currentPolyline.shapes.map(
            (shape) => shape.geometry as Line | Arc
        );

        // If we added segments at start/end, the original polyline is in the middle
        const addedAtStart: number =
            extendedSegments.length > originalSegments.length ? 1 : 0;
        const originalStart: number = addedAtStart / extendedSegments.length;
        const originalEnd: number =
            (addedAtStart + originalSegments.length) / extendedSegments.length;

        const onPolylineExtension: boolean =
            polylineParam < originalStart - tolerance ||
            polylineParam > originalEnd + tolerance;
        onExtension = onExtension || onPolylineExtension;
    }

    // Check if on arc extension using the same logic as line-arc intersection
    if (
        originalArc &&
        currentArc &&
        currentArc !== originalArc &&
        intersectionPoint
    ) {
        // Use the arc point checking function
        const onOriginalArc: boolean = isPointOnArc(
            intersectionPoint,
            originalArc
        );
        onExtension = onExtension || !onOriginalArc;
    }

    // If we have no original shapes, this intersection is definitely on an extension
    if (!originalPolyline && !originalArc && (currentPolyline || currentArc)) {
        onExtension = true;
    }

    return onExtension;
}

/**
 * Get start point of an arc
 */
function getArcStartPoint(arc: Arc): { x: number; y: number } {
    const { center, radius, startAngle } = arc;
    return {
        x: center.x + radius * Math.cos(startAngle),
        y: center.y + radius * Math.sin(startAngle),
    };
}

/**
 * Get end point of an arc
 */
function getArcEndPoint(arc: Arc): { x: number; y: number } {
    const { center, radius, endAngle } = arc;
    return {
        x: center.x + radius * Math.cos(endAngle),
        y: center.y + radius * Math.sin(endAngle),
    };
}
