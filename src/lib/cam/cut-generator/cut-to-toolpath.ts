import { LeadType } from '$lib/cam/lead/enums';
import type { Point2D } from '$lib/geometry/point';
import type { Shape } from '$lib/geometry/shape';
import type { CutPath } from './interfaces';
import type { Lead } from './types';
import { CutterCompensation } from './enums';
import type { Spline } from '$lib/geometry/spline';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { Tool } from '$lib/stores/tools/interfaces';
import { getShapePoints, GeometryType } from '$lib/geometry/shape';
import {
    calculateLeadPoints,
    getCachedLeadGeometry,
    hasValidCachedLeads,
} from '$lib/cam/cut/lead-persistence';
import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/cam/part/part-detection';
import { GEOMETRIC_PRECISION_TOLERANCE } from '$lib/geometry/math';
import {
    CAM_CALCULATION_TOLERANCE_MM,
    DEFAULT_CUT_HEIGHT_MM,
    DEFAULT_FEED_RATE_MM,
    DEFAULT_PIERCE_DELAY,
    DEFAULT_PIERCE_HEIGHT_MM,
} from '$lib/cam/constants';
import type { LeadResult } from '$lib/cam/lead/interfaces';
import {
    getToolFeedRate,
    getToolPierceHeight,
    getToolCutHeight,
    getToolKerfWidth,
} from '$lib/utils/tool-units';
import { Unit } from '$lib/utils/units';

/**
 * Convert a Cut from the cut store to a ToolPath for G-code generation.
 * Uses simulation's validated geometry resolution approach:
 * 1. cut.cutChain?.shapes (preferred - execution-ordered shapes)
 * 2. cut.calculatedOffset?.offsetShapes (fallback - offset geometry for SOFTWARE mode)
 * 3. originalShapes (final fallback or for MACHINE mode)
 */
