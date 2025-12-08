/**
 * Kerf Generation Functions
 *
 * Functions for transforming Cuts into Kerf representations showing
 * the material removal zone of the cutting tool.
 */

import type { Tool } from '$lib/cam/tool/interfaces';
import type { KerfData } from './interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { OffsetChain } from '$lib/cam/offset/types';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { Shape } from '$lib/cam/shape/classes';
import type { Part } from '$lib/cam/part/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';
import { BoundingBox } from '$lib/geometry/bounding-box/classes';
import { shapesBoundingBox, getShapeLength } from '$lib/cam/shape/functions';
import {
    isChainClosed,
    tessellateChainToShapes,
    getChainPointAt,
    sampleChain,
} from '$lib/cam/chain/functions';
import {
    offsetPaths,
    type OffsetOptions,
} from '$lib/cam/offset/clipper-offset';
import {
    reconstructChain as makeShapes,
    createOffsetChain as makeOffsetChain,
} from '$lib/cam/offset/reconstruct';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';
import { isPointInsideChainExact } from '$lib/cam/chain/point-in-chain';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { findPartContainingChain } from '$lib/cam/part/chain-part-interactions';
import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { CacheableLead } from '$lib/cam/lead/interfaces';
import { assignLeadsToCut } from '$lib/cam/pipeline/operations/part-operations';
import {
    CIRCLE_POINTS,
    CLOSURE_VALIDATION_TOLERANCE,
    DECIMAL_PLACES,
    DECIMAL_PRECISION,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_STEP_SIZE,
    DEFAULT_TOLERANCE,
    INTERVAL_DECIMAL_PLACES,
    KERF_VERSION,
} from './constants';

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
 */
