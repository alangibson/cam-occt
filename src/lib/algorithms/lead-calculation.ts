import type { Point2D, Shape } from '../types/geometry';
import type { Polyline } from '$lib/geometry/polyline';
import type { Line } from '$lib/geometry/line';
import type { Arc } from '$lib/geometry/arc';
import type { Circle } from '$lib/geometry/circle';
import { GeometryType } from '../types/geometry';
import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { LeadType, CutDirection } from '../types/direction';
import {
    validateLeadConfiguration,
    type LeadValidationResult,
} from './lead-validation';
import { isPointInPolygon } from '../utils/geometric-operations';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import { polylineToPoints } from '$lib/geometry/polyline';
import {
    GEOMETRIC_PRECISION_TOLERANCE,
    HALF_PERCENT,
    THREE_QUARTERS_PERCENT,
    QUARTER_PERCENT,
} from '$lib/geometry/math';
import { MAX_ITERATIONS } from '../constants';
import { HALF_CIRCLE_DEG, FULL_CIRCLE_DEG } from '$lib/geometry/circle';
import {
    OCTAGON_SIDES,
    SMALL_ANGLE_INCREMENT_DEG,
    DEFAULT_TESSELLATION_SEGMENTS,
    QUARTER_CIRCLE_QUADRANTS,
    LEAD_REACHABLE_DISTANCE_MULTIPLIER,
} from '../geometry/constants';
import { MIN_VERTICES_FOR_LINE } from '$lib/geometry/line';

export interface LeadInConfig {
    type: LeadType;
    length: number; // For arc: length along the arc
    flipSide?: boolean; // Flip which side of the chain the lead is on
    angle?: number; // Manual rotation angle (degrees, 0-360). If undefined, auto-calculated
    fit?: boolean; // Whether to automatically adjust length to avoid solid areas
}

export interface LeadOutConfig {
    type: LeadType;
    length: number; // For arc: length along the arc
    flipSide?: boolean; // Flip which side of the chain the lead is on
    angle?: number; // Manual rotation angle (degrees, 0-360). If undefined, auto-calculated
    fit?: boolean; // Whether to automatically adjust length to avoid solid areas
}

export interface LeadGeometry {
    points: Point2D[];
    type: LeadType;
}

export interface LeadResult {
    leadIn?: LeadGeometry;
    leadOut?: LeadGeometry;
    warnings?: string[];
    validation?: LeadValidationResult;
}

/**
 * Calculate lead-in and lead-out geometry for a chain.
 * Leads must be placed appropriately based on the context (inside holes, outside shells).
 * Lead direction respects the cut direction for proper tangency.
 */
export function calculateLeads(
    chain: Chain,
    leadInConfig: LeadInConfig,
    leadOutConfig: LeadOutConfig,
    cutDirection: CutDirection = CutDirection.NONE,
    part?: DetectedPart
): LeadResult {
    const result: LeadResult = {};
    const warnings: string[] = [];

    // 1. VALIDATION PIPELINE - Run comprehensive validation first
    const validation: LeadValidationResult = validateLeadConfiguration(
        { leadIn: leadInConfig, leadOut: leadOutConfig, cutDirection },
        chain,
        part
    );

    result.validation = validation;

    // Add validation warnings to the result
    if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
    }

    // If validation fails with errors, return early with validation results
    if (!validation.isValid && validation.severity === 'error') {
        result.warnings = warnings;
        return result;
    }

    // Skip if no leads requested
    if (leadInConfig.type === 'none' && leadOutConfig.type === 'none') {
        return result;
    }

    // Determine if chain is a hole or shell
    const isHole: boolean = part
        ? part.holes.some(
              (h: DetectedPart['holes'][0]) => h.chain.id === chain.id
          )
        : false;
    const isShell: boolean = part ? part.shell.chain.id === chain.id : false;

    // Get chain start and end points
    const startPoint: Point2D | null = getChainStartPoint(chain);
    const endPoint: Point2D | null = getChainEndPoint(chain);

    if (!startPoint || !endPoint) {
        return result;
    }

    // Calculate lead-in
    if (leadInConfig.type !== 'none' && leadInConfig.length > 0) {
        result.leadIn = calculateLead(
            chain,
            startPoint,
            leadInConfig,
            true,
            isHole,
            isShell,
            cutDirection,
            part,
            warnings
        );
    }

    // Calculate lead-out
    if (leadOutConfig.type !== 'none' && leadOutConfig.length > 0) {
        result.leadOut = calculateLead(
            chain,
            endPoint,
            leadOutConfig,
            false,
            isHole,
            isShell,
            cutDirection,
            part,
            warnings
        );
    }

    // Add warnings to result if any were generated
    if (warnings.length > 0) {
        result.warnings = warnings;
    }

    return result;
}

/**
 * Calculate a single lead (in or out).
 */
function calculateLead(
    chain: Chain,
    point: Point2D,
    config: LeadInConfig | LeadOutConfig,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part?: DetectedPart,
    warnings: string[] = []
): LeadGeometry | undefined {
    if (config.type === LeadType.ARC) {
        return calculateArcLead(
            chain,
            point,
            config.length,
            isLeadIn,
            isHole,
            isShell,
            cutDirection,
            part,
            warnings,
            config.flipSide,
            config.angle,
            config.fit
        );
    } else if (config.type === LeadType.LINE) {
        return calculateLineLead(
            chain,
            point,
            config.length,
            isLeadIn,
            isHole,
            isShell,
            cutDirection,
            part,
            warnings,
            config.flipSide,
            config.angle,
            config.fit
        );
    }
    return undefined;
}

/**
 * Calculate an arc lead that is tangent to the chain at the connection point.
 * Arc sweep is limited to 90 degrees maximum.
 * Lead direction depends on cut direction, hole vs shell context.
 * If the lead intersects solid areas of the part, rotate it in 5-degree increments to find a clear path.
 * If no clear path is found after 360 degrees of rotation, adds a warning.
 */
