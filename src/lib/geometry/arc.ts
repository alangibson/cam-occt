import type { Arc, Geometry, Point2D } from '$lib/types/geometry';
import {
    FULL_CIRCLE_RADIANS,
    DEFAULT_TESSELLATION_SEGMENTS,
    MIN_VERTICES_FOR_LINE,
} from './constants';

/**
 * Adaptive arc tessellation chord length for precise rendering
 */
const ARC_TESSELLATION_CHORD_LENGTH = 5;

/**
 * Default arc tessellation points for standard rendering
 */
const DEFAULT_ARC_TESSELLATION_POINTS = 10;

export function getArcStartPoint(arc: Arc): Point2D {
    return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
    };
}

export function getArcEndPoint(arc: Arc): Point2D {
    return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
    };
}

export function reverseArc(arc: Arc): Arc {
    return {
        ...arc,
        startAngle: arc.endAngle,
        endAngle: arc.startAngle,
        clockwise: !arc.clockwise,
    };
}

export function getArcPointAt(arc: Arc, t: number): Point2D {
    let angle: number;

    if (arc.clockwise) {
        // For clockwise arcs, we need to handle angle wrapping properly
        let angularSpan: number = arc.startAngle - arc.endAngle;

        // Normalize the angular span to be positive
        if (angularSpan <= 0) {
            angularSpan += FULL_CIRCLE_RADIANS;
        }

        // Interpolate in the clockwise direction (decreasing angle)
        angle = arc.startAngle - t * angularSpan;
    } else {
        // For counter-clockwise arcs
        let angularSpan: number = arc.endAngle - arc.startAngle;

        // Normalize the angular span to be positive
        if (angularSpan <= 0) {
            angularSpan += FULL_CIRCLE_RADIANS;
        }

        // Interpolate in the counter-clockwise direction (increasing angle)
        angle = arc.startAngle + t * angularSpan;
    }

    return {
        x: arc.center.x + arc.radius * Math.cos(angle),
        y: arc.center.y + arc.radius * Math.sin(angle),
    };
}

/**
 * Tessellate an arc into a series of points for detailed geometric analysis
 *
 * @param arc - Arc to tessellate
 * @param numPoints - Number of points to generate (minimum 2)
 * @returns Array of points along the arc from start to end
 */
export function tessellateArc(
    arc: Arc,
    numPoints: number = DEFAULT_ARC_TESSELLATION_POINTS
): Point2D[] {
    if (numPoints < MIN_VERTICES_FOR_LINE) {
        throw new Error('Arc tessellation requires at least 2 points');
    }

    const points: Point2D[] = [];

    for (let i: number = 0; i < numPoints; i++) {
        const t: number = i / (numPoints - 1); // Parameter from 0 to 1
        const point: Point2D = getArcPointAt(arc, t);
        points.push(point);
    }

    return points;
}

/**
 * Type guard to check if a segment is an Arc
 */
export function isArc(segment: Geometry): segment is Arc {
    return 'center' in segment && 'radius' in segment;
}

export function generateArcPoints(arc: Arc): Point2D[] {
    const points: Point2D[] = [];
    const totalAngle = arc.endAngle - arc.startAngle;
    const segments = Math.max(
        DEFAULT_TESSELLATION_SEGMENTS,
        Math.ceil(
            (Math.abs(totalAngle) * arc.radius) / ARC_TESSELLATION_CHORD_LENGTH
        )
    );

    for (let i: number = 0; i <= segments; i++) {
        const angle: number = arc.startAngle + (i / segments) * totalAngle;
        points.push({
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle),
        });
    }

    return points;
}
