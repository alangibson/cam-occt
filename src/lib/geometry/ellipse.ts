import { tessellateEllipse } from '$lib/geometry/ellipse-tessellation';
import type { Ellipse, Point2D } from '$lib/types/geometry';
import { calculateEllipsePoint, getEllipseParameters } from '$lib/utils/ellipse-utils';


export function getEllipseStartPoint(ellipse: Ellipse): Point2D {
    // return {
    //     x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
    //     y: ellipse.center.y + ellipse.majorAxisEndpoint.y
    // };

    // From overlay.ts
    // For ellipse arcs, use startParam if available, otherwise start at parameter 0
    // const startParam = ellipse.startParam !== undefined ? ellipse.startParam : 0;
    // return getEllipsePointAtParameter(ellipse, startParam);

    // From DrawingCanvas
    if (typeof ellipse.startParam === 'number') {
        // For ellipse arcs, calculate start point from start parameter
        const { majorAxisLength, minorAxisLength, majorAxisAngle } = getEllipseParameters(ellipse);
        return calculateEllipsePoint(ellipse, ellipse.startParam, majorAxisLength, minorAxisLength, majorAxisAngle);
    } else {
        // For full ellipses, use rightmost point (parameter 0)
        return {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y
        };
    }
}

export function getEllipseEndPoint(ellipse: Ellipse): Point2D {
    // if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
    //     return calculateEllipsePoint(ellipse, ellipse.endParam);
    // } else {
    //     return {
    //         x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
    //         y: ellipse.center.y + ellipse.majorAxisEndpoint.y
    //     };
    // }

    // From overlay.ts
    // For ellipse arcs, use endParam if available, otherwise end at parameter 2π
    // const endParam = ellipse.endParam !== undefined ? ellipse.endParam : 2 * Math.PI;
    // return getEllipsePointAtParameter(ellipse, endParam);

    // From DrawingCanvas
    if (typeof ellipse.endParam === 'number') {
        // For ellipse arcs, calculate end point from end parameter
        const { majorAxisLength, minorAxisLength, majorAxisAngle } = getEllipseParameters(ellipse);
        return calculateEllipsePoint(ellipse, ellipse.endParam, majorAxisLength, minorAxisLength, majorAxisAngle);
    } else {
        // For full ellipses, start and end points are the same (rightmost point at parameter 0)
        return {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y
        };
    }
}

export function reverseEllipse(ellipse: Ellipse): Ellipse {
    // For ellipses, swap start and end parameters to reverse direction
    const startParam: number = ellipse.startParam ?? 0;
    const endParam: number = ellipse.endParam ?? (2 * Math.PI);
    return {
        ...ellipse,
        startParam: endParam,
        endParam: startParam
    };
}

export function getEllipsePointAt(ellipse: Ellipse, t: number): Point2D {
    try {
        const points: Point2D[] = tessellateEllipse(ellipse, { numPoints: 32 });
        if (points.length > 0) {
            const index: number = Math.min(Math.floor(t * (points.length - 1)), points.length - 1);
            return points[index];
        }
    } catch {
        // Fallback to midpoint if tessellation fails
    }
    return { x: 0, y: 0 };
}

/**
 * Get the major axis radius (radiusX) from the new ellipse format
 */
export function getEllipseRadiusX(ellipse: Ellipse): number {
    const { majorAxisLength } = getEllipseParameters(ellipse);
    return majorAxisLength;
}

/**
 * Get the minor axis radius (radiusY) from the new ellipse format
 */
export function getEllipseRadiusY(ellipse: Ellipse): number {
    const { minorAxisLength } = getEllipseParameters(ellipse);
    return minorAxisLength;
}

/**
 * Get the rotation angle of the ellipse from the major axis endpoint
 */
export function getEllipseRotation(ellipse: Ellipse): number {
    const { majorAxisAngle } = getEllipseParameters(ellipse);
    return majorAxisAngle;
}