import type { Cut } from '$lib/stores/cuts/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Point2D } from '$lib/types';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import {
    calculateDistance,
    findNearestCut,
    getCutStartPoint,
    prepareChainsAndLeadConfigs,
} from '$lib/algorithms/optimize-start-points/cut-optimization-utils';
import { getChainEndPoint } from '$lib/geometry/chain/functions';
import { DEFAULT_ARRAY_NOT_FOUND_INDEX } from '$lib/geometry/constants';
import { convertLeadGeometryToPoints } from '$lib/algorithms/leads/functions';

/**
 * Rapids are the non-cutting movements that connect cuts.
 * They represent tool movement without cutting.
 */
export interface Rapid {
    id: string;
    start: Point2D;
    end: Point2D;
    type: 'rapid';
}

/**
 * Result of the cut order optimization
 */
export interface OptimizationResult {
    orderedCuts: Cut[];
    rapids: Rapid[];
    totalDistance: number;
}

/**
 * Process nearest cut by adding rapid and updating tracking state
 */
function processNearestCut(
    nearestResult: { cut: Cut; distance: number },
    chains: Map<string, Chain>,
    currentPoint: Point2D,
    findPartForChain: (chainId: string) => DetectedPart | undefined,
    rapids: Rapid[],
    orderedCuts: Cut[],
    unvisited: Set<Cut>
): { updatedPoint: Point2D; totalDistance: number } {
    const chain = chains.get(nearestResult.cut.chainId)!;
    const part = findPartForChain(nearestResult.cut.chainId);
    const cutStart = getCutStartPoint(nearestResult.cut, chain, part);

    rapids.push({
        id: crypto.randomUUID(),
        start: currentPoint,
        end: cutStart,
        type: 'rapid',
    });

    const totalDistance = nearestResult.distance;
    orderedCuts.push(nearestResult.cut);
    unvisited.delete(nearestResult.cut);

    const updatedPoint = getCutEndPoint(nearestResult.cut, chain, part);

    return { updatedPoint, totalDistance };
}

/**
 * Get the effective end point of a cut, accounting for lead-out geometry and offset.
 * If the cut has a lead-out, returns the lead-out end point.
 * Otherwise, returns the chain end point.
 */
function getCutEndPoint(cut: Cut, chain: Chain, part?: DetectedPart): Point2D {
    // Use cut.cutChain if it exists (it may have been reversed for open chains)
    const chainToUse = cut.cutChain || chain;

    // Check if cut has lead-out
    if (
        cut.leadOutConfig &&
        cut.leadOutConfig.type !== 'none' &&
        cut.leadOutConfig.length > 0
    ) {
        try {
            const { leadCalculationChain, leadInConfig, leadOutConfig } =
                prepareChainsAndLeadConfigs(cut, chain);

            const leadResult = calculateLeads(
                leadCalculationChain,
                leadInConfig,
                leadOutConfig,
                cut.cutDirection,
                part,
                cut.normal
            );

            if (leadResult.leadOut) {
                // Convert geometry to points and return the last point (end of lead-out)
                const points = convertLeadGeometryToPoints(leadResult.leadOut);
                if (points.length > 0) {
                    return points[
                        points.length + DEFAULT_ARRAY_NOT_FOUND_INDEX
                    ];
                }
            }
        } catch (error) {
            console.warn(
                'Failed to calculate lead-out for cut:',
                cut.name,
                error
            );
        }
    }

    // Fallback to chain end point (use offset if available)
    if (cut.offset && cut.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chainToUse.id + '_offset_temp',
            shapes: cut.offset.offsetShapes,
        };
        return getChainEndPoint(offsetChain);
    }

    return getChainEndPoint(chainToUse);
}

/**
 * Simple nearest neighbor algorithm for TSP
 * This is a greedy approximation that works well for many practical cases
 * @param cutHolesFirst - When true, cuts all holes across all parts before any shells
 */
