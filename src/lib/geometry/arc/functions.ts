import type { Geometry } from '$lib/geometry/types';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Arc } from './interfaces';
import { EPSILON } from '$lib/geometry/math/constants';
import { FULL_CIRCLE_RADIANS } from '$lib/geometry/circle/constants';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import {
    OCTAGON_SIDES,
    PRECISION_DECIMAL_PLACES,
} from '$lib/geometry/constants';
import {
    DIRECTION_CLOCKWISE,
    DIRECTION_COUNTERCLOCKWISE,
    PERPENDICULAR_TOLERANCE,
    QUARTER_CIRCLE_QUADRANTS,
    MAX_TOLERANCE_RATIO,
} from './constants';
import { normalizeAngle } from '$lib/geometry/math/functions';
import { hashObject } from '$lib/geometry/hash/functions';
import { THREE_HALVES_PI } from '$lib/geometry/bounding-box/constants';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';

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
 * Type guard to check if a segment is an Arc
 */
export function isArc(segment: Geometry): segment is Arc {
    return 'center' in segment && 'radius' in segment;
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
    end: Point2D,
    tolerance?: number
): Arc | null {
    const effectiveTolerance =
        tolerance ?? getDefaults().geometry.precisionTolerance;
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

        const validationTolerance: number = Math.max(
            effectiveTolerance,
            radius * effectiveTolerance
        );
        if (
            Math.abs(distToStart - radius) > validationTolerance ||
            Math.abs(distToEnd - radius) > validationTolerance
        ) {
            // Validation failed - this indicates a mathematical error
            console.warn(
                `Bulge conversion validation failed: bulge=${bulge}, chord=${chordLength.toFixed(PRECISION_DECIMAL_PLACES)}, radius=${radius.toFixed(PRECISION_DECIMAL_PLACES)}`
            );
            console.warn(
                `Distance errors: start=${Math.abs(distToStart - radius).toFixed(PRECISION_DECIMAL_PLACES)}, end=${Math.abs(distToEnd - radius).toFixed(PRECISION_DECIMAL_PLACES)}, tolerance=${validationTolerance.toFixed(PRECISION_DECIMAL_PLACES)}`
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

/**
 * Calculate the midpoint angle for an arc, handling angle wrapping
 * Exported for use in optimize-start-points.ts
 */
export function calculateArcMidpointAngle(
    startAngle: number,
    endAngle: number
): number {
    let midAngle = (startAngle + endAngle) / 2;

    // Handle arc crossing 0 degrees
    if (endAngle < startAngle) {
        midAngle = (startAngle + endAngle + 2 * Math.PI) / 2;
        if (midAngle > 2 * Math.PI) {
            midAngle -= 2 * Math.PI;
        }
    }

    return midAngle;
}

/**
 * Calculate the arc length for an existing arc
 * Arc length = radius × angular span (in radians)
 */
function calculateArcLength(arc: Arc): number {
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

    return arc.radius * angularSpan;
}

/**
 * Create an arc with a specific arc length from starting parameters
 * @param center - Arc center point
 * @param radius - Arc radius
 * @param startAngle - Starting angle in radians
 * @param arcLength - Desired arc length along the curve
 * @param clockwise - Direction of arc sweep
 */
export function createArcWithLength(
    center: Point2D,
    radius: number,
    startAngle: number,
    arcLength: number,
    clockwise: boolean
): Arc {
    // Calculate sweep angle from arc length
    // Clamp to maximum of 2π (full circle) to prevent invalid multi-loop arcs
    const sweepAngle = Math.min(arcLength / radius, FULL_CIRCLE_RADIANS);

    // Calculate end angle based on sweep direction
    const endAngle = clockwise
        ? normalizeAngle(startAngle - sweepAngle)
        : normalizeAngle(startAngle + sweepAngle);

    return {
        center,
        radius,
        startAngle: normalizeAngle(startAngle),
        endAngle,
        clockwise,
    };
}

/**
 * Get tangent direction for an arc geometry at start or end.
 */
// export function getArcTangent(arc: Arc, isStart: boolean): Point2D {
//     const angle: number = isStart ? arc.startAngle : arc.endAngle;
//     // Tangent is perpendicular to radius
//     // If arc goes counterclockwise, tangent points in +90° direction
//     // If arc goes clockwise, tangent points in -90° direction
//     const isCounterClockwise: boolean = arc.endAngle > arc.startAngle;
//     const tangentAngle: number = angle + (isCounterClockwise ? Math.PI / 2 : -Math.PI / 2);
//     return {
//         x: Math.cos(tangentAngle),
//         y: Math.sin(tangentAngle),
//     };
// }

/**
 * Get the tangent direction at the start or end of an arc
 * The tangent is perpendicular to the radius at that point
 * @param arc - The arc
 * @param atStart - true for start tangent, false for end tangent
 * @returns Unit vector representing tangent direction
 */
export function getArcTangent(arc: Arc, atStart: boolean): Point2D {
    const angle = atStart ? arc.startAngle : arc.endAngle;

    // Radius vector from center to point on arc
    const radiusVector: Point2D = {
        x: Math.cos(angle),
        y: Math.sin(angle),
    };

    // Tangent is perpendicular to radius and points in direction of travel
    // For counterclockwise arcs: tangent = rotate radius 90° CCW = (-radiusVector.y, radiusVector.x)
    // For clockwise arcs: tangent = rotate radius 90° CW = (radiusVector.y, -radiusVector.x)
    //
    // However, we need to consider the actual direction of travel along the arc:
    // - For counterclockwise: angles increase, so we go from startAngle to endAngle
    // - For clockwise: angles decrease, so we go from startAngle to endAngle (but decreasing)

    if (arc.clockwise) {
        // Clockwise: tangent points in clockwise direction (90° CW from radius)
        return { x: radiusVector.y, y: -radiusVector.x };
    } else {
        // Counterclockwise: tangent points in counterclockwise direction (90° CCW from radius)
        return { x: -radiusVector.y, y: radiusVector.x };
    }
}

/**
 * Create a tangent arc from a connection point with specified arc length
 * @param connectionPoint - Point where arc connects to path
 * @param tangentDirection - Unit vector of tangent at connection point
 * @param arcLength - Total length along the arc curve
 * @param curveDirection - Normal direction (perpendicular to tangent, indicates which side to curve)
 * @param isLeadIn - true if this is a lead-in arc (ends at connection), false for lead-out (starts at connection)
 * @param clockwise - desired arc sweep direction
 */
export function createTangentArc(
    connectionPoint: Point2D,
    tangentDirection: Point2D,
    arcLength: number,
    curveDirection: Point2D,
    isLeadIn: boolean,
    clockwise: boolean
): Arc {
    // Lead arcs should have a maximum 90-degree sweep for optimal cutting
    // For a 90-degree arc: radius = arcLength / (π/2) = arcLength × (2/π)
    const LEAD_ARC_MAX_SWEEP = Math.PI / 2; // 90 degrees
    const radius = arcLength / LEAD_ARC_MAX_SWEEP; // = arcLength × (2/π) ≈ arcLength × 0.637

    // Calculate the actual sweep angle
    // This will be exactly π/2 (90 degrees) for normal cases
    const sweepAngle = arcLength / radius;

    // For tangency, the arc center must be positioned perpendicular to the tangent direction
    // The curveDirection already indicates which side, but we need to ensure it's perpendicular
    let centerOffset: Point2D;

    // Normalize the curve direction
    const curveLength = Math.sqrt(
        curveDirection.x * curveDirection.x +
            curveDirection.y * curveDirection.y
    );
    const normalizedCurve = {
        x: curveDirection.x / curveLength,
        y: curveDirection.y / curveLength,
    };

    // For both lead-in and lead-out, ensure the center is perpendicular to tangent
    // Check if curveDirection is already perpendicular to tangentDirection
    const dot =
        tangentDirection.x * normalizedCurve.x +
        tangentDirection.y * normalizedCurve.y;

    if (Math.abs(dot) < PERPENDICULAR_TOLERANCE) {
        // curveDirection is already perpendicular (within ~0.57 degrees), use it
        centerOffset = normalizedCurve;
    } else {
        // Need to make it perpendicular
        // Choose the perpendicular direction that is closest to the requested curveDirection
        const leftPerp = { x: -tangentDirection.y, y: tangentDirection.x }; // 90° CCW from tangent
        const rightPerp = { x: tangentDirection.y, y: -tangentDirection.x }; // 90° CW from tangent

        // Check which perpendicular is closer to the requested curve direction
        const leftDot =
            leftPerp.x * normalizedCurve.x + leftPerp.y * normalizedCurve.y;
        const rightDot =
            rightPerp.x * normalizedCurve.x + rightPerp.y * normalizedCurve.y;

        // Choose the perpendicular that has a positive dot product (same general direction)
        if (leftDot > rightDot) {
            centerOffset = leftPerp;
        } else {
            centerOffset = rightPerp;
        }
    }

    // Arc center is offset from connection point by radius
    const center: Point2D = {
        x: connectionPoint.x + centerOffset.x * radius,
        y: connectionPoint.y + centerOffset.y * radius,
    };

    // Calculate the angle from center to connection point
    const connectionAngle = Math.atan2(
        connectionPoint.y - center.y,
        connectionPoint.x - center.x
    );

    // Use the provided clockwise value directly

    let startAngle: number;
    let endAngle: number;

    if (isLeadIn) {
        // Lead-in: arc ends at connection point
        endAngle = normalizeAngle(connectionAngle);
        startAngle = clockwise
            ? normalizeAngle(connectionAngle + sweepAngle)
            : normalizeAngle(connectionAngle - sweepAngle);
    } else {
        // Lead-out: arc starts at connection point
        startAngle = normalizeAngle(connectionAngle);
        endAngle = clockwise
            ? normalizeAngle(connectionAngle - sweepAngle)
            : normalizeAngle(connectionAngle + sweepAngle);
    }

    return {
        center,
        radius,
        startAngle,
        endAngle,
        clockwise,
    };
}

/**
 * Sample points along an arc geometry for collision testing.
 *
 * TODO Should take a distance argument. Don't assume "~2mm segments".
 *
 * @param arc - Arc geometry to sample
 * @returns Array of points along the arc
 */
export function sampleArc(arc: Arc): Point2D[] {
    const points: Point2D[] = [];
    const arcLength = calculateArcLength(arc);
    const segments = Math.max(OCTAGON_SIDES, Math.ceil(arcLength / 2)); // ~2mm segments

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let angle: number;

        if (arc.clockwise) {
            let angularSpan = arc.startAngle - arc.endAngle;
            if (angularSpan <= 0) angularSpan += 2 * Math.PI;
            angle = arc.startAngle - t * angularSpan;
        } else {
            let angularSpan = arc.endAngle - arc.startAngle;
            if (angularSpan <= 0) angularSpan += 2 * Math.PI;
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
 * Tessellate an arc into a series of points for detailed geometric analysis
 *
 * @param arc - Arc to tessellate
 * @param numPoints - Number of points to generate (minimum 2)
 * @returns Array of points along the arc from start to end
 */
// export function sampleArc2(
//     arc: Arc,
//     numPoints: number = DEFAULT_ARC_TESSELLATION_POINTS
// ): Point2D[] {
//     if (numPoints < MIN_VERTICES_FOR_LINE) {
//         throw new Error('Arc tessellation requires at least 2 points');
//     }
//     const points: Point2D[] = [];
//     for (let i: number = 0; i < numPoints; i++) {
//         const t: number = i / (numPoints - 1); // Parameter from 0 to 1
//         const point: Point2D = getArcPointAt(arc, t);
//         points.push(point);
//     }
//     return points;
// }

/**
 * Tessellate an arc into points with adaptive tolerance-based sampling.
 * Points are spaced to maintain approximately equal chord distances (Euclidean distance).
 *
 * @param arc Arc to tessellate
 * @param tolerance Maximum deviation tolerance for tessellation (chord error/sagitta)
 * @param maxSegments Maximum number of segments to prevent excessive tessellation (default 1000)
 * @returns Array of points along the arc with approximately equal chord spacing
 */
export function tessellateArc(
    arc: Arc,
    tolerance: number,
    // eslint-disable-next-line no-magic-numbers
    maxSegments: number = 1000
): Point2D[] {
    const points: Point2D[] = [];

    // Calculate the angular difference (sweep)
    let deltaAngle: number = arc.endAngle - arc.startAngle;

    // Adjust deltaAngle based on clockwise flag
    // DXF arcs are counterclockwise by default unless clockwise flag is set
    if (arc.clockwise) {
        // For clockwise arcs, if deltaAngle > 0, we want the long way around
        if (deltaAngle > 0) {
            deltaAngle -= 2 * Math.PI;
        }
    } else {
        // For counterclockwise arcs, if deltaAngle < 0, we want to cross zero
        if (deltaAngle < 0) {
            deltaAngle += 2 * Math.PI;
        }
    }

    const arcSpan: number = Math.abs(deltaAngle);
    const radius = arc.radius;

    // Calculate optimal segment angle for the given tolerance
    // For a circular arc with radius r and tolerance t (max chord deviation):
    // The sagitta (chord height) s = r - r*cos(θ/2) where θ is the segment angle
    // Setting s = t and solving for θ: θ = 2*acos(1 - t/r)
    const toleranceRatio = Math.min(tolerance / radius, MAX_TOLERANCE_RATIO);
    const segmentAngle = 2 * Math.acos(1 - toleranceRatio);

    // Calculate target chord distance for approximately equal spacing
    // Chord length for angle θ: chord = 2r * sin(θ/2)
    const targetChordDistance = 2 * radius * Math.sin(segmentAngle / 2);

    // Calculate arc length and number of segments for equal chord spacing
    const arcLength = radius * arcSpan;

    // Use chord distance as the target spacing (arc length ≈ chord length for small angles)
    const calculatedSegments = Math.ceil(arcLength / targetChordDistance);

    // Clamp to reasonable bounds (minimum 1 segment, maximum segments)
    const numSegments: number = Math.max(
        1,
        Math.min(maxSegments, calculatedSegments)
    );

    // Generate points with equal angular spacing (which gives approximately equal chord spacing)
    const angleStep = deltaAngle / numSegments;

    for (let i: number = 0; i <= numSegments; i++) {
        const theta: number = arc.startAngle + i * angleStep;
        points.push({
            x: arc.center.x + arc.radius * Math.cos(theta),
            y: arc.center.y + arc.radius * Math.sin(theta),
        });
    }

    return points;
}

/**
 * Translate an arc by the given offsets
 */
export function translateArc(arc: Arc, dx: number, dy: number): Arc {
    return {
        center: { x: arc.center.x + dx, y: arc.center.y + dy },
        radius: arc.radius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        clockwise: arc.clockwise,
    };
}

/**
 * Generate a content hash for an Arc
 * @param arc - The arc to hash
 * @returns A SHA-256 hash as a hex string
 */
export async function hashArc(arc: Arc): Promise<string> {
    return hashObject(arc);
}

export function arcBoundingBox(arc: Arc): BoundingBoxData {
    if (
        !arc.center ||
        !isFinite(arc.center.x) ||
        !isFinite(arc.center.y) ||
        !isFinite(arc.radius) ||
        arc.radius <= 0 ||
        !isFinite(arc.startAngle) ||
        !isFinite(arc.endAngle)
    ) {
        throw new Error(
            'Invalid arc: center, radius, and angles must be finite numbers'
        );
    }

    const startPoint = calculateArcPoint(
        arc.center,
        arc.radius,
        arc.startAngle
    );
    const endPoint = calculateArcPoint(arc.center, arc.radius, arc.endAngle);
    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;

    let minX: number = Math.min(startX, endX);
    let maxX: number = Math.max(startX, endX);
    let minY: number = Math.min(startY, endY);
    let maxY: number = Math.max(startY, endY);

    const normalizeAngle: (angle: number) => number = (
        angle: number
    ): number => {
        let normalized: number = angle % (2 * Math.PI);
        if (normalized < 0) normalized += 2 * Math.PI;
        return normalized;
    };

    const normStart: number = normalizeAngle(arc.startAngle);
    const normEnd: number = normalizeAngle(arc.endAngle);

    const isAngleInArc: (testAngle: number) => boolean = (
        testAngle: number
    ): boolean => {
        const normTest: number = normalizeAngle(testAngle);

        if (arc.clockwise) {
            if (normStart >= normEnd) {
                return normTest >= normEnd && normTest <= normStart;
            } else {
                return normTest >= normEnd || normTest <= normStart;
            }
        } else {
            if (normStart <= normEnd) {
                return normTest >= normStart && normTest <= normEnd;
            } else {
                return normTest >= normStart || normTest <= normEnd;
            }
        }
    };

    const extremeAngles: number[] = [0, Math.PI / 2, Math.PI, THREE_HALVES_PI];

    for (const angle of extremeAngles) {
        if (isAngleInArc(angle)) {
            const point = calculateArcPoint(arc.center, arc.radius, angle);
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}
