import type { Point2D } from '$lib/geometry/point';
import type { Arc } from '$lib/geometry/arc';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/cam/part/part-detection';
import { CutDirection, LeadType } from '$lib/types/direction';
import { normalizeVector } from '$lib/geometry/math/functions';
import { validateLeadConfiguration } from './lead-validation';
import {
    createTangentArc,
    calculateArcLength,
} from '$lib/geometry/arc/functions';
import {
    GEOMETRIC_PRECISION_TOLERANCE,
    HALF_PERCENT,
    QUARTER_PERCENT,
    THREE_QUARTERS_PERCENT,
} from '$lib/geometry/math';
import { HALF_CIRCLE_DEG } from '$lib/geometry/circle';
import {
    OCTAGON_SIDES,
    SMALL_ANGLE_INCREMENT_DEG,
} from '$lib/geometry/constants';
import {
    isPointInsidePart,
    isPointInsideChainExact,
} from '$lib/geometry/chain/point-in-chain';
import {
    getChainEndPoint,
    getChainStartPoint,
    getChainTangent,
    isChainClosed,
} from '$lib/geometry/chain/functions';
import { isChainHoleInPart, isChainShellInPart } from './part-lookup-utils';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import type {
    LeadConfig,
    LeadResult,
    Lead,
    LeadValidationResult,
} from './interfaces';

/**
 * Calculate lead-in and lead-out geometry for a chain.
 * Leads must be placed appropriately based on the context (inside holes, outside shells).
 * Lead direction respects the cut direction for proper tangency.
 *
 * @param cutNormal - Pre-calculated normal direction from the cut (required for consistency)
 */
export function calculateLeads(
    chain: Chain,
    leadInConfig: LeadConfig,
    leadOutConfig: LeadConfig,
    cutDirection: CutDirection = CutDirection.NONE,
    part: DetectedPart | undefined,
    cutNormal: Point2D
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
    // For offset chains, use the originalChainId to get correct classification
    const isHole: boolean = part ? isChainHoleInPart(chain, part) : false;
    const isShell: boolean = part ? isChainShellInPart(chain, part) : false;

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
            warnings,
            cutNormal
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
            warnings,
            cutNormal
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
    config: LeadConfig,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part: DetectedPart | undefined,
    warnings: string[],
    cutNormal: Point2D
): Lead | undefined {
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
            config.flipSide ?? false,
            config.angle,
            config.fit ?? true,
            cutNormal
        );
    }
    return undefined;
}