function nearestNeighborTSP(
    cuts: Cut[],
    chains: Map<string, Chain>,
    parts: DetectedPart[],
    startPoint: Point2D,
    cutHolesFirst: boolean = false
): OptimizationResult {
    // Create a map of part ID to part for efficient lookup
    const partMap: Map<string, DetectedPart> = new Map<string, DetectedPart>();
    for (const part of parts) {
        partMap.set(part.id, part);
    }

    // Helper function to find the part that contains a given chain
    function findPartForChain(chainId: string): DetectedPart | undefined {
        for (const part of parts) {
            if (part.shell.chain.id === chainId) {
                return part;
            }
            for (const hole of part.holes) {
                if (hole.chain.id === chainId) {
                    return part;
                }
            }
        }
        return undefined;
    }
    const orderedCuts: Cut[] = [];
    const rapids: Rapid[] = [];
    const unvisited: Set<Cut> = new Set(cuts);
    let currentPoint: Point2D = startPoint;
    let totalDistance: number = 0;

    // Group cuts by part
    const cutsByPart: Map<string, Cut[]> = new Map<string, Cut[]>();
    const cutsWithoutPart: Cut[] = [];

    // Find which part each cut belongs to
    for (const cut of cuts) {
        const chain: Chain | undefined = chains.get(cut.chainId);
        if (!chain) continue;

        let belongsToPart: boolean = false;
        for (const part of parts) {
            // Check if chain is shell
            if (part.shell.chain.id === chain.id) {
                if (!cutsByPart.has(part.id)) {
                    cutsByPart.set(part.id, []);
                }
                cutsByPart.get(part.id)!.push(cut);
                belongsToPart = true;
                break;
            }

            // Check if chain is a hole
            for (const hole of part.holes) {
                if (hole.chain.id === chain.id) {
                    if (!cutsByPart.has(part.id)) {
                        cutsByPart.set(part.id, []);
                    }
                    cutsByPart.get(part.id)!.push(cut);
                    belongsToPart = true;
                    break;
                }
            }

            if (belongsToPart) break;
        }

        if (!belongsToPart) {
            cutsWithoutPart.push(cut);
        }
    }

    // Process cuts not belonging to any part first
    while (cutsWithoutPart.length > 0 && unvisited.size > 0) {
        const nearestResult = findNearestCut(
            currentPoint,
            cutsWithoutPart,
            chains,
            unvisited,
            findPartForChain
        );

        if (!nearestResult.cut) break;

        // Add rapid from current point to cut start
        const result = processNearestCut(
            { cut: nearestResult.cut, distance: nearestResult.distance },
            chains,
            currentPoint,
            findPartForChain,
            rapids,
            orderedCuts,
            unvisited
        );
        totalDistance += result.totalDistance;
        currentPoint = result.updatedPoint;

        // Remove from unprocessed list
        const index = cutsWithoutPart.indexOf(nearestResult.cut);
        if (index > DEFAULT_ARRAY_NOT_FOUND_INDEX) {
            cutsWithoutPart.splice(index, 1);
        }
    }

    if (cutHolesFirst) {
        // Process ALL holes across ALL parts first
        const allHoleCuts: Cut[] = [];
        const allShellCuts: Cut[] = [];

        // Separate all holes and shells
        for (const [partId, partCuts] of cutsByPart) {
            const part: DetectedPart | undefined = parts.find(
                (p) => p.id === partId
            );
            if (!part) continue;

            for (const cut of partCuts) {
                if (!unvisited.has(cut)) continue;

                const chain: Chain | undefined = chains.get(cut.chainId);
                if (!chain) continue;

                if (chain.id === part.shell.chain.id) {
                    allShellCuts.push(cut);
                } else {
                    allHoleCuts.push(cut);
                }
            }
        }

        // Process all holes using nearest neighbor
        while (allHoleCuts.length > 0 && unvisited.size > 0) {
            const nearestResult = findNearestCut(
                currentPoint,
                allHoleCuts,
                chains,
                unvisited,
                findPartForChain
            );

            if (!nearestResult.cut) break;

            // Add rapid and cut
            const result = processNearestCut(
                { cut: nearestResult.cut, distance: nearestResult.distance },
                chains,
                currentPoint,
                findPartForChain,
                rapids,
                orderedCuts,
                unvisited
            );
            totalDistance += result.totalDistance;
            currentPoint = result.updatedPoint;

            // Remove from holes list
            const index = allHoleCuts.indexOf(nearestResult.cut);
            if (index > DEFAULT_ARRAY_NOT_FOUND_INDEX) {
                allHoleCuts.splice(index, 1);
            }
        }

        // Process all shells using nearest neighbor
        while (allShellCuts.length > 0 && unvisited.size > 0) {
            const nearestResult = findNearestCut(
                currentPoint,
                allShellCuts,
                chains,
                unvisited,
                findPartForChain
            );

            if (!nearestResult.cut) break;

            // Add rapid and cut
            const result = processNearestCut(
                { cut: nearestResult.cut, distance: nearestResult.distance },
                chains,
                currentPoint,
                findPartForChain,
                rapids,
                orderedCuts,
                unvisited
            );
            totalDistance += result.totalDistance;
            currentPoint = result.updatedPoint;

            // Remove from shells list
            const index = allShellCuts.indexOf(nearestResult.cut);
            if (index > DEFAULT_ARRAY_NOT_FOUND_INDEX) {
                allShellCuts.splice(index, 1);
            }
        }
    } else {
        // Process parts - shell must be last within each part
        for (const [partId, partCuts] of cutsByPart) {
            const part: DetectedPart | undefined = parts.find(
                (p) => p.id === partId
            );
            if (!part) continue;

            // Separate shell cut and hole cuts
            let shellCut: Cut | null = null;
            const holeCuts: Cut[] = [];

            for (const cut of partCuts) {
                if (!unvisited.has(cut)) continue;

                const chain: Chain | undefined = chains.get(cut.chainId);
                if (!chain) continue;

                if (chain.id === part.shell.chain.id) {
                    shellCut = cut;
                } else {
                    holeCuts.push(cut);
                }
            }

            // Process holes first
            while (holeCuts.length > 0 && unvisited.size > 0) {
                const nearestResult = findNearestCut(
                    currentPoint,
                    holeCuts,
                    chains,
                    unvisited,
                    findPartForChain
                );

                if (!nearestResult.cut) break;

                // Add rapid and cut
                const result = processNearestCut(
                    {
                        cut: nearestResult.cut,
                        distance: nearestResult.distance,
                    },
                    chains,
                    currentPoint,
                    findPartForChain,
                    rapids,
                    orderedCuts,
                    unvisited
                );
                totalDistance += result.totalDistance;
                currentPoint = result.updatedPoint;

                // Remove from holes list
                const index = holeCuts.indexOf(nearestResult.cut);
                if (index > DEFAULT_ARRAY_NOT_FOUND_INDEX) {
                    holeCuts.splice(index, 1);
                }
            }

            // Process shell last
            if (shellCut && unvisited.has(shellCut)) {
                const chain: Chain = chains.get(shellCut.chainId)!;
                const part: DetectedPart | undefined = findPartForChain(
                    shellCut.chainId
                );
                const cutStart: Point2D = getCutStartPoint(
                    shellCut,
                    chain,
                    part
                );
                const dist: number = calculateDistance(currentPoint, cutStart);

                rapids.push({
                    id: crypto.randomUUID(),
                    start: currentPoint,
                    end: cutStart,
                    type: 'rapid',
                });

                totalDistance += dist;
                orderedCuts.push(shellCut);
                unvisited.delete(shellCut);
                currentPoint = getCutEndPoint(shellCut, chain, part);
            }
        }
    }

    return {
        orderedCuts,
        rapids,
        totalDistance,
    };
}

