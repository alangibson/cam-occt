import {
    LeadType,
    type Point2D,
    type Shape,
    type CutPath,
    type Lead,
} from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import type { Path } from '$lib/stores/paths/interfaces';
import type { Tool } from '$lib/stores/tools/interfaces';
import { getShapePoints } from '$lib/geometry/shape';
import {
    calculateLeadPoints,
    getCachedLeadGeometry,
    hasValidCachedLeads,
} from '$lib/utils/lead-persistence-utils';
import { convertLeadGeometryToPoints } from '$lib/algorithms/leads/functions';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { GEOMETRIC_PRECISION_TOLERANCE } from '$lib/geometry/math';
import { GeometryType } from '$lib/types/geometry';
import {
    CAM_CALCULATION_TOLERANCE,
    DEFAULT_CUT_HEIGHT,
    DEFAULT_FEED_RATE,
    DEFAULT_PIERCE_DELAY,
    DEFAULT_PIERCE_HEIGHT,
} from '$lib/cam/constants';
import type { LeadResult } from '$lib/algorithms/leads/interfaces';

/**
 * Convert a Path from the path store to a ToolPath for G-code generation.
 * Uses simulation's validated geometry resolution approach:
 * 1. path.cutChain?.shapes (preferred - execution-ordered shapes)
 * 2. path.calculatedOffset?.offsetShapes (fallback - offset geometry)
 * 3. originalShapes (final fallback)
 */
