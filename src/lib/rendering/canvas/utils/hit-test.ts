/**
 * Hit testing types and utilities for canvas rendering
 */

import type {
    Point2D,
    Shape,
    Line,
    Circle,
    Arc,
    Polyline,
    Ellipse,
} from '$lib/types';
import { GeometryType } from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import { tessellateSpline } from '$lib/geometry/spline';
import {
    isFullEllipse,
    distanceFromEllipsePerimeter,
    transformPointToEllipseCoordinates,
} from '$lib/geometry/ellipse/index';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import type { Rapid } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';

/**
 * Types of objects that can be hit
 */
export enum HitTestType {
    SHAPE = 'shape',
    CHAIN = 'chain',
    PART = 'part',
    PATH = 'path',
    RAPID = 'rapid',
    OFFSET = 'offset',
    LEAD = 'lead',
    OVERLAY = 'overlay',
}

/**
 * Hit test metadata for different types
 */
export interface HitTestMetadata {
    shape?: Shape;
    shapeType?: 'original' | 'offset';
    pathId?: string;
    endpoint?: 'start' | 'end';
    rapid?: Rapid;
    part?: DetectedPart;
    chainId?: string;
    shapeId?: string;
    leadType?: 'leadIn' | 'leadOut';
    overlayType?: string;
    pointType?: string;
    endpointType?: string;
}

/**
 * Result of a hit test
 */
export interface HitTestResult {
    type: HitTestType;
    id: string;
    distance: number;
    point: Point2D;
    metadata?: HitTestMetadata;
}

/**
 * Hit test configuration
 */
export interface HitTestConfig {
    /**
     * Tolerance in world units for hit detection
     */
    tolerance: number;

    /**
     * Priority order for hit testing (first has highest priority)
     */
    priorityOrder?: HitTestType[];

    /**
     * Types to exclude from hit testing
     */
    excludeTypes?: HitTestType[];
}

/**
 * Default hit test priority order
 */
export const DEFAULT_HIT_TEST_PRIORITY: HitTestType[] = [
    HitTestType.RAPID,
    HitTestType.OFFSET,
    HitTestType.PATH,
    HitTestType.OVERLAY,
    HitTestType.LEAD,
    HitTestType.PART,
    HitTestType.CHAIN,
    HitTestType.SHAPE,
];

/**
 * Utility functions for hit testing
 */