function calculateArcLead(
    chain: Chain,
    point: Point2D,
    arcLength: number,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part?: DetectedPart,
    warnings: string[] = [],
    flipSide: boolean = false,
    manualAngle?: number,
    fit: boolean = true
): LeadGeometry {
    // Get the tangent direction at the point
    const tangent: Point2D = getChainTangent(chain, point, isLeadIn);

    // Calculate the base normal direction considering cut direction
    const baseCurveDirection: Point2D = getLeadCurveDirection(
        tangent,
        isHole,
        isShell,
        cutDirection,
        chain,
        point,
        part,
        arcLength,
        flipSide
    );

    // Calculate arc parameters with 90-degree maximum sweep
    const maxSweepAngle: number = Math.PI / 2; // 90 degrees

    // For a given arc length and maximum sweep, calculate minimum radius
    const minRadius: number = arcLength / maxSweepAngle;

    // Use the minimum radius and adjust sweep angle to get exact arc length
    const radius: number = minRadius;
    const sweepAngle: number = arcLength / radius; // This will be <= 90 degrees

    // Ensure we don't exceed 90 degrees
    const actualSweepAngle: number = Math.min(sweepAngle, maxSweepAngle);

    // Determine curve direction strategy: manual absolute angle or automatic optimization
    let curveDirectionsToTry: { x: number; y: number }[];

    if (manualAngle !== undefined) {
        // Use manual angle as absolute direction (unit circle: 0° = right, 90° = up, etc.)
        // Work in world coordinates (Y+ up), canvas rendering will handle coordinate conversion
        const manualAngleRad: number =
            (manualAngle * Math.PI) / HALF_CIRCLE_DEG;
        const absoluteDirection: Point2D = {
            x: Math.cos(manualAngleRad),
            y: Math.sin(manualAngleRad), // Use standard unit circle (Y+ up for world coordinates)
        };
        curveDirectionsToTry = [absoluteDirection];
    } else {
        // Try different curve directions up to 360 degrees to avoid solid areas
        const rotationStep: number =
            (SMALL_ANGLE_INCREMENT_DEG * Math.PI) / HALF_CIRCLE_DEG; // 5 degrees in radians
        const maxRotations: number =
            FULL_CIRCLE_DEG / SMALL_ANGLE_INCREMENT_DEG; // Try up to 360 degrees of rotation (72 * 5 = 360)
        curveDirectionsToTry = Array.from({ length: maxRotations }, (_, i) => {
            const rotationAngle: number = i * rotationStep;
            return rotateCurveDirection(baseCurveDirection, rotationAngle);
        });
    }

    // Try full length first, then shorter lengths if needed (only if fit is enabled)
    const lengthAttempts: number[] = fit
        ? [1.0, THREE_QUARTERS_PERCENT, HALF_PERCENT, QUARTER_PERCENT]
        : [1.0]; // Try 100%, 75%, 50%, 25% of original length if fit enabled, otherwise only full length

    for (const lengthFactor of lengthAttempts) {
        const adjustedArcLength: number = arcLength * lengthFactor;
        const adjustedRadius: number = adjustedArcLength / maxSweepAngle;
        const adjustedSweepAngle: number = Math.min(
            adjustedArcLength / adjustedRadius,
            maxSweepAngle
        );

        for (const curveDirection of curveDirectionsToTry) {
            // Calculate arc center position for perfect tangency
            const arcCenter: Point2D = {
                x: point.x + curveDirection.x * adjustedRadius,
                y: point.y + curveDirection.y * adjustedRadius,
            };

            // Generate arc points ensuring tangency
            let points: Point2D[];
            if (manualAngle !== undefined) {
                // For manual angles, use simpler arc generation that respects the angle
                points = generateSimpleArcPoints(
                    arcCenter,
                    adjustedRadius,
                    point,
                    adjustedSweepAngle,
                    isLeadIn,
                    curveDirection
                );
            } else {
                points = generateTangentArcPoints(
                    arcCenter,
                    adjustedRadius,
                    point,
                    adjustedSweepAngle,
                    isLeadIn,
                    tangent,
                    curveDirection
                );
            }

            // If no part context, use the first valid lead
            if (!part) {
                return {
                    points,
                    type: LeadType.ARC,
                };
            }

            // Check if this lead avoids solid areas using proper point-in-polygon detection
            const solidPointCount: number = countSolidAreaPoints(
                points,
                part,
                point
            );
            const intersectsSolid: boolean = solidPointCount > 0;

            if (!intersectsSolid) {
                return {
                    points,
                    type: LeadType.ARC,
                };
            }
        }
    }

    // If no rotation avoids solid areas after trying all angles and lengths, add a warning
    if (part) {
        const leadType: string = isLeadIn ? 'Lead-in' : 'Lead-out';
        const shapeType: string = isHole ? 'hole' : isShell ? 'shell' : 'shape';
        warnings.push(
            `${leadType} for ${shapeType} intersects solid material and cannot be avoided. Consider reducing lead length or manually adjusting the path.`
        );
    }

    // Return the base direction as fallback
    const arcCenter: Point2D = {
        x: point.x + baseCurveDirection.x * radius,
        y: point.y + baseCurveDirection.y * radius,
    };

    let points: Point2D[];
    if (manualAngle !== undefined) {
        // For manual angles, use simpler arc generation that respects the angle
        points = generateSimpleArcPoints(
            arcCenter,
            radius,
            point,
            actualSweepAngle,
            isLeadIn,
            baseCurveDirection
        );
    } else {
        points = generateTangentArcPoints(
            arcCenter,
            radius,
            point,
            actualSweepAngle,
            isLeadIn,
            tangent,
            baseCurveDirection
        );
    }

    return {
        points,
        type: LeadType.ARC,
    };
}

/**
 * Calculate a straight line lead that is tangent to the chain at the connection point.
 * Line direction depends on cut direction, hole vs shell context.
 * If the lead intersects solid areas of the part, rotate it in 5-degree increments to find a clear path.
 * If no clear path is found after 360 degrees of rotation, adds a warning.
 */
