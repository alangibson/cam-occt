import { describe, expect, it } from 'vitest';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { Shape } from '$lib/cam/shape/classes';
import { GeometryType } from '$lib/geometry/enums';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { isChainContainedInChain_Sampled } from '$lib/cam/chain/chain-containment';

describe('isChainContainedInChain_Sampled', () => {
    it('should detect a small circle inside a large circle', () => {
        // Create outer circle (radius 10, center at origin)
        const outerCircle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };
        const outerShape = new Shape({
            id: 'outer-circle-1',
            type: GeometryType.CIRCLE,
            geometry: outerCircle,
        });
        const outerChain = new Chain({
            id: 'outer',
            name: 'Outer Circle',
            shapes: [outerShape],
        });

        // Create inner circle (radius 2, center at origin)
        const innerCircle: Circle = {
            center: { x: 0, y: 0 },
            radius: 2,
        };
        const innerShape = new Shape({
            id: 'inner-circle-1',
            type: GeometryType.CIRCLE,
            geometry: innerCircle,
        });
        const innerChain = new Chain({
            id: 'inner',
            name: 'Inner Circle',
            shapes: [innerShape],
        });

        // Test containment
        const isContained = isChainContainedInChain_Sampled(
            innerChain,
            outerChain
        );
        expect(isContained).toBe(true);
    });

    it('should detect a small circle NOT inside a large circle when offset', () => {
        // Create outer circle (radius 10, center at origin)
        const outerCircle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };
        const outerShape = new Shape({
            id: 'outer-circle-2',
            type: GeometryType.CIRCLE,
            geometry: outerCircle,
        });
        const outerChain = new Chain({
            id: 'outer',
            name: 'Outer Circle',
            shapes: [outerShape],
        });

        // Create inner circle (radius 2, center way outside)
        const innerCircle: Circle = {
            center: { x: 50, y: 50 },
            radius: 2,
        };
        const innerShape = new Shape({
            id: 'inner-circle-2',
            type: GeometryType.CIRCLE,
            geometry: innerCircle,
        });
        const innerChain = new Chain({
            id: 'inner',
            name: 'Inner Circle',
            shapes: [innerShape],
        });

        // Test containment - should be false
        const isContained = isChainContainedInChain_Sampled(
            innerChain,
            outerChain
        );
        expect(isContained).toBe(false);
    });

    it('should detect a small rectangle inside a large rectangle', () => {
        // Create outer rectangle (20x20, centered at origin)
        const outerShapes: Shape[] = [
            new Shape({
                id: 'outer-line-1',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: -10 }, end: { x: 10, y: -10 } },
            }),
            new Shape({
                id: 'outer-line-2',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: -10 }, end: { x: 10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-3',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: -10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-4',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: 10 }, end: { x: -10, y: -10 } },
            }),
        ];
        const outerChain = new Chain({
            id: 'outer',
            name: 'Outer Rectangle',
            shapes: outerShapes,
        });

        // Create inner rectangle (4x4, centered at origin)
        const innerShapes: Shape[] = [
            new Shape({
                id: 'inner-line-1',
                type: GeometryType.LINE,
                geometry: { start: { x: -2, y: -2 }, end: { x: 2, y: -2 } },
            }),
            new Shape({
                id: 'inner-line-2',
                type: GeometryType.LINE,
                geometry: { start: { x: 2, y: -2 }, end: { x: 2, y: 2 } },
            }),
            new Shape({
                id: 'inner-line-3',
                type: GeometryType.LINE,
                geometry: { start: { x: 2, y: 2 }, end: { x: -2, y: 2 } },
            }),
            new Shape({
                id: 'inner-line-4',
                type: GeometryType.LINE,
                geometry: { start: { x: -2, y: 2 }, end: { x: -2, y: -2 } },
            }),
        ];
        const innerChain = new Chain({
            id: 'inner',
            name: 'Inner Rectangle',
            shapes: innerShapes,
        });

        // Test containment
        const isContained = isChainContainedInChain_Sampled(
            innerChain,
            outerChain
        );
        expect(isContained).toBe(true);
    });

    it('should detect overlapping rectangles as NOT contained', () => {
        // Create outer rectangle (20x20, centered at origin)
        const outerShapes: Shape[] = [
            new Shape({
                id: 'outer-line-5',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: -10 }, end: { x: 10, y: -10 } },
            }),
            new Shape({
                id: 'outer-line-6',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: -10 }, end: { x: 10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-7',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: -10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-8',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: 10 }, end: { x: -10, y: -10 } },
            }),
        ];
        const outerChain = new Chain({
            id: 'outer',
            name: 'Outer Rectangle',
            shapes: outerShapes,
        });

        // Create overlapping rectangle (4x4, offset so it overlaps but not fully contained)
        const innerShapes: Shape[] = [
            new Shape({
                id: 'overlapping-line-1',
                type: GeometryType.LINE,
                geometry: { start: { x: 8, y: -2 }, end: { x: 12, y: -2 } },
            }),
            new Shape({
                id: 'overlapping-line-2',
                type: GeometryType.LINE,
                geometry: { start: { x: 12, y: -2 }, end: { x: 12, y: 2 } },
            }),
            new Shape({
                id: 'overlapping-line-3',
                type: GeometryType.LINE,
                geometry: { start: { x: 12, y: 2 }, end: { x: 8, y: 2 } },
            }),
            new Shape({
                id: 'overlapping-line-4',
                type: GeometryType.LINE,
                geometry: { start: { x: 8, y: 2 }, end: { x: 8, y: -2 } },
            }),
        ];
        const innerChain = new Chain({
            id: 'inner',
            name: 'Overlapping Rectangle',
            shapes: innerShapes,
        });

        // Test containment - should be false (overlaps but not fully contained)
        const isContained = isChainContainedInChain_Sampled(
            innerChain,
            outerChain
        );
        expect(isContained).toBe(false);
    });

    it('should handle edge case where inner chain has sample point on boundary', () => {
        // Create outer rectangle (20x20, centered at origin)
        const outerShapes: Shape[] = [
            new Shape({
                id: 'outer-line-9',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: -10 }, end: { x: 10, y: -10 } },
            }),
            new Shape({
                id: 'outer-line-10',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: -10 }, end: { x: 10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-11',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: -10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-12',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: 10 }, end: { x: -10, y: -10 } },
            }),
        ];
        const outerChain = new Chain({
            id: 'outer',
            name: 'Outer Rectangle',
            shapes: outerShapes,
        });

        // Create inner circle touching the boundary (radius 5, center offset)
        const innerCircle: Circle = {
            center: { x: 5, y: 0 },
            radius: 4.9, // Just inside the boundary
        };
        const innerShape = new Shape({
            id: 'inner-circle-3',
            type: GeometryType.CIRCLE,
            geometry: innerCircle,
        });
        const innerChain = new Chain({
            id: 'inner',
            name: 'Inner Circle Near Boundary',
            shapes: [innerShape],
        });

        // Test containment - should still be true (majority of points inside)
        const isContained = isChainContainedInChain_Sampled(
            innerChain,
            outerChain
        );
        expect(isContained).toBe(true);
    });

    it('should return false if outer chain is not closed', () => {
        // Create open outer chain (open rectangle - missing one side)
        const outerShapes: Shape[] = [
            new Shape({
                id: 'outer-line-13',
                type: GeometryType.LINE,
                geometry: { start: { x: -10, y: -10 }, end: { x: 10, y: -10 } },
            }),
            new Shape({
                id: 'outer-line-14',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: -10 }, end: { x: 10, y: 10 } },
            }),
            new Shape({
                id: 'outer-line-15',
                type: GeometryType.LINE,
                geometry: { start: { x: 10, y: 10 }, end: { x: -10, y: 10 } },
            }),
            // Missing the closing line from (-10, 10) to (-10, -10)
        ];
        const outerChain = new Chain({
            id: 'outer',
            name: 'Open Rectangle',
            shapes: outerShapes,
        });

        // Create inner circle
        const innerCircle: Circle = {
            center: { x: 0, y: 0 },
            radius: 2,
        };
        const innerShape = new Shape({
            id: 'inner-circle-4',
            type: GeometryType.CIRCLE,
            geometry: innerCircle,
        });
        const innerChain = new Chain({
            id: 'inner',
            name: 'Inner Circle',
            shapes: [innerShape],
        });

        // Test containment - should be false (outer chain is not closed)
        const isContained = isChainContainedInChain_Sampled(
            innerChain,
            outerChain
        );
        expect(isContained).toBe(false);
    });
});