export class HitTestUtils {
    /**
     * Calculate distance from a point to a line segment
     */
    static distanceToLineSegment(
        point: Point2D,
        lineStart: Point2D,
        lineEnd: Point2D
    ): number {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx: number, yy: number;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate distance between two points
     */
    static distance(p1: Point2D, p2: Point2D): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Check if a point is within a circle
     */
    static isPointInCircle(
        point: Point2D,
        center: Point2D,
        radius: number
    ): boolean {
        return this.distance(point, center) <= radius;
    }

    /**
     * Check if a point is within a rectangle
     */
    static isPointInRectangle(
        point: Point2D,
        rectMin: Point2D,
        rectMax: Point2D
    ): boolean {
        return (
            point.x >= rectMin.x &&
            point.x <= rectMax.x &&
            point.y >= rectMin.y &&
            point.y <= rectMax.y
        );
    }

    /**
     * Check if a point is within tolerance of an arc
     */
    static distanceToArc(
        point: Point2D,
        center: Point2D,
        radius: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): number {
        // Calculate distance from center
        const distFromCenter = this.distance(point, center);

        // Calculate angle of point relative to center
        const angle = Math.atan2(point.y - center.y, point.x - center.x);

        // Check if angle is within arc range
        if (this.isAngleInArcRange(angle, startAngle, endAngle, clockwise)) {
            // Point is within arc range, return distance from arc
            return Math.abs(distFromCenter - radius);
        } else {
            // Point is outside arc range, return distance to nearest endpoint
            const startPoint = {
                x: center.x + radius * Math.cos(startAngle),
                y: center.y + radius * Math.sin(startAngle),
            };
            const endPoint = {
                x: center.x + radius * Math.cos(endAngle),
                y: center.y + radius * Math.sin(endAngle),
            };

            return Math.min(
                this.distance(point, startPoint),
                this.distance(point, endPoint)
            );
        }
    }

    /**
     * Check if an angle is within an arc's range
     */
    static isAngleInArcRange(
        angle: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): boolean {
        // Normalize angles to [0, 2π]
        const normalizeAngle = (a: number) => {
            while (a < 0) a += 2 * Math.PI;
            while (a >= 2 * Math.PI) a -= 2 * Math.PI;
            return a;
        };

        const normAngle = normalizeAngle(angle);
        const normStart = normalizeAngle(startAngle);
        const normEnd = normalizeAngle(endAngle);

        if (clockwise) {
            if (normStart >= normEnd) {
                return normAngle <= normStart && normAngle >= normEnd;
            } else {
                return normAngle <= normStart || normAngle >= normEnd;
            }
        } else {
            if (normStart <= normEnd) {
                return normAngle >= normStart && normAngle <= normEnd;
            } else {
                return normAngle >= normStart || normAngle <= normEnd;
            }
        }
    }

    /**
     * Sort hit results by priority and distance
     */
    static sortHitResults(
        results: HitTestResult[],
        priorityOrder: HitTestType[] = DEFAULT_HIT_TEST_PRIORITY
    ): HitTestResult[] {
        return results.sort((a, b) => {
            // First sort by priority
            const priorityA = priorityOrder.indexOf(a.type);
            const priorityB = priorityOrder.indexOf(b.type);

            if (priorityA !== priorityB) {
                // Lower index = higher priority
                return priorityA - priorityB;
            }

            // Then sort by distance
            return a.distance - b.distance;
        });
    }

    /**
     * Filter hit results based on configuration
     */
    static filterHitResults(
        results: HitTestResult[],
        config: HitTestConfig
    ): HitTestResult[] {
        let filtered = results;

        // Filter by excluded types
        if (config.excludeTypes && config.excludeTypes.length > 0) {
            filtered = filtered.filter(
                (r) => !config.excludeTypes!.includes(r.type)
            );
        }

        // Filter by tolerance
        filtered = filtered.filter((r) => r.distance <= config.tolerance);

        return filtered;
    }

    /**
     * Check if a point is near a shape within tolerance
     */
    static isPointNearShape(
        point: Point2D,
        shape: Shape,
        tolerance: number
    ): boolean {
        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                return (
                    this.distanceToLineSegment(point, line.start, line.end) <
                    tolerance
                );

            case GeometryType.CIRCLE:
                const circle = shape.geometry as Circle;
                const distToCenter = this.distance(point, circle.center);
                return Math.abs(distToCenter - circle.radius) < tolerance;

            case GeometryType.ARC:
                const arc = shape.geometry as Arc;
                return (
                    this.distanceToArc(
                        point,
                        arc.center,
                        arc.radius,
                        arc.startAngle,
                        arc.endAngle,
                        arc.clockwise
                    ) < tolerance
                );

            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;
                if (!polyline.shapes || polyline.shapes.length === 0)
                    return false;

                // Check each shape in the polyline
                for (const polylineShape of polyline.shapes) {
                    if (
                        this.isPointNearShape(point, polylineShape, tolerance)
                    ) {
                        return true;
                    }
                }
                return false;

            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;

                // Calculate distance from point to ellipse perimeter
                const distanceToPerimeter = distanceFromEllipsePerimeter(
                    point,
                    ellipse
                );

                // Check if within tolerance
                if (distanceToPerimeter > tolerance) return false;

                // For full ellipses, no additional checks needed
                if (isFullEllipse(ellipse)) return true;

                // For ellipse arcs, check if point is within angular range
                // Use the shared coordinate transformation function
                const { normalizedX, normalizedY } =
                    transformPointToEllipseCoordinates(point, ellipse);
                const pointParam = Math.atan2(normalizedY, normalizedX);

                // Check if point parameter is within arc range
                const startParam = ellipse.startParam!;
                const endParam = ellipse.endParam!;

                // Normalize parameters to [0, 2π]
                const normalizeParam = (param: number) => {
                    while (param < 0) param += 2 * Math.PI;
                    while (param >= 2 * Math.PI) param -= 2 * Math.PI;
                    return param;
                };

                const normStart = normalizeParam(startParam);
                const normEnd = normalizeParam(endParam);
                const normPoint = normalizeParam(pointParam);

                if (normStart <= normEnd) {
                    return normPoint >= normStart && normPoint <= normEnd;
                } else {
                    // Arc crosses 0 degrees
                    return normPoint >= normStart || normPoint <= normEnd;
                }

            case GeometryType.SPLINE:
                const spline = shape.geometry as Spline;
                // For hit testing, use properly evaluated NURBS points
                const evaluatedPoints = tessellateSpline(spline, {
                    numSamples: 50,
                }).points; // Use fewer points for hit testing performance

                if (!evaluatedPoints || evaluatedPoints.length < 2)
                    return false;

                for (let i = 0; i < evaluatedPoints.length - 1; i++) {
                    if (
                        this.distanceToLineSegment(
                            point,
                            evaluatedPoints[i],
                            evaluatedPoints[i + 1]
                        ) < tolerance
                    ) {
                        return true;
                    }
                }

                // Check closing segment if spline is closed
                if (spline.closed && evaluatedPoints.length > 2) {
                    if (
                        this.distanceToLineSegment(
                            point,
                            evaluatedPoints[evaluatedPoints.length - 1],
                            evaluatedPoints[0]
                        ) < tolerance
                    ) {
                        return true;
                    }
                }

                return false;

            default:
                return false;
        }
    }
}
