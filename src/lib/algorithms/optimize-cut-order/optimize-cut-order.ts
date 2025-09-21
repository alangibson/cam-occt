import type { Path } from '$lib/stores/paths/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Point2D } from '$lib/types';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import {
    calculateDistance,
    findNearestPath,
    getPathStartPoint,
    prepareChainsAndLeadConfigs,
} from '$lib/algorithms/optimize-start-points/path-optimization-utils';
import { getChainEndPoint } from '$lib/geometry/chain/functions';
import { DEFAULT_ARRAY_NOT_FOUND_INDEX } from '$lib/geometry/constants';
import { convertLeadGeometryToPoints } from '$lib/algorithms/leads/functions';

/**
 * Rapids are the non-cutting paths that connect cut paths.
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
    orderedPaths: Path[];
    rapids: Rapid[];
    totalDistance: number;
}

/**
 * Process nearest path by adding rapid and updating tracking state
 */
function processNearestPath(
    nearestResult: { path: Path; distance: number },
    chains: Map<string, Chain>,
    currentPoint: Point2D,
    findPartForChain: (chainId: string) => DetectedPart | undefined,
    rapids: Rapid[],
    orderedPaths: Path[],
    unvisited: Set<Path>
): { updatedPoint: Point2D; totalDistance: number } {
    const chain = chains.get(nearestResult.path.chainId)!;
    const part = findPartForChain(nearestResult.path.chainId);
    const pathStart = getPathStartPoint(nearestResult.path, chain, part);

    rapids.push({
        id: crypto.randomUUID(),
        start: currentPoint,
        end: pathStart,
        type: 'rapid',
    });

    const totalDistance = nearestResult.distance;
    orderedPaths.push(nearestResult.path);
    unvisited.delete(nearestResult.path);

    const updatedPoint = getPathEndPoint(nearestResult.path, chain, part);

    return { updatedPoint, totalDistance };
}

/**
 * Get the effective end point of a path, accounting for lead-out geometry and offset.
 * If the path has a lead-out, returns the lead-out end point.
 * Otherwise, returns the chain end point.
 */
function getPathEndPoint(
    path: Path,
    chain: Chain,
    part?: DetectedPart
): Point2D {
    // Check if path has lead-out
    if (
        path.leadOutConfig &&
        path.leadOutConfig.type !== 'none' &&
        path.leadOutConfig.length > 0
    ) {
        try {
            const { leadCalculationChain, leadInConfig, leadOutConfig } =
                prepareChainsAndLeadConfigs(path, chain);

            const leadResult = calculateLeads(
                leadCalculationChain,
                leadInConfig,
                leadOutConfig,
                path.cutDirection,
                part
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
                'Failed to calculate lead-out for path:',
                path.name,
                error
            );
        }
    }

    // Fallback to chain end point (use offset if available)
    if (path.offset && path.offset.offsetShapes.length > 0) {
        const offsetChain: Chain = {
            id: chain.id + '_offset_temp',
            shapes: path.offset.offsetShapes,
        };
        return getChainEndPoint(offsetChain);
    }

    return getChainEndPoint(chain);
}

/**
 * Simple nearest neighbor algorithm for TSP
 * This is a greedy approximation that works well for many practical cases
 */
