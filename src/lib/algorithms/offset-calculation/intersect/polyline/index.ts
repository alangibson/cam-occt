import {
    type Shape,
    type Polyline,
    type Line,
    type Arc,
    type Circle,
    GeometryType,
} from '../../../../../lib/types/geometry';
import type { IntersectionResult } from '../../chain/types';
import type { SegmentPosition } from '../line-arc/index';
import type { IntersectionType } from '../index';
import { DEFAULT_EXTENSION_LENGTH } from '../../../../geometry/constants';
// Import intersection functions from intersect module
import { findIntersectionsByType } from '../index';
// Import line-line intersection from dedicated module
import { findLineLineIntersectionsSegmentAware } from '../line-line/index';
// Import line-arc intersection utilities
import { findLineArcIntersectionsSegmentAware } from '../line-arc/index';
// Import line-circle intersection utilities
import { findLineCircleIntersectionsSegmentAware } from '../line-circle/index';
// Import polyline helper functions from the polyline-spline module
import { calculatePolylineParameter } from '../polyline-spline/helpers';
// Import polyline-polyline intersection from dedicated module
import { findPolylinePolylineIntersections } from '../polyline-polyline/index';

/**
 * Type guard to check if a segment is a Line
 */
function isLine(segment: Line | Arc): segment is Line {
    return 'start' in segment && 'end' in segment;
}

/**
 * Find intersections involving polylines (treat as multi-segment lines)
 */
export function findPolylineIntersections(
    shape1: Shape,
    shape2: Shape,
    intersectionType: IntersectionType = 'infinite'
): IntersectionResult[] {
    const results: IntersectionResult[] = [];

    // Determine which shape is the polyline and which is the other
    const polylineShape: Shape = shape1.type === 'polyline' ? shape1 : shape2;
    const otherShape: Shape = shape1.type === 'polyline' ? shape2 : shape1;
    const swapParams: boolean = shape1.type !== 'polyline';

    if (polylineShape.type !== 'polyline') {
        // Both are polylines
        return findPolylinePolylineIntersections(
            shape1,
            shape2,
            intersectionType
        );
    }

    const polyline: Polyline = polylineShape.geometry as Polyline;
    const segments: (Line | Arc)[] = polyline.shapes.map(
        (shape) => shape.geometry as Line | Arc
    );

    // Find intersections between each segment and the other shape
    segments.forEach((segment, segmentIndex) => {
        // Determine segment position
        let segmentPosition: SegmentPosition;
        if (segments.length === 1) {
            segmentPosition = 'only';
        } else if (segmentIndex === 0) {
            segmentPosition = 'first';
        } else if (segmentIndex === segments.length - 1) {
            segmentPosition = 'last';
        } else {
            segmentPosition = 'intermediate';
        }

        // Use segment-aware intersection functions
        let segmentIntersections: IntersectionResult[];
        if (isLine(segment) && otherShape.type === GeometryType.LINE) {
            segmentIntersections = findLineLineIntersectionsSegmentAware(
                segment,
                otherShape.geometry as Line,
                segmentPosition,
                'only',
                intersectionType
            );
        } else if (isLine(segment) && otherShape.type === GeometryType.ARC) {
            segmentIntersections = findLineArcIntersectionsSegmentAware(
                segment,
                otherShape.geometry as Arc,
                segmentPosition
            );
        } else if (isLine(segment) && otherShape.type === 'circle') {
            segmentIntersections = findLineCircleIntersectionsSegmentAware(
                segment,
                otherShape.geometry as Circle,
                segmentPosition
            );
        } else {
            // Fallback for other shape types (arc segments, splines, ellipses, etc.)
            // Create a shape wrapper for the segment
            const segmentShape: Shape = {
                id: `segment-${segmentIndex}`,
                type: isLine(segment) ? GeometryType.LINE : GeometryType.ARC,
                geometry: segment,
            };
            segmentIntersections = findIntersectionsByType(
                segmentShape,
                otherShape,
                false,
                DEFAULT_EXTENSION_LENGTH,
                intersectionType
            );
        }

        // Adjust parameters for polyline context
        segmentIntersections.forEach((intersection) => {
            // Calculate parameter on the polyline (across all segments)
            const polylineParam: number = calculatePolylineParameter(
                segmentIndex,
                intersection.param1,
                segments.length
            );

            results.push({
                ...intersection,
                param1: swapParams ? intersection.param2 : polylineParam,
                param2: swapParams ? polylineParam : intersection.param2,
            });
        });
    });

    return results;
}
