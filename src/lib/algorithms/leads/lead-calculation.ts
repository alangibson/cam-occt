import type { Point2D } from '$lib/types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { CutDirection, LeadType } from '$lib/types/direction';
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
import { FULL_CIRCLE_DEG, HALF_CIRCLE_DEG } from '$lib/geometry/circle';
import {
    OCTAGON_SIDES,
    SMALL_ANGLE_INCREMENT_DEG,
} from '$lib/geometry/constants';
import {
    isPointInsidePart,
    isPointInsideChainExact,
} from '$lib/algorithms/raytracing/point-in-chain';
import {
    getChainEndPoint,
    getChainStartPoint,
    getChainTangent,
    isChainClosed,
} from '$lib/geometry/chain/functions';
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
 */
export function calculateLeads(
    chain: Chain,
    leadInConfig: LeadConfig,
    leadOutConfig: LeadConfig,
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
    config: LeadConfig,
    isLeadIn: boolean,
    isHole: boolean,
    isShell: boolean,
    cutDirection: CutDirection,
    part?: DetectedPart,
    warnings: string[] = []
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
            config.flipSide,
            config.angle,
            config.fit
        );
    }
    return undefined;
}

/**
 * Calculate an arc lead that is tangent to the chain at the connection point.
 * Arc length is configurable and determines the sweep angle.
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
): Lead {
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
        flipSide,
        isLeadIn
    );

    // Determine desired arc sweep direction based on cut direction and shell/hole context
    // The key insight: for shells, we want arcs that curve AWAY from the solid material
    // When using rightNormal (pointing outward), clockwise sweep curves further outward
    let desiredClockwise: boolean;
    if (cutDirection === CutDirection.CLOCKWISE) {
        if (part) {
            // For clockwise cuts:
            // - Shells (leads outside) want CCW sweep (opposite to cut direction)
            // - Holes (leads inside) want CW sweep (same as cut direction)
            desiredClockwise = !isShell;
        } else {
            // No part context - use chain's clockwise property to determine behavior
            // Default to true (clockwise/shell) if property is undefined
            const chainIsShell = chain.clockwise ?? true; // CW chains are shells, CCW chains are holes
            desiredClockwise = !chainIsShell; // Shells want CCW sweep, holes want CW sweep
        }
    } else if (cutDirection === CutDirection.COUNTERCLOCKWISE) {
        if (part) {
            // For counterclockwise cuts:
            // - Shells (leads outside) want CW sweep (opposite to cut direction)
            // - Holes (leads inside) want CCW sweep (same as cut direction)
            desiredClockwise = isShell;
        } else {
            // No part context - use chain's clockwise property to determine behavior
            // Default to true (clockwise/shell) if property is undefined
            const chainIsShell = chain.clockwise ?? true; // CW chains are shells, CCW chains are holes
            desiredClockwise = chainIsShell; // Shells want CW sweep, holes want CCW sweep
        }
    } else {
        // No cut direction specified - use natural direction from cross product
        const cross =
            tangent.x * baseCurveDirection.y - tangent.y * baseCurveDirection.x;
        desiredClockwise = cross < 0;
    }

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
    };
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
    _chain: Chain,
    point: Point2D,
    part?: DetectedPart,
    leadLength?: number,
    flipSide: boolean = false,
    isLeadIn: boolean = true
): Point2D {
    // Base normal directions (perpendicular to tangent)
    const leftNormal: Point2D = { x: -tangent.y, y: tangent.x }; // 90° counterclockwise
    const rightNormal: Point2D = { x: tangent.y, y: -tangent.x }; // 90° clockwise

    // Simple geometric test: determine which normal points in the correct direction
    const testDistance = 20.0; // Test distance for direction sampling - increased to ensure clear inside/outside detection
    const leftTest: Point2D = {
        x: point.x + leftNormal.x * testDistance,
        y: point.y + leftNormal.y * testDistance,
    };

    const rightTest: Point2D = {
        x: point.x + rightNormal.x * testDistance,
        y: point.y + rightNormal.y * testDistance,
    };

    let selectedDirection: Point2D = leftNormal;

    // Choose direction based on part geometry and cut direction
    if (part) {
        // Use direct chain containment test for more reliable results
        let leftInSolid: boolean;
        let rightInSolid: boolean;

        if (isShell) {
            // For shells, test against the shell chain - inside the chain = inside solid
            // Only test if the shell chain is closed (open chains cannot have meaningful containment)
            if (isChainClosed(part.shell.chain, CHAIN_CLOSURE_TOLERANCE)) {
                leftInSolid = isPointInsideChainExact(
                    leftTest,
                    part.shell.chain
                );
                rightInSolid = isPointInsideChainExact(
                    rightTest,
                    part.shell.chain
                );
            } else {
                // For open shell chains, assume both directions are valid
                leftInSolid = false;
                rightInSolid = false;
            }

            // Force proper outside direction for shells - the one that doesn't go inside should be chosen
            // If one direction is inside and one is outside, choose the outside one
            if (leftInSolid && !rightInSolid) {
                selectedDirection = rightNormal;
            } else if (!leftInSolid && !rightInSolid) {
                // Both directions are outside - test actual arc geometry to see which one avoids the solid
                // Create test arcs with both directions and check which one doesn't intersect solid

                const testArcLength = 20.0; // Use actual lead length for testing

                // Test left direction arc
                const leftTestArc: Arc = createTangentArc(
                    point,
                    tangent,
                    testArcLength,
                    leftNormal,
                    isLeadIn,
                    false // Use counterclockwise as default for testing
                );

                // Test right direction arc
                const rightTestArc: Arc = createTangentArc(
                    point,
                    tangent,
                    testArcLength,
                    rightNormal,
                    isLeadIn,
                    false // Use counterclockwise as default for testing
                );

                // Check if the arc geometries intersect the solid by sampling points along them
                const leftArcIntersectsSolid = doesArcIntersectChain(
                    leftTestArc,
                    part.shell.chain,
                    point
                );
                const rightArcIntersectsSolid = doesArcIntersectChain(
                    rightTestArc,
                    part.shell.chain,
                    point
                );

                if (!leftArcIntersectsSolid && rightArcIntersectsSolid) {
                    selectedDirection = leftNormal;
                } else if (leftArcIntersectsSolid && !rightArcIntersectsSolid) {
                    selectedDirection = rightNormal;
                } else {
                    // Both arcs avoid solid or both intersect - use right as default
                    selectedDirection = rightNormal;
                }
            } else {
                // Both inside - warning case, use default
                selectedDirection = rightNormal;
            }

            // Skip the normal material avoidance logic for shells since we handled it above
            return selectedDirection;
        } else {
            // For holes, use part-based testing
            leftInSolid = isPointInsidePart(leftTest, part);
            rightInSolid = isPointInsidePart(rightTest, part);
        }

        // Choose direction based on material avoidance, using cut direction as a tiebreaker
        if (!leftInSolid && !rightInSolid) {
            // Both directions avoid material - for shells, we need to pick the direction that
            // will place the lead further from the material for better cutting performance

            if (isShell && !isHole) {
                // For shells, test which direction places the lead further from the material
                const furtherTestDistance = 20.0; // Test at lead length distance
                const leftFurtherTest: Point2D = {
                    x: point.x + leftNormal.x * furtherTestDistance,
                    y: point.y + leftNormal.y * furtherTestDistance,
                };
                const rightFurtherTest: Point2D = {
                    x: point.x + rightNormal.x * furtherTestDistance,
                    y: point.y + rightNormal.y * furtherTestDistance,
                };

                // Use same testing method as the initial test
                // Only test if the shell chain is closed
                let leftFurtherInSolid = false;
                let rightFurtherInSolid = false;
                if (isChainClosed(part.shell.chain, CHAIN_CLOSURE_TOLERANCE)) {
                    leftFurtherInSolid = isPointInsideChainExact(
                        leftFurtherTest,
                        part.shell.chain
                    );
                    rightFurtherInSolid = isPointInsideChainExact(
                        rightFurtherTest,
                        part.shell.chain
                    );
                }

                // Prefer the direction that remains outside even at lead length distance
                if (!leftFurtherInSolid && rightFurtherInSolid) {
                    selectedDirection = leftNormal;
                } else if (leftFurtherInSolid && !rightFurtherInSolid) {
                    selectedDirection = rightNormal;
                } else {
                    // If both are still outside, prefer rightNormal for shells (conventional outside direction)
                    // If both are still inside, also prefer rightNormal as it's likely closer to outside
                    selectedDirection = rightNormal;
                }
            } else {
                // For holes, use the original cut direction logic
                if (cutDirection !== CutDirection.NONE) {
                    // Determine which direction gives the correct arc sweep for shell/hole + cut direction
                    const leftCross =
                        tangent.x * leftNormal.y - tangent.y * leftNormal.x;

                    // For cut direction logic, we need to consider what arc sweep direction
                    // will place the lead OUTSIDE the shape (for shells) or INSIDE holes
                    let wantClockwiseArcSweep: boolean;
                    if (cutDirection === CutDirection.CLOCKWISE) {
                        // For clockwise cutting of shells: leads should point outside (use rightNormal)
                        // For clockwise cutting of holes: leads should point inside hole (use leftNormal)
                        wantClockwiseArcSweep = !isHole; // Shells want CW sweep to point outside, holes want CCW to point into hole
                    } else {
                        // For counterclockwise cutting of shells: leads should point outside (use rightNormal)
                        // For counterclockwise cutting of holes: leads should point inside hole (use leftNormal)
                        wantClockwiseArcSweep = !isShell; // Shells want CCW sweep to point outside, holes want CW to point into hole
                    }

                    // Choose direction that produces the desired sweep
                    const leftGivesClockwiseSweep = leftCross < 0;
                    if (wantClockwiseArcSweep === leftGivesClockwiseSweep) {
                        selectedDirection = leftNormal;
                    } else {
                        selectedDirection = rightNormal;
                    }
                } else {
                    selectedDirection = leftNormal; // Default when no cut direction
                }
            }
        } else if (!leftInSolid && rightInSolid) {
            // Only left direction avoids material
            selectedDirection = leftNormal;
        } else if (leftInSolid && !rightInSolid) {
            // Only right direction avoids material
            selectedDirection = rightNormal;
        } else {
            // Both directions intersect material - warn and use default
            console.warn(
                `Both normal directions intersect solid material at (${point.x}, ${point.y}). ` +
                    `Cut direction: ${cutDirection}, isHole: ${isHole}, isShell: ${isShell}. ` +
                    `Using left direction as fallback.`
            );
            selectedDirection = leftNormal;
        }

        // Material avoidance is now handled in the selection logic above
    } else {
        // No part geometry - check if chain is closed and treat as solid area
        const isClosedChain = isChainClosed(_chain, CHAIN_CLOSURE_TOLERANCE);

        if (isClosedChain) {
            // For closed chains, test which normal direction points outside the chain
            const leftInChain = isPointInsideChainExact(leftTest, _chain);
            const rightInChain = isPointInsideChainExact(rightTest, _chain);

            // Apply cut direction preference when both directions are valid (outside chain)
            if (!leftInChain && !rightInChain) {
                // Both directions are outside - use cut direction preference
                // Use chain's clockwise property to determine if it behaves like a shell or hole
                const chainIsShell = _chain.clockwise ?? true; // CW chains are shells (default), CCW chains are holes
                if (
                    cutDirection === CutDirection.CLOCKWISE ||
                    cutDirection === CutDirection.COUNTERCLOCKWISE
                ) {
                    let wantClockwiseArcSweep: boolean;
                    if (cutDirection === CutDirection.CLOCKWISE) {
                        // Shells want CCW arc sweep, holes want CW arc sweep
                        wantClockwiseArcSweep = !chainIsShell;
                    } else {
                        // Shells want CW arc sweep, holes want CCW arc sweep
                        wantClockwiseArcSweep = chainIsShell;
                    }

                    // Calculate cross products to see which normal directions give us the desired sweep
                    const leftCross =
                        tangent.x * leftNormal.y - tangent.y * leftNormal.x;
                    const leftGivesClockwiseSweep = leftCross < 0;

                    // Choose direction that gives us the desired arc sweep
                    if (wantClockwiseArcSweep === leftGivesClockwiseSweep) {
                        selectedDirection = leftNormal;
                    } else {
                        selectedDirection = rightNormal;
                    }
                } else {
                    selectedDirection = leftNormal; // Default when no cut direction
                }
            } else if (!leftInChain && rightInChain) {
                // Only left direction is outside the chain
                selectedDirection = leftNormal;

                // Apply cut direction logic with constraint that we must use left direction
                if (
                    cutDirection === CutDirection.CLOCKWISE ||
                    cutDirection === CutDirection.COUNTERCLOCKWISE
                ) {
                    // Note: Cut direction logic is constrained to use left direction
                    // Future implementation may consider sweep direction correction
                }
            } else if (leftInChain && !rightInChain) {
                // Only right direction is outside the chain
                selectedDirection = rightNormal;

                // Apply cut direction logic with constraint that we must use right direction
                if (
                    cutDirection === CutDirection.CLOCKWISE ||
                    cutDirection === CutDirection.COUNTERCLOCKWISE
                ) {
                    // Note: Cut direction logic is constrained to use right direction
                    // Future implementation may consider sweep direction correction
                }
            } else {
                // Both directions are inside chain - warn and use default
                console.warn(
                    `Both normal directions point inside closed chain at point (${point.x}, ${point.y}). Using default direction.`
                );
                selectedDirection = leftNormal;
            }
        } else {
            // Open chain - use cut direction to determine sweep orientation
            if (cutDirection === CutDirection.CLOCKWISE) {
                // For CW cuts: lead-in and lead-out need opposite sides
                const leftCross =
                    tangent.x * leftNormal.y - tangent.y * leftNormal.x;

                if (isLeadIn) {
                    // Lead-in: choose direction that makes cross product negative
                    selectedDirection =
                        leftCross < 0 ? leftNormal : rightNormal;
                } else {
                    // Lead-out: choose opposite direction for smooth exit
                    selectedDirection =
                        leftCross < 0 ? rightNormal : leftNormal;
                }
            } else if (cutDirection === CutDirection.COUNTERCLOCKWISE) {
                // For CCW cuts: lead-in and lead-out need opposite sides
                const leftCross =
                    tangent.x * leftNormal.y - tangent.y * leftNormal.x;

                if (isLeadIn) {
                    // Lead-in: choose direction that makes cross product positive
                    selectedDirection =
                        leftCross > 0 ? leftNormal : rightNormal;
                } else {
                    // Lead-out: choose opposite direction for smooth exit
                    selectedDirection =
                        leftCross > 0 ? rightNormal : leftNormal;
                }
            } else {
                // Default to left normal when no cut direction specified
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
