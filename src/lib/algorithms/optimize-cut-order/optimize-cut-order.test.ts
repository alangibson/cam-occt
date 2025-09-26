import { describe, expect, it, vi } from 'vitest';
import { optimizeCutOrder } from './optimize-cut-order';
import type { Path } from '$lib/stores/paths/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Arc, Circle, Ellipse, Line, Polyline, Shape } from '$lib/types';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import type { Spline } from '$lib/geometry/spline';
import type {
    DetectedPart,
    PartShell,
    PartHole,
} from '$lib/algorithms/part-detection/part-detection';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import { GeometryType } from '$lib/types/geometry';
import { CutDirection, LeadType } from '$lib/types/direction';
import { createPolylineFromVertices } from '$lib/geometry/polyline';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import * as pathOptUtils from '$lib/algorithms/optimize-start-points/path-optimization-utils';

// Mock crypto.randomUUID
if (typeof crypto === 'undefined') {
    const mockCrypto: Partial<Crypto> = {
        randomUUID: vi.fn(() => {
            const hex = Math.random().toString(16).substr(2, 8);
            return `${hex.substr(0, 8)}-${hex.substr(0, 4)}-4${hex.substr(0, 3)}-${hex.substr(0, 4)}-${hex.padEnd(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`;
        }),
    };
    global.crypto = mockCrypto as Crypto;
}

