/**
 * Kerf Generation Functions
 *
 * Functions for transforming Cuts into Kerf representations showing
 * the material removal zone of the cutting tool.
 */

import type { Cut } from '$lib/cam/cut/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Kerf } from './interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { OffsetChain } from '$lib/cam/offset/types';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Part } from '$lib/cam/part/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import {
    isChainClosed,
    tessellateChainToShapes,
    sampleChainAtDistanceInterval,
    getChainPointAt,
} from '$lib/geometry/chain/functions';
import {
    offsetPaths,
    type OffsetOptions,
} from '$lib/cam/offset/clipper-offset';
import {
    reconstructChain,
    createOffsetChain,
} from '$lib/cam/offset/reconstruct';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';
import { isPointInsideChainExact } from '$lib/geometry/chain/point-in-chain';
import { getShapeLength } from '$lib/geometry/shape/functions';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { findPartContainingChain } from '$lib/cam/part/chain-part-interactions';

/**
 * Algorithm version for kerf generation
 * Increment when algorithm changes to invalidate old cached kerfs
 */
const KERF_VERSION = '1.0.0';

/**
 * Default tolerance for chain closure detection
 */
const DEFAULT_TOLERANCE = 0.001;

/**
 * Tolerance for validating chain closure (stricter than DEFAULT_TOLERANCE)
 */
const CLOSURE_VALIDATION_TOLERANCE = 0.01;

/**
 * Number of decimal places for displaying coordinates in error messages
 */
const DECIMAL_PLACES = 3;

/**
 * Number of decimal places for displaying interval distances in log messages
 */
const INTERVAL_DECIMAL_PLACES = 3;

/**
 * Default step size for adjusting cut start point (10% increments)
 */
const DEFAULT_STEP_SIZE = 0.1;

/**
 * Default maximum number of attempts when adjusting cut start point
 */
const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * Validate that a kerf offset chain is properly closed
 * @param chain - The chain to validate
 * @param side - Which side (inner/outer) for error messages
 * @param cutName - Name of the cut for error messages
 * @throws Error if the chain is not properly closed
 */
function validateChainClosure(
    chain: OffsetChain,
    side: string,
    cutName: string
): void {
    if (chain.shapes.length === 0) {
        throw new Error(
            `Kerf ${side} chain for cut "${cutName}" has no shapes`
        );
    }

    // Get first and last line segments
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];

    if (
        firstShape.type !== GeometryType.LINE ||
        lastShape.type !== GeometryType.LINE
    ) {
        throw new Error(
            `Kerf chains must contain only Line shapes, found ${firstShape.type} and ${lastShape.type}`
        );
    }

    const firstLine = firstShape.geometry as Line;
    const lastLine = lastShape.geometry as Line;

    // Calculate closure distance
    const dx = lastLine.end.x - firstLine.start.x;
    const dy = lastLine.end.y - firstLine.start.y;
    const closureDistance = Math.sqrt(dx * dx + dy * dy);

    // Validate closure
    if (closureDistance > CLOSURE_VALIDATION_TOLERANCE) {
        throw new Error(
            `Kerf ${side} chain for cut "${cutName}" is not properly closed.\n` +
                `First shape starts at (${firstLine.start.x.toFixed(DECIMAL_PLACES)}, ${firstLine.start.y.toFixed(DECIMAL_PLACES)})\n` +
                `Last shape ends at (${lastLine.end.x.toFixed(DECIMAL_PLACES)}, ${lastLine.end.y.toFixed(DECIMAL_PLACES)})\n` +
                `Closure distance: ${closureDistance.toFixed(DECIMAL_PLACES)} (tolerance: ${CLOSURE_VALIDATION_TOLERANCE})\n` +
                `This indicates the offset reconstruction failed to create a closed chain.`
        );
    }
}

/**
 * Transform a Cut into a Kerf representation
 *
 * This function generates a bi-directional offset of the complete cutting path,
 * including lead-in and lead-out geometry, representing the material removal zone.
 * The offset distance is half the tool's kerf width in each direction, creating
 * a total kerf width equal to the tool's kerf width.
 *
 * When leads are present, the kerf includes the material removed by the torch
 * during lead-in and lead-out movements, providing a complete visualization
 * of material removal.
 *
 * All fills and ends use round geometry for smooth, realistic material removal zones.
 *
 * @param cut - The Cut to transform into a Kerf (must have cutChain; leadIn/leadOut optional)
 * @param tool - The Tool providing kerf width
 * @returns Promise resolving to a Kerf object with inner and outer offset chains
 * @throws Error if cut is missing cutChain or tool is missing kerfWidth
 *
 * @example
 * ```typescript
 * const kerf = await cutToKerf(myCut, myTool);
 * console.log('Inner kerf boundary:', kerf.innerChain);
 * console.log('Outer kerf boundary:', kerf.outerChain);
 * console.log('Total kerf width:', kerf.kerfWidth);
 * console.log('Includes leads:', kerf.leadIn !== undefined || kerf.leadOut !== undefined);
 * ```
 */
