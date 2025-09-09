import {
    type Shape,
    type Polyline,
    type Line,
    type Arc,
    type Point2D,
    GeometryType,
} from '../../../../../lib/types/geometry';
import type {
    IntersectionResult,
    PolylineSelfIntersection,
} from '../../chain/types';
import {
    findIntersectionsByType,
    type IntersectionType,
    DEFAULT_INTERSECTION_TYPE,
} from '../index';
import { POLYGON_POINTS_MIN } from '$lib/geometry/constants';
import { calculatePolylineParameter } from '../polyline-spline/helpers';
import { EPSILON } from '$lib/constants';

/**
 * Algorithm selection threshold based on segment count
 */
const POLYLINE_ALGORITHM_SWITCH_THRESHOLD = 20;

/**
 * Self-Intersection Detection for Polylines
 *
 * This module implements efficient self-intersection detection within individual polylines.
 * Uses a modified sweep line algorithm optimized for polylines to find all points where
 * the polyline crosses itself.
 *
 * Key features:
 * - Skips adjacent segments (they naturally connect)
 * - Handles both line and arc segments
 * - Returns intersection results with proper parameter mapping
 * - Optimized for performance with large polylines
 */

/**
 * Event type for sweep line algorithm
 */
interface SweepEvent {
    x: number;
    y: number;
    segmentIndex: number;
    isStart: boolean;
    segment: Line | Arc;
}

/**
 * Type guard to check if a segment is a Line
 */
function isLine(segment: Line | Arc): segment is Line {
    return 'start' in segment && 'end' in segment;
}

/**
 * Extract start and end points from a segment
 */
function getSegmentEndpoints(segment: Line | Arc): {
    start: Point2D;
    end: Point2D;
} {
    if (isLine(segment)) {
        return { start: segment.start, end: segment.end };
    } else {
        // For arc, calculate start and end points from center, radius, and angles
        const { center, radius, startAngle, endAngle } = segment;
        const start: Point2D = {
            x: center.x + radius * Math.cos(startAngle),
            y: center.y + radius * Math.sin(startAngle),
        };
        const end: Point2D = {
            x: center.x + radius * Math.cos(endAngle),
            y: center.y + radius * Math.sin(endAngle),
        };
        return { start, end };
    }
}

/**
 * Find all self-intersections within a polyline
 *
 * Uses a sweep line algorithm to efficiently detect intersections between
 * non-adjacent segments of the polyline.
 *
 * @param polylineShape Shape containing the polyline geometry
 * @param intersectionType Type of intersections to detect ('true' or 'infinite')
 * @returns Array of intersection results with polyline parameters
 */
export function findPolylineSelfIntersections(
    polylineShape: Shape,
    intersectionType: IntersectionType = DEFAULT_INTERSECTION_TYPE
): PolylineSelfIntersection[] {
    if (polylineShape.type !== 'polyline') {
        throw new Error('Shape must be of type polyline');
    }

    const polyline: Polyline = polylineShape.geometry as Polyline;
    const segments: (Line | Arc)[] = polyline.shapes.map(
        (shape) => shape.geometry as Line | Arc
    );

    if (segments.length < POLYGON_POINTS_MIN) {
        // Need at least 3 segments to have non-adjacent intersections
        return [];
    }

    // Use brute force approach for small polylines (more efficient than sweep line overhead)
    if (segments.length < POLYLINE_ALGORITHM_SWITCH_THRESHOLD) {
        return findSelfIntersectionsBruteForce(segments, intersectionType);
    }

    // Use sweep line algorithm for larger polylines
    return findSelfIntersectionsSweepLine(segments, intersectionType);
}

/**
 * Brute force self-intersection detection for small polylines
 * Checks all pairs of non-adjacent segments
 */
function findSelfIntersectionsBruteForce(
    segments: (Line | Arc)[],
    intersectionType: IntersectionType
): PolylineSelfIntersection[] {
    const results: PolylineSelfIntersection[] = [];

    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 2; j < segments.length; j++) {
            // Skip if segments are adjacent or if checking last segment with first
            if (isAdjacentInPolyline(i, j, segments.length)) {
                continue;
            }

            const segment1 = segments[i];
            const segment2 = segments[j];

            const segmentIntersections = findSegmentSegmentIntersections(
                segment1,
                i,
                segments.length,
                segment2,
                j,
                segments.length,
                intersectionType
            );

            // Convert segment parameters to polyline parameters
            segmentIntersections.forEach((intersection) => {
                const param1 = calculatePolylineParameter(
                    i,
                    intersection.param1,
                    segments.length
                );
                const param2 = calculatePolylineParameter(
                    j,
                    intersection.param2,
                    segments.length
                );

                results.push({
                    ...intersection,
                    param1,
                    param2,
                });
            });
        }
    }

    return results;
}

