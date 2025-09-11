import verb from 'verb-nurbs';
import type { Ellipse } from './interfaces';

/**
 * Convert Ellipse geometry to verb-nurbs curve
 * Handles both full ellipses and ellipse arcs
 * Following INTERSECTION.md recommendation for Ellipse-NURBS intersections
 */
export function createVerbCurveFromEllipse(ellipse: Ellipse): verb.geom.ICurve {
    const {
        center,
        majorAxisEndpoint,
        minorToMajorRatio,
        startParam,
        endParam,
    } = ellipse;

    // Calculate semi-major and semi-minor axis lengths
    const a = Math.sqrt(majorAxisEndpoint.x ** 2 + majorAxisEndpoint.y ** 2); // Semi-major axis
    const b = a * minorToMajorRatio; // Semi-minor axis

    // Get the rotation angle of the ellipse from the major axis endpoint
    const rotAngle = Math.atan2(majorAxisEndpoint.y, majorAxisEndpoint.x);
    const cosRot = Math.cos(rotAngle);
    const sinRot = Math.sin(rotAngle);

    // Create scaled and rotated axis vectors for verb-nurbs
    // verb.geom.Ellipse expects the axis vectors to encode the ellipse size
    const xAxis = [a * cosRot, a * sinRot, 0] as [number, number, number];
    const yAxis = [b * -sinRot, b * cosRot, 0] as [number, number, number];

    // Check if this is an ellipse arc or full ellipse
    if (startParam !== undefined && endParam !== undefined) {
        // This is an ellipse arc - use verb.geom.EllipseArc
        // EllipseArc constructor expects unit axis vectors and separate scale factors
        const unitXAxis = [cosRot, sinRot, 0] as [number, number, number];
        const unitYAxis = [-sinRot, cosRot, 0] as [number, number, number];

        return new verb.geom.EllipseArc(
            [center.x, center.y, 0], // center point
            unitXAxis, // unit x-axis (major axis direction)
            unitYAxis, // unit y-axis (minor axis direction)
            a, // semi-major axis length
            b, // semi-minor axis length
            startParam, // start parameter (angle in radians)
            endParam // end parameter (angle in radians)
        );
    } else {
        // This is a full ellipse - use verb.geom.Ellipse
        // Ellipse constructor expects scaled axis vectors
        return new verb.geom.Ellipse(
            [center.x, center.y, 0], // center point
            xAxis, // x-axis (scaled major axis direction)
            yAxis, // y-axis (scaled minor axis direction)
            1, // normalized scale factor for major axis
            1 // normalized scale factor for minor axis
        );
    }
}