function calculateLineLead(
    chain: Chain,
    point: Point2D,
    lineLength: number,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part?: DetectedPart,
    warnings: string[] = [],
    flipSide: boolean = false,
    manualAngle?: number,
    fit: boolean = true
): LeadGeometry {
    // Get the tangent direction at the point
    const tangent: Point2D = getChainTangent(chain, point, isLeadIn);

    // Calculate the base normal direction considering cut direction
    const baseLeadDirection: Point2D = getLeadCurveDirection(
        tangent,
        isHole,
        isShell,
        cutDirection,
        chain,
        point,
        part,
        lineLength,
        flipSide
    );

    // Determine lead direction strategy: manual absolute angle or automatic optimization
    let leadDirectionsToTry: { x: number; y: number }[];

    if (manualAngle !== undefined) {
        // Use manual angle as absolute direction (unit circle: 0° = right, 90° = up, etc.)
        // Work in world coordinates (Y+ up), canvas rendering will handle coordinate conversion
        const manualAngleRad: number =
            (manualAngle * Math.PI) / HALF_CIRCLE_DEG;
        const absoluteDirection: Point2D = {
            x: Math.cos(manualAngleRad),
            y: Math.sin(manualAngleRad), // Use standard unit circle (Y+ up for world coordinates)
        };
        leadDirectionsToTry = [absoluteDirection];
    } else {
        // Try different lead directions up to 360 degrees to avoid solid areas
        const rotationStep: number =
            (SMALL_ANGLE_INCREMENT_DEG * Math.PI) / HALF_CIRCLE_DEG; // 5 degrees in radians
        const maxRotations: number =
            FULL_CIRCLE_DEG / SMALL_ANGLE_INCREMENT_DEG; // Try up to 360 degrees of rotation (72 * 5 = 360)
        leadDirectionsToTry = Array.from({ length: maxRotations }, (_, i) => {
            const rotationAngle: number = i * rotationStep;
            return rotateCurveDirection(baseLeadDirection, rotationAngle);
        });
    }

    // Try full length first, then shorter lengths if needed (only if fit is enabled)
    const lengthAttempts: number[] = fit
        ? [1.0, THREE_QUARTERS_PERCENT, HALF_PERCENT, QUARTER_PERCENT]
        : [1.0]; // Try 100%, 75%, 50%, 25% of original length if fit enabled, otherwise only full length

    for (const lengthFactor of lengthAttempts) {
        const adjustedLineLength: number = lineLength * lengthFactor;

        for (const leadDirection of leadDirectionsToTry) {
            // Generate line points
            const points: Point2D[] = generateTangentLinePoints(
                point,
                adjustedLineLength,
                isLeadIn,
                tangent,
                leadDirection
            );

            // If no part context, use the first valid lead
            if (!part) {
                return {
                    points,
                    type: LeadType.LINE,
                };
            }

            // Check if this lead avoids solid areas using proper point-in-polygon detection
            const solidPointCount: number = countSolidAreaPoints(
                points,
                part,
                point
            );
            const intersectsSolid: boolean = solidPointCount > 0;

            if (!intersectsSolid) {
                return {
                    points,
                    type: LeadType.LINE,
                };
            }
        }
    }

    // If no rotation avoids solid areas after trying all angles and lengths, add a warning
    if (part) {
        const leadType: string = isLeadIn ? 'Lead-in' : 'Lead-out';
        const shapeType: string = isHole ? 'hole' : isShell ? 'shell' : 'shape';
        warnings.push(
            `${leadType} for ${shapeType} intersects solid material and cannot be avoided. Consider reducing lead length or manually adjusting the path.`
        );
    }

    // Return the base direction as fallback
    const points: Point2D[] = generateTangentLinePoints(
        point,
        lineLength,
        isLeadIn,
        tangent,
        baseLeadDirection
    );

    return {
        points,
        type: LeadType.LINE,
    };
}

/**
 * Generate points along a simple arc lead that respects manual angles.
 * This is used when manual angles are specified to avoid complex tangency calculations.
 */
function generateSimpleArcPoints(
    center: Point2D,
    radius: number,
    connectionPoint: Point2D,
    sweepAngle: number,
    isLeadIn: boolean,
    _direction: Point2D
): Point2D[] {
    const points: Point2D[] = [];
    const segments: number = Math.max(
        OCTAGON_SIDES,
        Math.ceil((sweepAngle * radius) / 2)
    ); // Approximate 2mm segments

    // Calculate the angle of the connection point relative to the arc center
    const connectionAngle: number = Math.atan2(
        connectionPoint.y - center.y,
        connectionPoint.x - center.x
    );

    if (isLeadIn) {
        // Lead-in: arc starts away from connection and ends at connection point
        const startAngle: number = connectionAngle - sweepAngle; // Start earlier in the arc

        for (let i: number = 0; i <= segments; i++) {
            const t: number = i / segments;
            const angle: number = startAngle + t * sweepAngle; // Sweep from start to connection

            if (i === segments) {
                // Ensure last point is exactly the connection point
                points.push(connectionPoint);
            } else {
                points.push({
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + radius * Math.sin(angle),
                });
            }
        }
    } else {
        // Lead-out: arc starts at connection point and curves away
        for (let i: number = 0; i <= segments; i++) {
            const t: number = i / segments;
            const angle: number = connectionAngle + t * sweepAngle; // Sweep from connection outward

            if (i === 0) {
                // Ensure first point is exactly the connection point
                points.push(connectionPoint);
            } else {
                points.push({
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + radius * Math.sin(angle),
                });
            }
        }
    }

    return points;
}

/**
 * Generate points along a tangent arc lead.
 * The arc starts tangent to the chain and curves in the specified direction.
 */