/**
 * Sweep line self-intersection detection for larger polylines
 * More efficient for complex polylines with many segments
 */
function findSelfIntersectionsSweepLine(
    segments: (Line | Arc)[],
    intersectionType: IntersectionType
): PolylineSelfIntersection[] {
    const results: PolylineSelfIntersection[] = [];

    // Create events for all segment endpoints
    const events: SweepEvent[] = [];

    segments.forEach((segment, index) => {
        const { start, end } = getSegmentEndpoints(segment);

        events.push({
            x: start.x,
            y: start.y,
            segmentIndex: index,
            isStart: true,
            segment,
        });

        events.push({
            x: end.x,
            y: end.y,
            segmentIndex: index,
            isStart: false,
            segment,
        });
    });

    // Sort events by x-coordinate, then by y-coordinate
    events.sort((a, b) => {
        const dx = a.x - b.x;
        if (Math.abs(dx) > EPSILON) return dx;
        return a.y - b.y;
    });

    // Active segments (currently intersected by sweep line)
    const activeSegments = new Set<number>();

    // Process events
    for (const event of events) {
        if (event.isStart) {
            // Add segment to active set and check intersections with all active segments
            for (const activeIndex of activeSegments) {
                if (
                    isAdjacentInPolyline(
                        event.segmentIndex,
                        activeIndex,
                        segments.length
                    )
                ) {
                    continue;
                }

                const intersections = findSegmentSegmentIntersections(
                    event.segment,
                    event.segmentIndex,
                    segments.length,
                    segments[activeIndex],
                    activeIndex,
                    segments.length,
                    intersectionType
                );

                intersections.forEach((intersection) => {
                    const param1 = calculatePolylineParameter(
                        event.segmentIndex,
                        intersection.param1,
                        segments.length
                    );
                    const param2 = calculatePolylineParameter(
                        activeIndex,
                        intersection.param2,
                        segments.length
                    );

                    results.push({
                        ...intersection,
                        param1,
                        param2,
                    });
                });
            }

            activeSegments.add(event.segmentIndex);
        } else {
            // Remove segment from active set
            activeSegments.delete(event.segmentIndex);
        }
    }

    return results;
}

/**
 * Check if two segment indices are adjacent in the polyline
 * Adjacent segments naturally connect and should not be checked for intersection
 */
function isAdjacentInPolyline(
    index1: number,
    index2: number,
    totalSegments: number
): boolean {
    // Consecutive segments
    if (Math.abs(index1 - index2) === 1) {
        return true;
    }

    // First and last segments in closed polyline
    if (
        (index1 === 0 && index2 === totalSegments - 1) ||
        (index2 === 0 && index1 === totalSegments - 1)
    ) {
        return true;
    }

    return false;
}

/**
 * Find intersections between two specific segments using existing intersection infrastructure
 */
function findSegmentSegmentIntersections(
    segment1: Line | Arc,
    index1: number,
    totalSegments: number,
    segment2: Line | Arc,
    index2: number,
    totalSegments2: number,
    intersectionType: IntersectionType
): IntersectionResult[] {
    // Create shape wrappers for the segments
    const shape1: Shape = {
        id: `segment-${index1}`,
        type: isLine(segment1) ? GeometryType.LINE : GeometryType.ARC,
        geometry: segment1,
    };

    const shape2: Shape = {
        id: `segment-${index2}`,
        type: isLine(segment2) ? GeometryType.LINE : GeometryType.ARC,
        geometry: segment2,
    };

    // Use existing intersection infrastructure
    return findIntersectionsByType(shape1, shape2, false, 0, intersectionType);
}

/**
 * Check if a polyline has any self-intersections
 * Fast check that returns true/false without finding specific intersection points
 *
 * @param polylineShape Shape containing the polyline geometry
 * @returns True if the polyline has self-intersections
 */
export function hasPolylineSelfIntersections(polylineShape: Shape): boolean {
    if (polylineShape.type !== 'polyline') {
        return false;
    }

    const polyline: Polyline = polylineShape.geometry as Polyline;
    const segments: (Line | Arc)[] = polyline.shapes.map(
        (shape) => shape.geometry as Line | Arc
    );

    if (segments.length < POLYGON_POINTS_MIN) {
        return false;
    }

    // Use the same algorithm but return early on first intersection found
    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 2; j < segments.length; j++) {
            if (isAdjacentInPolyline(i, j, segments.length)) {
                continue;
            }

            const intersections = findSegmentSegmentIntersections(
                segments[i],
                i,
                segments.length,
                segments[j],
                j,
                segments.length,
                DEFAULT_INTERSECTION_TYPE
            );

            if (intersections.length > 0) {
                return true; // Early exit on first intersection
            }
        }
    }

    return false;
}
