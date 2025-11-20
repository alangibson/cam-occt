import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { partStore } from '$lib/stores/parts/store';
import { getChainPartType, getPartChainIds } from '$lib/test/parts';
import { Part } from '$lib/cam/part/classes.svelte';
import {
    type PartData,
    type PartDetectionWarning,
    type PartVoid,
} from '$lib/cam/part/interfaces';
import { PartType } from '$lib/cam/part/enums';

describe('Parts Store', () => {
    beforeEach(() => {
        partStore.clearParts();
    });

    // Helper function to create test parts
    function createTestPart(
        partId: string,
        shellChainId: string,
        holeChainIds: string[] = []
    ): Part {
        const holes: PartVoid[] = holeChainIds.map((chainId, index) => ({
            id: `hole-${index + 1}`,
            chain: {
                id: chainId,
                shapes: [],
            },
            type: PartType.HOLE as const,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
        }));

        const partData: PartData = {
            id: partId,
            shell: {
                id: shellChainId,
                shapes: [],
            },
            type: PartType.SHELL as const,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } },
            voids: holes,
            slots: [],
            layerName: '0',
        };

        return new Part(partData);
    }

    describe('Basic Store Operations', () => {
        it('should initialize with empty state', () => {
            const state = get(partStore);
            expect(state.warnings).toEqual([]);
            expect(state.highlightedPartId).toBeNull();
        });

        it('should set warnings', () => {
            const warnings: PartDetectionWarning[] = [
                {
                    type: 'overlapping_boundary',
                    chainId: 'chain-2',
                    message: 'Test warning',
                },
            ];

            partStore.setWarnings(warnings);

            const state = get(partStore);
            expect(state.warnings).toEqual(warnings);
            expect(state.highlightedPartId).toBeNull();
        });

        it('should clear parts and reset highlighting', () => {
            partStore.highlightPart('part-1');

            partStore.clearParts();

            const state = get(partStore);
            expect(state.warnings).toEqual([]);
            expect(state.highlightedPartId).toBeNull();
        });
    });

    describe('Part Highlighting', () => {
        beforeEach(() => {
            // Note: Parts now come from Drawing.layers, not from partStore
            partStore.clearParts();
        });

        it('should highlight a part', () => {
            partStore.highlightPart('part-1');

            const state = get(partStore);
            expect(state.highlightedPartId).toBe('part-1');
        });

        it('should clear highlighting', () => {
            partStore.highlightPart('part-1');
            partStore.clearHighlight();

            const state = get(partStore);
            expect(state.highlightedPartId).toBeNull();
        });

        it('should replace previous highlighting when highlighting different part', () => {
            partStore.highlightPart('part-1');
            partStore.highlightPart('part-2');

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
            const complexPartData: PartData = {
                id: 'complex-part',
                shell: { id: 'shell-chain', shapes: [] },
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 30, y: 30 } },
                voids: [
                    {
                        id: 'hole-1',
                        chain: { id: 'hole-chain', shapes: [] },
                        type: PartType.HOLE,
                        boundingBox: {
                            min: { x: 5, y: 5 },
                            max: { x: 25, y: 25 },
                        },
                    },
                ],
                slots: [],
                layerName: '0',
            };

            const parts = [new Part(complexPartData)];
            const chainIds = getPartChainIds('complex-part', parts);

            expect(chainIds).toEqual(['shell-chain', 'hole-chain']);
            expect(getChainPartType('shell-chain', parts)).toBe(PartType.SHELL);
            expect(getChainPartType('hole-chain', parts)).toBe(PartType.HOLE);
        });
    });

    describe('Part Hovering', () => {
        it('should hover a part', () => {
            const testPartId = 'part-123';

            partStore.hoverPart(testPartId);

            const state = get(partStore);
            expect(state.hoveredPartId).toBe(testPartId);
            expect(state.highlightedPartId).toBeNull(); // Should not affect highlighting
        });

        it('should clear part hover', () => {
            const testPartId = 'part-123';

            // First hover a part
            partStore.hoverPart(testPartId);
            expect(get(partStore).hoveredPartId).toBe(testPartId);

            // Then clear the hover
            partStore.clearPartHover();
            expect(get(partStore).hoveredPartId).toBeNull();
        });

        it('should allow hovering and highlighting to coexist', () => {
            const highlightedPartId = 'part-highlighted';
            const hoveredPartId = 'part-hovered';

            // Highlight one part and hover another
            partStore.highlightPart(highlightedPartId);
            partStore.hoverPart(hoveredPartId);

            const state = get(partStore);
            expect(state.highlightedPartId).toBe(highlightedPartId);
            expect(state.hoveredPartId).toBe(hoveredPartId);
        });

        it('should handle null part hovering', () => {
            partStore.hoverPart(null);

            const state = get(partStore);
            expect(state.hoveredPartId).toBeNull();
        });
    });

    describe('Part Selection', () => {
        it('should select a part', () => {
            const testPartId = 'part-123';

            partStore.selectPart(testPartId);

            const state = get(partStore);
            expect(state.selectedPartIds.has(testPartId)).toBe(true);
            expect(state.highlightedPartId).toBeNull(); // Should not affect highlighting
            expect(state.hoveredPartId).toBeNull(); // Should not affect hovering
        });

        it('should clear part selection', () => {
            const testPartId = 'part-123';

            // First select a part
            partStore.selectPart(testPartId);
            expect(get(partStore).selectedPartIds.has(testPartId)).toBe(true);

            // Then clear the selection
            partStore.clearPartSelection();
            expect(get(partStore).selectedPartIds.size).toBe(0);
        });

        it('should allow selection, highlighting, and hovering to coexist', () => {
            const selectedPartId = 'part-selected';
            const highlightedPartId = 'part-highlighted';
            const hoveredPartId = 'part-hovered';

            // Select, highlight, and hover different parts
            partStore.selectPart(selectedPartId);
            partStore.highlightPart(highlightedPartId);
            partStore.hoverPart(hoveredPartId);

            const state = get(partStore);
            expect(state.selectedPartIds.has(selectedPartId)).toBe(true);
            expect(state.highlightedPartId).toBe(highlightedPartId);
            expect(state.hoveredPartId).toBe(hoveredPartId);
        });

        it('should handle null part selection', () => {
            partStore.selectPart(null);

            const state = get(partStore);
            expect(state.selectedPartIds.size).toBe(0);
        });
    });
});