function generateTangentArcPoints(
    center: Point2D,
    radius: number,
    connectionPoint: Point2D,
    sweepAngle: number,
    isLeadIn: boolean,
    tangent: Point2D,
    curveDirection: Point2D
): Point2D[] {
    const points: Point2D[] = [];
    const segments: number = Math.max(
        OCTAGON_SIDES,
        Math.ceil((sweepAngle * radius) / 2)
    ); // Approximate 2mm segments

    // For a truly tangent arc, we need to ensure the tangent direction at the connection point
    // matches the chain tangent. The tangent to a circle at any point is perpendicular to the
    // radius at that point.

    // Calculate what the tangent angle should be at the connection point
    const tangentAngle: number = Math.atan2(tangent.y, tangent.x);

    // The radius angle at the connection point should be perpendicular to the tangent
    // So radius angle = tangent angle ± 90°
    const radiusAngle1: number = tangentAngle + Math.PI / 2;
    const radiusAngle2: number = tangentAngle - Math.PI / 2;

    // Choose the radius angle that points from connection point toward the calculated center
    const actualRadiusAngle: number = Math.atan2(
        center.y - connectionPoint.y,
        center.x - connectionPoint.x
    );

    // Determine which radius angle is closer to the actual one
    const diff1: number = Math.abs(
        normalizeAngle(radiusAngle1 - actualRadiusAngle)
    );
    const diff2: number = Math.abs(
        normalizeAngle(radiusAngle2 - actualRadiusAngle)
    );
    const correctRadiusAngle: number =
        diff1 < diff2 ? radiusAngle1 : radiusAngle2;

    // Adjust the arc center to ensure perfect tangency
    const adjustedCenter: Point2D = {
        x: connectionPoint.x + radius * Math.cos(correctRadiusAngle),
        y: connectionPoint.y + radius * Math.sin(correctRadiusAngle),
    };

    // Determine sweep direction based on the curve direction relative to tangent
    // Cross product: tangent × curveDirection. If positive, curveDirection is to the left of tangent
    const crossProduct: number =
        tangent.x * curveDirection.y - tangent.y * curveDirection.x;
    const sweepCounterClockwise: boolean = crossProduct > 0;

    // For perfect tangency, the connection point angle relative to the adjusted center
    const connectionAngleFromAdjustedCenter: number = Math.atan2(
        connectionPoint.y - adjustedCenter.y,
        connectionPoint.x - adjustedCenter.x
    );

    // Generate arc points using the adjusted center
    if (isLeadIn) {
        // Lead-in: arc starts away from connection and ends at connection point
        const startAngle: number = sweepCounterClockwise
            ? connectionAngleFromAdjustedCenter - sweepAngle // Start behind connection point
            : connectionAngleFromAdjustedCenter + sweepAngle; // Start ahead of connection point

        for (let i: number = 0; i <= segments; i++) {
            const t: number = i / segments;
            const angle: number = sweepCounterClockwise
                ? startAngle + t * sweepAngle // Sweep counter-clockwise to connection
                : startAngle - t * sweepAngle; // Sweep clockwise to connection

            if (i === segments) {
                // Ensure last point is exactly the connection point
                points.push(connectionPoint);
            } else if (i === segments - 1) {
                // Special handling for second-to-last point to ensure tangency
                // Position it along the tangent direction from the connection point
                const segmentLength: number = (radius * sweepAngle) / segments; // Approximate segment length
                const backwardTangent: Point2D = {
                    x: -tangent.x,
                    y: -tangent.y,
                }; // Opposite direction
                points.push({
                    x: connectionPoint.x + backwardTangent.x * segmentLength,
                    y: connectionPoint.y + backwardTangent.y * segmentLength,
                });
            } else {
                points.push({
                    x: adjustedCenter.x + radius * Math.cos(angle),
                    y: adjustedCenter.y + radius * Math.sin(angle),
                });
            }
        }
    } else {
        // Lead-out: arc starts at connection point and curves away
        for (let i: number = 0; i <= segments; i++) {
            const t: number = i / segments;
            const angle: number = sweepCounterClockwise
                ? connectionAngleFromAdjustedCenter + t * sweepAngle // Sweep counter-clockwise from connection
                : connectionAngleFromAdjustedCenter - t * sweepAngle; // Sweep clockwise from connection

            if (i === 0) {
                // Ensure first point is exactly the connection point
                points.push(connectionPoint);
            } else if (i === 1) {
                // Special handling for second point to ensure tangency
                // Position it along the tangent direction from the connection point
                const segmentLength: number = (radius * sweepAngle) / segments; // Approximate segment length
                points.push({
                    x: connectionPoint.x + tangent.x * segmentLength,
                    y: connectionPoint.y + tangent.y * segmentLength,
                });
            } else {
                points.push({
                    x: adjustedCenter.x + radius * Math.cos(angle),
                    y: adjustedCenter.y + radius * Math.sin(angle),
                });
            }
        }
    }

    return points;
}

/**
 * Generate points along a tangent line lead.
 * The line starts tangent to the chain and extends in the specified direction.
 */
function generateTangentLinePoints(
    connectionPoint: Point2D,
    lineLength: number,
    isLeadIn: boolean,
    tangent: Point2D,
    leadDirection: Point2D
): Point2D[] {
    const points: Point2D[] = [];

    // For line leads, we create a straight line that extends from the connection point
    // in the specified lead direction

    if (isLeadIn) {
        // Lead-in: line starts away from connection and ends at connection point
        // leadDirection points FROM connection TO start, so we ADD it for lead-in
        const startPoint: Point2D = {
            x: connectionPoint.x + leadDirection.x * lineLength,
            y: connectionPoint.y + leadDirection.y * lineLength,
        };

        // Generate points along the line (start to connection)
        const segments: number = Math.max(
            MIN_VERTICES_FOR_LINE,
            Math.ceil(lineLength / 2)
        ); // Approximate 2mm segments, minimum 2 points
        for (let i: number = 0; i <= segments; i++) {
            const t: number = i / segments;
            if (i === segments) {
                // Ensure last point is exactly the connection point
                points.push(connectionPoint);
            } else {
                points.push({
                    x: startPoint.x + (connectionPoint.x - startPoint.x) * t,
                    y: startPoint.y + (connectionPoint.y - startPoint.y) * t,
                });
            }
        }
    } else {
        // Lead-out: line starts at connection point and extends away
        // leadDirection points FROM connection TO end, so we ADD it for lead-out
        const endPoint: Point2D = {
            x: connectionPoint.x + leadDirection.x * lineLength,
            y: connectionPoint.y + leadDirection.y * lineLength,
        };

        // Generate points along the line (connection to end)
        const segments: number = Math.max(
            MIN_VERTICES_FOR_LINE,
            Math.ceil(lineLength / 2)
        ); // Approximate 2mm segments, minimum 2 points
        for (let i: number = 0; i <= segments; i++) {
            const t: number = i / segments;
            if (i === 0) {
                // Ensure first point is exactly the connection point
                points.push(connectionPoint);
            } else {
                points.push({
                    x: connectionPoint.x + (endPoint.x - connectionPoint.x) * t,
                    y: connectionPoint.y + (endPoint.y - connectionPoint.y) * t,
                });
            }
        }
    }

    return points;
}

/**
 * Normalize an angle to be between -π and π
 */
function normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Get the start point of a chain.
 */
