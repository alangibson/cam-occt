import type { Circle } from './interfaces';
import type { Geometry, Point2D } from '$lib/types/geometry';
import {
    HIGH_TESSELLATION_SEGMENTS,
    SMALL_ANGLE_INCREMENT_DEG,
} from '$lib/geometry/constants';

export function getCircleStartPoint(circle: Circle): Point2D {
    return { x: circle.center.x + circle.radius, y: circle.center.y };
}

export function getCircleEndPoint(circle: Circle): Point2D {
    return { x: circle.center.x + circle.radius, y: circle.center.y };
}

export function reverseCircle(circle: Circle): Circle {
    // Circles don't need reversal
    return circle;
}

export function getCirclePointAt(circle: Circle, t: number): Point2D {
    const angle: number = t * 2 * Math.PI;
    return {
        x: circle.center.x + circle.radius * Math.cos(angle),
        y: circle.center.y + circle.radius * Math.sin(angle),
    };
}

export function isCircle(geometry: Geometry): geometry is Circle {
    return (
        'center' in geometry &&
        'radius' in geometry &&
        !('startAngle' in geometry)
    );
}

export function generateCirclePoints(
    center: Point2D,
    radius: number
): Point2D[] {
    const points: Point2D[] = [];
    const segments = Math.max(
        HIGH_TESSELLATION_SEGMENTS,
        Math.ceil((radius * 2 * Math.PI) / SMALL_ANGLE_INCREMENT_DEG)
    ); // ~5mm segments

    for (let i: number = 0; i <= segments; i++) {
        const angle: number = (i / segments) * 2 * Math.PI;
        points.push({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
        });
    }

    return points;
}
