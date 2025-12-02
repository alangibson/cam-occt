import { Chain } from '$lib/cam/chain/classes';
import { describe, expect, it } from 'vitest';
import { isPointInsidePart } from '$lib/cam/chain/point-in-chain';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { GeometryType } from '$lib/geometry/enums';

describe('Part Selection - Point-in-Part Detection', () => {
    it('should detect point inside shell but outside voids', () => {
        // Create a simple rectangular part with a void
        const shell = {
            id: 'shell-1',
            name: 'shell-1',
            shapes: [
                {
                    id: 'line-1',
                    type: GeometryType.LINE as const,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 100, y: 0 },
                    },
                },
                {
                    id: 'line-2',
                    type: GeometryType.LINE as const,
                    geometry: {
                        start: { x: 100, y: 0 },
                        end: { x: 100, y: 100 },
                    },
                },
                {
                    id: 'line-3',
                    type: GeometryType.LINE as const,
                    geometry: {
                        start: { x: 100, y: 100 },
                        end: { x: 0, y: 100 },
                    },
                },
                {
                    id: 'line-4',
                    type: GeometryType.LINE as const,
                    geometry: {
                        start: { x: 0, y: 100 },
                        end: { x: 0, y: 0 },
                    },
                },
            ],
        };

        const voids = [
            {
                chain: {
                    id: 'void-1',
                    name: 'void-1',
                    shapes: [
                        {
                            id: 'circle-1',
                            type: GeometryType.CIRCLE as const,
                            geometry: { center: { x: 50, y: 50 }, radius: 20 },
                        },
                    ],
                },
            },
        ];

        const part = {
            shell: new Chain(shell),
            voids: voids.map((v) => ({ chain: new Chain(v.chain) })),
        };

        // Point inside shell but outside void - should return true
        const pointInPart: Point2D = { x: 25, y: 25 };
        expect(isPointInsidePart(pointInPart, part)).toBe(true);

        // Point inside void - should return false
        const pointInVoid: Point2D = { x: 50, y: 50 };
        expect(isPointInsidePart(pointInVoid, part)).toBe(false);

        // Point outside shell - should return false
        const pointOutside: Point2D = { x: 150, y: 150 };
        expect(isPointInsidePart(pointOutside, part)).toBe(false);
    });
});