describe('Optimize Cut Order', () => {
    // Helper function to create a basic path
    const createPath = (
        id: string,
        chainId: string,
        options: Partial<Path> = {}
    ): Path => ({
        id,
        name: `Path ${id}`,
        chainId,
        operationId: 'op-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        cutDirection: CutDirection.COUNTERCLOCKWISE,
        ...options,
    });

    // Helper function to create a basic chain with line geometry
    const createLineChain = (
        id: string,
        start = { x: 0, y: 0 },
        end = { x: 10, y: 10 }
    ): Chain => ({
        id,
        shapes: [
            {
                id: `shape-${id}`,
                type: GeometryType.LINE,
                geometry: { start, end } as Line,
            },
        ],
    });

    // Helper function to create a detected part
    const createDetectedPart = (
        id: string,
        shellChain: Chain,
        holeChains: Chain[] = []
    ): DetectedPart => {
        const createBoundingBox = (): BoundingBox => ({
            min: { x: 0, y: 0 },
            max: { x: 100, y: 100 },
        });

        const shell: PartShell = {
            id: `shell-${id}`,
            chain: shellChain,
            type: PartType.SHELL,
            boundingBox: createBoundingBox(),
            holes: [],
        };

        const holes: PartHole[] = holeChains.map((chain, index) => ({
            id: `hole-${id}-${index}`,
            chain,
            type: PartType.HOLE,
            boundingBox: createBoundingBox(),
            holes: [],
        }));

        return {
            id,
            shell,
            holes,
        };
    };

    describe('Edge Cases', () => {
        it('should return empty result for empty paths array', () => {
            const chains = new Map<string, Chain>();
            const result = optimizeCutOrder([], chains, []);

            expect(result.orderedPaths).toEqual([]);
            expect(result.rapids).toEqual([]);
            expect(result.totalDistance).toBe(0);
        });

        it('should return empty result when no paths have corresponding chains', () => {
            const paths = [createPath('path-1', 'nonexistent-chain')];
            const chains = new Map<string, Chain>();

            const result = optimizeCutOrder(paths, chains, []);

            expect(result.orderedPaths).toEqual([]);
            expect(result.rapids).toEqual([]);
            expect(result.totalDistance).toBe(0);
        });

        it('should filter out paths without corresponding chains', () => {
            const chain1 = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const paths = [
                createPath('path-1', 'chain-1'),
                createPath('path-2', 'nonexistent-chain'),
            ];
            const chains = new Map([['chain-1', chain1]]);

            const result = optimizeCutOrder(paths, chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0].id).toBe('path-1');
        });
    });

    describe('Single Path Optimization', () => {
        it('should handle single path without parts', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 5, y: 5 },
                { x: 15, y: 15 }
            );
            const path = createPath('path-1', 'chain-1');
            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([path], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0]).toBe(path);
            expect(result.rapids).toHaveLength(1);
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 }); // origin
            expect(result.rapids[0].end).toEqual({ x: 5, y: 5 }); // chain start
            expect(result.totalDistance).toBeGreaterThan(0);
        });
    });

    describe('Multiple Paths Without Parts', () => {
        it('should optimize multiple independent paths', () => {
            const chain1 = createLineChain(
                'chain-1',
                { x: 1, y: 1 },
                { x: 2, y: 2 }
            );
            const chain2 = createLineChain(
                'chain-2',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const chain3 = createLineChain(
                'chain-3',
                { x: 5, y: 5 },
                { x: 6, y: 6 }
            );

            const paths = [
                createPath('path-1', 'chain-1'),
                createPath('path-2', 'chain-2'),
                createPath('path-3', 'chain-3'),
            ];

            const chains = new Map([
                ['chain-1', chain1],
                ['chain-2', chain2],
                ['chain-3', chain3],
            ]);

            const result = optimizeCutOrder(paths, chains, []);

            expect(result.orderedPaths).toHaveLength(3);
            expect(result.rapids).toHaveLength(3);
            expect(result.totalDistance).toBeGreaterThan(0);

            // Should pick the closest path first (chain-1 is closest to origin)
            expect(result.orderedPaths[0].chainId).toBe('chain-1');
        });
    });

    describe('Parts Processing', () => {
        it('should process holes before shell in a part', () => {
            // Create shell chain (outer boundary)
            const shellChain = createLineChain(
                'shell-chain',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );

            // Create hole chains
            const holeChain1 = createLineChain(
                'hole-chain-1',
                { x: 20, y: 20 },
                { x: 30, y: 30 }
            );
            const holeChain2 = createLineChain(
                'hole-chain-2',
                { x: 60, y: 60 },
                { x: 70, y: 70 }
            );

            const part = createDetectedPart('part-1', shellChain, [
                holeChain1,
                holeChain2,
            ]);

            const paths = [
                createPath('shell-path', 'shell-chain'),
                createPath('hole-path-1', 'hole-chain-1'),
                createPath('hole-path-2', 'hole-chain-2'),
            ];

            const chains = new Map([
                ['shell-chain', shellChain],
                ['hole-chain-1', holeChain1],
                ['hole-chain-2', holeChain2],
            ]);

            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(3);
            expect(result.rapids).toHaveLength(3);

            // Shell should be last
            const shellPathIndex = result.orderedPaths.findIndex(
                (p) => p.id === 'shell-path'
            );
            expect(shellPathIndex).toBe(2); // Should be the last path

            // Holes should come first
            const holeIndices = result.orderedPaths
                .map((p, i) => (p.id.startsWith('hole-path') ? i : -1))
                .filter((i) => i >= 0);
            expect(holeIndices).toEqual([0, 1]);
        });

        it('should handle multiple parts correctly', () => {
            // Part 1
            const shell1 = createLineChain(
                'shell-1',
                { x: 0, y: 0 },
                { x: 50, y: 50 }
            );
            const hole1 = createLineChain(
                'hole-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const part1 = createDetectedPart('part-1', shell1, [hole1]);

            // Part 2
            const shell2 = createLineChain(
                'shell-2',
                { x: 100, y: 100 },
                { x: 150, y: 150 }
            );
            const hole2 = createLineChain(
                'hole-2',
                { x: 110, y: 110 },
                { x: 120, y: 120 }
            );
            const part2 = createDetectedPart('part-2', shell2, [hole2]);

            const paths = [
                createPath('shell-path-1', 'shell-1'),
                createPath('hole-path-1', 'hole-1'),
                createPath('shell-path-2', 'shell-2'),
                createPath('hole-path-2', 'hole-2'),
            ];

            const chains = new Map([
                ['shell-1', shell1],
                ['hole-1', hole1],
                ['shell-2', shell2],
                ['hole-2', hole2],
            ]);

            const result = optimizeCutOrder(paths, chains, [part1, part2]);

            expect(result.orderedPaths).toHaveLength(4);
            expect(result.rapids).toHaveLength(4);

            // Within each part, holes should come before shells
            const pathOrder = result.orderedPaths.map((p) => p.id);
            const shell1Index = pathOrder.indexOf('shell-path-1');
            const hole1Index = pathOrder.indexOf('hole-path-1');
            const shell2Index = pathOrder.indexOf('shell-path-2');
            const hole2Index = pathOrder.indexOf('hole-path-2');

            // In each part, hole should come before shell
            expect(hole1Index).toBeLessThan(shell1Index);
            expect(hole2Index).toBeLessThan(shell2Index);
        });

        it('should handle parts with no holes', () => {
            const shellChain = createLineChain(
                'shell-chain',
                { x: 5, y: 5 },
                { x: 15, y: 15 }
            );
            const part = createDetectedPart('part-1', shellChain, []);

            const paths = [createPath('shell-path', 'shell-chain')];
            const chains = new Map([['shell-chain', shellChain]]);

            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0].id).toBe('shell-path');
            expect(result.rapids).toHaveLength(1);
        });
    });

    describe('Lead Configuration Tests', () => {
        it('should handle paths with lead-out configuration', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const pathWithLeadOut = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: 5 },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([pathWithLeadOut], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should handle paths with no lead-out (none type)', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const pathWithoutLeadOut = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.NONE, length: 0 },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([pathWithoutLeadOut], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should handle paths with calculated offset', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const offsetShape: Shape = {
                id: 'offset-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 12, y: 12 },
                    end: { x: 22, y: 22 },
                } as Line,
            };

            const pathWithOffset = createPath('path-1', 'chain-1', {
                offset: {
                    offsetShapes: [offsetShape],
                    originalShapes: [offsetShape],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 2,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([pathWithOffset], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });
    });

    describe('Custom Origin', () => {
        it('should use custom origin point', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const path = createPath('path-1', 'chain-1');
            const chains = new Map([['chain-1', chain]]);
            const customOrigin = { x: 100, y: 100 };

            const result = optimizeCutOrder([path], chains, [], customOrigin);

            expect(result.rapids[0].start).toEqual(customOrigin);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle findNearestPath returning no path', () => {
            // This test ensures the break conditions are hit when findNearestPath returns no path
            const chain = createLineChain(
                'chain-1',
                { x: 1000, y: 1000 },
                { x: 2000, y: 2000 }
            );
            const path = createPath('path-1', 'chain-1', { enabled: false }); // disabled path to potentially trigger edge case
            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([path], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
        });

        it('should handle array index edge cases', () => {
            // Test the DEFAULT_ARRAY_NOT_FOUND_INDEX logic
            const chain1 = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const chain2 = createLineChain(
                'chain-2',
                { x: 20, y: 20 },
                { x: 30, y: 30 }
            );

            const paths = [
                createPath('path-1', 'chain-1'),
                createPath('path-2', 'chain-2'),
            ];

            const chains = new Map([
                ['chain-1', chain1],
                ['chain-2', chain2],
            ]);

            const result = optimizeCutOrder(paths, chains, []);

            // Should handle the path removal from arrays correctly
            expect(result.orderedPaths).toHaveLength(2);
            expect(result.rapids).toHaveLength(2);
        });

        it('should handle missing parts in pathsByPart', () => {
            const shellChain = createLineChain(
                'shell-chain',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const holeChain = createLineChain(
                'hole-chain',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );

            // Create a part but reference it in a way that could cause lookup issues
            const part = createDetectedPart('part-1', shellChain, [holeChain]);

            const paths = [
                createPath('shell-path', 'shell-chain'),
                createPath('hole-path', 'hole-chain'),
            ];

            const chains = new Map([
                ['shell-chain', shellChain],
                ['hole-chain', holeChain],
            ]);

            // Test with parts array that might cause edge case
            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(2);
        });

        it('should handle paths already visited in unvisited set', () => {
            const shell = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 50, y: 50 }
            );
            const hole1 = createLineChain(
                'hole1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const hole2 = createLineChain(
                'hole2',
                { x: 30, y: 30 },
                { x: 40, y: 40 }
            );

            const part = createDetectedPart('part-1', shell, [hole1, hole2]);

            const paths = [
                createPath('shell-path', 'shell'),
                createPath('hole-path-1', 'hole1'),
                createPath('hole-path-2', 'hole2'),
            ];

            const chains = new Map([
                ['shell', shell],
                ['hole1', hole1],
                ['hole2', hole2],
            ]);

            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(3);
            expect(result.rapids).toHaveLength(3);
        });
    });

    describe('getPathEndPoint Function Coverage', () => {
        it('should use lead-out end point when available', () => {
            // This test specifically targets the lead-out calculation branch
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const pathWithLeadOut = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: 10 },
                cutDirection: CutDirection.CLOCKWISE,
            });

            const chains = new Map([['chain-1', chain]]);

            // Mock console.warn to test error handling
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = optimizeCutOrder([pathWithLeadOut], chains, []);

            expect(result.orderedPaths).toHaveLength(1);

            consoleSpy.mockRestore();
        });

        it('should handle lead calculation errors gracefully', () => {
            // Create a path with lead-out but invalid configuration to trigger error handling
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const pathWithBadLeadOut = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: -1 }, // Invalid length to potentially cause errors
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const chains = new Map([['chain-1', chain]]);

            // Mock console.warn to capture error handling
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = optimizeCutOrder([pathWithBadLeadOut], chains, []);

            expect(result.orderedPaths).toHaveLength(1);

            consoleSpy.mockRestore();
        });

        it('should trigger error handling in lead calculation', async () => {
            // Mock the prepareChainsAndLeadConfigs to throw an error
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const pathWithLeadOut = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: 5 },
            });

            const chains = new Map([['chain-1', chain]]);

            // Mock prepareChainsAndLeadConfigs to throw an error
            vi.spyOn(
                pathOptUtils,
                'prepareChainsAndLeadConfigs'
            ).mockImplementation(() => {
                throw new Error('Mock error in lead calculation');
            });

            const result = optimizeCutOrder([pathWithLeadOut], chains, []);

            expect(result.orderedPaths).toHaveLength(1);

            // Restore mocks
            vi.mocked(pathOptUtils.prepareChainsAndLeadConfigs).mockRestore();
        });

        it('should use offset chain end point when no lead-out but offset exists', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const offsetShape: Shape = {
                id: 'offset-shape',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 2, y: 2 },
                    end: { x: 102, y: 102 },
                } as Line,
            };

            const pathWithOffset = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.NONE, length: 0 }, // No lead-out
                offset: {
                    offsetShapes: [offsetShape],
                    originalShapes: [offsetShape],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 2,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([pathWithOffset], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should fallback to chain end point when no lead-out and no offset', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 5, y: 5 },
                { x: 25, y: 25 }
            );
            const simplePath = createPath('path-1', 'chain-1', {
                leadOutConfig: undefined, // No lead-out type
                offset: undefined, // No offset
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([simplePath], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should handle empty offset shapes array', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 50, y: 50 }
            );
            const pathWithEmptyOffset = createPath('path-1', 'chain-1', {
                leadOutConfig: { type: LeadType.NONE, length: 0 },
                offset: {
                    offsetShapes: [], // Empty array
                    originalShapes: [],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 2,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([pathWithEmptyOffset], chains, []);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });
    });

    describe('Additional Edge Cases for Full Coverage', () => {
        it('should handle holes that have already been used in pathsByPart', () => {
            // Create chains for shell and multiple holes
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const holeChain1 = createLineChain(
                'hole1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const holeChain2 = createLineChain(
                'hole2',
                { x: 30, y: 30 },
                { x: 40, y: 40 }
            );

            // Create two parts that share hole chains (edge case)
            const part1 = createDetectedPart('part-1', shellChain, [
                holeChain1,
            ]);
            const part2 = createDetectedPart(
                'part-2',
                createLineChain(
                    'shell2',
                    { x: 200, y: 200 },
                    { x: 300, y: 300 }
                ),
                [holeChain2]
            );

            const paths = [
                createPath('shell-path', 'shell'),
                createPath('hole-path-1', 'hole1'),
                createPath('hole-path-2', 'hole2'),
                createPath('shell-path-2', 'shell2'),
            ];

            const chains = new Map([
                ['shell', shellChain],
                ['hole1', holeChain1],
                ['hole2', holeChain2],
                [
                    'shell2',
                    createLineChain(
                        'shell2',
                        { x: 200, y: 200 },
                        { x: 300, y: 300 }
                    ),
                ],
            ]);

            const result = optimizeCutOrder(paths, chains, [part1, part2]);

            expect(result.orderedPaths).toHaveLength(4);
        });

        it('should handle case where pathsByPart has parts that need new arrays', () => {
            // This test hits the case where pathsByPart.has(part.id) returns false for holes
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const holeChain = createLineChain(
                'hole',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );

            // Create part with both shell and hole
            const part = createDetectedPart('part-1', shellChain, [holeChain]);

            // Create paths where holes are processed first
            const paths = [
                createPath('hole-path', 'hole'), // This should hit the pathsByPart.set case
                createPath('shell-path', 'shell'),
            ];

            const chains = new Map([
                ['shell', shellChain],
                ['hole', holeChain],
            ]);

            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(2);
            // Hole should come before shell
            const holeIndex = result.orderedPaths.findIndex(
                (p) => p.id === 'hole-path'
            );
            const shellIndex = result.orderedPaths.findIndex(
                (p) => p.id === 'shell-path'
            );
            expect(holeIndex).toBeLessThan(shellIndex);
        });

        it('should handle missing chains for paths', () => {
            // This test covers the continue statement when chain is not found
            const chain1 = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );

            const paths = [
                createPath('path-1', 'chain-1'),
                createPath('path-missing', 'missing-chain-id'), // This chain doesn't exist
            ];

            const chains = new Map([
                ['chain-1', chain1],
                // missing-chain-id not included
            ]);

            const result = optimizeCutOrder(paths, chains, []);

            // Should only process the valid path
            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0].id).toBe('path-1');
        });

        it('should handle missing chains in part processing', () => {
            // Cover the chain lookup failure in part processing
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const part = createDetectedPart('part-1', shellChain, []);

            const paths = [
                createPath('shell-path', 'shell'),
                createPath('invalid-path', 'missing-chain'), // Missing chain
            ];

            const chains = new Map([
                ['shell', shellChain],
                // 'missing-chain' not included
            ]);

            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0].id).toBe('shell-path');
        });

        it('should handle missing parts in part processing lookup', () => {
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );

            // Create paths that appear to belong to parts but parts array is manipulated
            const paths = [createPath('shell-path', 'shell')];

            const chains = new Map([['shell', shellChain]]);

            // Test the continue branch by passing empty parts array but paths that would match
            const result = optimizeCutOrder(paths, chains, []);

            // Should process paths as non-part paths
            expect(result.orderedPaths).toHaveLength(1);
        });

        it('should handle already visited paths in unvisited check', () => {
            // This test verifies normal part processing behavior
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const holeChain = createLineChain(
                'hole',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const part = createDetectedPart('part-1', shellChain, [holeChain]);

            const paths = [
                createPath('shell-path', 'shell'),
                createPath('hole-path', 'hole'),
            ];

            const chains = new Map([
                ['shell', shellChain],
                ['hole', holeChain],
            ]);

            const result = optimizeCutOrder(paths, chains, [part]);

            expect(result.orderedPaths).toHaveLength(2);
            // Verify hole comes before shell
            const holeIndex = result.orderedPaths.findIndex(
                (p) => p.id === 'hole-path'
            );
            const shellIndex = result.orderedPaths.findIndex(
                (p) => p.id === 'shell-path'
            );
            expect(holeIndex).toBeLessThan(shellIndex);
        });
    });

    describe('Legacy Tests', () => {
        it('should handle ellipse shapes in chains', () => {
            // Create an ellipse shape
            const ellipseShape: Shape = {
                id: 'shape-1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 50, y: 50 },
                    majorAxisEndpoint: { x: 30, y: 0 }, // Major axis is 30 units along X
                    minorToMajorRatio: 0.5, // Minor axis is 15 units
                    startParam: 0,
                    endParam: 2 * Math.PI,
                } as Ellipse,
            };

            // Create a chain with the ellipse
            const chain: Chain = {
                id: 'chain-1',
                shapes: [ellipseShape],
            };

            // Create a path for the chain
            const path: Path = {
                id: 'path-1',
                name: 'Path 1',
                chainId: 'chain-1',
                operationId: 'op-1',
                toolId: 'tool-1',
                enabled: true,
                order: 1,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            };

            // Create a map of chains
            const chains = new Map<string, Chain>();
            chains.set('chain-1', chain);

            // Test with no parts
            const result = optimizeCutOrder([path], chains, []);

            // Verify the result
            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0].id).toBe('path-1');
            expect(result.rapids).toHaveLength(1);
            expect(result.rapids[0].type).toBe('rapid');
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 }); // From origin
            expect(result.rapids[0].end.x).toBeCloseTo(80, 1); // 50 + 30 (center + major axis)
            expect(result.rapids[0].end.y).toBeCloseTo(50, 1); // Center Y
        });

        it('should handle spline shapes in chains', () => {
            // Create a spline shape
            const splineShape: Shape = {
                id: 'shape-1',
                type: GeometryType.SPLINE,
                geometry: {
                    controlPoints: [
                        { x: 10, y: 10 },
                        { x: 20, y: 20 },
                        { x: 30, y: 10 },
                        { x: 40, y: 20 },
                    ],
                    knots: [],
                    weights: [],
                    degree: 3,
                    fitPoints: [],
                    closed: false,
                } as Spline,
            };

            // Create a chain with the spline
            const chain: Chain = {
                id: 'chain-1',
                shapes: [splineShape],
            };

            // Create a path for the chain
            const path: Path = {
                id: 'path-1',
                name: 'Path 1',
                chainId: 'chain-1',
                operationId: 'op-1',
                toolId: 'tool-1',
                enabled: true,
                order: 1,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            };

            // Create a map of chains
            const chains = new Map<string, Chain>();
            chains.set('chain-1', chain);

            // Test with no parts
            const result = optimizeCutOrder([path], chains, []);

            // Verify the result
            expect(result.orderedPaths).toHaveLength(1);
            expect(result.orderedPaths[0].id).toBe('path-1');
            expect(result.rapids).toHaveLength(1);
            expect(result.rapids[0].type).toBe('rapid');
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 }); // From origin
            expect(result.rapids[0].end).toEqual({ x: 10, y: 10 }); // First point of polyline
        });

        it('should handle all shape types without throwing errors', () => {
            const shapeTypes = [
                'line',
                'arc',
                'circle',
                'polyline',
                'spline',
                'ellipse',
            ];
            const chains = new Map<string, Chain>();
            const paths: Path[] = [];

            // Create a shape for each type
            shapeTypes.forEach((type, index) => {
                let geometry: Line | Arc | Circle | Polyline | Ellipse | Spline;

                switch (type) {
                    case 'line':
                        geometry = {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 10 },
                        } as Line;
                        break;
                    case 'arc':
                        geometry = {
                            center: { x: 5, y: 5 },
                            radius: 5,
                            startAngle: 0,
                            endAngle: 90,
                            clockwise: true,
                        };
                        break;
                    case 'circle':
                        geometry = {
                            center: { x: 5, y: 5 },
                            radius: 5,
                        } as Circle;
                        break;
                    case 'polyline':
                        geometry = createPolylineFromVertices(
                            [
                                { x: 0, y: 0, bulge: 0 },
                                { x: 10, y: 10, bulge: 0 },
                            ],
                            false
                        ).geometry;
                        break;
                    case 'spline':
                        geometry = {
                            controlPoints: [
                                { x: 0, y: 0 },
                                { x: 10, y: 10 },
                            ],
                            knots: [],
                            weights: [],
                            degree: 1,
                            fitPoints: [],
                            closed: false,
                        } as Spline;
                        break;
                    case 'ellipse':
                        geometry = {
                            center: { x: 5, y: 5 },
                            majorAxisEndpoint: { x: 3, y: 0 },
                            minorToMajorRatio: 0.5,
                        } as Ellipse;
                        break;
                    default:
                        geometry = {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 10 },
                        } as Line;
                        break;
                }

                const shape: Shape = {
                    id: `shape-${index}`,
                    type: type as GeometryType,
                    geometry,
                };

                const chain: Chain = {
                    id: `chain-${index}`,
                    shapes: [shape],
                };

                chains.set(chain.id, chain);

                paths.push({
                    id: `path-${index}`,
                    name: `Path ${index + 1}`,
                    chainId: chain.id,
                    operationId: 'op-1',
                    toolId: 'tool-1',
                    enabled: true,
                    order: index + 1,
                    cutDirection: CutDirection.COUNTERCLOCKWISE,
                });
            });

            // This should not throw any errors
            const result = optimizeCutOrder(paths, chains, []);

            expect(result.orderedPaths).toHaveLength(shapeTypes.length);
            expect(result.rapids).toHaveLength(shapeTypes.length);
            expect(result.totalDistance).toBeGreaterThan(0);
        });
    });
});