export async function cutToKerf(cut: Cut, tool: Tool): Promise<Kerf> {
    // Validation
    if (!cut.cutChain) {
        throw new Error('Cut must have a cutChain to generate kerf');
    }
    if (tool.kerfWidth === undefined || tool.kerfWidth <= 0) {
        throw new Error('Tool must have a positive kerfWidth to generate kerf');
    }

    const cutChain = cut.cutChain;

    // Calculate offset distance (half kerf width in each direction)
    // Use getToolValue to get the correct unit-adjusted kerf width
    const kerfWidth = getToolValue(tool, 'kerfWidth');
    const offsetDistance = kerfWidth / 2;

    // Determine if chain is closed
    const isClosed = isChainClosed(cutChain, DEFAULT_TOLERANCE);

    // Tessellate the cut chain to a single polyline for Clipper2
    const CIRCLE_POINTS = 32;
    const DECIMAL_PRECISION = 3;

    const shapePointArrays = tessellateChainToShapes(cutChain, {
        circleTessellationPoints: CIRCLE_POINTS,
        tessellationTolerance: getDefaults().geometry.tessellationTolerance,
        decimalPrecision: DECIMAL_PRECISION,
        enableTessellation: false,
    });

    // Flatten all chain points into a single array
    const chainPoints: Point2D[] = [];
    for (const points of shapePointArrays) {
        chainPoints.push(...points);
    }

    // Get lead geometry points if present
    const leadInPoints: Point2D[] = cut.leadIn
        ? convertLeadGeometryToPoints(cut.leadIn)
        : [];
    const leadOutPoints: Point2D[] = cut.leadOut
        ? convertLeadGeometryToPoints(cut.leadOut)
        : [];

    // Combine: lead-in + chain + lead-out
    const combinedPoints: Point2D[] = [
        ...leadInPoints,
        ...chainPoints,
        ...leadOutPoints,
    ];

    // When leads are present, treat as open path
    const hasLeads = leadInPoints.length > 0 || leadOutPoints.length > 0;
    const pointArrays: Point2D[][] = [combinedPoints];

    // Get Clipper2 module for accessing JoinType and EndType enums
    const clipper = await getClipper2();
    const { JoinType, EndType } = clipper;

    // When leads are present, treat as open path regardless of chain closure
    const isClosedForOffset = isClosed && !hasLeads;

    // Configure Clipper2 for round fills and ends
    const offsetOptions: OffsetOptions = {
        joinType: JoinType.Round, // Round corners for smooth kerf boundaries
        endType: isClosedForOffset ? EndType.Polygon : EndType.Round, // Round ends for open paths
        arcTolerance: 0.1, // Precision for round geometry (0.1mm)
    };

    // Perform bi-directional offset using Clipper2
    const { inner, outer } = await offsetPaths(
        pointArrays,
        offsetDistance,
        isClosedForOffset,
        offsetOptions
    );

    // Reconstruct chains from Clipper2 results
    // Clipper2 may return multiple polygons (e.g., shell + holes combined in one cut)
    // Each polygon will be properly closed in reconstructChain
    const innerShapes = reconstructChain(inner);
    const outerShapes = reconstructChain(outer);

    // Build offset chains
    const innerChain = createOffsetChain(
        innerShapes,
        isClosedForOffset ? 'inner' : 'left',
        cutChain.id,
        isClosedForOffset
    );
    const outerChain = createOffsetChain(
        outerShapes,
        isClosedForOffset ? 'outer' : 'right',
        cutChain.id,
        isClosedForOffset
    );

    // Validate chain closure for closed cuts
    if (isClosedForOffset) {
        validateChainClosure(innerChain, 'inner', cut.name);
        validateChainClosure(outerChain, 'outer', cut.name);
    }

    // Calculate kerf for leads separately if they exist
    let leadInInnerChain: OffsetChain | undefined;
    let leadInOuterChain: OffsetChain | undefined;
    let leadOutInnerChain: OffsetChain | undefined;
    let leadOutOuterChain: OffsetChain | undefined;

    if (leadInPoints.length > 1) {
        const leadInOffset = await offsetPaths(
            [leadInPoints],
            offsetDistance,
            false, // Leads are always open paths
            {
                joinType: JoinType.Round,
                endType: EndType.Round,
                arcTolerance: 0.1,
            }
        );
        const leadInInnerShapes = reconstructChain(leadInOffset.inner);
        const leadInOuterShapes = reconstructChain(leadInOffset.outer);
        leadInInnerChain = createOffsetChain(
            leadInInnerShapes,
            'left',
            `${cutChain.id}-leadIn`,
            false
        );
        leadInOuterChain = createOffsetChain(
            leadInOuterShapes,
            'right',
            `${cutChain.id}-leadIn`,
            false
        );
    }

    if (leadOutPoints.length > 1) {
        const leadOutOffset = await offsetPaths(
            [leadOutPoints],
            offsetDistance,
            false, // Leads are always open paths
            {
                joinType: JoinType.Round,
                endType: EndType.Round,
                arcTolerance: 0.1,
            }
        );
        const leadOutInnerShapes = reconstructChain(leadOutOffset.inner);
        const leadOutOuterShapes = reconstructChain(leadOutOffset.outer);
        leadOutInnerChain = createOffsetChain(
            leadOutInnerShapes,
            'left',
            `${cutChain.id}-leadOut`,
            false
        );
        leadOutOuterChain = createOffsetChain(
            leadOutOuterShapes,
            'right',
            `${cutChain.id}-leadOut`,
            false
        );
    }

    // Check if lead kerfs overlap with the ORIGINAL chain (before offset)
    // We need to check the original chain, not the offset cut chain
    let leadInKerfOverlapsChain = false;
    let leadOutKerfOverlapsChain = false;

    // Get the original chain shapes (before any offset was applied)
    const originalShapes = cut.offset?.originalShapes || cutChain.shapes;
    const originalChain: Chain = {
        id: cutChain.id,
        shapes: originalShapes,
    };

    if (leadInOuterChain) {
        console.log(
            `[Kerf Gen] Checking lead-in kerf overlap for cut "${cut.name}"`
        );
        // Check if original chain intersects with the lead-in kerf zone
        // Use half of kerf width as sampling interval for appropriate resolution
        leadInKerfOverlapsChain = doesLeadKerfOverlapChain(
            leadInOuterChain,
            originalChain,
            kerfWidth / 2
        );
    }

    if (leadOutOuterChain) {
        console.log(
            `[Kerf Gen] Checking lead-out kerf overlap for cut "${cut.name}"`
        );
        // Check if original chain intersects with the lead-out kerf zone
        // Use half of kerf width as sampling interval for appropriate resolution
        leadOutKerfOverlapsChain = doesLeadKerfOverlapChain(
            leadOutOuterChain,
            originalChain,
            kerfWidth / 2
        );
    }

    console.log(
        `[Kerf Gen] Lead kerf overlap summary for "${cut.name}": leadIn=${leadInKerfOverlapsChain}, leadOut=${leadOutKerfOverlapsChain}`
    );

    // Create Kerf object with lead geometry from the cut
    const kerf: Kerf = {
        id: crypto.randomUUID(),
        name: `Kerf for ${cut.name}`,
        enabled: true,
        cutId: cut.id,
        kerfWidth: kerfWidth,
        innerChain,
        outerChain,
        isClosed,
        leadIn: cut.leadIn,
        leadOut: cut.leadOut,
        leadInInnerChain,
        leadInOuterChain,
        leadOutInnerChain,
        leadOutOuterChain,
        leadInKerfOverlapsChain,
        leadOutKerfOverlapsChain,
        generatedAt: new Date().toISOString(),
        version: KERF_VERSION,
    };

    return kerf;
}