function getChainStartPoint(chain: Chain): Point2D | null {
    if (chain.shapes.length === 0) return null;

    const firstShape: Shape = chain.shapes[0];
    try {
        return getShapeStartPoint(firstShape);
    } catch (error) {
        console.warn('Error getting start point for shape:', firstShape, error);
        return null;
    }
}

/**
 * Get the end point of a chain.
 */
function getChainEndPoint(chain: Chain): Point2D | null {
    if (chain.shapes.length === 0) return null;

    const lastShape: Shape = chain.shapes[chain.shapes.length - 1];
    try {
        return getShapeEndPoint(lastShape);
    } catch (error) {
        console.warn('Error getting end point for shape:', lastShape, error);
        return null;
    }
}

/**
 * Get the tangent direction at a point on the chain.
 */
function getChainTangent(
    chain: Chain,
    point: Point2D,
    isStart: boolean
): Point2D {
    if (chain.shapes.length === 0) {
        return { x: 1, y: 0 }; // Default to horizontal
    }

    const shape: Shape = isStart
        ? chain.shapes[0]
        : chain.shapes[chain.shapes.length - 1];

    switch (shape.type) {
        case GeometryType.LINE:
            // Line tangent is just the line direction
            const line: import('$lib/types/geometry').Line =
                shape.geometry as Line;
            const dx: number = line.end.x - line.start.x;
            const dy: number = line.end.y - line.start.y;
            const len: number = Math.sqrt(dx * dx + dy * dy);
            return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };

        case GeometryType.ARC:
            // Arc tangent is perpendicular to radius at the point
            const arc: Arc = shape.geometry as Arc;
            const angle: number = isStart ? arc.startAngle : arc.endAngle;
            // Tangent is perpendicular to radius
            // If arc goes counterclockwise, tangent points in +90° direction
            // If arc goes clockwise, tangent points in -90° direction
            const isCounterClockwise: boolean = arc.endAngle > arc.startAngle;
            const tangentAngle: number =
                angle + (isCounterClockwise ? Math.PI / 2 : -Math.PI / 2);
            return {
                x: Math.cos(tangentAngle),
                y: Math.sin(tangentAngle),
            };

        case GeometryType.CIRCLE:
            // Circle tangent at any point is perpendicular to radius
            const circle: import('$lib/types/geometry').Circle =
                shape.geometry as Circle;
            const cdx: number = point.x - circle.center.x;
            const cdy: number = point.y - circle.center.y;
            const clen: number = Math.sqrt(cdx * cdx + cdy * cdy);
            if (clen > 0) {
                // Tangent is perpendicular to radius, assuming counterclockwise
                return { x: -cdy / clen, y: cdx / clen };
            }
            return { x: 1, y: 0 };

        case GeometryType.POLYLINE:
            // Polyline tangent at start/end
            const points: Point2D[] = polylineToPoints(
                shape.geometry as Polyline
            );
            if (isStart && points.length >= 2) {
                const dx: number = points[1].x - points[0].x;
                const dy: number = points[1].y - points[0].y;
                const len: number = Math.sqrt(dx * dx + dy * dy);
                return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
            } else if (!isStart && points.length >= 2) {
                const n: number = points.length;
                const dx: number = points[n - 1].x - points[n - 2].x;
                const dy: number = points[n - 1].y - points[n - 2].y;
                const len: number = Math.sqrt(dx * dx + dy * dy);
                return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
            }
            return { x: 1, y: 0 };

        default:
            return { x: 1, y: 0 };
    }
}

/**
 * Calculate the curve direction for lead placement.
 * This determines which side of the tangent line the arc curves to.
 * Uses cut direction and hole/shell context for proper tangency.
 */
function getLeadCurveDirection(
    tangent: Point2D,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    chain: Chain,
    point: Point2D,
    part?: DetectedPart,
    leadLength?: number,
    flipSide: boolean = false
): Point2D {
    // Base normal directions (perpendicular to tangent)
    const leftNormal: Point2D = { x: -tangent.y, y: tangent.x }; // 90° counterclockwise
    const rightNormal: Point2D = { x: tangent.y, y: -tangent.x }; // 90° clockwise

    let selectedDirection: Point2D = leftNormal; // Default fallback

    // Use cut direction to determine lead placement for proper tangency
    if (cutDirection !== 'none') {
        // For shells (outer boundaries):
        if (isShell) {
            // Default: leads should be placed outside the part
            // For clockwise cuts: lead curves to maintain clockwise flow
            // For counterclockwise cuts: lead curves to maintain counterclockwise flow
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? rightNormal
                    : leftNormal;

            // Check if there are nearby holes that could provide better lead placement
            // But only use hole direction if it's consistent with cut direction preference
            const nearbyHoleDirection: Point2D | null = getNearbyHoleDirection(
                chain,
                point,
                tangent,
                part,
                leadLength
            );
            if (nearbyHoleDirection) {
                // Calculate dot product to see if hole direction aligns with cut direction preference
                const dotProduct: number =
                    selectedDirection.x * nearbyHoleDirection.x +
                    selectedDirection.y * nearbyHoleDirection.y;
                // Only use hole direction if it's reasonably aligned (dot product > 0.3)
                // eslint-disable-next-line no-magic-numbers
                if (dotProduct > 0.3) {
                    selectedDirection = nearbyHoleDirection;
                }
                // Otherwise, stick with cut direction preference
            }
        }

        // For holes (inner boundaries):
        else if (isHole) {
            // Leads should be placed inside the hole (away from solid material)
            // For clockwise holes: lead curves opposite to shell direction
            // For counterclockwise holes: lead curves opposite to shell direction
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? leftNormal
                    : rightNormal;
        }

        // For chains without part context, still respect cut direction
        else if (!isHole && !isShell) {
            // Default behavior: assume it's an outer boundary
            selectedDirection =
                cutDirection === CutDirection.CLOCKWISE
                    ? rightNormal
                    : leftNormal;
        }
    }
    // Fallback: If no cut direction is specified, use geometric analysis
    else {
        // For shells, try to place leads outward
        if (isShell) {
            const outwardNormal: Point2D | null = calculateLocalOutwardNormal(
                chain,
                point,
                tangent
            );
            if (outwardNormal) {
                selectedDirection = outwardNormal;
            } else {
                selectedDirection = leftNormal; // Default fallback
            }
        }
        // For holes, try to place leads inward
        else if (isHole) {
            const outwardNormal: Point2D | null = calculateLocalOutwardNormal(
                chain,
                point,
                tangent
            );
            if (outwardNormal) {
                // For holes, we want the opposite of outward (inward)
                selectedDirection = {
                    x: -outwardNormal.x,
                    y: -outwardNormal.y,
                };
            } else {
                selectedDirection = leftNormal; // Default fallback
            }
        }
        // Final fallback: use centroid-based approach
        else {
            const centroid: Point2D = calculateChainCentroid(chain);
            const toCentroid: Point2D = {
                x: centroid.x - point.x,
                y: centroid.y - point.y,
            };

            const toCentroidLen: number = Math.sqrt(
                toCentroid.x * toCentroid.x + toCentroid.y * toCentroid.y
            );
            if (toCentroidLen > 0) {
                toCentroid.x /= toCentroidLen;
                toCentroid.y /= toCentroidLen;
            }

            if (isHole) {
                const leftDot: number =
                    leftNormal.x * toCentroid.x + leftNormal.y * toCentroid.y;
                const rightDot: number =
                    rightNormal.x * toCentroid.x + rightNormal.y * toCentroid.y;
                selectedDirection =
                    leftDot > rightDot ? leftNormal : rightNormal;
            } else if (isShell) {
                const leftDot: number =
                    leftNormal.x * toCentroid.x + leftNormal.y * toCentroid.y;
                const rightDot: number =
                    rightNormal.x * toCentroid.x + rightNormal.y * toCentroid.y;
                selectedDirection =
                    leftDot < rightDot ? leftNormal : rightNormal;
            } else {
                selectedDirection = leftNormal;
            }
        }
    }

    // Apply flip if requested
    if (flipSide) {
        selectedDirection = {
            x: -selectedDirection.x,
            y: -selectedDirection.y,
        };
    }

    return selectedDirection;
}

