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
import {
    type DetectedPart,
    type PartHole,
    type PartShell,
    PartType,
} from '$lib/algorithms/part-detection/part-detection';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';

describe('findPartContainingChain', () => {
    // Helper function to create a mock chain
    function createMockChain(id: string): Chain {
        return {
            id,
            shapes: [],
        };
    }

    // Helper function to create a mock part shell
    function createMockShell(chainId: string): PartShell {
        return {
            id: `shell-${chainId}`,
            chain: createMockChain(chainId),
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
            holes: [],
        };
    }

    // Helper function to create a mock part hole
    function createMockHole(chainId: string): PartHole {
        return {
            id: `hole-${chainId}`,
            chain: createMockChain(chainId),
            type: PartType.HOLE,
            boundingBox: { min: { x: 10, y: 10 }, max: { x: 20, y: 20 } },
            holes: [],
        };
    }

    // Helper function to create a mock part
    function createMockPart(
        shellChainId: string,
        holeChainIds: string[] = []
    ): DetectedPart {
        const holes = holeChainIds.map((holeId) => createMockHole(holeId));
        return {
            id: `part-${shellChainId}`,
            shell: createMockShell(shellChainId),
            holes,
        };
    }

    describe('basic functionality', () => {
        it('should return undefined for empty chainId', () => {
            const parts = [createMockPart('shell-1')];
            const result = findPartContainingChain('', parts);
            expect(result).toBeUndefined();
        });

        it('should return undefined for null/undefined chainId', () => {
            const parts = [createMockPart('shell-1')];
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
                findPartContainingChain(
                    'chain-1',
                    null as unknown as DetectedPart[]
                )
            ).toBeUndefined();
            expect(
                findPartContainingChain(
                    'chain-1',
                    undefined as unknown as DetectedPart[]
                )
            ).toBeUndefined();
        });

        it('should return undefined when chain is not found in any part', () => {
            const parts = [
                createMockPart('shell-1', ['hole-1', 'hole-2']),
                createMockPart('shell-2', ['hole-3']),
            ];
            const result = findPartContainingChain('non-existent-chain', parts);
            expect(result).toBeUndefined();
        });
    });

    describe('shell chain matching', () => {
        it('should find part by shell chain ID', () => {
            const parts = [
                createMockPart('shell-1'),
                createMockPart('shell-2'),
                createMockPart('shell-3'),
            ];

            const result = findPartContainingChain('shell-2', parts);

            expect(result).toBeDefined();
            expect(result?.id).toBe('part-shell-2');
            expect(result?.shell.chain.id).toBe('shell-2');
        });

        it('should return first matching part when multiple parts have same shell chain ID', () => {
            // This shouldn't happen in normal usage, but test the behavior
            const parts = [
                createMockPart('shell-1'),
                createMockPart('shell-1'), // Duplicate shell ID
                createMockPart('shell-2'),
            ];

            const result = findPartContainingChain('shell-1', parts);

            expect(result).toBeDefined();
            expect(result?.shell.chain.id).toBe('shell-1');
            // Should return the first one found
            expect(result?.id).toBe('part-shell-1');
        });
    });

    describe('hole chain matching', () => {
        it('should find part by hole chain ID', () => {
            const parts = [
                createMockPart('shell-1', ['hole-1', 'hole-2']),
                createMockPart('shell-2', ['hole-3', 'hole-4']),
                createMockPart('shell-3'),
            ];

            const result = findPartContainingChain('hole-3', parts);

            expect(result).toBeDefined();
            expect(result?.id).toBe('part-shell-2');
            expect(result?.shell.chain.id).toBe('shell-2');
            expect(result?.holes.some((h) => h.chain.id === 'hole-3')).toBe(
                true
            );
        });

        it('should find part with multiple holes', () => {
            const parts = [
                createMockPart('shell-1', ['hole-1', 'hole-2', 'hole-3']),
                createMockPart('shell-2', ['hole-4']),
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
                createMockPart('shell-1'), // No holes
                createMockPart('shell-2', ['hole-1']),
            ];

            const result1 = findPartContainingChain('shell-1', parts);
            expect(result1?.id).toBe('part-shell-1');
            expect(result1?.holes).toHaveLength(0);

            const result2 = findPartContainingChain('hole-1', parts);
            expect(result2?.id).toBe('part-shell-2');
        });
    });

    describe('edge cases', () => {
        it('should handle case-sensitive chain IDs', () => {
            const parts = [createMockPart('Shell-1', ['Hole-1'])];

            expect(findPartContainingChain('shell-1', parts)).toBeUndefined();
            expect(findPartContainingChain('Shell-1', parts)).toBeDefined();
            expect(findPartContainingChain('hole-1', parts)).toBeUndefined();
            expect(findPartContainingChain('Hole-1', parts)).toBeDefined();
        });

        it('should handle special characters in chain IDs', () => {
            const parts = [
                createMockPart('shell-1_test', ['hole-1@special']),
                createMockPart('shell-2-dash', ['hole.dot']),
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
            const parts = [createMockPart('123', ['456'])];

            expect(findPartContainingChain('123', parts)?.id).toBe('part-123');
            expect(findPartContainingChain('456', parts)?.id).toBe('part-123');
        });

        it('should find part from large collection efficiently', () => {
            // Create many parts to test performance doesn't degrade significantly
            const parts = Array.from({ length: 100 }, (_, i) =>
                createMockPart(`shell-${i}`, [`hole-${i}-1`, `hole-${i}-2`])
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
                createMockPart('chain-1'),
                createMockPart('chain-2'),
                createMockPart('chain-3'),
                createMockPart('chain-4'),
                createMockPart('chain-5', ['chain-10']), // Part with hole
                createMockPart('chain-6'),
                createMockPart('chain-7'),
                createMockPart('chain-8'),
                createMockPart('chain-9'),
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
                ]),
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
        highlightChain: vi.fn(),
        clearChainHighlight: vi.fn(),
    },
}));

vi.mock('$lib/stores/parts/store', () => ({
    partStore: {
        selectPart: vi.fn(),
        hoverPart: vi.fn(),
        clearPartHover: vi.fn(),
    },
}));

describe('Chain interaction handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleChainClick', () => {
        it('should deselect chain when already selected', async () => {
            handleChainClick('chain-1', 'chain-1');

            expect(chainStore.selectChain).toHaveBeenCalledWith(null);
        });

        it('should select chain when different chain is selected', async () => {
            handleChainClick('chain-2', 'chain-1');

            expect(chainStore.selectChain).toHaveBeenCalledWith('chain-2');
        });

        it('should select chain when no chain is selected', async () => {
            handleChainClick('chain-1', null);

            expect(chainStore.selectChain).toHaveBeenCalledWith('chain-1');
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
        it('should deselect part when already selected', async () => {
            handlePartClick('part-1', 'part-1');

            expect(partStore.selectPart).toHaveBeenCalledWith(null);
        });

        it('should select part when different part is selected', async () => {
            handlePartClick('part-2', 'part-1');

            expect(partStore.selectPart).toHaveBeenCalledWith('part-2');
        });

        it('should select part when no part is selected', async () => {
            handlePartClick('part-1', null);

            expect(partStore.selectPart).toHaveBeenCalledWith('part-1');
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