export function pathToToolPath(
    path: Path,
    originalShapes: Shape[],
    tools: Tool[],
    chainMap?: Map<string, Chain>,
    partMap?: Map<string, DetectedPart>
): CutPath {
    // Use simulation's validated geometry resolution approach
    // Priority: cutChain > calculatedOffset > original shapes
    let shapesToUse: Shape[];

    // First priority: Use execution chain if available (contains shapes in correct execution order)
    if (path.cutChain && path.cutChain.shapes.length > 0) {
        shapesToUse = path.cutChain.shapes;
    } else {
        // Second priority: Use offset shapes if available, otherwise fall back to original
        shapesToUse = path.offset?.offsetShapes || originalShapes;
    }

    // Determine if we can use native shape commands early
    // Only for single shapes (circles, arcs) that aren't part of complex offset chains
    const canUseNativeShapes =
        shapesToUse.length === 1 &&
        (shapesToUse[0].type === GeometryType.CIRCLE ||
            shapesToUse[0].type === GeometryType.ARC ||
            (shapesToUse[0].type === GeometryType.SPLINE &&
                (shapesToUse[0].geometry as Spline).controlPoints &&
                (shapesToUse[0].geometry as Spline).controlPoints!.length >=
                    2));

    // Combine all points from the shapes
    const points: Point2D[] = [];
    shapesToUse.forEach((shape) => {
        const shapePoints: Point2D[] = getShapePoints(
            shape,
            canUseNativeShapes
        );
        // For the first shape, add all points
        // For subsequent shapes, skip the first point to avoid duplication at connection points
        if (points.length === 0) {
            points.push(...shapePoints);
        } else {
            // Check if the last point of previous shape matches first point of current shape
            const lastPoint: Point2D = points[points.length - 1];
            const firstPoint: Point2D = shapePoints[0];
            const tolerance: number = GEOMETRIC_PRECISION_TOLERANCE;

            if (
                Math.abs(lastPoint.x - firstPoint.x) > tolerance ||
                Math.abs(lastPoint.y - firstPoint.y) > tolerance
            ) {
                // If points don't match, add all points
                points.push(...shapePoints);
            } else {
                // If points match, skip the first point
                points.push(...shapePoints.slice(1));
            }
        }
    });

    // Prepare lead-in points using both simulation and legacy approaches
    let leadIn: Lead | undefined;

    // First check for existing calculatedLeadIn (backward compatibility)
    if (path.leadIn) {
        const cachedLeadInPoints = convertLeadGeometryToPoints(path.leadIn);
        // Check if lead is valid (not zero-length line)
        const isZeroLengthLine =
            cachedLeadInPoints.length === 2 &&
            cachedLeadInPoints[0].x === cachedLeadInPoints[1].x &&
            cachedLeadInPoints[0].y === cachedLeadInPoints[1].y;
        if (cachedLeadInPoints.length > 0 && !isZeroLengthLine) {
            if (shapesToUse !== originalShapes && points.length > 0) {
                // Using offset geometry - verify lead connects to first point
                const leadEnd: Point2D =
                    cachedLeadInPoints[cachedLeadInPoints.length - 1];
                const pathStart: Point2D = points[0];
                const tolerance: number = 0.1; // Allow small tolerance for connection

                if (
                    Math.abs(leadEnd.x - pathStart.x) <= tolerance &&
                    Math.abs(leadEnd.y - pathStart.y) <= tolerance
                ) {
                    leadIn = convertLeadGeometryToPoints(path.leadIn);
                } else {
                    console.warn(
                        `Cached lead-in doesn't connect to offset path for path ${path.id}. Lead connects to (${leadEnd.x}, ${leadEnd.y}) but path starts at (${pathStart.x}, ${pathStart.y})`
                    );
                    leadIn = undefined; // Don't use disconnected lead
                }
            } else {
                leadIn = convertLeadGeometryToPoints(path.leadIn);
            }
        }
    }
    // If no calculatedLeadIn, try simulation's approach with leadInConfig
    else if (
        path.leadInConfig &&
        path.leadInConfig.type !== LeadType.NONE &&
        path.leadInConfig.length > 0
    ) {
        // First try to use cached lead geometry (simulation's approach)
        if (hasValidCachedLeads(path)) {
            const cached: LeadResult = getCachedLeadGeometry(path);
            if (cached.leadIn) {
                const cachedLeadInPoints = convertLeadGeometryToPoints(
                    cached.leadIn
                );
                // Check if lead is valid (not zero-length line)
                const isZeroLengthLine =
                    cachedLeadInPoints.length === 2 &&
                    cachedLeadInPoints[0].x === cachedLeadInPoints[1].x &&
                    cachedLeadInPoints[0].y === cachedLeadInPoints[1].y;
                if (cachedLeadInPoints.length > 0 && !isZeroLengthLine) {
                    // Verify cached lead connects properly to current geometry
                    const leadEnd: Point2D =
                        cachedLeadInPoints[cachedLeadInPoints.length - 1];
                    const pathStart: Point2D = points[0];
                    const tolerance: number = 0.1;

                    if (
                        Math.abs(leadEnd.x - pathStart.x) <= tolerance &&
                        Math.abs(leadEnd.y - pathStart.y) <= tolerance
                    ) {
                        leadIn = convertLeadGeometryToPoints(cached.leadIn);
                    } else {
                        console.warn(
                            `Cached lead-in doesn't connect to current geometry for path ${path.id}`
                        );
                        leadIn = undefined; // Will trigger recalculation below
                    }
                }
            }
        }

        // Fallback to calculating if no valid cache (simulation's approach)
        if (!leadIn) {
            const leadInPoints = calculateLeadPoints(
                path,
                chainMap,
                partMap,
                'leadIn'
            );
            if (leadInPoints && leadInPoints.length >= 2) {
                leadIn = leadInPoints;
            }
        }
    }

    // Prepare lead-out points using both simulation and legacy approaches
    let leadOut: Lead | undefined;

    // First check for existing calculatedLeadOut (backward compatibility)
    if (path.leadOut) {
        const cachedLeadOutPoints = convertLeadGeometryToPoints(path.leadOut);
        // Check if lead is valid (not zero-length line)
        const isZeroLengthLine =
            cachedLeadOutPoints.length === 2 &&
            cachedLeadOutPoints[0].x === cachedLeadOutPoints[1].x &&
            cachedLeadOutPoints[0].y === cachedLeadOutPoints[1].y;
        if (cachedLeadOutPoints.length > 0 && !isZeroLengthLine) {
            if (shapesToUse !== originalShapes && points.length > 0) {
                // Using offset geometry - verify lead connects to last point
                const leadStart: Point2D = cachedLeadOutPoints[0];
                const pathEnd: Point2D = points[points.length - 1];
                const tolerance: number = 0.1; // Allow small tolerance for connection

                if (
                    Math.abs(leadStart.x - pathEnd.x) <= tolerance &&
                    Math.abs(leadStart.y - pathEnd.y) <= tolerance
                ) {
                    leadOut = convertLeadGeometryToPoints(path.leadOut);
                } else {
                    console.warn(
                        `Cached lead-out doesn't connect to offset path for path ${path.id}. Lead connects to (${leadStart.x}, ${leadStart.y}) but path ends at (${pathEnd.x}, ${pathEnd.y})`
                    );
                    leadOut = undefined; // Don't use disconnected lead
                }
            } else {
                leadOut = convertLeadGeometryToPoints(path.leadOut);
            }
        }
    }
    // If no calculatedLeadOut, try simulation's approach with leadOutConfig
    else if (
        path.leadOutConfig &&
        path.leadOutConfig.type !== LeadType.NONE &&
        path.leadOutConfig.length > 0
    ) {
        // First try to use cached lead geometry (simulation's approach)
        if (hasValidCachedLeads(path)) {
            const cached = getCachedLeadGeometry(path);
            if (cached.leadOut) {
                const cachedLeadOutPoints = convertLeadGeometryToPoints(
                    cached.leadOut
                );
                // Check if lead is valid (not zero-length line)
                const isZeroLengthLine =
                    cachedLeadOutPoints.length === 2 &&
                    cachedLeadOutPoints[0].x === cachedLeadOutPoints[1].x &&
                    cachedLeadOutPoints[0].y === cachedLeadOutPoints[1].y;
                if (cachedLeadOutPoints.length > 0 && !isZeroLengthLine) {
                    // Verify cached lead connects properly to current geometry
                    const leadStart: Point2D = cachedLeadOutPoints[0];
                    const pathEnd: Point2D = points[points.length - 1];
                    const tolerance: number = 0.1;

                    if (
                        Math.abs(leadStart.x - pathEnd.x) <= tolerance &&
                        Math.abs(leadStart.y - pathEnd.y) <= tolerance
                    ) {
                        leadOut = convertLeadGeometryToPoints(cached.leadOut);
                    } else {
                        console.warn(
                            `Cached lead-out doesn't connect to current geometry for path ${path.id}`
                        );
                        leadOut = undefined; // Will trigger recalculation below
                    }
                }
            }
        }

        // Fallback to calculating if no valid cache (simulation's approach)
        if (!leadOut) {
            const leadOutPoints = calculateLeadPoints(
                path,
                chainMap,
                partMap,
                'leadOut'
            );
            if (leadOutPoints && leadOutPoints.length >= 2) {
                leadOut = leadOutPoints;
            }
        }
    }

    // Build cutting parameters from tool settings
    const tool = path.toolId ? tools.find((t) => t.id === path.toolId) : null;
    const parameters: CutPath['parameters'] = {
        feedRate: tool?.feedRate || DEFAULT_FEED_RATE,
        pierceHeight: tool?.pierceHeight || DEFAULT_PIERCE_HEIGHT,
        pierceDelay: tool?.pierceDelay || DEFAULT_PIERCE_DELAY,
        cutHeight: tool?.cutHeight || DEFAULT_CUT_HEIGHT,
        kerf: tool?.kerfWidth || 0,
        isHole: path.isHole || false,
        holeUnderspeedPercent: path.holeUnderspeedPercent,
    };

    // Set originalShape for native command generation
    const originalShape: Shape | undefined = canUseNativeShapes
        ? shapesToUse[0]
        : undefined;

    return {
        id: path.id,
        shapeId: path.chainId, // Use chainId as the shape reference
        points,
        leadIn,
        leadOut,
        isRapid: false,
        parameters,
        originalShape,
        executionClockwise: path.executionClockwise,
    };
}