/**
 * Check if there are nearby holes that could provide space for lead placement.
 * Returns a direction toward the nearest accessible hole, or null if none found.
 */
function getNearbyHoleDirection(
    chain: Chain,
    point: Point2D,
    tangent: Point2D,
    part?: DetectedPart,
    leadLength?: number
): Point2D | null {
    if (!part || part.holes.length === 0) {
        return null;
    }

    // Only consider holes that are reachable by the lead length
    // Use a reasonable multiplier (e.g., 3x lead length) to account for arc curvature
    const maxReachableDistance: number = leadLength
        ? leadLength * LEAD_REACHABLE_DISTANCE_MULTIPLIER
        : MAX_ITERATIONS;

    // Base normal directions (perpendicular to tangent)
    const leftNormal: Point2D = { x: -tangent.y, y: tangent.x }; // 90° counterclockwise
    const rightNormal: Point2D = { x: tangent.y, y: -tangent.x }; // 90° clockwise

    let nearestHole: { distance: number; direction: Point2D } | null = null;

    // Check each hole to find the nearest one
    for (const hole of part.holes) {
        // Calculate hole center
        const holeCenter: Point2D = calculateChainCentroid(hole.chain);

        // Vector from connection point to hole center
        const toHole: Point2D = {
            x: holeCenter.x - point.x,
            y: holeCenter.y - point.y,
        };

        const distance: number = Math.sqrt(
            toHole.x * toHole.x + toHole.y * toHole.y
        );

        // Normalize the direction
        if (distance > 0) {
            toHole.x /= distance;
            toHole.y /= distance;
        }

        // Check if hole is reachable by the lead length
        if (distance < maxReachableDistance) {
            // Determine which normal direction (left or right) points more toward the hole
            const leftDot: number =
                leftNormal.x * toHole.x + leftNormal.y * toHole.y;
            const rightDot: number =
                rightNormal.x * toHole.x + rightNormal.y * toHole.y;

            // Choose the normal that points more toward the hole
            const holeDirection: Point2D =
                leftDot > rightDot ? leftNormal : rightNormal;

            // Track the nearest hole
            if (!nearestHole || distance < nearestHole.distance) {
                nearestHole = { distance, direction: holeDirection };
            }
        }
    }

    return nearestHole ? nearestHole.direction : null;
}

/**
 * Calculate the local outward normal using curvature analysis.
 * This works by analyzing adjacent points to determine which direction leads away from the shape.
 */
function calculateLocalOutwardNormal(
    chain: Chain,
    point: Point2D,
    tangent: Point2D
): Point2D | null {
    // Find the shape and position within the chain that corresponds to this point
    const shapeInfo: { shapeIndex: number; isStart: boolean } | null =
        findPointInChain(chain, point);
    if (!shapeInfo) {
        return null;
    }

    // Get adjacent points for curvature analysis
    const adjacentPoints: { prev: Point2D; next: Point2D } | null =
        getAdjacentPoints(chain, shapeInfo);
    if (!adjacentPoints) {
        return null;
    }

    const { prev, next } = adjacentPoints;

    // Calculate vectors from point to adjacent points
    const toPrev: Point2D = { x: prev.x - point.x, y: prev.y - point.y };
    const toNext: Point2D = { x: next.x - point.x, y: next.y - point.y };

    // Normalize vectors
    const prevLen: number = Math.sqrt(
        toPrev.x * toPrev.x + toPrev.y * toPrev.y
    );
    const nextLen: number = Math.sqrt(
        toNext.x * toNext.x + toNext.y * toNext.y
    );

    if (prevLen > 0) {
        toPrev.x /= prevLen;
        toPrev.y /= prevLen;
    }

    if (nextLen > 0) {
        toNext.x /= nextLen;
        toNext.y /= nextLen;
    }

    // Calculate the bisector of the angle formed by adjacent points
    const bisector: Point2D = {
        x: (toPrev.x + toNext.x) / 2,
        y: (toPrev.y + toNext.y) / 2,
    };

    // Normalize bisector
    const bisectorLen: number = Math.sqrt(
        bisector.x * bisector.x + bisector.y * bisector.y
    );
    if (bisectorLen > 0) {
        bisector.x /= bisectorLen;
        bisector.y /= bisectorLen;
    }

    // The outward normal should point away from the bisector for convex areas,
    // or in the direction of the bisector for concave areas

    // Cross product to determine if we're in a convex or concave area
    // Using the turn direction from prev -> current -> next
    const cross: number =
        (toNext.x - toPrev.x) * tangent.y - (toNext.y - toPrev.y) * tangent.x;

    // Base normal directions
    const leftNormal: Point2D = { x: -tangent.y, y: tangent.x }; // 90° counterclockwise
    const rightNormal: Point2D = { x: tangent.y, y: -tangent.x }; // 90° clockwise

    // For convex curves (cross < 0), use the normal that points away from the bisector
    // For concave curves (cross > 0), use the normal that points with the bisector
    if (Math.abs(cross) < GEOMETRIC_PRECISION_TOLERANCE) {
        // Nearly straight - use default left normal
        return leftNormal;
    }

    // Determine which normal points more away from the shape
    const leftDotBisector: number =
        leftNormal.x * bisector.x + leftNormal.y * bisector.y;
    const rightDotBisector: number =
        rightNormal.x * bisector.x + rightNormal.y * bisector.y;

    if (cross > 0) {
        // Concave area - bisector points inward, so choose normal that opposes it
        return leftDotBisector < rightDotBisector ? leftNormal : rightNormal;
    } else {
        // Convex area - bisector points outward, so choose normal that aligns with it
        return leftDotBisector > rightDotBisector ? leftNormal : rightNormal;
    }
}

