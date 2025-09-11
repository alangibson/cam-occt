import type {
    Point2D,
    Line,
    Circle,
    Polyline,
    Ellipse,
    Shape,
} from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { Arc } from '$lib/geometry/arc';
import type { BoundingBox } from './interfaces';
import { GeometryType } from '$lib/geometry/shape';
import { polylineToPoints } from '$lib/geometry/polyline';
import { sampleNURBS } from '$lib/geometry/spline';
import { calculateArcPoint } from '$lib/geometry/arc';
import { VALIDATION_SAMPLE_COUNT } from '$lib/geometry/spline';
import { THREE_HALVES_PI } from './constants';
import { GEOMETRIC_PRECISION_TOLERANCE } from '$lib/geometry/math/constants';
import { SPLINE_TESSELLATION_TOLERANCE } from '$lib/geometry/spline';
import type { Chain } from '../chain/interfaces';

export function getBoundingBoxForLine(line: Line): BoundingBox {
    if (
        !line.start ||
        !line.end ||
        !isFinite(line.start.x) ||
        !isFinite(line.start.y) ||
        !isFinite(line.end.x) ||
        !isFinite(line.end.y)
    ) {
        throw new Error(
            'Invalid line: start and end points must be finite numbers'
        );
    }

    return {
        min: {
            x: Math.min(line.start.x, line.end.x),
            y: Math.min(line.start.y, line.end.y),
        },
        max: {
            x: Math.max(line.start.x, line.end.x),
            y: Math.max(line.start.y, line.end.y),
        },
    };
}

export function getBoundingBoxForCircle(circle: Circle): BoundingBox {
    if (
        !circle.center ||
        !isFinite(circle.center.x) ||
        !isFinite(circle.center.y) ||
        !isFinite(circle.radius) ||
        circle.radius <= 0
    ) {
        throw new Error(
            'Invalid circle: center must be finite and radius must be positive'
        );
    }

    return {
        min: {
            x: circle.center.x - circle.radius,
            y: circle.center.y - circle.radius,
        },
        max: {
            x: circle.center.x + circle.radius,
            y: circle.center.y + circle.radius,
        },
    };
}