/**
 * Convert multiple Paths to ToolPaths, preserving cut order
 * Uses simulation's validated approach for geometry resolution
 */
export function pathsToToolPaths(
    paths: Path[],
    chainShapes: Map<string, Shape[]>,
    tools: Tool[],
    chainMap?: Map<string, Chain>,
    partMap?: Map<string, DetectedPart>
): CutPath[] {
    const toolPaths: CutPath[] = [];

    // Sort paths by their order field
    const sortedPaths: Path[] = [...paths].sort((a, b) => a.order - b.order);

    for (const path of sortedPaths) {
        if (!path.enabled) continue;

        const originalShapes: Shape[] | undefined = chainShapes.get(
            path.chainId
        );
        if (!originalShapes) continue;

        const toolPath: CutPath = pathToToolPath(
            path,
            originalShapes,
            tools,
            chainMap,
            partMap
        );
        toolPaths.push(toolPath);
    }

    // Add rapids between tool paths
    const toolPathsWithRapids: CutPath[] = [];
    for (let i: number = 0; i < toolPaths.length; i++) {
        toolPathsWithRapids.push(toolPaths[i]);

        // Add rapid to next path start if not the last path
        if (i < toolPaths.length - 1) {
            const currentEnd: Point2D =
                toolPaths[i].points[toolPaths[i].points.length - 1];
            const nextStart: Point2D =
                toolPaths[i + 1].leadIn && toolPaths[i + 1].leadIn!.length > 0
                    ? toolPaths[i + 1].leadIn![0]
                    : toolPaths[i + 1].points[0];

            // Only add rapid if there's actual movement needed
            const distance: number = Math.sqrt(
                Math.pow(nextStart.x - currentEnd.x, 2) +
                    Math.pow(nextStart.y - currentEnd.y, 2)
            );

            if (distance > CAM_CALCULATION_TOLERANCE) {
                toolPathsWithRapids.push({
                    id: `rapid-${i}`,
                    shapeId: '',
                    points: [currentEnd, nextStart],
                    isRapid: true,
                    parameters: undefined,
                });
            }
        }
    }

    return toolPathsWithRapids;
}
