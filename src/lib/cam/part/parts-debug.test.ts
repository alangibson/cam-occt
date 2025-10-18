import { describe, expect, it } from 'vitest';
import { getChainPartType } from '$lib/cam/part/functions';
import { type DetectedPart } from '$lib/cam/part/interfaces';
import { PartType } from '$lib/cam/part/enums';

describe('Parts Store Chain Type Detection', () => {
    // Helper function to create test parts matching the real structure
    function createTestPartWithHoles(): DetectedPart {
        return {
            id: 'part-1',
            shell: {
                id: 'shell-1',
                chain: {
                    id: 'chain-shell',
                    shapes: [],
                },
                type: PartType.SHELL as const,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } },
                holes: [
                    {
                        id: 'hole-1',
                        chain: {
                            id: 'chain-hole-1',
                            shapes: [],
                        },
                        type: PartType.HOLE as const,
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                        holes: [],
                    },
                    {
                        id: 'hole-2',
                        chain: {
                            id: 'chain-hole-2',
                            shapes: [],
                        },
                        type: PartType.HOLE as const,
                        boundingBox: {
                            min: { x: 12, y: 12 },
                            max: { x: 18, y: 18 },
                        },
                        holes: [],
                    },
                ],
            },
            holes: [
                {
                    id: 'hole-1',
                    chain: {
                        id: 'chain-hole-1',
                        shapes: [],
                    },
                    type: PartType.HOLE as const,
                    boundingBox: { min: { x: 2, y: 2 }, max: { x: 8, y: 8 } },
                    holes: [],
                },
                {
                    id: 'hole-2',
                    chain: {
                        id: 'chain-hole-2',
                        shapes: [],
                    },
                    type: PartType.HOLE as const,
                    boundingBox: {
                        min: { x: 12, y: 12 },
                        max: { x: 18, y: 18 },
                    },
                    holes: [],
                },
            ],
        };
    }

    it('should correctly identify shell chains', () => {
        const parts = [createTestPartWithHoles()];

        const shellType = getChainPartType('chain-shell', parts);
        expect(shellType).toBe(PartType.SHELL);
    });

    it('should correctly identify hole chains', () => {
        const parts = [createTestPartWithHoles()];

        const hole1Type = getChainPartType('chain-hole-1', parts);
        const hole2Type = getChainPartType('chain-hole-2', parts);

        expect(hole1Type).toBe(PartType.HOLE);
        expect(hole2Type).toBe(PartType.HOLE);
    });

    it('should return null for unknown chains', () => {
        const parts = [createTestPartWithHoles()];

        const unknownType = getChainPartType('unknown-chain', parts);
        expect(unknownType).toBeNull();
    });

    it('should work with empty parts array', () => {
        const parts: DetectedPart[] = [];

        const result = getChainPartType('any-chain', parts);
        expect(result).toBeNull();
    });

    it('should work with multiple parts', () => {
        const part1 = createTestPartWithHoles();
        const part2: DetectedPart = {
            id: 'part-2',
            shell: {
                id: 'shell-2',
                chain: {
                    id: 'chain-shell-2',
                    shapes: [],
                },
                type: PartType.SHELL,
                boundingBox: { min: { x: 30, y: 30 }, max: { x: 50, y: 50 } },
                holes: [],
            },
            holes: [],
        };

        const parts = [part1, part2];

        expect(getChainPartType('chain-shell', parts)).toBe(PartType.SHELL);
        expect(getChainPartType('chain-shell-2', parts)).toBe(PartType.SHELL);
        expect(getChainPartType('chain-hole-1', parts)).toBe(PartType.HOLE);
        expect(getChainPartType('chain-hole-2', parts)).toBe(PartType.HOLE);
    });
});