/**
 * Check if a lead kerf overlaps with the original chain
 *
 * Uses point sampling + ray tracing to detect if the original chain passes through
 * the Lead Kerf surface. The original chain is sampled at regular intervals
 * (specified by distanceInterval), and each sampled point is tested against the
 * Lead Kerf polygon using ray-tracing point-in-polygon algorithms.
 *
 * For leads (which are open paths), Clipper2 with EndType.Round produces a single
 * closed polygon in the outer chain that represents the entire kerf surface.
 *
 * @param leadKerfOuterChain - The outer kerf chain for the lead (closed polygon from Clipper2)
 * @param originalChain - The original chain before any offset was applied
 * @param distanceInterval - Distance between sampling points on the original chain
 * @returns true if the lead kerf overlaps with the original chain
 */
export function doesLeadKerfOverlapChain(
    leadKerfOuterChain: OffsetChain | undefined,
    originalChain: Chain,
    distanceInterval: number
): boolean {
    // For leads, only the outer chain exists (it's a closed polygon from Clipper2)
    if (!leadKerfOuterChain) {
        console.log(
            `[Overlap Check] No lead kerf outer chain - returning false`
        );
        return false;
    }

    // Sample the original chain at the specified distance interval
    const samples = sampleChainAtDistanceInterval(
        originalChain,
        distanceInterval
    );

    console.log(
        `[Overlap Check] Checking chain "${originalChain.id}" with ${samples.length} sample points (interval: ${distanceInterval.toFixed(INTERVAL_DECIMAL_PLACES)})`
    );

    // If no samples, no overlap is possible
    if (samples.length === 0) {
        console.log(`[Overlap Check] No samples - returning false`);
        return false;
    }

    // The outer chain from Clipper2 is already a closed polygon representing the lead kerf
    // Just use it directly as the polygon for ray tracing
    const leadKerfPolygon: Chain = {
        id: leadKerfOuterChain.id,
        shapes: leadKerfOuterChain.shapes,
    };

    // Test each sampled point against the Lead Kerf polygon using ray tracing
    for (const sample of samples) {
        try {
            if (isPointInsideChainExact(sample.point, leadKerfPolygon)) {
                console.log(
                    `[Overlap Check] ✗ Sample point (${sample.point.x.toFixed(2)}, ${sample.point.y.toFixed(2)}) is INSIDE lead kerf polygon`
                );
                console.log(
                    `[Overlap Check] OVERLAP DETECTED for chain "${originalChain.id}"`
                );
                return true; // Found overlap - original chain passes through kerf
            }
        } catch (error) {
            // isPointInsideChainExact may throw if chain is not closed
            // In that case, we can't reliably detect containment
            console.warn(
                '[Overlap Check] Unable to test point containment:',
                error
            );
            continue;
        }
    }

    // No sampled points were inside the Lead Kerf
    console.log(
        `[Overlap Check] ✓ No overlap detected for chain "${originalChain.id}" (tested ${samples.length} points)`
    );
    return false;
}

