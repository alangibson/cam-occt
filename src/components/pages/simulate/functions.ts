import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { PartData } from '$lib/cam/part/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { polylineToPoints } from '$lib/geometry/dxf-polyline/functions';
import {
    getSplinePointAt,
    tessellateSpline,
} from '$lib/geometry/spline/functions';
import { Unit } from '$lib/config/units/units';
import { getToolFeedRate } from '$lib/config/units/tool-units';
import { findPartContainingChain } from '$lib/cam/part/chain-part-interactions';
import { Part } from '$lib/cam/part/classes.svelte';
import { getShapePointAt } from '$lib/cam/shape/functions';
import { Shape } from '$lib/cam/shape/classes';

// Constants
const MM_TO_INCH_RATIO = 25.4;
const PERCENT_FULL = 100;
const SPLINE_TESSELLATION_SAMPLES = 100;
const FALLBACK_SHAPE_LENGTH = 100;
const ELLIPSE_COEFFICIENT = 3;
const SECONDS_PER_MINUTE = 60;

/**
 * Convert distance from drawing units to display units
 */
export function convertDistanceToDisplayUnit(
    distance: number,
    drawingUnit: 'mm' | 'inch',
    displayUnit: 'mm' | 'inch'
): number {
    const drawingUnitEnum = drawingUnit === 'mm' ? Unit.MM : Unit.INCH;
    const displayUnitEnum = displayUnit === 'mm' ? Unit.MM : Unit.INCH;

    // If units match, no conversion needed
    if (drawingUnitEnum === displayUnitEnum) {
        return distance;
    }

    // Convert between mm and inch
    if (drawingUnitEnum === Unit.MM && displayUnitEnum === Unit.INCH) {
        return distance / MM_TO_INCH_RATIO;
    } else if (drawingUnitEnum === Unit.INCH && displayUnitEnum === Unit.MM) {
        return distance * MM_TO_INCH_RATIO;
    }

    return distance;
}

/**
 * Get feed rate for a cut, accounting for hole underspeed
 */
export function getFeedRateForCut(
    cut: CutData,
    displayUnit: 'mm' | 'inch',
    toolStoreState: Tool[] | null
): number {
    let baseFeedRate = 1000; // Default feed rate
    const displayUnitEnum = displayUnit === 'mm' ? Unit.MM : Unit.INCH;

    if (cut.sourceToolId && toolStoreState) {
        const tool = toolStoreState.find(
            (t: Tool) => t.id === cut.sourceToolId
        );
        if (tool) {
            baseFeedRate = getToolFeedRate(tool, displayUnitEnum);
        }
    }

    // Apply hole underspeed if applicable
    if (
        cut.isHole &&
        cut.holeUnderspeedPercent !== undefined &&
        cut.holeUnderspeedPercent < PERCENT_FULL
    ) {
        return baseFeedRate * (cut.holeUnderspeedPercent / PERCENT_FULL);
    }

    return baseFeedRate;
}

/**
 * Calculate the length of a polyline
 */
export function calculatePolylineLength(points: Point2D[]): number {
    if (points.length < 2) return 0;

    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        length += Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );
    }
    return length;
}

/**
 * Get position along a series of points at given target distance
 */
function getPositionOnPointSequence(
    points: Point2D[],
    targetDistance: number
): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];

    let currentDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const segmentLength = Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );

        if (currentDistance + segmentLength >= targetDistance) {
            const segmentProgress =
                segmentLength > 0
                    ? (targetDistance - currentDistance) / segmentLength
                    : 0;
            return {
                x: p1.x + (p2.x - p1.x) * segmentProgress,
                y: p1.y + (p2.y - p1.y) * segmentProgress,
            };
        }
        currentDistance += segmentLength;
    }
    return points[points.length - 1];
}

/**
 * Get position along a polyline at given progress (0-1)
 */
export function getPositionOnPolyline(
    points: Point2D[],
    progress: number
): Point2D {
    progress = Math.max(0, Math.min(1, progress));
    const totalLength = calculatePolylineLength(points);
    const targetDistance = totalLength * progress;
    return getPositionOnPointSequence(points, targetDistance);
}

/**
 * Calculate length of a shape
 */
