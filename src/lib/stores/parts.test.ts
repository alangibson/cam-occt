import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
    partStore,
    setParts,
    clearParts,
    highlightPart,
    clearHighlight,
    hoverPart,
    clearPartHover,
    selectPart,
    clearPartSelection,
    getPartChainIds,
    getChainPartType,
} from './parts';
import {
    PartType,
    type DetectedPart,
    type PartDetectionWarning,
    type PartHole,
} from '../algorithms/part-detection';

describe('Parts Store', () => {
    beforeEach(() => {
        clearParts();
    });

    // Helper function to create test parts
    function createTestPart(
        partId: string,
        shellChainId: string,
        holeChainIds: string[] = []
    ): DetectedPart {
        const holes: PartHole[] = holeChainIds.map((chainId, index) => ({
            id: `hole-${index + 1}`,
            chain: {
                id: chainId,
                shapes: [],
            },
            type: PartType.HOLE as const,
            boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
            holes: [],
        }));

        return {
            id: partId,
            shell: {
                id: `shell-1`,
                chain: {
                    id: shellChainId,
                    shapes: [],
                },
                type: PartType.SHELL as const,
                boundingBox: { minX: 0, maxX: 20, minY: 0, maxY: 20 },
                holes: holes,
            },
            holes: holes,
        };
    }

    describe('Basic Store Operations', () => {
        it('should initialize with empty state', () => {
            const state = get(partStore);
            expect(state.parts).toEqual([]);
            expect(state.warnings).toEqual([]);
            expect(state.highlightedPartId).toBeNull();
        });

        it('should set parts and warnings', () => {
            const parts = [createTestPart('part-1', 'chain-1')];
            const warnings: PartDetectionWarning[] = [
                {
                    type: 'overlapping_boundary',
                    chainId: 'chain-2',
                    message: 'Test warning',
                },
            ];

            setParts(parts, warnings);

            const state = get(partStore);
            expect(state.parts).toEqual(parts);
            expect(state.warnings).toEqual(warnings);
            expect(state.highlightedPartId).toBeNull();
        });

        it('should clear parts and reset highlighting', () => {
            const parts = [createTestPart('part-1', 'chain-1')];
            setParts(parts);
            highlightPart('part-1');

            clearParts();

            const state = get(partStore);
            expect(state.parts).toEqual([]);
            expect(state.warnings).toEqual([]);
            expect(state.highlightedPartId).toBeNull();
        });
    });

    describe('Part Highlighting', () => {
        beforeEach(() => {
            const parts = [
                createTestPart('part-1', 'chain-1', ['chain-2']),
                createTestPart('part-2', 'chain-3', ['chain-4', 'chain-5']),
            ];
            setParts(parts);
        });

        it('should highlight a part', () => {
            highlightPart('part-1');

            const state = get(partStore);
            expect(state.highlightedPartId).toBe('part-1');
        });

        it('should clear highlighting', () => {
            highlightPart('part-1');
            clearHighlight();

            const state = get(partStore);
            expect(state.highlightedPartId).toBeNull();
        });

        it('should replace previous highlighting when highlighting different part', () => {
            highlightPart('part-1');
            highlightPart('part-2');

            const state = get(partStore);
            expect(state.highlightedPartId).toBe('part-2');
        });
    });

    describe('Helper Functions', () => {
        const parts = [
            createTestPart('part-1', 'shell-chain-1', [
                'hole-chain-1',
                'hole-chain-2',
            ]),
            createTestPart('part-2', 'shell-chain-2', ['hole-chain-3']),
        ];

        describe('getPartChainIds', () => {
            it('should return all chain IDs for a part (shell + holes)', () => {
                const chainIds = getPartChainIds('part-1', parts);
                expect(chainIds).toEqual([
                    'shell-chain-1',
                    'hole-chain-1',
                    'hole-chain-2',
                ]);
            });

            it('should return shell chain ID only for part without holes', () => {
                const partWithoutHoles = [
                    createTestPart('part-no-holes', 'shell-only'),
                ];
                const chainIds = getPartChainIds(
                    'part-no-holes',
                    partWithoutHoles
                );
                expect(chainIds).toEqual(['shell-only']);
            });

            it('should return empty array for non-existent part', () => {
                const chainIds = getPartChainIds('non-existent', parts);
                expect(chainIds).toEqual([]);
            });
        });

        describe('getChainPartType', () => {
            it('should identify shell chains', () => {
                const partType = getChainPartType('shell-chain-1', parts);
                expect(partType).toBe(PartType.SHELL);
            });

            it('should identify hole chains', () => {
                const partType = getChainPartType('hole-chain-1', parts);
                expect(partType).toBe(PartType.HOLE);
            });

            it('should return null for non-part chains', () => {
                const partType = getChainPartType('unknown-chain', parts);
                expect(partType).toBeNull();
            });
        });
    });

    describe('Integration with Complex Hierarchies', () => {
        it('should handle nested holes correctly', () => {
            // Create a part with nested structure (holes containing other parts)
            const complexPart: DetectedPart = {
                id: 'complex-part',
                shell: {
                    id: 'shell-1',
                    chain: { id: 'shell-chain', shapes: [] },
                    type: PartType.SHELL,
                    boundingBox: { minX: 0, maxX: 30, minY: 0, maxY: 30 },
                    holes: [
                        {
                            id: 'hole-1',
                            chain: { id: 'hole-chain', shapes: [] },
                            type: PartType.HOLE,
                            boundingBox: {
                                minX: 5,
                                maxX: 25,
                                minY: 5,
                                maxY: 25,
                            },
                            holes: [
                                {
                                    id: 'nested-hole',
                                    chain: { id: 'nested-chain', shapes: [] },
                                    type: PartType.HOLE,
                                    boundingBox: {
                                        minX: 10,
                                        maxX: 20,
                                        minY: 10,
                                        maxY: 20,
                                    },
                                    holes: [],
                                },
                            ],
                        },
                    ],
                },
                holes: [
                    {
                        id: 'hole-1',
                        chain: { id: 'hole-chain', shapes: [] },
                        type: PartType.HOLE,
                        boundingBox: { minX: 5, maxX: 25, minY: 5, maxY: 25 },
                        holes: [
                            {
                                id: 'nested-hole',
                                chain: { id: 'nested-chain', shapes: [] },
                                type: PartType.HOLE,
                                boundingBox: {
                                    minX: 10,
                                    maxX: 20,
                                    minY: 10,
                                    maxY: 20,
                                },
                                holes: [],
                            },
                        ],
                    },
                ],
            };

            const parts = [complexPart];
            const chainIds = getPartChainIds('complex-part', parts);

            expect(chainIds).toEqual([
                'shell-chain',
                'hole-chain',
                'nested-chain',
            ]);
            expect(getChainPartType('shell-chain', parts)).toBe(PartType.SHELL);
            expect(getChainPartType('hole-chain', parts)).toBe(PartType.HOLE);
            expect(getChainPartType('nested-chain', parts)).toBe(PartType.HOLE);
        });
    });

    describe('Part Hovering', () => {
        it('should hover a part', () => {
            const testPartId = 'part-123';

            hoverPart(testPartId);

            const state = get(partStore);
            expect(state.hoveredPartId).toBe(testPartId);
            expect(state.highlightedPartId).toBeNull(); // Should not affect highlighting
        });

        it('should clear part hover', () => {
            const testPartId = 'part-123';

            // First hover a part
            hoverPart(testPartId);
            expect(get(partStore).hoveredPartId).toBe(testPartId);

            // Then clear the hover
            clearPartHover();
            expect(get(partStore).hoveredPartId).toBeNull();
        });

        it('should allow hovering and highlighting to coexist', () => {
            const highlightedPartId = 'part-highlighted';
            const hoveredPartId = 'part-hovered';

            // Highlight one part and hover another
            highlightPart(highlightedPartId);
            hoverPart(hoveredPartId);

            const state = get(partStore);
            expect(state.highlightedPartId).toBe(highlightedPartId);
            expect(state.hoveredPartId).toBe(hoveredPartId);
        });

        it('should handle null part hovering', () => {
            hoverPart(null);

            const state = get(partStore);
            expect(state.hoveredPartId).toBeNull();
        });
    });

    describe('Part Selection', () => {
        it('should select a part', () => {
            const testPartId = 'part-123';

            selectPart(testPartId);

            const state = get(partStore);
            expect(state.selectedPartId).toBe(testPartId);
            expect(state.highlightedPartId).toBeNull(); // Should not affect highlighting
            expect(state.hoveredPartId).toBeNull(); // Should not affect hovering
        });

        it('should clear part selection', () => {
            const testPartId = 'part-123';

            // First select a part
            selectPart(testPartId);
            expect(get(partStore).selectedPartId).toBe(testPartId);

            // Then clear the selection
            clearPartSelection();
            expect(get(partStore).selectedPartId).toBeNull();
        });

        it('should allow selection, highlighting, and hovering to coexist', () => {
            const selectedPartId = 'part-selected';
            const highlightedPartId = 'part-highlighted';
            const hoveredPartId = 'part-hovered';

            // Select, highlight, and hover different parts
            selectPart(selectedPartId);
            highlightPart(highlightedPartId);
            hoverPart(hoveredPartId);

            const state = get(partStore);
            expect(state.selectedPartId).toBe(selectedPartId);
            expect(state.highlightedPartId).toBe(highlightedPartId);
            expect(state.hoveredPartId).toBe(hoveredPartId);
        });

        it('should handle null part selection', () => {
            selectPart(null);

            const state = get(partStore);
            expect(state.selectedPartId).toBeNull();
        });
    });
});
