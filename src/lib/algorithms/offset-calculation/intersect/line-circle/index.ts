import type { Line, Arc } from '../../../../types/geometry';
import type { Circle } from '$lib/geometry/circle';
import type { IntersectionResult } from '../../chain/types';
import {
    findLineArcIntersections,
    findLineArcIntersectionsSegmentAware,
    type SegmentPosition,
} from '../line-arc/index';
import { DEFAULT_EXTENSION_LENGTH } from '../../../../geometry/constants';

/**
 * Find intersections between a line and a circle
 */
export function findLineCircleIntersections(
    line: Line,
    circle: Circle,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    // Convert circle to full arc and use line-arc intersection
    const arc: Arc = {
        center: circle.center,
        radius: circle.radius,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        clockwise: false,
    };

    return findLineArcIntersections(
        line,
        arc,
        swapParams,
        allowExtensions,
        extensionLength
    );
}

/**
 * Find intersections between a line and a circle with segment position awareness
 */
export function findLineCircleIntersectionsSegmentAware(
    line: Line,
    circle: Circle,
    segmentPosition: SegmentPosition = 'only',
    swapParams: boolean = false
): IntersectionResult[] {
    // Convert circle to full arc and use line-arc intersection
    const arc: Arc = {
        center: circle.center,
        radius: circle.radius,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        clockwise: false,
    };

    return findLineArcIntersectionsSegmentAware(
        line,
        arc,
        segmentPosition,
        swapParams
    );
}