/**
 * Optimize the cutting order of cuts using a traveling salesman algorithm
 *
 * @param cuts - Array of cuts to optimize
 * @param chains - Map of chain IDs to chains
 * @param parts - Array of detected parts (for shell/hole ordering)
 * @param origin - Starting point (usually drawing origin 0,0)
 * @param cutHolesFirst - When true, cut all holes before any shells
 * @returns Optimized cut order with rapids
 */
export function optimizeCutOrder(
    cuts: Cut[],
    chains: Map<string, Chain>,
    parts: DetectedPart[],
    origin: Point2D = { x: 0, y: 0 },
    cutHolesFirst: boolean = false
): OptimizationResult {
    if (cuts.length === 0) {
        return {
            orderedCuts: [],
            rapids: [],
            totalDistance: 0,
        };
    }

    // Filter out cuts that don't have corresponding chains
    const validCuts: Cut[] = cuts.filter((cut) => chains.has(cut.chainId));

    if (validCuts.length === 0) {
        return {
            orderedCuts: [],
            rapids: [],
            totalDistance: 0,
        };
    }

    // Use nearest neighbor algorithm for now
    // This can be replaced with more sophisticated algorithms if needed
    return nearestNeighborTSP(validCuts, chains, parts, origin, cutHolesFirst);
}
