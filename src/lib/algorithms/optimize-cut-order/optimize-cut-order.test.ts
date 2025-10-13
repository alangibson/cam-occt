import { describe, expect, it, vi } from 'vitest';
import { optimizeCutOrder } from './optimize-cut-order';
import type { Cut } from '$lib/stores/cuts/interfaces';
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
import * as pathOptUtils from '$lib/algorithms/optimize-start-points/cut-optimization-utils';
import { NormalSide } from '$lib/types/cam';

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
    // Helper function to create a basic cut
    const createCut = (
        id: string,
        chainId: string,
        options: Partial<Cut> = {}
    ): Cut => ({
        id,
        name: `Cut ${id}`,
        chainId,
        operationId: 'op-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        cutDirection: CutDirection.COUNTERCLOCKWISE,
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
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
        it('should return empty result for empty cuts array', () => {
            const chains = new Map<string, Chain>();
            const result = optimizeCutOrder([], chains, []);

            expect(result.orderedCuts).toEqual([]);
            expect(result.rapids).toEqual([]);
            expect(result.totalDistance).toBe(0);
        });

        it('should return empty result when no cuts have corresponding chains', () => {
            const cuts = [createCut('cut-1', 'nonexistent-chain')];
            const chains = new Map<string, Chain>();

            const result = optimizeCutOrder(cuts, chains, []);

            expect(result.orderedCuts).toEqual([]);
            expect(result.rapids).toEqual([]);
            expect(result.totalDistance).toBe(0);
        });

        it('should filter out cuts without corresponding chains', () => {
            const chain1 = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const cuts = [
                createCut('cut-1', 'chain-1'),
                createCut('cut-2', 'nonexistent-chain'),
            ];
            const chains = new Map([['chain-1', chain1]]);

            const result = optimizeCutOrder(cuts, chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0].id).toBe('cut-1');
        });
    });

    describe('Single Cut Optimization', () => {
        it('should handle single cut without parts', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 5, y: 5 },
                { x: 15, y: 15 }
            );
            const cut = createCut('cut-1', 'chain-1');
            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0]).toBe(cut);
            expect(result.rapids).toHaveLength(1);
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 }); // origin
            expect(result.rapids[0].end).toEqual({ x: 5, y: 5 }); // chain start
            expect(result.totalDistance).toBeGreaterThan(0);
        });
    });

    describe('Multiple Cuts Without Parts', () => {
        it('should optimize multiple independent cuts', () => {
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

            const cuts = [
                createCut('cut-1', 'chain-1'),
                createCut('cut-2', 'chain-2'),
                createCut('cut-3', 'chain-3'),
            ];

            const chains = new Map([
                ['chain-1', chain1],
                ['chain-2', chain2],
                ['chain-3', chain3],
            ]);

            const result = optimizeCutOrder(cuts, chains, []);

            expect(result.orderedCuts).toHaveLength(3);
            expect(result.rapids).toHaveLength(3);
            expect(result.totalDistance).toBeGreaterThan(0);

            // Should pick the closest cut first (chain-1 is closest to origin)
            expect(result.orderedCuts[0].chainId).toBe('chain-1');
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

            const cuts = [
                createCut('shell-cut', 'shell-chain'),
                createCut('hole-cut-1', 'hole-chain-1'),
                createCut('hole-cut-2', 'hole-chain-2'),
            ];

            const chains = new Map([
                ['shell-chain', shellChain],
                ['hole-chain-1', holeChain1],
                ['hole-chain-2', holeChain2],
            ]);

            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(3);
            expect(result.rapids).toHaveLength(3);

            // Shell should be last
            const shellCutIndex = result.orderedCuts.findIndex(
                (p) => p.id === 'shell-cut'
            );
            expect(shellCutIndex).toBe(2); // Should be the last cut

            // Holes should come first
            const holeIndices = result.orderedCuts
                .map((p, i) => (p.id.startsWith('hole-cut') ? i : -1))
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

            const cuts = [
                createCut('shell-cut-1', 'shell-1'),
                createCut('hole-cut-1', 'hole-1'),
                createCut('shell-cut-2', 'shell-2'),
                createCut('hole-cut-2', 'hole-2'),
            ];

            const chains = new Map([
                ['shell-1', shell1],
                ['hole-1', hole1],
                ['shell-2', shell2],
                ['hole-2', hole2],
            ]);

            const result = optimizeCutOrder(cuts, chains, [part1, part2]);

            expect(result.orderedCuts).toHaveLength(4);
            expect(result.rapids).toHaveLength(4);

            // Within each part, holes should come before shells
            const cutOrder = result.orderedCuts.map((p) => p.id);
            const shell1Index = cutOrder.indexOf('shell-cut-1');
            const hole1Index = cutOrder.indexOf('hole-cut-1');
            const shell2Index = cutOrder.indexOf('shell-cut-2');
            const hole2Index = cutOrder.indexOf('hole-cut-2');

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

            const cuts = [createCut('shell-cut', 'shell-chain')];
            const chains = new Map([['shell-chain', shellChain]]);

            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0].id).toBe('shell-cut');
            expect(result.rapids).toHaveLength(1);
        });
    });

    describe('Lead Configuration Tests', () => {
        it('should handle cuts with lead-out configuration', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const cut = createCut('cut-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: 5 },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should handle cuts with no lead-out (none type)', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );
            const cut = createCut('cut-1', 'chain-1', {
                leadOutConfig: { type: LeadType.NONE, length: 0 },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should handle cuts with calculated offset', () => {
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

            const cut = createCut('cut-1', 'chain-1', {
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

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
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
            const cut = createCut('cut-1', 'chain-1');
            const chains = new Map([['chain-1', chain]]);
            const customOrigin = { x: 100, y: 100 };

            const result = optimizeCutOrder([cut], chains, [], customOrigin);

            expect(result.rapids[0].start).toEqual(customOrigin);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle findNearestCut returning no cut', () => {
            // This test ensures the break conditions are hit when findNearestCut returns no cut
            const chain = createLineChain(
                'chain-1',
                { x: 1000, y: 1000 },
                { x: 2000, y: 2000 }
            );
            const cut = createCut('cut-1', 'chain-1', { enabled: false }); // disabled cut to potentially trigger edge case
            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
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

            const cuts = [
                createCut('cut-1', 'chain-1'),
                createCut('cut-2', 'chain-2'),
            ];

            const chains = new Map([
                ['chain-1', chain1],
                ['chain-2', chain2],
            ]);

            const result = optimizeCutOrder(cuts, chains, []);

            // Should handle the cut removal from arrays correctly
            expect(result.orderedCuts).toHaveLength(2);
            expect(result.rapids).toHaveLength(2);
        });

        it('should handle missing parts in cutsByPart', () => {
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

            const cuts = [
                createCut('shell-cut', 'shell-chain'),
                createCut('hole-cut', 'hole-chain'),
            ];

            const chains = new Map([
                ['shell-chain', shellChain],
                ['hole-chain', holeChain],
            ]);

            // Test with parts array that might cause edge case
            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(2);
        });

        it('should handle cuts already visited in unvisited set', () => {
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

            const cuts = [
                createCut('shell-cut', 'shell'),
                createCut('hole-cut-1', 'hole1'),
                createCut('hole-cut-2', 'hole2'),
            ];

            const chains = new Map([
                ['shell', shell],
                ['hole1', hole1],
                ['hole2', hole2],
            ]);

            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(3);
            expect(result.rapids).toHaveLength(3);
        });
    });

    describe('getCutEndPoint Function Coverage', () => {
        it('should use lead-out end point when available', () => {
            // This test specifically targets the lead-out calculation branch
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const cut = createCut('cut-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: 10 },
                cutDirection: CutDirection.CLOCKWISE,
            });

            const chains = new Map([['chain-1', chain]]);

            // Mock console.warn to test error handling
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);

            consoleSpy.mockRestore();
        });

        it('should handle lead calculation errors gracefully', () => {
            // Create a cut with lead-out but invalid configuration to trigger error handling
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const cut = createCut('cut-1', 'chain-1', {
                leadOutConfig: { type: LeadType.ARC, length: -1 }, // Invalid length to potentially cause errors
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const chains = new Map([['chain-1', chain]]);

            // Mock console.warn to capture error handling
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);

            consoleSpy.mockRestore();
        });

        it('should trigger error handling in lead calculation', async () => {
            // Mock the prepareChainsAndLeadConfigs to throw an error
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );
            const cut = createCut('cut-1', 'chain-1', {
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

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);

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

            const cut = createCut('cut-1', 'chain-1', {
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

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should fallback to chain end point when no lead-out and no offset', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 5, y: 5 },
                { x: 25, y: 25 }
            );
            const simpleCut = createCut('cut-1', 'chain-1', {
                leadOutConfig: undefined, // No lead-out type
                offset: undefined, // No offset
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([simpleCut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });

        it('should handle empty offset shapes array', () => {
            const chain = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 50, y: 50 }
            );
            const cut = createCut('cut-1', 'chain-1', {
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

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);
        });
    });

    describe('Additional Edge Cases for Full Coverage', () => {
        it('should handle holes that have already been used in cutsByPart', () => {
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

            const cuts = [
                createCut('shell-cut', 'shell'),
                createCut('hole-cut-1', 'hole1'),
                createCut('hole-cut-2', 'hole2'),
                createCut('shell-cut-2', 'shell2'),
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

            const result = optimizeCutOrder(cuts, chains, [part1, part2]);

            expect(result.orderedCuts).toHaveLength(4);
        });

        it('should handle case where cutsByPart has parts that need new arrays', () => {
            // This test hits the case where cutsByPart.has(part.id) returns false for holes
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

            // Create cuts where holes are processed first
            const cuts = [
                createCut('hole-cut', 'hole'), // This should hit the cutsByPart.set case
                createCut('shell-cut', 'shell'),
            ];

            const chains = new Map([
                ['shell', shellChain],
                ['hole', holeChain],
            ]);

            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(2);
            // Hole should come before shell
            const holeIndex = result.orderedCuts.findIndex(
                (p) => p.id === 'hole-cut'
            );
            const shellIndex = result.orderedCuts.findIndex(
                (p) => p.id === 'shell-cut'
            );
            expect(holeIndex).toBeLessThan(shellIndex);
        });

        it('should handle missing chains for cuts', () => {
            // This test covers the continue statement when chain is not found
            const chain1 = createLineChain(
                'chain-1',
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            );

            const cuts = [
                createCut('cut-1', 'chain-1'),
                createCut('cut-missing', 'missing-chain-id'), // This chain doesn't exist
            ];

            const chains = new Map([
                ['chain-1', chain1],
                // missing-chain-id not included
            ]);

            const result = optimizeCutOrder(cuts, chains, []);

            // Should only process the valid cut
            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0].id).toBe('cut-1');
        });

        it('should handle missing chains in part processing', () => {
            // Cover the chain lookup failure in part processing
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );
            const part = createDetectedPart('part-1', shellChain, []);

            const cuts = [
                createCut('shell-cut', 'shell'),
                createCut('invalid-cut', 'missing-chain'), // Missing chain
            ];

            const chains = new Map([
                ['shell', shellChain],
                // 'missing-chain' not included
            ]);

            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0].id).toBe('shell-cut');
        });

        it('should handle missing parts in part processing lookup', () => {
            const shellChain = createLineChain(
                'shell',
                { x: 0, y: 0 },
                { x: 100, y: 100 }
            );

            // Create cuts that appear to belong to parts but parts array is manipulated
            const cuts = [createCut('shell-cut', 'shell')];

            const chains = new Map([['shell', shellChain]]);

            // Test the continue branch by passing empty parts array but cuts that would match
            const result = optimizeCutOrder(cuts, chains, []);

            // Should process cuts as non-part cuts
            expect(result.orderedCuts).toHaveLength(1);
        });

        it('should handle already visited cuts in unvisited check', () => {
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

            const cuts = [
                createCut('shell-cut', 'shell'),
                createCut('hole-cut', 'hole'),
            ];

            const chains = new Map([
                ['shell', shellChain],
                ['hole', holeChain],
            ]);

            const result = optimizeCutOrder(cuts, chains, [part]);

            expect(result.orderedCuts).toHaveLength(2);
            // Verify hole comes before shell
            const holeIndex = result.orderedCuts.findIndex(
                (p) => p.id === 'hole-cut'
            );
            const shellIndex = result.orderedCuts.findIndex(
                (p) => p.id === 'shell-cut'
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

            // Create a cut for the chain
            const cut: Cut = {
                id: 'cut-1',
                name: 'Cut 1',
                chainId: 'chain-1',
                operationId: 'op-1',
                toolId: 'tool-1',
                enabled: true,
                order: 1,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                normal: { x: 1, y: 0 },
                normalConnectionPoint: { x: 0, y: 0 },
                normalSide: NormalSide.LEFT,
            };

            // Create a map of chains
            const chains = new Map<string, Chain>();
            chains.set('chain-1', chain);

            // Test with no parts
            const result = optimizeCutOrder([cut], chains, []);

            // Verify the result
            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0].id).toBe('cut-1');
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

            // Create a cut for the chain
            const cut: Cut = {
                id: 'cut-1',
                name: 'Cut 1',
                chainId: 'chain-1',
                operationId: 'op-1',
                toolId: 'tool-1',
                enabled: true,
                order: 1,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                normal: { x: 1, y: 0 },
                normalConnectionPoint: { x: 0, y: 0 },
                normalSide: NormalSide.LEFT,
            };

            // Create a map of chains
            const chains = new Map<string, Chain>();
            chains.set('chain-1', chain);

            // Test with no parts
            const result = optimizeCutOrder([cut], chains, []);

            // Verify the result
            expect(result.orderedCuts).toHaveLength(1);
            expect(result.orderedCuts[0].id).toBe('cut-1');
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
            const cuts: Cut[] = [];

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

                cuts.push({
                    id: `cut-${index}`,
                    name: `Cut ${index + 1}`,
                    chainId: chain.id,
                    operationId: 'op-1',
                    toolId: 'tool-1',
                    enabled: true,
                    order: index + 1,
                    cutDirection: CutDirection.COUNTERCLOCKWISE,
                    normal: { x: 1, y: 0 },
                    normalConnectionPoint: { x: 0, y: 0 },
                    normalSide: NormalSide.LEFT,
                });
            });

            // This should not throw any errors
            const result = optimizeCutOrder(cuts, chains, []);

            expect(result.orderedCuts).toHaveLength(shapeTypes.length);
            expect(result.rapids).toHaveLength(shapeTypes.length);
            expect(result.totalDistance).toBeGreaterThan(0);
        });
    });

    describe('Open Chain Rapid Connection', () => {
        it('should connect rapid to start point of reversed open chain without leads', () => {
            // Create an open chain line from (10,10) to (20,20)
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );

            // Create a cut with COUNTERCLOCKWISE direction
            // For an open chain, this should reverse the traversal order
            const cut = createCut('cut-1', 'chain-1', {
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                executionClockwise: false,
                leadInConfig: undefined, // No lead-in
                leadOutConfig: undefined, // No lead-out
                cutChain: {
                    id: 'chain-1-cut',
                    shapes: [
                        {
                            id: 'shape-chain-1-reversed',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 20 }, // Reversed: end becomes start
                                end: { x: 10, y: 10 },   // Reversed: start becomes end
                            } as Line,
                        },
                    ],
                },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);

            // The rapid should connect from origin (0,0) to the START of the CUT
            // Since the cut is reversed, the start should be (20,20), NOT (10,10)
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 });
            expect(result.rapids[0].end).toEqual({ x: 20, y: 20 }); // Should be the reversed start
        });

        it('should connect rapid correctly for open chain with CLOCKWISE direction without leads', () => {
            // Create an open chain line from (10,10) to (20,20)
            const chain = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );

            // Create a cut with CLOCKWISE direction (no reversal for open chain)
            const cut = createCut('cut-1', 'chain-1', {
                cutDirection: CutDirection.CLOCKWISE,
                executionClockwise: true,
                leadInConfig: undefined, // No lead-in
                leadOutConfig: undefined, // No lead-out
                cutChain: {
                    id: 'chain-1-cut',
                    shapes: chain.shapes, // Not reversed
                },
            });

            const chains = new Map([['chain-1', chain]]);

            const result = optimizeCutOrder([cut], chains, []);

            expect(result.orderedCuts).toHaveLength(1);
            expect(result.rapids).toHaveLength(1);

            // The rapid should connect from origin (0,0) to the START of the CUT
            // Since the cut is NOT reversed, the start should be (10,10)
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 });
            expect(result.rapids[0].end).toEqual({ x: 10, y: 10 });
        });

        it('should connect sequential rapids correctly for reversed open chains without leads', () => {
            // Create two open chain lines
            // Chain 1: (10,10) to (20,20)
            const chain1 = createLineChain(
                'chain-1',
                { x: 10, y: 10 },
                { x: 20, y: 20 }
            );

            // Chain 2: (30,30) to (40,40)
            const chain2 = createLineChain(
                'chain-2',
                { x: 30, y: 30 },
                { x: 40, y: 40 }
            );

            // Create cuts with COUNTERCLOCKWISE direction (reversed)
            const cut1 = createCut('cut-1', 'chain-1', {
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                executionClockwise: false,
                leadInConfig: undefined,
                leadOutConfig: undefined,
                cutChain: {
                    id: 'chain-1-cut',
                    shapes: [
                        {
                            id: 'shape-chain-1-reversed',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 20, y: 20 }, // Reversed
                                end: { x: 10, y: 10 },
                            } as Line,
                        },
                    ],
                },
            });

            const cut2 = createCut('cut-2', 'chain-2', {
                cutDirection: CutDirection.COUNTERCLOCKWISE,
                executionClockwise: false,
                leadInConfig: undefined,
                leadOutConfig: undefined,
                cutChain: {
                    id: 'chain-2-cut',
                    shapes: [
                        {
                            id: 'shape-chain-2-reversed',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 40, y: 40 }, // Reversed
                                end: { x: 30, y: 30 },
                            } as Line,
                        },
                    ],
                },
            });

            const chains = new Map([
                ['chain-1', chain1],
                ['chain-2', chain2],
            ]);

            const result = optimizeCutOrder([cut1, cut2], chains, []);

            expect(result.orderedCuts).toHaveLength(2);
            expect(result.rapids).toHaveLength(2);

            // First rapid: origin (0,0) to start of cut1 (20,20)
            expect(result.rapids[0].start).toEqual({ x: 0, y: 0 });
            expect(result.rapids[0].end).toEqual({ x: 20, y: 20 });

            // Second rapid: end of cut1 (10,10) to start of cut2 (40,40)
            expect(result.rapids[1].start).toEqual({ x: 10, y: 10 });
            expect(result.rapids[1].end).toEqual({ x: 40, y: 40 });
        });
    });
});
