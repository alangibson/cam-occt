import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    findPartContainingChain,
    handleChainClick,
    handleChainMouseEnter,
    handleChainMouseLeave,
    handlePartClick,
    handlePartMouseEnter,
    handlePartMouseLeave,
} from './chain-part-interactions';
import { type PartData, type PartVoid } from './interfaces';
import { Part } from './classes.svelte';
import { PartType } from './enums';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';

describe('findPartContainingChain', () => {
    // Helper function to create a mock chain
    function createMockChain(id: string): ChainData {
        return {
            id,
            shapes: [],
        };
    }

    // Helper function to create a mock part hole
    function createMockHole(chainId: string): PartVoid {
        return {
            id: `hole-${chainId}`,
            chain: createMockChain(chainId),
            type: PartType.HOLE,
            boundingBox: { min: { x: 10, y: 10 }, max: { x: 20, y: 20 } },
        };
    }

    // Helper function to create a mock part
    function createMockPart(
        shellChainId: string,
        holeChainIds: string[] = []
    ): PartData {
        const holes = holeChainIds.map((holeId) => createMockHole(holeId));
        return {
            id: `part-${shellChainId}`,
            shell: createMockChain(shellChainId),
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
            voids: holes,
            slots: [],
            layerName: '0',
        };
    }

    describe('basic functionality', () => {
        it('should return undefined for empty chainId', () => {
            const partData = createMockPart('shell-1');
            const parts = [new Part(partData)];
            const result = findPartContainingChain('', parts);
            expect(result).toBeUndefined();
        });

        it('should return undefined for null/undefined chainId', () => {
            const partData = createMockPart('shell-1');
            const parts = [new Part(partData)];
            expect(
                findPartContainingChain(null as unknown as string, parts)
            ).toBeUndefined();
            expect(
                findPartContainingChain(undefined as unknown as string, parts)
            ).toBeUndefined();
        });

        it('should return undefined for empty parts array', () => {
            const result = findPartContainingChain('chain-1', []);
            expect(result).toBeUndefined();
        });

        it('should return undefined for null/undefined parts array', () => {
            expect(
                findPartContainingChain('chain-1', null as unknown as Part[])
            ).toBeUndefined();
            expect(
                findPartContainingChain(
                    'chain-1',
                    undefined as unknown as Part[]
                )
            ).toBeUndefined();
        });

        it('should return undefined when chain is not found in any part', () => {
            const parts = [
                new Part(createMockPart('shell-1', ['hole-1', 'hole-2'])),
                new Part(createMockPart('shell-2', ['hole-3'])),
            ];
            const result = findPartContainingChain('non-existent-chain', parts);
            expect(result).toBeUndefined();
        });
    });

    describe('shell chain matching', () => {
        it('should find part by shell chain ID', () => {
            const parts = [
                new Part(createMockPart('shell-1')),
                new Part(createMockPart('shell-2')),
                new Part(createMockPart('shell-3')),
            ];

            const result = findPartContainingChain('shell-2', parts);

            expect(result).toBeDefined();
            expect(result?.id).toBe('part-shell-2');
            expect(result?.shell.id).toBe('shell-2');
        });

        it('should return first matching part when multiple parts have same shell chain ID', () => {
            // This shouldn't happen in normal usage, but test the behavior
            const parts = [
                new Part(createMockPart('shell-1')),
                new Part(createMockPart('shell-1')), // Duplicate shell ID
                new Part(createMockPart('shell-2')),
            ];

            const result = findPartContainingChain('shell-1', parts);

            expect(result).toBeDefined();
            expect(result?.shell.id).toBe('shell-1');
            // Should return the first one found
            expect(result?.id).toBe('part-shell-1');
        });
    });

    describe('hole chain matching', () => {
        it('should find part by hole chain ID', () => {
            const parts = [
                new Part(createMockPart('shell-1', ['hole-1', 'hole-2'])),
                new Part(createMockPart('shell-2', ['hole-3', 'hole-4'])),
                new Part(createMockPart('shell-3')),
            ];

            const result = findPartContainingChain('hole-3', parts);

            expect(result).toBeDefined();
            expect(result?.id).toBe('part-shell-2');
            expect(result?.shell.id).toBe('shell-2');
            expect(result?.voids.some((h) => h.chain.id === 'hole-3')).toBe(
                true
            );
        });

        it('should find part with multiple holes', () => {
            const parts = [
                new Part(
                    createMockPart('shell-1', ['hole-1', 'hole-2', 'hole-3'])
                ),
                new Part(createMockPart('shell-2', ['hole-4'])),
            ];

            const result1 = findPartContainingChain('hole-1', parts);
            const result2 = findPartContainingChain('hole-2', parts);
            const result3 = findPartContainingChain('hole-3', parts);

            expect(result1?.id).toBe('part-shell-1');
            expect(result2?.id).toBe('part-shell-1');
            expect(result3?.id).toBe('part-shell-1');

            const result4 = findPartContainingChain('hole-4', parts);
            expect(result4?.id).toBe('part-shell-2');
        });

        it('should find part when part has no holes', () => {
            const parts = [
                new Part(createMockPart('shell-1')), // No holes
                new Part(createMockPart('shell-2', ['hole-1'])),
            ];

            const result1 = findPartContainingChain('shell-1', parts);
            expect(result1?.id).toBe('part-shell-1');
            expect(result1?.voids).toHaveLength(0);

            const result2 = findPartContainingChain('hole-1', parts);
            expect(result2?.id).toBe('part-shell-2');
        });
    });

    describe('edge cases', () => {
        it('should handle case-sensitive chain IDs', () => {
            const parts = [new Part(createMockPart('Shell-1', ['Hole-1']))];

            expect(findPartContainingChain('shell-1', parts)).toBeUndefined();
            expect(findPartContainingChain('Shell-1', parts)).toBeDefined();
            expect(findPartContainingChain('hole-1', parts)).toBeUndefined();
            expect(findPartContainingChain('Hole-1', parts)).toBeDefined();
        });

        it('should handle special characters in chain IDs', () => {
            const parts = [
                new Part(createMockPart('shell-1_test', ['hole-1@special'])),
                new Part(createMockPart('shell-2-dash', ['hole.dot'])),
            ];

            expect(findPartContainingChain('shell-1_test', parts)?.id).toBe(
                'part-shell-1_test'
            );
            expect(findPartContainingChain('hole-1@special', parts)?.id).toBe(
                'part-shell-1_test'
            );
            expect(findPartContainingChain('shell-2-dash', parts)?.id).toBe(
                'part-shell-2-dash'
            );
            expect(findPartContainingChain('hole.dot', parts)?.id).toBe(
                'part-shell-2-dash'
            );
        });

        it('should handle numeric chain IDs', () => {
            const parts = [new Part(createMockPart('123', ['456']))];

            expect(findPartContainingChain('123', parts)?.id).toBe('part-123');
            expect(findPartContainingChain('456', parts)?.id).toBe('part-123');
        });

        it('should find part from large collection efficiently', () => {
            // Create many parts to test performance doesn't degrade significantly
            const parts = Array.from(
                { length: 100 },
                (_, i) =>
                    new Part(
                        createMockPart(`shell-${i}`, [
                            `hole-${i}-1`,
                            `hole-${i}-2`,
                        ])
                    )
            );

            // Find a part in the middle
            const result = findPartContainingChain('hole-50-2', parts);
            expect(result?.id).toBe('part-shell-50');

            // Find the last part
            const lastResult = findPartContainingChain('shell-99', parts);
            expect(lastResult?.id).toBe('part-shell-99');
        });
    });

    describe('real-world scenarios', () => {
        it('should handle typical ADLER.dxf-like scenario', () => {
            // Simulate ADLER.dxf with 9 parts, one having a hole
            const parts = [
                new Part(createMockPart('chain-1')),
                new Part(createMockPart('chain-2')),
                new Part(createMockPart('chain-3')),
                new Part(createMockPart('chain-4')),
                new Part(createMockPart('chain-5', ['chain-10'])), // Part with hole
                new Part(createMockPart('chain-6')),
                new Part(createMockPart('chain-7')),
                new Part(createMockPart('chain-8')),
                new Part(createMockPart('chain-9')),
            ];

            // Should find shell chains
            expect(findPartContainingChain('chain-5', parts)?.id).toBe(
                'part-chain-5'
            );
            expect(findPartContainingChain('chain-1', parts)?.id).toBe(
                'part-chain-1'
            );

            // Should find hole chain
            expect(findPartContainingChain('chain-10', parts)?.id).toBe(
                'part-chain-5'
            );

            // Should not find non-existent chain
            expect(findPartContainingChain('chain-11', parts)).toBeUndefined();
        });

        it('should handle complex part with multiple holes', () => {
            // Simulate a complex part like Tractor Seat Mount with many holes
            const parts = [
                new Part(
                    createMockPart('main-shell', [
                        'hole-1',
                        'hole-2',
                        'hole-3',
                        'hole-4',
                        'hole-5',
                        'hole-6',
                        'hole-7',
                        'hole-8',
                        'hole-9',
                        'hole-10',
                        'hole-11',
                        'hole-12',
                    ])
                ),
            ];

            // Should find the main shell
            expect(findPartContainingChain('main-shell', parts)?.id).toBe(
                'part-main-shell'
            );

            // Should find any of the holes
            expect(findPartContainingChain('hole-1', parts)?.id).toBe(
                'part-main-shell'
            );
            expect(findPartContainingChain('hole-6', parts)?.id).toBe(
                'part-main-shell'
            );
            expect(findPartContainingChain('hole-12', parts)?.id).toBe(
                'part-main-shell'
            );
        });
    });
});

