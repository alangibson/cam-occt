import type { Circle } from './interfaces';
import type { Geometry } from '$lib/geometry/types';
import type { Point2D } from '$lib/geometry/point/interfaces';
import {
    HIGH_TESSELLATION_SEGMENTS,
    SMALL_ANGLE_INCREMENT_DEG,
} from '$lib/geometry/constants';
import { hashObject } from '$lib/geometry/hash/functions';

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
/**
 * Get tangent direction for a circle geometry at a given point.
 */
export function getCircleTangent(circle: Circle, point: Point2D): Point2D {
    const cdx: number = point.x - circle.center.x;
    const cdy: number = point.y - circle.center.y;
    const clen: number = Math.sqrt(cdx * cdx + cdy * cdy);
    if (clen > 0) {
        // Tangent is perpendicular to radius, assuming counterclockwise
        return { x: -cdy / clen, y: cdx / clen };
    }
    return { x: 1, y: 0 };
}

/**
 * Tessellate a circle into points
 * @param circle Circle to tessellate
 * @param numPoints Number of points to generate around the circle
 * @returns Array of points around the circle
 */
export function tessellateCircle(circle: Circle, numPoints: number): Point2D[] {
    const points: Point2D[] = [];
    for (let i: number = 0; i < numPoints; i++) {
        const angle: number = (i / numPoints) * 2 * Math.PI;
        points.push({
            x: circle.center.x + circle.radius * Math.cos(angle),
            y: circle.center.y + circle.radius * Math.sin(angle),
        });
    }
    return points;
}

/**
 * Generate a content hash for a Circle
 * @param circle - The circle to hash
 * @returns A SHA-256 hash as a hex string
 */
export async function hashCircle(circle: Circle): Promise<string> {
    return hashObject(circle);
}