export function getShapeLength(shape: ShapeData): number {
    switch (shape.type) {
        case GeometryType.LINE:
            const line = shape.geometry as Line;
            return Math.sqrt(
                Math.pow(line.end.x - line.start.x, 2) +
                    Math.pow(line.end.y - line.start.y, 2)
            );
        case GeometryType.CIRCLE:
            const circle = shape.geometry as Circle;
            return 2 * Math.PI * circle.radius;
        case GeometryType.ARC:
            const arc = shape.geometry as Arc;
            const angleRange = Math.abs(arc.endAngle - arc.startAngle);
            return angleRange * arc.radius;
        case GeometryType.POLYLINE:
            const polyline = shape.geometry as DxfPolyline;
            const polylinePoints = polylineToPoints(polyline);
            let polylineDistance = 0;
            for (let i = 0; i < polylinePoints.length - 1; i++) {
                const p1 = polylinePoints[i];
                const p2 = polylinePoints[i + 1];
                polylineDistance += Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                );
            }
            return polylineDistance;
        case GeometryType.SPLINE:
            const spline = shape.geometry as Spline;
            try {
                const samples = tessellateSpline(spline, {
                    numSamples: SPLINE_TESSELLATION_SAMPLES,
                }).points;
                let splineLength = 0;
                for (let i = 0; i < samples.length - 1; i++) {
                    const p1 = samples[i];
                    const p2 = samples[i + 1];
                    splineLength += Math.sqrt(
                        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                    );
                }
                return splineLength;
            } catch {
                // Fallback: calculate distance between fit points or control points
                if (spline.fitPoints && spline.fitPoints.length > 1) {
                    let fallbackLength = 0;
                    for (let i = 0; i < spline.fitPoints.length - 1; i++) {
                        const p1 = spline.fitPoints[i];
                        const p2 = spline.fitPoints[i + 1];
                        fallbackLength += Math.sqrt(
                            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                        );
                    }
                    return fallbackLength;
                } else if (
                    spline.controlPoints &&
                    spline.controlPoints.length > 1
                ) {
                    let fallbackLength = 0;
                    for (let i = 0; i < spline.controlPoints.length - 1; i++) {
                        const p1 = spline.controlPoints[i];
                        const p2 = spline.controlPoints[i + 1];
                        fallbackLength += Math.sqrt(
                            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                        );
                    }
                    return fallbackLength;
                }
                return FALLBACK_SHAPE_LENGTH; // Final fallback
            }
        case GeometryType.ELLIPSE:
            const ellipse = shape.geometry as Ellipse;
            const majorAxisLength = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;

            if (
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number'
            ) {
                const paramSpan = Math.abs(
                    ellipse.endParam - ellipse.startParam
                );
                const fullEllipsePerimeter =
                    Math.PI *
                    (ELLIPSE_COEFFICIENT * (majorAxisLength + minorAxisLength) -
                        Math.sqrt(
                            (ELLIPSE_COEFFICIENT * majorAxisLength +
                                minorAxisLength) *
                                (majorAxisLength +
                                    ELLIPSE_COEFFICIENT * minorAxisLength)
                        ));
                return fullEllipsePerimeter * (paramSpan / (2 * Math.PI));
            } else {
                return (
                    Math.PI *
                    (ELLIPSE_COEFFICIENT * (majorAxisLength + minorAxisLength) -
                        Math.sqrt(
                            (ELLIPSE_COEFFICIENT * majorAxisLength +
                                minorAxisLength) *
                                (majorAxisLength +
                                    ELLIPSE_COEFFICIENT * minorAxisLength)
                        ))
                );
            }
        default:
            return FALLBACK_SHAPE_LENGTH;
    }
}

/**
 * Calculate total distance of a chain
 */
export function getChainDistance(chain: ChainData): number {
    let totalDistance = 0;
    for (const shape of chain.shapes) {
        totalDistance += getShapeLength(shape);
    }
    return totalDistance;
}

/**
 * Get position along a shape at given progress (0-1)
 */