// Mock the stores
vi.mock('$lib/stores/chains/store', () => ({
    chainStore: {
        selectChain: vi.fn(),
        deselectChain: vi.fn(),
        highlightChain: vi.fn(),
        clearChainHighlight: vi.fn(),
    },
}));

vi.mock('$lib/stores/parts/store', () => ({
    partStore: {
        selectPart: vi.fn(),
        deselectPart: vi.fn(),
        hoverPart: vi.fn(),
        clearPartHover: vi.fn(),
    },
}));

describe('Chain interaction handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleChainClick', () => {
        it('should not modify selection when chain is already selected', async () => {
            handleChainClick('chain-1', new Set(['chain-1']));

            // Selection is handled by DrawingCanvas, so no store calls expected
            expect(chainStore.deselectChain).not.toHaveBeenCalled();
            expect(chainStore.selectChain).not.toHaveBeenCalled();
        });

        it('should not modify selection when different chain is selected', async () => {
            handleChainClick('chain-2', new Set(['chain-1']));

            // Selection is handled by DrawingCanvas, so no store calls expected
            expect(chainStore.deselectChain).not.toHaveBeenCalled();
            expect(chainStore.selectChain).not.toHaveBeenCalled();
        });

        it('should not modify selection when no chain is selected', async () => {
            handleChainClick('chain-1', new Set());

            // Selection is handled by DrawingCanvas, so no store calls expected
            expect(chainStore.deselectChain).not.toHaveBeenCalled();
            expect(chainStore.selectChain).not.toHaveBeenCalled();
        });
    });

    describe('handleChainMouseEnter', () => {
        it('should highlight chain', async () => {
            handleChainMouseEnter('chain-1');

            expect(chainStore.highlightChain).toHaveBeenCalledWith('chain-1');
        });
    });

    describe('handleChainMouseLeave', () => {
        it('should clear chain highlight', async () => {
            handleChainMouseLeave();

            expect(chainStore.clearChainHighlight).toHaveBeenCalledWith();
        });
    });
});

