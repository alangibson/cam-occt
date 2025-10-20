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
import type { OffsetChain } from '$lib/algorithms/offset-calculation/chain/types';
import { GeometryType } from '$lib/geometry/shape/enums';
import {
    isChainClosed,
    tessellateChainToShapes,
} from '$lib/geometry/chain/functions';
import {
    offsetPaths,
    type OffsetOptions,
} from '$lib/cam/offset/clipper-offset';
import {
    reconstructChain,
    createOffsetChain,
} from '$lib/cam/offset/reconstruct';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import { getToolValue } from '$lib/cam/tool/tool-utils';
import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';

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
    const DECIMAL_PLACES = 3;
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
    const ARC_TOLERANCE = 0.1;
    const DECIMAL_PRECISION = 3;

    const shapePointArrays = tessellateChainToShapes(cutChain, {
        circleTessellationPoints: CIRCLE_POINTS,
        arcTessellationTolerance: ARC_TOLERANCE,
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
    // This will throw an error if Clipper2 returned multiple disconnected polygons
    const innerShapes = reconstructChain(inner, isClosedForOffset);
    const outerShapes = reconstructChain(outer, isClosedForOffset);

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
        generatedAt: new Date().toISOString(),
        version: KERF_VERSION,
    };

    return kerf;
}
