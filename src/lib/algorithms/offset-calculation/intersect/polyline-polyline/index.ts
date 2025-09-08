import type { Shape, Polyline, Line, Arc } from '../../../../types/geometry';
import type { IntersectionResult } from '../../chain/types';
import type { IntersectionType } from '../index';
// Import intersection functions from line-line module
import { findLineLineIntersectionsSegmentAware } from '../line-line/index';
import { type SegmentPosition } from '../line-arc/index';
// Import intersection function from intersect module
import { findIntersectionsByType } from '../index';
// Import polyline helper functions from the polyline-spline module
import { calculatePolylineParameter } from '../polyline-spline/helpers';

/**
 * Type guard to check if a segment is a Line
 */
function isLine(segment: Line | Arc): segment is Line {
    return 'start' in segment && 'end' in segment;
}

/**
 * Find intersections between two polylines
 */
export function findPolylinePolylineIntersections(
    shape1: Shape,
    shape2: Shape,
    intersectionType: IntersectionType = 'infinite'
): IntersectionResult[] {
    const polyline1: Polyline = shape1.geometry as Polyline;
    const polyline2: Polyline = shape2.geometry as Polyline;

    const segments1: (Line | Arc)[] = polyline1.shapes.map(
        (shape) => shape.geometry as Line | Arc
    );
    const segments2: (Line | Arc)[] = polyline2.shapes.map(
        (shape) => shape.geometry as Line | Arc
    );

    const results: IntersectionResult[] = [];

    // Check each segment of polyline1 against each segment of polyline2
    segments1.forEach((segment1, index1) => {
        segments2.forEach((segment2, index2) => {
            // Determine segment positions for proper intersection handling
            const segment1Position: SegmentPosition = getSegmentPosition(
                index1,
                segments1.length
            );
            const segment2Position: SegmentPosition = getSegmentPosition(
                index2,
                segments2.length
            );

            let segmentIntersections: IntersectionResult[] = [];

            // Use segment-aware intersection for line-line intersections
            if (isLine(segment1) && isLine(segment2)) {
                segmentIntersections = findLineLineIntersectionsSegmentAware(
                    segment1,
                    segment2,
                    segment1Position,
                    segment2Position,
                    intersectionType
                );
            } else {
                // For non-line segments, use the standard intersection logic
                // Create shape wrappers for the segments
                const shape1: Shape = {
                    id: `segment1-${index1}`,
                    type: isLine(segment1) ? 'line' : 'arc',
                    geometry: segment1,
                };
                const shape2: Shape = {
                    id: `segment2-${index2}`,
                    type: isLine(segment2) ? 'line' : 'arc',
                    geometry: segment2,
                };
                segmentIntersections = findIntersectionsByType(
                    shape1,
                    shape2,
                    false,
                    1000,
                    intersectionType
                );
            }

            segmentIntersections.forEach((intersection) => {
                const param1: number = calculatePolylineParameter(
                    index1,
                    intersection.param1,
                    segments1.length
                );
                const param2: number = calculatePolylineParameter(
                    index2,
                    intersection.param2,
                    segments2.length
                );

                results.push({
                    ...intersection,
                    param1,
                    param2,
                });
            });
        });
    });

    return results;
}

/**
 * Determine the position of a segment within a polyline
 */
function getSegmentPosition(
    index: number,
    totalSegments: number
): SegmentPosition {
    if (totalSegments === 1) {
        return 'only';
    } else if (index === 0) {
        return 'first';
    } else if (index === totalSegments - 1) {
        return 'last';
    } else {
        return 'intermediate';
    }
}