export async function cutToToolPath(
    cut: Cut,
    originalShapes: Shape[],
    tools: Tool[],
    cutterCompensation: CutterCompensation | null,
    chainMap?: Map<string, Chain>,
    partMap?: Map<string, DetectedPart>,
    displayUnit?: Unit
): Promise<CutPath> {
    // Use simulation's validated geometry resolution approach
    // Priority: cutChain > calculatedOffset (if SOFTWARE mode) > original shapes
    let shapesToUse: Shape[];

    // First priority: Use execution chain if available (contains shapes in correct execution order)
    if (cut.cutChain && cut.cutChain.shapes.length > 0) {
        shapesToUse = cut.cutChain.shapes;
    } else if (
        cutterCompensation === CutterCompensation.SOFTWARE &&
        cut.offset?.offsetShapes
    ) {
        // Second priority: Use offset shapes ONLY in SOFTWARE mode
        shapesToUse = cut.offset.offsetShapes;
    } else {
        // Fall back to original shapes (used for MACHINE mode or when no offset available)
        shapesToUse = originalShapes;
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
    if (cut.leadIn) {
        const cachedLeadInPoints = convertLeadGeometryToPoints(cut.leadIn);
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
                const cutStart: Point2D = points[0];
                const tolerance: number = 0.1; // Allow small tolerance for connection

                if (
                    Math.abs(leadEnd.x - cutStart.x) <= tolerance &&
                    Math.abs(leadEnd.y - cutStart.y) <= tolerance
                ) {
                    leadIn = convertLeadGeometryToPoints(cut.leadIn);
                } else {
                    console.warn(
                        `Cached lead-in doesn't connect to offset cut for cut ${cut.id}. Lead connects to (${leadEnd.x}, ${leadEnd.y}) but cut starts at (${cutStart.x}, ${cutStart.y})`
                    );
                    leadIn = undefined; // Don't use disconnected lead
                }
            } else {
                leadIn = convertLeadGeometryToPoints(cut.leadIn);
            }
        }
    }
    // If no calculatedLeadIn, try simulation's approach with leadInConfig
    else if (
        cut.leadInConfig &&
        cut.leadInConfig.type !== LeadType.NONE &&
        cut.leadInConfig.length > 0
    ) {
        // First try to use cached lead geometry (simulation's approach)
        if (hasValidCachedLeads(cut)) {
            const cached: LeadResult = getCachedLeadGeometry(cut);
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
                    const cutStart: Point2D = points[0];
                    const tolerance: number = 0.1;

                    if (
                        Math.abs(leadEnd.x - cutStart.x) <= tolerance &&
                        Math.abs(leadEnd.y - cutStart.y) <= tolerance
                    ) {
                        leadIn = convertLeadGeometryToPoints(cached.leadIn);
                    } else {
                        console.warn(
                            `Cached lead-in doesn't connect to current geometry for cut ${cut.id}`
                        );
                        leadIn = undefined; // Will trigger recalculation below
                    }
                }
            }
        }

        // Fallback to calculating if no valid cache (simulation's approach)
        if (!leadIn) {
            const leadInPoints = await calculateLeadPoints(
                cut,
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
    if (cut.leadOut) {
        const cachedLeadOutPoints = convertLeadGeometryToPoints(cut.leadOut);
        // Check if lead is valid (not zero-length line)
        const isZeroLengthLine =
            cachedLeadOutPoints.length === 2 &&
            cachedLeadOutPoints[0].x === cachedLeadOutPoints[1].x &&
            cachedLeadOutPoints[0].y === cachedLeadOutPoints[1].y;
        if (cachedLeadOutPoints.length > 0 && !isZeroLengthLine) {
            if (shapesToUse !== originalShapes && points.length > 0) {
                // Using offset geometry - verify lead connects to last point
                const leadStart: Point2D = cachedLeadOutPoints[0];
                const cutEnd: Point2D = points[points.length - 1];
                const tolerance: number = 0.1; // Allow small tolerance for connection

                if (
                    Math.abs(leadStart.x - cutEnd.x) <= tolerance &&
                    Math.abs(leadStart.y - cutEnd.y) <= tolerance
                ) {
                    leadOut = convertLeadGeometryToPoints(cut.leadOut);
                } else {
                    console.warn(
                        `Cached lead-out doesn't connect to offset cut for cut ${cut.id}. Lead connects to (${leadStart.x}, ${leadStart.y}) but cut ends at (${cutEnd.x}, ${cutEnd.y})`
                    );
                    leadOut = undefined; // Don't use disconnected lead
                }
            } else {
                leadOut = convertLeadGeometryToPoints(cut.leadOut);
            }
        }
    }
    // If no calculatedLeadOut, try simulation's approach with leadOutConfig
    else if (
        cut.leadOutConfig &&
        cut.leadOutConfig.type !== LeadType.NONE &&
        cut.leadOutConfig.length > 0
    ) {
        // First try to use cached lead geometry (simulation's approach)
        if (hasValidCachedLeads(cut)) {
            const cached = getCachedLeadGeometry(cut);
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
                    const cutEnd: Point2D = points[points.length - 1];
                    const tolerance: number = 0.1;

                    if (
                        Math.abs(leadStart.x - cutEnd.x) <= tolerance &&
                        Math.abs(leadStart.y - cutEnd.y) <= tolerance
                    ) {
                        leadOut = convertLeadGeometryToPoints(cached.leadOut);
                    } else {
                        console.warn(
                            `Cached lead-out doesn't connect to current geometry for cut ${cut.id}`
                        );
                        leadOut = undefined; // Will trigger recalculation below
                    }
                }
            }
        }

        // Fallback to calculating if no valid cache (simulation's approach)
        if (!leadOut) {
            const leadOutPoints = await calculateLeadPoints(
                cut,
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
    const tool = cut.toolId ? tools.find((t) => t.id === cut.toolId) : null;

    // Use the correct unit-specific values based on displayUnit
    const unitToUse = displayUnit || Unit.MM; // Default to mm if not specified

    const parameters: CutPath['parameters'] = {
        feedRate: tool
            ? getToolFeedRate(tool, unitToUse)
            : DEFAULT_FEED_RATE_MM,
        pierceHeight: tool
            ? getToolPierceHeight(tool, unitToUse)
            : DEFAULT_PIERCE_HEIGHT_MM,
        pierceDelay: tool?.pierceDelay || DEFAULT_PIERCE_DELAY,
        cutHeight: tool
            ? getToolCutHeight(tool, unitToUse)
            : DEFAULT_CUT_HEIGHT_MM,
        kerf: tool ? getToolKerfWidth(tool, unitToUse) : 0,
        isHole: cut.isHole || false,
        holeUnderspeedPercent: cut.holeUnderspeedPercent,
    };

    // Set originalShape for native command generation
    const originalShape: Shape | undefined = canUseNativeShapes
        ? shapesToUse[0]
        : undefined;

    return {
        id: cut.id,
        shapeId: cut.chainId, // Use chainId as the shape reference
        points,
        leadIn,
        leadOut,
        isRapid: false,
        parameters,
        originalShape,
        executionClockwise: cut.executionClockwise,
        normalSide: cut.normalSide,
        hasOffset:
            cut.offset !== undefined &&
            cut.offset.offsetShapes !== undefined &&
            cut.offset.offsetShapes.length > 0,
    };
}

/**
 * Convert multiple Cuts to ToolPaths, preserving cut order
 * Uses simulation's validated approach for geometry resolution
 */
export async function cutsToToolPaths(
    cuts: Cut[],
    chainShapes: Map<string, Shape[]>,
    tools: Tool[],
    cutterCompensation: CutterCompensation | null,
    chainMap?: Map<string, Chain>,
    partMap?: Map<string, DetectedPart>,
    displayUnit?: Unit
): Promise<CutPath[]> {
    const toolPaths: CutPath[] = [];

    // Sort cuts by their order field
    const sortedCuts: Cut[] = [...cuts].sort((a, b) => a.order - b.order);

    for (const cut of sortedCuts) {
        if (!cut.enabled) continue;

        const originalShapes: Shape[] | undefined = chainShapes.get(
            cut.chainId
        );
        if (!originalShapes) continue;

        const toolPath: CutPath = await cutToToolPath(
            cut,
            originalShapes,
            tools,
            cutterCompensation,
            chainMap,
            partMap,
            displayUnit
        );
        toolPaths.push(toolPath);
    }

    // Add rapids between tool paths
    const toolPathsWithRapids: CutPath[] = [];
    for (let i: number = 0; i < toolPaths.length; i++) {
        toolPathsWithRapids.push(toolPaths[i]);

        // Add rapid to next cut start if not the last cut
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

            if (distance > CAM_CALCULATION_TOLERANCE_MM) {
                toolPathsWithRapids.push({
                    id: `rapid-${i}`,
                    shapeId: '',
                    points: [currentEnd, nextStart],
                    isRapid: true,
                    parameters: undefined,
                } as CutPath);
            }
        }
    }

    return toolPathsWithRapids;
}

// Removed backward compatibility exports - use cutToToolPath and cutsToToolPaths directly