function nearestNeighborTSP(
    paths: Path[],
    chains: Map<string, Chain>,
    parts: DetectedPart[],
    startPoint: Point2D
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
    const orderedPaths: Path[] = [];
    const rapids: Rapid[] = [];
    const unvisited: Set<Path> = new Set(paths);
    let currentPoint: Point2D = startPoint;
    let totalDistance: number = 0;

    // Group paths by part
    const pathsByPart: Map<string, Path[]> = new Map<string, Path[]>();
    const pathsWithoutPart: Path[] = [];

    // Find which part each path belongs to
    for (const path of paths) {
        const chain: Chain | undefined = chains.get(path.chainId);
        if (!chain) continue;

        let belongsToPart: boolean = false;
        for (const part of parts) {
            // Check if chain is shell
            if (part.shell.chain.id === chain.id) {
                if (!pathsByPart.has(part.id)) {
                    pathsByPart.set(part.id, []);
                }
                pathsByPart.get(part.id)!.push(path);
                belongsToPart = true;
                break;
            }

            // Check if chain is a hole
            for (const hole of part.holes) {
                if (hole.chain.id === chain.id) {
                    if (!pathsByPart.has(part.id)) {
                        pathsByPart.set(part.id, []);
                    }
                    pathsByPart.get(part.id)!.push(path);
                    belongsToPart = true;
                    break;
                }
            }

            if (belongsToPart) break;
        }

        if (!belongsToPart) {
            pathsWithoutPart.push(path);
        }
    }

    // Process paths not belonging to any part first
    while (pathsWithoutPart.length > 0 && unvisited.size > 0) {
        const nearestResult = findNearestPath(
            currentPoint,
            pathsWithoutPart,
            chains,
            unvisited,
            findPartForChain
        );

        if (!nearestResult.path) break;

        // Add rapid from current point to path start
        const result = processNearestPath(
            { path: nearestResult.path, distance: nearestResult.distance },
            chains,
            currentPoint,
            findPartForChain,
            rapids,
            orderedPaths,
            unvisited
        );
        totalDistance += result.totalDistance;
        currentPoint = result.updatedPoint;

        // Remove from unprocessed list
        const index = pathsWithoutPart.indexOf(nearestResult.path);
        if (index > DEFAULT_ARRAY_NOT_FOUND_INDEX) {
            pathsWithoutPart.splice(index, 1);
        }
    }

    // Process parts - shell must be last within each part
    for (const [partId, partPaths] of pathsByPart) {
        const part: DetectedPart | undefined = parts.find(
            (p) => p.id === partId
        );
        if (!part) continue;

        // Separate shell path and hole paths
        let shellPath: Path | null = null;
        const holePaths: Path[] = [];

        for (const path of partPaths) {
            if (!unvisited.has(path)) continue;

            const chain: Chain | undefined = chains.get(path.chainId);
            if (!chain) continue;

            if (chain.id === part.shell.chain.id) {
                shellPath = path;
            } else {
                holePaths.push(path);
            }
        }

        // Process holes first
        while (holePaths.length > 0 && unvisited.size > 0) {
            const nearestResult = findNearestPath(
                currentPoint,
                holePaths,
                chains,
                unvisited,
                findPartForChain
            );

            if (!nearestResult.path) break;

            // Add rapid and path
            const result = processNearestPath(
                { path: nearestResult.path, distance: nearestResult.distance },
                chains,
                currentPoint,
                findPartForChain,
                rapids,
                orderedPaths,
                unvisited
            );
            totalDistance += result.totalDistance;
            currentPoint = result.updatedPoint;

            // Remove from holes list
            const index = holePaths.indexOf(nearestResult.path);
            if (index > DEFAULT_ARRAY_NOT_FOUND_INDEX) {
                holePaths.splice(index, 1);
            }
        }

        // Process shell last
        if (shellPath && unvisited.has(shellPath)) {
            const chain: Chain = chains.get(shellPath.chainId)!;
            const part: DetectedPart | undefined = findPartForChain(
                shellPath.chainId
            );
            const pathStart: Point2D = getPathStartPoint(
                shellPath,
                chain,
                part
            );
            const dist: number = calculateDistance(currentPoint, pathStart);

            rapids.push({
                id: crypto.randomUUID(),
                start: currentPoint,
                end: pathStart,
                type: 'rapid',
            });

            totalDistance += dist;
            orderedPaths.push(shellPath);
            unvisited.delete(shellPath);
            currentPoint = getPathEndPoint(shellPath, chain, part);
        }
    }

    return {
        orderedPaths,
        rapids,
        totalDistance,
    };
}

/**
 * Optimize the cutting order of paths using a traveling salesman algorithm
 *
 * @param paths - Array of paths to optimize
 * @param chains - Map of chain IDs to chains
 * @param parts - Array of detected parts (for shell/hole ordering)
 * @param origin - Starting point (usually drawing origin 0,0)
 * @returns Optimized path order with rapids
 */
export function optimizeCutOrder(
    paths: Path[],
    chains: Map<string, Chain>,
    parts: DetectedPart[],
    origin: Point2D = { x: 0, y: 0 }
): OptimizationResult {
    if (paths.length === 0) {
        return {
            orderedPaths: [],
            rapids: [],
            totalDistance: 0,
        };
    }

    // Filter out paths that don't have corresponding chains
    const validPaths: Path[] = paths.filter((path) => chains.has(path.chainId));

    if (validPaths.length === 0) {
        return {
            orderedPaths: [],
            rapids: [],
            totalDistance: 0,
        };
    }

    // Use nearest neighbor algorithm for now
    // This can be replaced with more sophisticated algorithms if needed
    return nearestNeighborTSP(validPaths, chains, parts, origin);
}