/**
 * Find which shape and position within a chain corresponds to a given point.
 */
function findPointInChain(
    chain: Chain,
    targetPoint: Point2D
): { shapeIndex: number; isStart: boolean } | null {
    const tolerance: number = GEOMETRIC_PRECISION_TOLERANCE;

    for (let i: number = 0; i < chain.shapes.length; i++) {
        const shape: Shape = chain.shapes[i];

        // Check start and end points of each shape
        try {
            const startPoint: Point2D = getShapeStartPoint(shape);
            const endPoint: Point2D = getShapeEndPoint(shape);

            if (distance(startPoint, targetPoint) < tolerance) {
                return { shapeIndex: i, isStart: true };
            }

            if (distance(endPoint, targetPoint) < tolerance) {
                return { shapeIndex: i, isStart: false };
            }
        } catch (error) {
            console.warn('Error getting shape points:', shape, error);
            continue;
        }
    }

    return null;
}

/**
 * Get adjacent points for curvature analysis.
 */
function getAdjacentPoints(
    chain: Chain,
    shapeInfo: { shapeIndex: number; isStart: boolean }
): { prev: Point2D; next: Point2D } | null {
    const { shapeIndex, isStart } = shapeInfo;
    const shapes: Shape[] = chain.shapes;
    const currentShape: Shape = shapes[shapeIndex];

    // Special handling for polylines since they contain multiple points
    if (currentShape.type === 'polyline') {
        const points: Point2D[] = polylineToPoints(
            currentShape.geometry as Polyline
        );

        if (isStart) {
            // For polyline start, prev is the second-to-last point (since last = first in closed polylines)
            const prevPoint: Point2D = points[points.length - 2];
            const nextPoint: Point2D = points[1]; // Second point in polyline

            if (prevPoint && nextPoint) {
                return { prev: prevPoint, next: nextPoint };
            }
        } else {
            // For polyline end, prev is second-to-last, next is from next shape
            const prevPoint: Point2D = points[points.length - 2];
            const nextShape: Shape = shapes[(shapeIndex + 1) % shapes.length];
            try {
                const nextStart: Point2D = getShapeStartPoint(nextShape);

                if (prevPoint) {
                    return { prev: prevPoint, next: nextStart };
                }
            } catch (error) {
                console.warn('Error getting next shape start point:', error);
            }
        }
    }

    // Original logic for non-polyline shapes
    if (isStart) {
        // Point is at the start of a shape
        const prevShape: Shape =
            shapes[(shapeIndex - 1 + shapes.length) % shapes.length];
        const nextShape: Shape = shapes[shapeIndex];

        try {
            const prevEnd: Point2D = getShapeEndPoint(prevShape);
            const nextPoint: Point2D | null =
                getShapePointAfterStart(nextShape);

            if (nextPoint) {
                return { prev: prevEnd, next: nextPoint };
            }
        } catch (error) {
            console.warn('Error getting adjacent points for start:', error);
        }
    } else {
        // Point is at the end of a shape
        const nextShape: Shape = shapes[(shapeIndex + 1) % shapes.length];

        try {
            const prevPoint: Point2D | null =
                getShapePointBeforeEnd(currentShape);
            const nextStart: Point2D = getShapeStartPoint(nextShape);

            if (prevPoint) {
                return { prev: prevPoint, next: nextStart };
            }
        } catch (error) {
            console.warn('Error getting adjacent points for end:', error);
        }
    }

    return null;
}

function getShapePointAfterStart(shape: Shape): Point2D | null {
    switch (shape.type) {
        case GeometryType.LINE:
            return (shape.geometry as Line).end;
        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            const midAngle: number = (arc.startAngle + arc.endAngle) / 2;
            return {
                x: arc.center.x + arc.radius * Math.cos(midAngle),
                y: arc.center.y + arc.radius * Math.sin(midAngle),
            };
        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            return { x: circle.center.x, y: circle.center.y + circle.radius };
        case GeometryType.POLYLINE:
            const points: Point2D[] = polylineToPoints(
                shape.geometry as Polyline
            );
            return points.length > 1 ? points[1] : points[0];
        default:
            return null;
    }
}

function getShapePointBeforeEnd(shape: Shape): Point2D | null {
    switch (shape.type) {
        case GeometryType.LINE:
            return (shape.geometry as Line).start;
        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            const midAngle: number = (arc.startAngle + arc.endAngle) / 2;
            return {
                x: arc.center.x + arc.radius * Math.cos(midAngle),
                y: arc.center.y + arc.radius * Math.sin(midAngle),
            };
        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            return { x: circle.center.x - circle.radius, y: circle.center.y };
        case GeometryType.POLYLINE:
            const points: Point2D[] = polylineToPoints(
                shape.geometry as Polyline
            );
            return points.length > 1 ? points[points.length - 2] : points[0];
        default:
            return null;
    }
}