function getPositionOnShape(shape: ShapeData, progress: number): Point2D {
    progress = Math.max(0, Math.min(1, progress));

    switch (shape.type) {
        case GeometryType.LINE:
            const line = shape.geometry as Line;
            return {
                x: line.start.x + (line.end.x - line.start.x) * progress,
                y: line.start.y + (line.end.y - line.start.y) * progress,
            };
        case GeometryType.CIRCLE:
        case GeometryType.ARC:
            return getShapePointAt(new Shape(shape), progress);
        case GeometryType.POLYLINE:
            const polyline = shape.geometry as DxfPolyline;
            const polylinePoints = polylineToPoints(polyline);
            const totalLength = getShapeLength(shape);
            const targetDistance = totalLength * progress;
            return getPositionOnPointSequence(polylinePoints, targetDistance);
        case GeometryType.SPLINE:
            const splineGeom = shape.geometry as Spline;
            try {
                return getSplinePointAt(splineGeom, progress);
            } catch {
                // Fallback: interpolate between fit points or control points
                if (splineGeom.fitPoints && splineGeom.fitPoints.length > 1) {
                    const totalLength = getShapeLength(shape);
                    const targetDistance = totalLength * progress;
                    return getPositionOnPointSequence(
                        splineGeom.fitPoints,
                        targetDistance
                    );
                } else if (
                    splineGeom.controlPoints &&
                    splineGeom.controlPoints.length > 1
                ) {
                    const index = Math.floor(
                        progress * (splineGeom.controlPoints.length - 1)
                    );
                    const localProgress =
                        progress * (splineGeom.controlPoints.length - 1) -
                        index;
                    const p1 = splineGeom.controlPoints[index];
                    const p2 =
                        splineGeom.controlPoints[
                            Math.min(
                                index + 1,
                                splineGeom.controlPoints.length - 1
                            )
                        ];
                    return {
                        x: p1.x + (p2.x - p1.x) * localProgress,
                        y: p1.y + (p2.y - p1.y) * localProgress,
                    };
                }
                return { x: 0, y: 0 };
            }
        case GeometryType.ELLIPSE:
            const ellipse = shape.geometry as Ellipse;
            const majorAxisLength = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
            const majorAxisAngle = Math.atan2(
                ellipse.majorAxisEndpoint.y,
                ellipse.majorAxisEndpoint.x
            );

            let param: number;
            if (
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number'
            ) {
                param =
                    ellipse.startParam +
                    (ellipse.endParam - ellipse.startParam) * progress;
            } else {
                param = progress * 2 * Math.PI;
            }

            const canonicalX = majorAxisLength * Math.cos(param);
            const canonicalY = minorAxisLength * Math.sin(param);

            const cos = Math.cos(majorAxisAngle);
            const sin = Math.sin(majorAxisAngle);

            return {
                x: ellipse.center.x + canonicalX * cos - canonicalY * sin,
                y: ellipse.center.y + canonicalX * sin + canonicalY * cos,
            };
        default:
            return { x: 0, y: 0 };
    }
}

/**
 * Get position along a chain at given progress (0-1)
 */
export function getPositionOnChain(
    chain: ChainData,
    progress: number
): Point2D {
    const totalLength = getChainDistance(chain);
    const targetDistance = totalLength * progress;

    const shapes = chain.shapes;

    let currentDistance = 0;
    for (const shape of shapes) {
        const shapeLength = getShapeLength(shape);
        if (currentDistance + shapeLength >= targetDistance) {
            const shapeProgress =
                shapeLength > 0
                    ? (targetDistance - currentDistance) / shapeLength
                    : 0;
            return getPositionOnShape(shape, shapeProgress);
        }
        currentDistance += shapeLength;
    }

    // Fallback to last shape end
    if (shapes.length > 0) {
        const lastShape = shapes[shapes.length - 1];
        return getPositionOnShape(lastShape, 1.0);
    }

    return { x: 0, y: 0 };
}

/**
 * Find the part that contains a given chain
 */
export function findPartForChain(
    chainId: string,
    parts: PartData[]
): PartData | undefined {
    // Convert PartData to Part instances for the function call
    const partInstances = parts.map((p) => new Part(p));
    const result = findPartContainingChain(chainId, partInstances);
    return result?.toData();
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainingSeconds = Math.floor(seconds % SECONDS_PER_MINUTE);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format distance with units
 */
export function formatDistance(distance: number): string {
    return distance.toFixed(1);
}