/**
 * Adjust cut start point to avoid lead kerf overlap with original chain
 *
 * When a lead kerf overlaps the original chain, iteratively try different start points
 * along the chain until finding one where the lead kerf doesn't overlap. Uses getChainPointAt()
 * to sample positions along the chain.
 *
 * @param cut - The cut with lead kerf overlap
 * @param tool - The tool providing kerf width
 * @param originalChain - The original chain before offset
 * @param tolerance - Tolerance for chain closure detection
 * @param parts - Array of parts for determining part context (holes vs shells)
 * @param stepSize - Step size for trying positions (default DEFAULT_STEP_SIZE = 10% increments)
 * @param maxAttempts - Maximum positions to try (default DEFAULT_MAX_ATTEMPTS)
 * @returns Adjusted cut with new start point, or null if no solution found
 */
export async function adjustCutStartPointForLeadKerfOverlap(
    cut: Cut,
    tool: Tool,
    _originalChain: Chain,
    tolerance: number,
    parts: Part[],
    stepSize: number = DEFAULT_STEP_SIZE,
    maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<Cut | null> {
    console.log(
        `[Start Adjust] Starting adjustment for cut "${cut.name}" (max attempts: ${maxAttempts}, step size: ${stepSize})`
    );

    if (!cut.cutChain) {
        console.log(`[Start Adjust] No cutChain - returning null`);
        return null;
    }

    // Only adjust closed chains (open chains can't be rotated)
    if (!isChainClosed(cut.cutChain, tolerance)) {
        console.warn(
            `[Start Adjust] Cannot adjust start point for open chain (cut: ${cut.name})`
        );
        return null;
    }

    // Find part context for this cut's chain (needed for correct normal calculation)
    const part = findPartContainingChain(cut.chainId, parts);
    if (part) {
        console.log(
            `[Start Adjust] Found part context (part ID: "${part.id}") for chain "${cut.chainId}"`
        );
    }

    // Try different positions along the chain
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const t = attempt * stepSize;
        if (t >= 1.0) {
            console.log(
                `[Start Adjust] Stopping at attempt ${attempt} (t=${t.toFixed(2)} >= 1.0)`
            );
            break; // Don't go past the end
        }

        console.log(
            `[Start Adjust] Attempt ${attempt}/${maxAttempts}: trying position t=${t.toFixed(2)}`
        );

        try {
            // Get point at this position
            const newStartPoint = getChainPointAt(cut.cutChain, t);

            // Rotate chain to start at this point
            // Find which shape contains this point and split it
            const rotatedChain = rotateChainToPoint(
                cut.cutChain,
                newStartPoint,
                t
            );
            if (!rotatedChain) {
                console.log(
                    `[Start Adjust] Failed to rotate chain to t=${t.toFixed(2)} - skipping`
                );
                continue;
            }

            // Create test cut with rotated chain
            const testCut: Cut = {
                ...cut,
                cutChain: rotatedChain,
            };

            // Recalculate normal for new start point WITH part context
            const normalResult = calculateCutNormal(
                rotatedChain,
                cut.cutDirection,
                part, // Use actual part context for correct normal direction
                cut.kerfCompensation
            );

            // Recalculate leads WITH part context
            const leadResult = calculateLeads(
                rotatedChain,
                cut.leadInConfig!,
                cut.leadOutConfig!,
                cut.cutDirection,
                part, // Use actual part context for correct lead orientation
                normalResult.normal
            );

            // Update test cut with new leads
            if (leadResult.leadIn) {
                testCut.leadIn = {
                    ...leadResult.leadIn,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                };
            }
            if (leadResult.leadOut) {
                testCut.leadOut = {
                    ...leadResult.leadOut,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                };
            }

            // Generate kerf for test cut
            const testKerf = await cutToKerf(testCut, tool);

            // Check if overlap is resolved
            const hasOverlap =
                testKerf.leadInKerfOverlapsChain ||
                testKerf.leadOutKerfOverlapsChain;

            console.log(
                `[Start Adjust] Position t=${t.toFixed(2)}: overlap=${hasOverlap} (leadIn=${testKerf.leadInKerfOverlapsChain}, leadOut=${testKerf.leadOutKerfOverlapsChain})`
            );

            if (!hasOverlap) {
                // Success! Return the adjusted cut
                console.log(
                    `[Start Adjust] ✓ SUCCESS! Adjusted cut start point for "${cut.name}" to t=${t.toFixed(2)} to avoid lead kerf overlap`
                );
                return {
                    ...testCut,
                    normal: normalResult.normal,
                    normalConnectionPoint: normalResult.connectionPoint,
                    normalSide: normalResult.normalSide,
                };
            }
        } catch (error) {
            console.warn(
                `[Start Adjust] Failed to test start point at t=${t.toFixed(2)}:`,
                error
            );
            continue;
        }
    }

    // No solution found
    console.warn(
        `[Start Adjust] ✗ FAILED: Could not find start point without lead kerf overlap for cut "${cut.name}" after ${maxAttempts} attempts`
    );
    return null;
}

