import { describe, it, expect } from 'vitest';
import { getChainPartType } from './parts';
import type { DetectedPart } from '../algorithms/part-detection';

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
                type: 'shell' as const,
                boundingBox: { minX: 0, maxX: 20, minY: 0, maxY: 20 },
                holes: [
                    {
                        id: 'hole-1',
                        chain: {
                            id: 'chain-hole-1',
                            shapes: [],
                        },
                        type: 'hole' as const,
                        boundingBox: { minX: 2, maxX: 8, minY: 2, maxY: 8 },
                        holes: [],
                    },
                    {
                        id: 'hole-2',
                        chain: {
                            id: 'chain-hole-2',
                            shapes: [],
                        },
                        type: 'hole' as const,
                        boundingBox: { minX: 12, maxX: 18, minY: 12, maxY: 18 },
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
                    type: 'hole' as const,
                    boundingBox: { minX: 2, maxX: 8, minY: 2, maxY: 8 },
                    holes: [],
                },
                {
                    id: 'hole-2',
                    chain: {
                        id: 'chain-hole-2',
                        shapes: [],
                    },
                    type: 'hole' as const,
                    boundingBox: { minX: 12, maxX: 18, minY: 12, maxY: 18 },
                    holes: [],
                },
            ],
        };
    }

    it('should correctly identify shell chains', () => {
        const parts = [createTestPartWithHoles()];

        const shellType = getChainPartType('chain-shell', parts);
        expect(shellType).toBe('shell');
    });

    it('should correctly identify hole chains', () => {
        const parts = [createTestPartWithHoles()];

        const hole1Type = getChainPartType('chain-hole-1', parts);
        const hole2Type = getChainPartType('chain-hole-2', parts);

        expect(hole1Type).toBe('hole');
        expect(hole2Type).toBe('hole');
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
                type: 'shell' as const,
                boundingBox: { minX: 30, maxX: 50, minY: 30, maxY: 50 },
                holes: [],
            },
            holes: [],
        };

        const parts = [part1, part2];

        expect(getChainPartType('chain-shell', parts)).toBe('shell');
        expect(getChainPartType('chain-shell-2', parts)).toBe('shell');
        expect(getChainPartType('chain-hole-1', parts)).toBe('hole');
        expect(getChainPartType('chain-hole-2', parts)).toBe('hole');
    });
});