export async function cutToKerf(cut: Cut, tool: Tool): Promise<KerfData> {
    performance.mark(`cutToKerf-${cut.id}-start`);

    // Validation
    if (!cut.chain) {
        throw new Error('Cut must have a cutChain to generate kerf');
    }
    if (tool.kerfWidth === undefined || tool.kerfWidth <= 0) {
        throw new Error('Tool must have a positive kerfWidth to generate kerf');
    }

    // Calculate offset distance (half kerf width in each direction)
    // Use getToolValue to get the correct unit-adjusted kerf width
    const kerfWidth = getToolValue(tool, 'kerfWidth');
    const offsetDistance = kerfWidth / 2;

    // Determine if chain is closed
    const isClosed = isChainClosed(cut.chain, DEFAULT_TOLERANCE);

    // Tessellate the cut chain to a single polyline for Clipper2
    performance.mark(`cutToKerf-${cut.id}-tessellate-start`);

    const shapePointArrays: Point2D[][] = tessellateChainToShapes(cut.chain, {
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
    performance.mark(`cutToKerf-${cut.id}-tessellate-end`);

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
    performance.mark(`cutToKerf-${cut.id}-offset-main-start`);
    const { inner, outer }: { inner: Point2D[][]; outer: Point2D[][] } =
        await offsetPaths(
            pointArrays,
            offsetDistance,
            isClosedForOffset,
            offsetOptions
        );
    performance.mark(`cutToKerf-${cut.id}-offset-main-end`);

    // Reconstruct chains from Clipper2 results
    // Clipper2 may return multiple polygons (e.g., shell + holes combined in one cut)
    // Each polygon will be properly closed in reconstructChain
    performance.mark(`cutToKerf-${cut.id}-reconstruct-main-start`);
    const innerShapes: Shape[] = makeShapes(inner);
    const outerShapes: Shape[] = makeShapes(outer);
    performance.mark(`cutToKerf-${cut.id}-reconstruct-main-end`);

    // Build offset chains
    const innerChain: OffsetChain = makeOffsetChain(
        innerShapes,
        isClosedForOffset ? 'inner' : 'left',
        cut.chain.id,
        isClosedForOffset
    );
    const outerChain: OffsetChain = makeOffsetChain(
        outerShapes,
        isClosedForOffset ? 'outer' : 'right',
        cut.chain.id,
        isClosedForOffset
    );

    // Validate chain closure for closed cuts
    if (isClosedForOffset) {
        validateChainClosure(innerChain, 'inner', cut.name);
        validateChainClosure(outerChain, 'outer', cut.name);
    }

    // Calculate kerf for leads separately if they exist
    performance.mark(`cutToKerf-${cut.id}-offset-leads-start`);
    let leadInInnerChain: OffsetChain | undefined;
    let leadInOuterChain: OffsetChain | undefined;
    let leadOutInnerChain: OffsetChain | undefined;
    let leadOutOuterChain: OffsetChain | undefined;

    if (leadInPoints.length > 1) {
        const leadInOffset: { inner: Point2D[][]; outer: Point2D[][] } =
            await offsetPaths(
                [leadInPoints],
                offsetDistance,
                false, // Leads are always open paths
                {
                    joinType: JoinType.Round,
                    endType: EndType.Round,
                    arcTolerance: 0.1,
                }
            );
        const leadInInnerShapes = makeShapes(leadInOffset.inner);
        const leadInOuterShapes = makeShapes(leadInOffset.outer);
        leadInInnerChain = makeOffsetChain(
            leadInInnerShapes,
            'left',
            `${cut.chain.id}-leadIn`,
            false
        );
        leadInOuterChain = makeOffsetChain(
            leadInOuterShapes,
            'right',
            `${cut.chain.id}-leadIn`,
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
        const leadOutInnerShapes = makeShapes(leadOutOffset.inner);
        const leadOutOuterShapes = makeShapes(leadOutOffset.outer);
        leadOutInnerChain = makeOffsetChain(
            leadOutInnerShapes,
            'left',
            `${cut.chain.id}-leadOut`,
            false
        );
        leadOutOuterChain = makeOffsetChain(
            leadOutOuterShapes,
            'right',
            `${cut.chain.id}-leadOut`,
            false
        );
    }
    performance.mark(`cutToKerf-${cut.id}-offset-leads-end`);

    // Overlap detection is not performed here - it's done in adjustKerfForLeadOverlap if needed
    const leadInKerfOverlapsChain = false;
    const leadOutKerfOverlapsChain = false;

    // Create Kerf object with lead geometry from the cut
    const kerf: KerfData = {
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

    performance.mark(`cutToKerf-${cut.id}-end`);

    // Measure all phases
    performance.measure(
        `cutToKerf-tessellate`,
        `cutToKerf-${cut.id}-tessellate-start`,
        `cutToKerf-${cut.id}-tessellate-end`
    );
    performance.measure(
        `cutToKerf-offset-main`,
        `cutToKerf-${cut.id}-offset-main-start`,
        `cutToKerf-${cut.id}-offset-main-end`
    );
    performance.measure(
        `cutToKerf-reconstruct-main`,
        `cutToKerf-${cut.id}-reconstruct-main-start`,
        `cutToKerf-${cut.id}-reconstruct-main-end`
    );
    performance.measure(
        `cutToKerf-offset-leads`,
        `cutToKerf-${cut.id}-offset-leads-start`,
        `cutToKerf-${cut.id}-offset-leads-end`
    );
    performance.measure(
        `cutToKerf-total`,
        `cutToKerf-${cut.id}-start`,
        `cutToKerf-${cut.id}-end`
    );

    return kerf;
}

/**
 * Check if a lead kerf overlaps with the original chain
 *
 * Uses distance-based sampling + ray tracing to detect if the original chain passes through
 * the Lead Kerf surface. The original chain is sampled at intervals based on the kerf width,
 * and each point is tested against the Lead Kerf polygon using ray-tracing point-in-polygon
 * algorithms.
 *
 * For leads (which are open paths), Clipper2 with EndType.Round produces a single
 * closed polygon in the outer chain that represents the entire kerf surface.
 *
 * @param leadKerfOuterChain - The outer kerf chain for the lead (closed polygon from Clipper2)
 * @param originalChain - The original chain before any offset was applied
 * @param kerfWidth - The kerf width in current units (used to determine sampling interval)
 * @returns true if the lead kerf overlaps with the original chain
 */
export function doesLeadKerfOverlapChain(
    leadKerfOuterChain: OffsetChain | undefined,
    originalChain: ChainData,
    kerfWidth: number
): boolean {
    // For leads, only the outer chain exists (it's a closed polygon from Clipper2)
    if (!leadKerfOuterChain) {
        if (import.meta.env.DEV) {
            console.log(
                `[Overlap Check] No lead kerf outer chain - returning false`
            );
        }
        return false;
    }

    // Fast bounding box pre-filtering: if bounding boxes don't overlap, chains can't overlap
    // Only perform if both chains have shapes
    if (
        leadKerfOuterChain.shapes.length > 0 &&
        originalChain.shapes.length > 0
    ) {
        const leadKerfBBox = new BoundingBox(
            shapesBoundingBox(leadKerfOuterChain.shapes)
        );
        const originalBBox = new BoundingBox(
            shapesBoundingBox(originalChain.shapes)
        );

        if (!leadKerfBBox.overlaps(originalBBox)) {
            if (import.meta.env.DEV) {
                console.log(
                    `[Overlap Check] ✓ Bounding boxes don't overlap - fast exit for chain "${originalChain.id}"`
                );
            }
            return false;
        }
    }

    // Sample the original chain at intervals based on kerf width
    // Use 2.5× kerf width as the sampling interval - much coarser than kerfWidth/2 but sufficient
    // This works in both mm and inches since kerfWidth is already in the correct units
    const SAMPLE_INTERVAL_MULTIPLIER = 2.5;
    const sampleInterval = kerfWidth * SAMPLE_INTERVAL_MULTIPLIER;

    // Skip direction calculation for overlap detection (only need positions)
    // This eliminates 2 extra getShapePointAt() calls per sample point
    const samples = sampleChain(
        new Chain(originalChain),
        sampleInterval,
        false
    );

    if (import.meta.env.DEV) {
        console.log(
            `[Overlap Check] Checking chain "${originalChain.id}" with ${samples.length} sample points (interval: ${sampleInterval.toFixed(INTERVAL_DECIMAL_PLACES)} units, kerf: ${kerfWidth.toFixed(INTERVAL_DECIMAL_PLACES)} units)`
        );
    }

    // If no samples, no overlap is possible
    if (samples.length === 0) {
        if (import.meta.env.DEV) {
            console.log(`[Overlap Check] No samples - returning false`);
        }
        return false;
    }

    // The outer chain from Clipper2 is already a closed polygon representing the lead kerf
    // Just use it directly as the polygon for ray tracing
    const leadKerfPolygon = new Chain({
        id: leadKerfOuterChain.id,
        name: leadKerfOuterChain.name || leadKerfOuterChain.id,
        shapes: leadKerfOuterChain.shapes,
    });

    // Test each sampled point against the Lead Kerf polygon using ray tracing
    for (const sample of samples) {
        const point = sample.point;
        try {
            if (isPointInsideChainExact(point, leadKerfPolygon)) {
                if (import.meta.env.DEV) {
                    console.log(
                        `[Overlap Check] ✗ Test point (${point.x.toFixed(2)}, ${point.y.toFixed(2)}) is INSIDE lead kerf polygon`
                    );
                    console.log(
                        `[Overlap Check] OVERLAP DETECTED for chain "${originalChain.id}"`
                    );
                }
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
    if (import.meta.env.DEV) {
        console.log(
            `[Overlap Check] ✓ No overlap detected for chain "${originalChain.id}" (tested ${samples.length} points)`
        );
    }
    return false;
}

/**
 * Adjust cut start point to avoid lead kerf overlap with original chain
 * Mutates the cut in place if adjustment succeeds.
 *
 * When a lead kerf overlaps the original chain, iteratively try different start points
 * along the chain until finding one where the lead kerf doesn't overlap. Uses getChainPointAt()
 * to sample positions along the chain.
 *
 * @param cut - The cut with lead kerf overlap (mutated in place if adjustment succeeds)
 * @param tool - The tool providing kerf width
 * @param tolerance - Tolerance for chain closure detection
 * @param parts - Array of parts for determining part context (holes vs shells)
 * @param stepSize - Step size for trying positions (default DEFAULT_STEP_SIZE = 10% increments)
 * @param maxAttempts - Maximum positions to try (default DEFAULT_MAX_ATTEMPTS)
 * @returns true if adjustment succeeded, false if no solution found
 */
export async function adjustCutStartPointForLeadKerfOverlap(
    cut: Cut,
    tool: Tool,
    tolerance: number,
    parts: Part[],
    stepSize: number = DEFAULT_STEP_SIZE,
    maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<boolean> {
    if (import.meta.env.DEV) {
        console.log(
            `[Start Adjust] Starting adjustment for cut "${cut.name}" (max attempts: ${maxAttempts}, step size: ${stepSize})`
        );
    }

    if (!cut.chain) {
        if (import.meta.env.DEV) {
            console.log(`[Start Adjust] No cutChain - returning false`);
        }
        return false;
    }

    // Only adjust closed chains (open chains can't be rotated)
    if (!isChainClosed(cut.chain, tolerance)) {
        console.warn(
            `[Start Adjust] Cannot adjust start point for open chain (cut: ${cut.name})`
        );
        return false;
    }

    // Find part context for this cut's chain (needed for correct normal calculation)
    const part = findPartContainingChain(cut.sourceChainId, parts);
    if (part) {
        if (import.meta.env.DEV) {
            console.log(
                `[Start Adjust] Found part context (part ID: "${part.id}") for chain "${cut.sourceChainId}"`
            );
        }
    }

    // Try different positions along the chain
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const t = attempt * stepSize;
        if (t >= 1.0) {
            if (import.meta.env.DEV) {
                console.log(
                    `[Start Adjust] Stopping at attempt ${attempt} (t=${t.toFixed(2)} >= 1.0)`
                );
            }
            break; // Don't go past the end
        }

        if (import.meta.env.DEV) {
            console.log(
                `[Start Adjust] Attempt ${attempt}/${maxAttempts}: trying position t=${t.toFixed(2)}`
            );
        }

        try {
            // Get point at this position
            const newStartPoint = getChainPointAt(cut.chain!, t);

            // Rotate chain to start at this point
            // Find which shape contains this point and split it
            const rotatedChain = rotateChainToPoint(
                cut.chain!,
                newStartPoint,
                t
            );
            if (!rotatedChain) {
                if (import.meta.env.DEV) {
                    console.log(
                        `[Start Adjust] Failed to rotate chain to t=${t.toFixed(2)} - skipping`
                    );
                }
                continue;
            }

            // Create test cut with rotated chain
            const rotatedChainInstance = new Chain(rotatedChain);

            // Recalculate normal for new start point WITH part context
            const normalResult = calculateCutNormal(
                rotatedChainInstance,
                cut.direction,
                part, // Use actual part context for correct normal direction
                cut.kerfCompensation
            );

            // Recalculate leads WITH part context
            const leadResult = calculateLeads(
                rotatedChainInstance,
                cut.leadInConfig!,
                cut.leadOutConfig!,
                cut.direction,
                part, // Use actual part context for correct lead orientation
                normalResult.normal
            );

            // Temporarily mutate cut for testing
            const originalCutChain: Chain | undefined = cut.chain;
            const originalLeadIn: CacheableLead | undefined = cut.leadIn;
            const originalLeadOut: CacheableLead | undefined = cut.leadOut;

            cut.chain = rotatedChainInstance;
            assignLeadsToCut(cut, leadResult.leadIn, leadResult.leadOut);

            // Generate kerf for test cut
            const testKerf = await cutToKerf(cut, tool);

            // Check if overlap is resolved
            const hasOverlap =
                testKerf.leadInKerfOverlapsChain ||
                testKerf.leadOutKerfOverlapsChain;

            if (import.meta.env.DEV) {
                console.log(
                    `[Start Adjust] Position t=${t.toFixed(2)}: overlap=${hasOverlap} (leadIn=${testKerf.leadInKerfOverlapsChain}, leadOut=${testKerf.leadOutKerfOverlapsChain})`
                );
            }

            if (!hasOverlap) {
                // Success! Keep the mutated values
                if (import.meta.env.DEV) {
                    console.log(
                        `[Start Adjust] ✓ SUCCESS! Adjusted cut start point for "${cut.name}" to t=${t.toFixed(2)} to avoid lead kerf overlap`
                    );
                }
                cut.normal = normalResult.normal;
                cut.normalConnectionPoint = normalResult.connectionPoint;
                cut.normalSide = normalResult.normalSide;
                return true;
            } else {
                // Restore original values for next iteration
                cut.chain = originalCutChain;
                if (originalLeadIn !== undefined) {
                    cut.leadIn = originalLeadIn;
                }
                if (originalLeadOut !== undefined) {
                    cut.leadOut = originalLeadOut;
                }
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
    return false;
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
    chain: ChainData,
    _startPoint: Point2D,
    t: number
): ChainData | null {
    if (import.meta.env.DEV) {
        console.log(
            `[Chain Rotate] Rotating chain "${chain.id}" to position t=${t.toFixed(2)}`
        );
    }

    // For simplicity, just start at the nearest shape boundary
    // Calculate which shape contains the target point
    const shapeLengths: number[] = chain.shapes.map((shape) =>
        getShapeLength(new Shape(shape))
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

    if (import.meta.env.DEV) {
        console.log(
            `[Chain Rotate] Target shape index: ${shapeIndex}/${chain.shapes.length - 1} (distance: ${targetDistance.toFixed(2)}/${totalLength.toFixed(2)})`
        );
    }

    // Reorder shapes to start at this index
    const reorderedShapes = [
        ...chain.shapes.slice(shapeIndex),
        ...chain.shapes.slice(0, shapeIndex),
    ];

    if (import.meta.env.DEV) {
        console.log(
            `[Chain Rotate] Reordered ${chain.shapes.length} shapes to start at index ${shapeIndex}`
        );
    }

    return {
        ...chain,
        shapes: reorderedShapes,
    };
}

/**
 * Adjust kerf to avoid lead overlap with the original chain
 *
 * This function:
 * 1. Checks if initial kerf has lead overlap
 * 2. Attempts to adjust start point if overlap detected
 * 3. Regenerates kerf with adjusted cut
 *
 * @param cut - The cut to generate kerf for (may be modified if adjustment succeeds)
 * @param tool - The tool providing kerf width
 * @param originalChain - The original chain before any offset
 * @param tolerance - Tolerance for chain closure detection
 * @param parts - Array of parts for determining part context (needed for correct normal calculation)
 * @param initialKerf - The initial kerf to check for overlap
 * @returns Result indicating whether adjustment was attempted and succeeded
 */
// export async function adjustKerfForLeadOverlap(
//     cut: Cut,
//     tool: Tool,
//     originalChain: Chain,
//     tolerance: number,
//     parts: Part[],
//     initialKerf: KerfData
// ): Promise<{
//     adjustmentAttempted: boolean;
//     adjustmentSucceeded: boolean;
//     kerf: KerfData;
// }> {
//     // Get tool kerf width
//     const kerfWidth = getToolValue(tool, 'kerfWidth');

//     // Create original chain data from the chain
//     const originalChainData: ChainData = {
//         id: originalChain.id,
//         name: originalChain.name || originalChain.id,
//         shapes: originalChain.shapes,
//     };

//     // Check if lead kerfs overlap with the original chain
//     let leadInKerfOverlapsChain = false;
//     let leadOutKerfOverlapsChain = false;

//     if (initialKerf.leadInOuterChain) {
//         if (import.meta.env.DEV) {
//             console.log(
//                 `[Kerf Gen] Checking lead-in kerf overlap for cut "${cut.name}"`
//             );
//         }
//         // Check if original chain intersects with the lead-in kerf zone
//         // Sampling interval scales with kerf width for unit independence
//         leadInKerfOverlapsChain = doesLeadKerfOverlapChain(
//             initialKerf.leadInOuterChain,
//             originalChainData,
//             kerfWidth
//         );
//     }

//     if (initialKerf.leadOutOuterChain) {
//         if (import.meta.env.DEV) {
//             console.log(
//                 `[Kerf Gen] Checking lead-out kerf overlap for cut "${cut.name}"`
//             );
//         }
//         // Check if original chain intersects with the lead-out kerf zone
//         // Sampling interval scales with kerf width for unit independence
//         leadOutKerfOverlapsChain = doesLeadKerfOverlapChain(
//             initialKerf.leadOutOuterChain,
//             originalChainData,
//             kerfWidth
//         );
//     }

//     const hasOverlap = leadInKerfOverlapsChain || leadOutKerfOverlapsChain;

//     if (import.meta.env.DEV) {
//         console.log(
//             `[Operation] Lead kerf overlap summary for "${cut.name}": leadIn=${leadInKerfOverlapsChain}, leadOut=${leadOutKerfOverlapsChain}`
//         );
//     }

//     if (hasOverlap) {
//         // Try to adjust start point to avoid overlap
//         if (import.meta.env.DEV) {
//             console.log(
//                 `[Operation] Attempting to adjust start point for cut "${cut.name}"`
//             );
//         }

//         const wasAdjusted = await adjustCutStartPointForLeadKerfOverlap(
//             cut,
//             tool,
//             tolerance,
//             parts
//         );

//         if (wasAdjusted) {
//             // Cut was adjusted in place
//             if (import.meta.env.DEV) {
//                 console.log(
//                     `[Operation] ✓ Start point adjustment SUCCEEDED for "${cut.name}"`
//                 );
//             }

//             // Regenerate kerf with the adjusted cut
//             if (import.meta.env.DEV) {
//                 console.log(`[Operation] Regenerating kerf with adjusted cut`);
//             }
//             const adjustedKerf = await cutToKerf(cut, tool);

//             return {
//                 adjustmentAttempted: true,
//                 adjustmentSucceeded: true,
//                 kerf: adjustedKerf,
//             };
//         } else {
//             // No solution found, use original kerf
//             console.warn(
//                 `[Operation] ✗ Start point adjustment FAILED for "${cut.name}" - using original cut with overlap`
//             );

//             return {
//                 adjustmentAttempted: true,
//                 adjustmentSucceeded: false,
//                 kerf: initialKerf,
//             };
//         }
//     } else {
//         // No overlap
//         if (import.meta.env.DEV) {
//             console.log(`[Operation] No overlap detected for "${cut.name}"`);
//         }

//         return {
//             adjustmentAttempted: false,
//             adjustmentSucceeded: false,
//             kerf: initialKerf,
//         };
//     }
// }