/**
 * Calculate an arc lead that is tangent to the chain at the connection point.
 * Arc length is configurable and determines the sweep angle.
 * Lead direction uses the pre-calculated cut normal for consistency.
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
    part: DetectedPart | undefined,
    warnings: string[],
    flipSide: boolean,
    manualAngle: number | undefined,
    fit: boolean,
    cutNormal: Point2D
): Lead {
    // Get the tangent direction at the point
    const tangent: Point2D = getChainTangent(chain, point, isLeadIn);

    // Use pre-calculated cut normal for lead direction
    // Apply flipSide if requested (lead-specific configuration)
    let baseCurveDirection: Point2D = cutNormal;
    if (flipSide) {
        baseCurveDirection = {
            x: -cutNormal.x,
            y: -cutNormal.y,
        };
    }

    // Determine desired arc sweep direction based on the cut tangent
    // CRITICAL INVARIANT: Lead arc must sweep in the direction of the cut tangent
    //
    // The arc's velocity at the connection point must match the cut tangent direction.
    // For an arc, velocity is perpendicular to the radius:
    // - CW arc (clockwise=true): velocity is 90° CW from radius
    // - CCW arc (clockwise=false): velocity is 90° CCW from radius
    //
    // To match the tangent, we need to determine which sweep direction produces
    // the correct velocity at the connection point.
    //
    // The key insight: calculate the cross product of tangent × normal.
    // If cross > 0: tangent is CCW from normal → arc should be CCW to curve into tangent
    // If cross < 0: tangent is CW from normal → arc should be CW to curve into tangent
    const cross =
        tangent.x * baseCurveDirection.y - tangent.y * baseCurveDirection.x;
    const desiredClockwise = cross < 0;

    // Determine curve direction strategy: manual absolute angle or automatic (use cut normal)
    let curveDirectionsToTry: { x: number; y: number }[];

    if (manualAngle !== undefined && manualAngle !== 0) {
        // Manual angle mode: User has specified an absolute angle override (non-zero)
        // This rotates the cut normal by the specified angle
        // Work in world coordinates (Y+ up), canvas rendering will handle coordinate conversion
        const manualAngleRad: number =
            (manualAngle * Math.PI) / HALF_CIRCLE_DEG;

        // Calculate rotation from cut normal direction
        const cutNormalAngle = Math.atan2(cutNormal.y, cutNormal.x);
        const finalAngle = cutNormalAngle + manualAngleRad;

        const rotatedDirection: Point2D = {
            x: Math.cos(finalAngle),
            y: Math.sin(finalAngle),
        };
        curveDirectionsToTry = [rotatedDirection];
    } else {
        // Automatic mode: Use cut normal direction (INVARIANT)
        // Allow limited rotation (±90°) for collision avoidance, but NEVER flip to opposite side
        // This ensures leads stay on the correct side while still avoiding obstacles
        const maxRotationDeg = 90; // Maximum rotation in either direction
        const rotationStep: number =
            (SMALL_ANGLE_INCREMENT_DEG * Math.PI) / HALF_CIRCLE_DEG; // 5 degrees in radians
        const maxSteps = Math.floor(maxRotationDeg / SMALL_ANGLE_INCREMENT_DEG); // 18 steps = 90°

        curveDirectionsToTry = [];
        // Try cut normal first (0° rotation)
        curveDirectionsToTry.push(baseCurveDirection);

        // Then try small rotations in both directions
        for (let i = 1; i <= maxSteps; i++) {
            const rotationAngle = i * rotationStep;
            // Try positive rotation
            curveDirectionsToTry.push(
                rotateCurveDirection(baseCurveDirection, rotationAngle)
            );
            // Try negative rotation
            curveDirectionsToTry.push(
                rotateCurveDirection(baseCurveDirection, -rotationAngle)
            );
        }
    }

    // Try full length first, then shorter lengths if needed (only if fit is enabled)
    const lengthAttempts: number[] = fit
        ? [1.0, THREE_QUARTERS_PERCENT, HALF_PERCENT, QUARTER_PERCENT]
        : [1.0]; // Try 100%, 75%, 50%, 25% of original length if fit enabled, otherwise only full length

    for (const lengthFactor of lengthAttempts) {
        const adjustedArcLength: number = arcLength * lengthFactor;

        for (const curveDirection of curveDirectionsToTry) {
            // Create arc geometry with tangency
            const arc: Arc = createTangentArc(
                point,
                tangent,
                adjustedArcLength,
                curveDirection,
                isLeadIn,
                desiredClockwise
            );

            // If no part context, use the first valid lead
            if (!part) {
                return {
                    geometry: arc,
                    type: LeadType.ARC,
                    normal: normalizeVector(cutNormal), // INVARIANT: Lead normal always matches cut normal
                    connectionPoint: point,
                };
            }

            // Check if this lead avoids solid areas using geometric validation
            const intersectsSolid: boolean = isLeadInPart(arc, part, point);

            // For holes, add additional check to ensure lead stays within hole boundary
            const exitsHole: boolean =
                isHole && checkArcExitsHole(arc, chain, point);

            if (!intersectsSolid && !exitsHole) {
                return {
                    geometry: arc,
                    type: LeadType.ARC,
                    normal: normalizeVector(cutNormal), // INVARIANT: Lead normal always matches cut normal
                    connectionPoint: point,
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

    // Return the base direction as fallback with full arc length
    const arc: Arc = createTangentArc(
        point,
        tangent,
        arcLength,
        baseCurveDirection,
        isLeadIn,
        desiredClockwise
    );

    return {
        geometry: arc,
        type: LeadType.ARC,
        normal: normalizeVector(cutNormal), // INVARIANT: Lead normal always matches cut normal
        connectionPoint: point,
    };
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
 * Sample points along an arc geometry for collision testing.
 *
 * @param arc - Arc geometry to sample
 * @returns Array of points along the arc
 */