describe('Part interaction handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handlePartClick', () => {
        it('should not modify selection when part is already selected', async () => {
            handlePartClick('part-1', new Set(['part-1']));

            // Selection is handled by DrawingCanvas, so no store calls expected
            expect(partStore.deselectPart).not.toHaveBeenCalled();
            expect(partStore.selectPart).not.toHaveBeenCalled();
        });

        it('should not modify selection when different part is selected', async () => {
            handlePartClick('part-2', new Set(['part-1']));

            // Selection is handled by DrawingCanvas, so no store calls expected
            expect(partStore.deselectPart).not.toHaveBeenCalled();
            expect(partStore.selectPart).not.toHaveBeenCalled();
        });

        it('should not modify selection when no part is selected', async () => {
            handlePartClick('part-1', new Set());

            // Selection is handled by DrawingCanvas, so no store calls expected
            expect(partStore.deselectPart).not.toHaveBeenCalled();
            expect(partStore.selectPart).not.toHaveBeenCalled();
        });
    });

    describe('handlePartMouseEnter', () => {
        it('should hover part', async () => {
            handlePartMouseEnter('part-1');

            expect(partStore.hoverPart).toHaveBeenCalledWith('part-1');
        });
    });

    describe('handlePartMouseLeave', () => {
        it('should clear part hover', async () => {
            handlePartMouseLeave();

            expect(partStore.clearPartHover).toHaveBeenCalledWith();
        });
    });
});
