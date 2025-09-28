import type {
    CuttingParameters,
    Drawing,
    Point2D,
    Shape,
    CutPath,
    Lead,
} from '$lib/types';
import { generateId } from '$lib/domain/id';
import { getShapePoints } from '$lib/geometry/shape';
import {
    DEFAULT_LEAD_IN_LENGTH_MM,
    DEFAULT_LEAD_OUT_LENGTH_MM,
} from '$lib/algorithms/leads/constants';

export function generateToolPaths(
    drawing: Drawing,
    parameters: CuttingParameters,
    leadOptions?: { leadInLength?: number; leadOutLength?: number }
): CutPath[] {
    const paths: CutPath[] = [];

    // Generate tool paths for each shape
    drawing.shapes.forEach((shape: Shape) => {
        const path: CutPath | null = generateShapeToolPath(
            shape,
            parameters,
            leadOptions
        );
        if (path) {
            paths.push(path);
        }
    });

    // Optimize cut sequence
    return optimizeCutSequence(paths);
}

function generateShapeToolPath(
    shape: Shape,
    parameters: CuttingParameters,
    leadOptions?: { leadInLength?: number; leadOutLength?: number }
): CutPath | null {
    const points: Point2D[] = getShapePoints(shape);
    if (points.length < 2) return null;

    // Apply kerf compensation
    const compensatedPoints: Point2D[] = applyKerfCompensation(
        points,
        parameters.kerf
    );

    // Generate lead-in and lead-out with configurable lengths
    // Use provided lengths, or defaults, or zero if not specified
    const leadInLength = leadOptions?.leadInLength ?? DEFAULT_LEAD_IN_LENGTH_MM; // Default 2mm lead-in
    const leadOutLength =
        leadOptions?.leadOutLength ?? DEFAULT_LEAD_OUT_LENGTH_MM; // Default 2mm lead-out
    const leadIn: Lead = generateLeadIn(compensatedPoints[0], leadInLength);
    const leadOut: Lead = generateLeadOut(
        compensatedPoints[compensatedPoints.length - 1],
        leadOutLength
    );

    return {
        id: generateId(),
        shapeId: shape.id,
        points: compensatedPoints,
        leadIn,
        leadOut,
        isRapid: false,
        parameters,
        originalShape: shape, // Preserve original shape for native G-code generation
    };
}

// tessellateEllipse is now imported from the ellipse-tessellation module

function applyKerfCompensation(points: Point2D[], kerf: number): Point2D[] {
    // Simplified kerf compensation - offset perpendicular to path
    // In production, use proper offset algorithms
    if (kerf === 0 || points.length < 2) return points;

    const compensated: Point2D[] = [];
    const offset: number = kerf / 2;

    for (let i: number = 0; i < points.length; i++) {
        const prev: Point2D = points[i - 1] || points[points.length - 2];
        const curr: Point2D = points[i];
        const next: Point2D = points[i + 1] || points[1];

        // Calculate normal vector
        const dx1: number = curr.x - prev.x;
        const dy1: number = curr.y - prev.y;
        const dx2: number = next.x - curr.x;
        const dy2: number = next.y - curr.y;

        const len1: number = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2: number = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (len1 > 0 && len2 > 0) {
            // Average normal
            const nx: number = (-dy1 / len1 - dy2 / len2) / 2;
            const ny: number = (dx1 / len1 + dx2 / len2) / 2;

            compensated.push({
                x: curr.x + nx * offset,
                y: curr.y + ny * offset,
            });
        } else {
            compensated.push(curr);
        }
    }

    return compensated;
}

function generateLeadIn(startPoint: Point2D, length: number): Lead {
    // Simple perpendicular lead-in
    const leadInPoint: Point2D = {
        x: startPoint.x - length,
        y: startPoint.y,
    };

    return [leadInPoint, startPoint];
}

function generateLeadOut(endPoint: Point2D, length: number): Lead {
    // Simple perpendicular lead-out
    const leadOutPoint: Point2D = {
        x: endPoint.x + length,
        y: endPoint.y,
    };

    return [endPoint, leadOutPoint];
}

function optimizeCutSequence(paths: CutPath[]): CutPath[] {
    if (paths.length <= 1) return paths;

    // Simple nearest neighbor optimization
    const optimized: CutPath[] = [];
    const remaining: CutPath[] = [...paths];

    // Start with the first path
    let current: CutPath = remaining.shift()!;
    optimized.push(current);

    while (remaining.length > 0) {
        // Find nearest path
        let nearestIndex: number = 0;
        let nearestDistance: number = Infinity;

        const currentEnd: Point2D = current.points[current.points.length - 1];

        remaining.forEach((path: CutPath, index: number) => {
            const pathStart: Point2D = path.points[0];
            const distance: number = Math.sqrt(
                Math.pow(pathStart.x - currentEnd.x, 2) +
                    Math.pow(pathStart.y - currentEnd.y, 2)
            );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });

        current = remaining.splice(nearestIndex, 1)[0];
        optimized.push(current);
    }

    return optimized;
}
