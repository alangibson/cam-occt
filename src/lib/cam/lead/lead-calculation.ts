import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { PartData } from '$lib/cam/part/interfaces';
import { Part } from '$lib/cam/part/classes.svelte';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { normalizeVector } from '$lib/geometry/math/functions';
import { createTangentArc, sampleArc } from '$lib/geometry/arc/functions';
import {
    HALF_PERCENT,
    QUARTER_PERCENT,
    THREE_QUARTERS_PERCENT,
} from '$lib/geometry/math/constants';
import { HALF_CIRCLE_DEG } from '$lib/geometry/circle/constants';
import { SMALL_ANGLE_INCREMENT_DEG } from '$lib/geometry/constants';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import {
    isPointInsidePart,
    isPointInsideChainExact,
} from '$lib/cam/chain/point-in-chain';
import {
    getChainEndPoint,
    getChainStartPoint,
    getChainTangent,
    isChainClosed,
} from '$lib/cam/chain/functions';
import { isChainHoleInPart, isChainShellInPart } from './part-lookup-utils';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';
import type { LeadConfig, LeadResult, Lead } from './interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { Chain } from '$lib/cam/chain/classes';

/**
 * Calculate lead-in and lead-out geometry for a chain.
 * Leads must be placed appropriately based on the context (inside holes, outside shells).
 * Lead direction respects the cut direction for proper tangency.
 *
 * @param cutNormal - Pre-calculated normal direction from the cut (required for consistency)
 */
export function calculateLeads(
    chain: ChainData,
    leadInConfig: LeadConfig,
    leadOutConfig: LeadConfig,
    cutDirection: CutDirection = CutDirection.NONE,
    part: PartData | undefined,
    cutNormal: Point2D
): LeadResult {
    const result: LeadResult = {};
    const warnings: string[] = [];

    // Skip if no leads requested
    if (leadInConfig.type === 'none' && leadOutConfig.type === 'none') {
        return result;
    }

    // Create Chain instance for functions that need it
    const chainInstance = new Chain(chain);

    // Create Part instance if provided
    const partInstance = part ? new Part(part) : undefined;

    // Determine if chain is a hole or shell
    // For offset chains, use the originalChainId to get correct classification
    const isHole: boolean = partInstance
        ? isChainHoleInPart(chainInstance, partInstance)
        : false;
    const isShell: boolean = partInstance
        ? isChainShellInPart(chainInstance, partInstance)
        : false;

    // Get chain start and end points
    const startPoint: Point2D | null = getChainStartPoint(chainInstance);
    const endPoint: Point2D | null = getChainEndPoint(chainInstance);

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
    chain: ChainData,
    point: Point2D,
    config: LeadConfig,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part: PartData | undefined,
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
    chain: ChainData,
    point: Point2D,
    arcLength: number,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part: PartData | undefined,
    warnings: string[],
    flipSide: boolean,
    manualAngle: number | undefined,
    fit: boolean,
    cutNormal: Point2D
): Lead {
    // Create Chain instance for functions that need it
    const chainInstance = new Chain(chain);

    // Get the tangent direction at the point
    const tangent: Point2D = getChainTangent(chainInstance, point, isLeadIn);

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
            const intersectsSolid: boolean = isLeadInPart(
                arc,
                {
                    shell: new Chain(part.shell),
                    voids: part.voids.map((v) => ({
                        chain: new Chain(v.chain),
                    })),
                },
                point
            );

            // For holes, add additional check to ensure lead stays within hole boundary
            const exitsHole: boolean =
                isHole && checkArcExitsHole(arc, chainInstance, point);

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
 * Check if an arc lead exits the boundary of a hole.
 * For holes, leads must stay entirely within the hole boundary.
 */
function checkArcExitsHole(
    arc: Arc,
    holeChain: Chain,
    connectionPoint?: Point2D,
    tolerance?: number
): boolean {
    const effectiveTolerance =
        tolerance ?? getDefaults().geometry.precisionTolerance;
    // Only check for closed chains - open chains cannot have meaningful containment
    if (!isChainClosed(holeChain, CHAIN_CLOSURE_TOLERANCE)) {
        return false; // Cannot meaningfully check containment for open chains
    }

    // Sample points along the arc for testing
    const points = sampleArc(arc);

    // Check if any points are outside the hole boundary (excluding connection point)
    for (const leadPoint of points) {
        // Skip the connection point as it's expected to be on the boundary
        if (
            connectionPoint &&
            Math.abs(leadPoint.x - connectionPoint.x) < effectiveTolerance &&
            Math.abs(leadPoint.y - connectionPoint.y) < effectiveTolerance
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
    part: { shell: Chain; voids: { chain: Chain }[] },
    connectionPoint?: Point2D,
    tolerance?: number
): boolean {
    const effectiveTolerance =
        tolerance ?? getDefaults().geometry.precisionTolerance;
    // Sample points along the arc lead geometry
    const points = sampleArc(leadGeometry);

    // Check if any points are in solid material (inside shell but outside holes)
    for (const leadPoint of points) {
        // Skip the connection point as it's expected to be on the boundary
        if (
            connectionPoint &&
            Math.abs(leadPoint.x - connectionPoint.x) < effectiveTolerance &&
            Math.abs(leadPoint.y - connectionPoint.y) < effectiveTolerance
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