/**
 * Rotate a chain to start at a different shape
 * Creates a new chain with shapes reordered to start at the specified shape index
 *
 * This is a simplified rotation that starts at shape boundaries rather than
 * arbitrary points within shapes. This is sufficient for avoiding lead kerf overlap
 * in most cases.
 *
 * @param chain - The chain to rotate
 * @param _startPoint - Start point (unused, kept for API consistency)
 * @param t - Parameter value (0-1) indicating approximate position along chain
 * @returns Rotated chain
 */
function rotateChainToPoint(
    chain: Chain,
    _startPoint: Point2D,
    t: number
): Chain | null {
    console.log(
        `[Chain Rotate] Rotating chain "${chain.id}" to position t=${t.toFixed(2)}`
    );

    // For simplicity, just start at the nearest shape boundary
    // Calculate which shape contains the target point
    const shapeLengths: number[] = chain.shapes.map((shape) =>
        getShapeLength(shape)
    );
    const totalLength: number = shapeLengths.reduce(
        (sum, length) => sum + length,
        0
    );
    const targetDistance: number = t * totalLength;

    // Find the shape containing the target point
    let accumulatedDistance: number = 0;
    let shapeIndex: number = 0;

    for (let i = 0; i < chain.shapes.length; i++) {
        const shapeLength: number = shapeLengths[i];
        const nextDistance: number = accumulatedDistance + shapeLength;

        if (targetDistance <= nextDistance) {
            shapeIndex = i;
            break;
        }
        accumulatedDistance = nextDistance;
    }

    console.log(
        `[Chain Rotate] Target shape index: ${shapeIndex}/${chain.shapes.length - 1} (distance: ${targetDistance.toFixed(2)}/${totalLength.toFixed(2)})`
    );

    // Reorder shapes to start at this index
    const reorderedShapes = [
        ...chain.shapes.slice(shapeIndex),
        ...chain.shapes.slice(0, shapeIndex),
    ];

    console.log(
        `[Chain Rotate] Reordered ${chain.shapes.length} shapes to start at index ${shapeIndex}`
    );

    return {
        ...chain,
        shapes: reorderedShapes,
    };
}