function sampleArcPoints(arc: Arc): Point2D[] {
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
 * Check if an arc lead exits the boundary of a hole.
 * For holes, leads must stay entirely within the hole boundary.
 */
function checkArcExitsHole(
    arc: Arc,
    holeChain: Chain,
    connectionPoint?: Point2D
): boolean {
    // Only check for closed chains - open chains cannot have meaningful containment
    if (!isChainClosed(holeChain, CHAIN_CLOSURE_TOLERANCE)) {
        return false; // Cannot meaningfully check containment for open chains
    }

    // Sample points along the arc for testing
    const points = sampleArcPoints(arc);

    // Check if any points are outside the hole boundary (excluding connection point)
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

        // If point is outside the hole chain, the lead exits the hole
        if (!isPointInsideChainExact(leadPoint, holeChain)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a lead arc geometry is placed in solid material of a part.
 *
 * For proper lead placement:
 * - Hole leads: should be entirely within hole boundaries (not in solid material)
 * - Shell leads: should be entirely outside part boundaries (not in solid material)
 *
 * @param leadGeometry - Arc geometry representing the lead
 * @param part - Part containing shell and holes
 * @param connectionPoint - Point where lead connects to path (excluded from check)
 * @returns true if ANY point of the lead is in solid material (bad placement)
 */
function isLeadInPart(
    leadGeometry: Arc,
    part: DetectedPart,
    connectionPoint?: Point2D
): boolean {
    // Sample points along the arc lead geometry
    const points = sampleArcPoints(leadGeometry);

    // Check if any points are in solid material (inside shell but outside holes)
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

        // Check if point is in solid material using part geometry
        if (isPointInsidePart(leadPoint, part)) {
            return true; // Lead point is in solid material - bad placement
        }
    }
    return false; // All lead points are in valid areas
}

/**
 * Check if an arc intersects with a chain by sampling points along the arc
 * @param arc - Arc geometry to test
 * @param chain - Chain to test intersection against
 * @param connectionPoint - Point where arc connects (excluded from test)
 * @returns true if arc intersects the chain interior
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doesArcIntersectChain(
    arc: Arc,
    chain: Chain,
    connectionPoint: Point2D
): boolean {
    // Sample points along the arc
    const points = sampleArcPoints(arc);

    // Check if any sampled points are inside the chain
    for (const arcPoint of points) {
        // Skip the connection point as it's expected to be on the boundary
        if (
            Math.abs(arcPoint.x - connectionPoint.x) <
                GEOMETRIC_PRECISION_TOLERANCE &&
            Math.abs(arcPoint.y - connectionPoint.y) <
                GEOMETRIC_PRECISION_TOLERANCE
        ) {
            continue;
        }

        // If any point on the arc is inside the chain, the arc intersects
        // Only test if the chain is closed (open chains cannot have meaningful containment)
        if (
            isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE) &&
            isPointInsideChainExact(arcPoint, chain)
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Check if leads would collide with each other or with cuts.
 * This is a placeholder for the actual collision detection logic.
 */
export function checkLeadCollisions(
    _leadResult: LeadResult,
    _allCuts: object[],
    _currentCut: object
): boolean {
    // TODO: Implement collision detection
    // - Check if lead-in crosses lead-out
    // - Check if leads cross other cuts
    // - Check if leads cross other leads

    return false; // No collisions for now
}