export function getBoundingBoxForArc(arc: Arc): BoundingBox {
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

export function getBoundingBoxForPolyline(polyline: Polyline): BoundingBox {
    let minX: number = Infinity;
    let maxX: number = -Infinity;
    let minY: number = Infinity;
    let maxY: number = -Infinity;

    // If polyline has segments (new format), process each segment for accurate bounds
    if (polyline.shapes && polyline.shapes.length > 0) {
        for (const shape of polyline.shapes) {
            const segmentBounds = getBoundingBoxForShape(shape);

            minX = Math.min(minX, segmentBounds.min.x);
            maxX = Math.max(maxX, segmentBounds.max.x);
            minY = Math.min(minY, segmentBounds.min.y);
            maxY = Math.max(maxY, segmentBounds.max.y);
        }
    } else {
        // Fallback for old format or legacy polylines - use points
        const points: Point2D[] = polylineToPoints(polyline);
        if (!points || points.length === 0) {
            throw new Error('Invalid polyline: must have at least one point');
        }

        for (const point of points) {
            if (!point || !isFinite(point.x) || !isFinite(point.y)) {
                throw new Error(
                    'Invalid polyline: all points must be finite numbers'
                );
            }

            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }

    if (
        !isFinite(minX) ||
        !isFinite(maxX) ||
        !isFinite(minY) ||
        !isFinite(maxY)
    ) {
        throw new Error('Invalid polyline: no finite bounds found');
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}

export function getBoundingBoxForEllipse(ellipse: Ellipse): BoundingBox {
    if (
        !ellipse.center ||
        !isFinite(ellipse.center.x) ||
        !isFinite(ellipse.center.y) ||
        !ellipse.majorAxisEndpoint ||
        !isFinite(ellipse.majorAxisEndpoint.x) ||
        !isFinite(ellipse.majorAxisEndpoint.y) ||
        !isFinite(ellipse.minorToMajorRatio) ||
        ellipse.minorToMajorRatio <= 0
    ) {
        throw new Error(
            'Invalid ellipse: center, major axis endpoint, and ratio must be finite numbers'
        );
    }

    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );

    if (majorAxisLength <= 0) {
        throw new Error('Invalid ellipse: major axis length must be positive');
    }

    const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;

    const angle: number = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );
    const cos: number = Math.cos(angle);
    const sin: number = Math.sin(angle);

    const halfWidth: number = Math.sqrt(
        majorAxisLength * majorAxisLength * cos * cos +
            minorAxisLength * minorAxisLength * sin * sin
    );
    const halfHeight: number = Math.sqrt(
        majorAxisLength * majorAxisLength * sin * sin +
            minorAxisLength * minorAxisLength * cos * cos
    );

    return {
        min: {
            x: ellipse.center.x - halfWidth,
            y: ellipse.center.y - halfHeight,
        },
        max: {
            x: ellipse.center.x + halfWidth,
            y: ellipse.center.y + halfHeight,
        },
    };
}

export function getBoundingBoxForSpline(spline: Spline): BoundingBox {
    if (!spline.controlPoints || spline.controlPoints.length === 0) {
        throw new Error('Invalid spline: must have control points');
    }

    let points: Point2D[];

    try {
        points = sampleNURBS(spline, VALIDATION_SAMPLE_COUNT);
    } catch {
        if (spline.fitPoints && spline.fitPoints.length > 0) {
            points = spline.fitPoints;
        } else {
            points = spline.controlPoints;
        }
    }

    if (points.length === 0) {
        throw new Error('Invalid spline: no valid points available');
    }

    let minX: number = Infinity;
    let maxX: number = -Infinity;
    let minY: number = Infinity;
    let maxY: number = -Infinity;

    for (const point of points) {
        if (!point || !isFinite(point.x) || !isFinite(point.y)) {
            continue;
        }

        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    if (
        !isFinite(minX) ||
        !isFinite(maxX) ||
        !isFinite(minY) ||
        !isFinite(maxY)
    ) {
        throw new Error('Invalid spline: no finite points found');
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}

export function getBoundingBoxForShape(shape: Shape): BoundingBox {
    switch (shape.type) {
        case GeometryType.LINE:
            return getBoundingBoxForLine(shape.geometry as Line);
        case GeometryType.ARC:
            return getBoundingBoxForArc(shape.geometry as Arc);
        case GeometryType.CIRCLE:
            return getBoundingBoxForCircle(shape.geometry as Circle);
        case GeometryType.POLYLINE:
            return getBoundingBoxForPolyline(shape.geometry as Polyline);
        case GeometryType.ELLIPSE:
            return getBoundingBoxForEllipse(shape.geometry as Ellipse);
        case GeometryType.SPLINE:
            return getBoundingBoxForSpline(shape.geometry as Spline);
        default:
            throw new Error(`Unsupported shape type: ${shape.type}`);
    }
}

export function combineBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
    if (boxes.length === 0) {
        throw new Error('Cannot combine empty array of bounding boxes');
    }

    let minX: number = Infinity;
    let maxX: number = -Infinity;
    let minY: number = Infinity;
    let maxY: number = -Infinity;

    for (const box of boxes) {
        if (
            !box ||
            !box.min ||
            !box.max ||
            !isFinite(box.min.x) ||
            !isFinite(box.min.y) ||
            !isFinite(box.max.x) ||
            !isFinite(box.max.y)
        ) {
            throw new Error(
                'Invalid bounding box: min and max must be finite numbers'
            );
        }

        minX = Math.min(minX, box.min.x);
        maxX = Math.max(maxX, box.max.x);
        minY = Math.min(minY, box.min.y);
        maxY = Math.max(maxY, box.max.y);
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
    };
}

export function getBoundingBoxForShapes(shapes: Shape[]): BoundingBox {
    if (shapes.length === 0) {
        throw new Error(
            'Cannot calculate bounding box for empty array of shapes'
        );
    }

    const boundingBoxes: BoundingBox[] = shapes.map((shape) =>
        getBoundingBoxForShape(shape)
    );
    return combineBoundingBoxes(boundingBoxes);
}

export function calculateDynamicTolerance(
    shapes: Shape[],
    fallbackTolerance: number = SPLINE_TESSELLATION_TOLERANCE
): number {
    if (shapes.length === 0) return fallbackTolerance;

    try {
        const boundingBox: BoundingBox = getBoundingBoxForShapes(shapes);
        const width: number = boundingBox.max.x - boundingBox.min.x;
        const height: number = boundingBox.max.y - boundingBox.min.y;
        const diagonal: number = Math.sqrt(width * width + height * height);

        // Use 0.1% of diagonal as tolerance, with reasonable min/max bounds
        const dynamicTolerance: number = Math.max(
            GEOMETRIC_PRECISION_TOLERANCE,
            Math.min(1.0, diagonal * GEOMETRIC_PRECISION_TOLERANCE)
        );
        return dynamicTolerance;
    } catch {
        return fallbackTolerance;
    }
}

/**
 * Calculates the bounding box of a chain by aggregating bounds of all shapes
 */
export function calculateChainBoundingBox(chain: Chain): BoundingBox {
    const shapeBounds = chain.shapes.map((shape) =>
        getBoundingBoxForShape(shape)
    );
    return combineBoundingBoxes(shapeBounds);
}

/**
 * Gets the bounding box of a single shape
 * @deprecated Use getBoundingBoxForShape from '$lib/geometry/bounding-box' instead
 */

export function getShapeBoundingBox(shape: Shape): BoundingBox {
    return getBoundingBoxForShape(shape);
}

/**
 * Calculates the bounding box of a spline using NURBS sampling
 * @deprecated Use getBoundingBoxForSpline from '$lib/geometry/bounding-box' instead
 */
export function calculateSplineBoundingBox(spline: Spline): BoundingBox {
    return getBoundingBoxForShape({
        type: GeometryType.SPLINE,
        geometry: spline,
    } as Shape);
}

/**
 * Calculates the bounding box of a polyline
 * @deprecated Use getBoundingBoxForPolyline from '$lib/geometry/bounding-box' instead
 */
export function calculatePolylineBoundingBox(polyline: Polyline): BoundingBox {
    return getBoundingBoxForShape({
        type: GeometryType.POLYLINE,
        geometry: polyline,
    } as Shape);
}

/**
 * Get all significant points from a shape for bounding box calculation
 * Consolidated from translate-to-positive.ts and dxf-parser.ts
 */
export function getShapePointsForBounds(shape: Shape): Point2D[] {
    const bounds = getBoundingBoxForShape(shape);
    return [bounds.min, bounds.max];
}