function distance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Calculate the centroid of a chain for determining inside/outside.
 */
function calculateChainCentroid(chain: Chain): Point2D {
    let sumX: number = 0;
    let sumY: number = 0;
    let count: number = 0;

    for (const shape of chain.shapes) {
        const points: Point2D[] = getShapePoints(shape);
        for (const point of points) {
            sumX += point.x;
            sumY += point.y;
            count++;
        }
    }

    return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
}

/**
 * Get sample points from a shape for centroid calculation.
 */
function getShapePoints(shape: Shape): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];
        case GeometryType.ARC:
            // Sample a few points along the arc
            const arc: Arc = shape.geometry as Arc;
            const points: Point2D[] = [];
            const segments: number = QUARTER_CIRCLE_QUADRANTS;
            for (let i: number = 0; i <= segments; i++) {
                const angle: number =
                    arc.startAngle +
                    ((arc.endAngle - arc.startAngle) * i) / segments;
                points.push({
                    x: arc.center.x + arc.radius * Math.cos(angle),
                    y: arc.center.y + arc.radius * Math.sin(angle),
                });
            }
            return points;
        case GeometryType.CIRCLE:
            // Sample points around circle
            const circle: Circle = shape.geometry as Circle;
            return [
                { x: circle.center.x + circle.radius, y: circle.center.y },
                { x: circle.center.x, y: circle.center.y + circle.radius },
                { x: circle.center.x - circle.radius, y: circle.center.y },
                { x: circle.center.x, y: circle.center.y - circle.radius },
            ];
        case GeometryType.POLYLINE:
            return polylineToPoints(shape.geometry as Polyline);
        default:
            return [];
    }
}

/**
 * Rotate a curve direction vector by the specified angle
 */
function rotateCurveDirection(direction: Point2D, angle: number): Point2D {
    const cos: number = Math.cos(angle);
    const sin: number = Math.sin(angle);

    return {
        x: direction.x * cos - direction.y * sin,
        y: direction.x * sin + direction.y * cos,
    };
}

/**
 * Count how many points in the lead are in solid areas of the part.
 * Excludes the connection point from the check since it's on the boundary.
 */
function countSolidAreaPoints(
    points: Point2D[],
    part: DetectedPart,
    connectionPoint?: Point2D
): number {
    let solidPoints: number = 0;
    // Check each point in the lead
    for (const leadPoint of points) {
        // Skip the connection point as it's expected to be on the boundary
        if (
            connectionPoint &&
            Math.abs(leadPoint.x - connectionPoint.x) <
                GEOMETRIC_PRECISION_TOLERANCE &&
            Math.abs(leadPoint.y - connectionPoint.y) <
                GEOMETRIC_PRECISION_TOLERANCE
        ) {
            continue;
        }

        if (isPointInSolidArea(leadPoint, part)) {
            solidPoints++;
        }
    }
    return solidPoints;
}

/**
 * Check if a point is inside the solid area of a part.
 * A point is in solid area if it's inside the shell but outside all holes.
 * Uses proper point-in-polygon detection with ray casting algorithm.
 */
function isPointInSolidArea(point: Point2D, part: DetectedPart): boolean {
    // First check if point is inside the shell using ray casting
    const shellPolygon: Point2D[] = getPolygonFromChain(part.shell.chain);
    if (!isPointInPolygon(point, shellPolygon)) {
        return false; // Not inside shell, definitely not in solid area
    }

    // Check if point is inside any hole using ray casting
    for (const hole of part.holes) {
        const holePolygon: Point2D[] = getPolygonFromChain(hole.chain);
        if (isPointInPolygon(point, holePolygon)) {
            return false; // Inside hole, not solid area
        }
    }

    return true; // Inside shell, outside all holes = solid area
}

/**
 * Extract polygon points from a chain for point-in-polygon testing.
 */
function getPolygonFromChain(chain: Chain): Point2D[] {
    const points: Point2D[] = [];

    for (const shape of chain.shapes) {
        switch (shape.type) {
            case GeometryType.LINE:
                const line: Line = shape.geometry as Line;
                points.push(line.start);
                break;

            case GeometryType.ARC:
                // Sample points along the arc
                const arc: Arc = shape.geometry as Arc;
                const segments: number = Math.max(
                    OCTAGON_SIDES,
                    Math.ceil(
                        (Math.abs(arc.endAngle - arc.startAngle) * arc.radius) /
                            2
                    )
                );
                for (let i: number = 0; i < segments; i++) {
                    const t: number = i / segments;
                    const angle: number =
                        arc.startAngle + (arc.endAngle - arc.startAngle) * t;
                    points.push({
                        x: arc.center.x + arc.radius * Math.cos(angle),
                        y: arc.center.y + arc.radius * Math.sin(angle),
                    });
                }
                break;

            case GeometryType.CIRCLE:
                // Sample points around the circle
                const circle: Circle = shape.geometry as Circle;
                const circleSegments: number = Math.max(
                    DEFAULT_TESSELLATION_SEGMENTS,
                    Math.ceil((2 * Math.PI * circle.radius) / 2)
                );
                for (let i: number = 0; i < circleSegments; i++) {
                    const angle: number = (2 * Math.PI * i) / circleSegments;
                    points.push({
                        x: circle.center.x + circle.radius * Math.cos(angle),
                        y: circle.center.y + circle.radius * Math.sin(angle),
                    });
                }
                break;

            case GeometryType.POLYLINE:
                const polyline: Polyline = shape.geometry as Polyline;
                points.push(...polylineToPoints(polyline));
                break;

            default:
                // For other shape types, use bounding points
                const shapePoints: Point2D[] = getShapePoints(shape);
                points.push(...shapePoints);
                break;
        }
    }

    return points;
}

/**
 * Point-in-polygon test using ray casting algorithm.
 * Returns true if point is inside the polygon.
 */

/**
 * Check if leads would collide with each other or with paths.
 * This is a placeholder for the actual collision detection logic.
 */
export function checkLeadCollisions(
    _leadResult: LeadResult,
    _allPaths: unknown[],
    _currentPath: unknown
): boolean {
    // TODO: Implement collision detection
    // - Check if lead-in crosses lead-out
    // - Check if leads cross other paths
    // - Check if leads cross other leads

    return false; // No collisions for now
}
