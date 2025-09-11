import type { Point2D, Geometry } from '$lib/types/geometry';
import type { Arc } from './interfaces';
import { EPSILON, GEOMETRIC_PRECISION_TOLERANCE } from '$lib/geometry/math';
import { FULL_CIRCLE_RADIANS } from '$lib/geometry/circle';
import {
    DEFAULT_TESSELLATION_SEGMENTS,
    PRECISION_DECIMAL_PLACES,
} from '$lib/geometry/constants';
import { MIN_VERTICES_FOR_LINE } from '$lib/geometry/line';
import {
    ARC_TESSELLATION_CHORD_LENGTH,
    DEFAULT_ARC_TESSELLATION_POINTS,
    QUARTER_CIRCLE_QUADRANTS,
    DIRECTION_COUNTERCLOCKWISE,
    DIRECTION_CLOCKWISE,
} from './constants';

/**
 * Calculate a point on a circle/arc given center, radius and angle
 */
export function calculateArcPoint(
    center: Point2D,
    radius: number,
    angle: number
): Point2D {
    const x: number = center.x + radius * Math.cos(angle);
    const y: number = center.y + radius * Math.sin(angle);

    const roundCoord = (val: number): number =>
        Math.abs(val) < EPSILON ? 0 : val;
    return { x: roundCoord(x), y: roundCoord(y) };
}

/**
 * Calculate the start point of an arc
 */
export function calculateArcStartPoint(arc: Arc): Point2D {
    return calculateArcPoint(arc.center, arc.radius, arc.startAngle);
}

/**
 * Calculate the end point of an arc
 */
export function calculateArcEndPoint(arc: Arc): Point2D {
    return calculateArcPoint(arc.center, arc.radius, arc.endAngle);
}

/**
 * Get the start point of an arc
 */
export function getArcStartPoint(arc: Arc): Point2D {
    return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
    };
}

/**
 * Get the end point of an arc
 */
export function getArcEndPoint(arc: Arc): Point2D {
    return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
    };
}

/**
 * Reverse the direction of an arc
 */
export function reverseArc(arc: Arc): Arc {
    return {
        ...arc,
        startAngle: arc.endAngle,
        endAngle: arc.startAngle,
        clockwise: !arc.clockwise,
    };
}

/**
 * Get a point on an arc at parameter t (0 to 1)
 */
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

/**
 * Generate points along an arc for rendering
 */
export function generateArcPoints(arc: Arc): Point2D[] {
    const points: Point2D[] = [];

    // Use the same logic as getArcPointAt to respect the clockwise property
    let angularSpan: number;
    if (arc.clockwise) {
        // For clockwise arcs, calculate span from start to end in clockwise direction
        angularSpan = arc.startAngle - arc.endAngle;
        if (angularSpan <= 0) {
            angularSpan += FULL_CIRCLE_RADIANS;
        }
    } else {
        // For counter-clockwise arcs, calculate span from start to end in counter-clockwise direction
        angularSpan = arc.endAngle - arc.startAngle;
        if (angularSpan <= 0) {
            angularSpan += FULL_CIRCLE_RADIANS;
        }
    }

    const segments = Math.max(
        DEFAULT_TESSELLATION_SEGMENTS,
        Math.ceil((angularSpan * arc.radius) / ARC_TESSELLATION_CHORD_LENGTH)
    );

    for (let i: number = 0; i <= segments; i++) {
        const t: number = i / segments;
        let angle: number;

        if (arc.clockwise) {
            // Interpolate in clockwise direction (decreasing angle)
            angle = arc.startAngle - t * angularSpan;
        } else {
            // Interpolate in counter-clockwise direction (increasing angle)
            angle = arc.startAngle + t * angularSpan;
        }

        points.push({
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle),
        });
    }

    return points;
}

/**
 * Convert a bulged polyline segment to an arc
 *
 * @param bulge Bulge factor (tan(θ/4) where θ is the included angle)
 * @param start Start point
 * @param end End point
 * @returns Arc geometry or null if conversion fails
 */
export function convertBulgeToArc(
    bulge: number,
    start: Point2D,
    end: Point2D
): Arc | null {
    try {
        // DXF bulge-to-arc conversion algorithm
        // Reference: AutoCAD DXF documentation - bulge = tan(θ/4) where θ is the included angle

        const dx: number = end.x - start.x;
        const dy: number = end.y - start.y;
        const chordLength: number = Math.sqrt(dx * dx + dy * dy);

        if (chordLength < EPSILON) {
            return null; // Degenerate segment
        }

        // Calculate included angle from bulge: θ = 4 * arctan(|bulge|)
        const includedAngle: number =
            QUARTER_CIRCLE_QUADRANTS * Math.atan(Math.abs(bulge));

        // Calculate radius: R = chord / (2 * sin(θ/2))
        const radius: number = chordLength / (2 * Math.sin(includedAngle / 2));

        // Calculate chord midpoint
        const chordMidX: number = (start.x + end.x) / 2;
        const chordMidY: number = (start.y + end.y) / 2;

        // Calculate unit vector perpendicular to chord (rotated 90° CCW)
        const perpX: number = -dy / chordLength;
        const perpY: number = dx / chordLength;

        // Distance from chord midpoint to arc center
        // Using the relationship: d = sqrt(R² - (chord/2)²)
        const halfChord: number = chordLength / 2;
        const centerDistance: number = Math.sqrt(
            radius * radius - halfChord * halfChord
        );

        // Determine center position based on bulge sign
        // Positive bulge = counterclockwise = center is on the left side of the chord
        // Negative bulge = clockwise = center is on the right side of the chord
        const direction: number =
            bulge > 0 ? DIRECTION_COUNTERCLOCKWISE : DIRECTION_CLOCKWISE;
        const centerX: number = chordMidX + direction * centerDistance * perpX;
        const centerY: number = chordMidY + direction * centerDistance * perpY;

        // Validate the calculation by checking distances from center to endpoints
        const distToStart: number = Math.sqrt(
            (start.x - centerX) ** 2 + (start.y - centerY) ** 2
        );
        const distToEnd: number = Math.sqrt(
            (end.x - centerX) ** 2 + (end.y - centerY) ** 2
        );

        const tolerance: number = Math.max(
            GEOMETRIC_PRECISION_TOLERANCE,
            radius * GEOMETRIC_PRECISION_TOLERANCE
        );
        if (
            Math.abs(distToStart - radius) > tolerance ||
            Math.abs(distToEnd - radius) > tolerance
        ) {
            // Validation failed - this indicates a mathematical error
            console.warn(
                `Bulge conversion validation failed: bulge=${bulge}, chord=${chordLength.toFixed(PRECISION_DECIMAL_PLACES)}, radius=${radius.toFixed(PRECISION_DECIMAL_PLACES)}`
            );
            console.warn(
                `Distance errors: start=${Math.abs(distToStart - radius).toFixed(PRECISION_DECIMAL_PLACES)}, end=${Math.abs(distToEnd - radius).toFixed(PRECISION_DECIMAL_PLACES)}, tolerance=${tolerance.toFixed(PRECISION_DECIMAL_PLACES)}`
            );
            return null;
        }

        // Calculate start and end angles
        const startAngle: number = Math.atan2(
            start.y - centerY,
            start.x - centerX
        );
        const endAngle: number = Math.atan2(end.y - centerY, end.x - centerX);

        // Normalize angles to [0, 2π) range
        const normalizeAngle: (angle: number) => number = (
            angle: number
        ): number => {
            while (angle < 0) angle += 2 * Math.PI;
            while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
            return angle;
        };

        return {
            center: { x: centerX, y: centerY },
            radius: Math.abs(radius),
            startAngle: normalizeAngle(startAngle),
            endAngle: normalizeAngle(endAngle),
            clockwise: bulge < 0, // Negative bulge indicates clockwise direction
        };
    } catch (error) {
        console.warn('Error in bulge-to-arc conversion:', error);
        return null;
    }
}
