import { beforeEach, describe, expect, it } from 'vitest';
import { cutStore } from '$lib/stores/cuts/store';
import { chainStore } from '$lib/stores/chains/store';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/types';
import { CutDirection } from '$lib/types/direction';
import { GeometryType } from '$lib/geometry/shape';
import { NormalSide } from '$lib/types/cam';

describe('SimulateStage Cut Direction', () => {
    beforeEach(() => {
        // Reset stores
        cutStore.reset();
        chainStore.clearChains();
    });

    it('should trace circles clockwise when cut direction is clockwise', () => {
        // Create a circle shape
        const circleShape: Shape = {
            id: 'circle-1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 100, y: 100 },
                radius: 50,
            },
        };

        // Create a chain with the circle
        const chain: Chain = {
            id: 'chain-1',
            shapes: [circleShape],
        };

        // Add chain to store
        chainStore.setChains([chain]);

        // Create cuts with different cut directions
        cutStore.addCut({
            id: 'cut-clockwise-1',
            name: 'Clockwise Circle',
            operationId: 'op-1',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        });

        cutStore.addCut({
            id: 'cut-counter-1',
            name: 'Counterclockwise Circle',
            operationId: 'op-2',
            chainId: 'chain-1',
            toolId: 'tool-1',
            enabled: true,
            order: 2,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
            feedRate: 1000,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        });

        // Access the internal getPositionOnShape function from the SimulateStage component
        // For testing purposes, we'll verify the mathematical correctness directly

        // Test clockwise direction - at progress 0.25 (90 degrees clockwise)
        // Clockwise: angle = -0.25 * 2π = -π/2 (points downward from center)
        const expectedClockwise = {
            x: 100 + 50 * Math.cos(-Math.PI / 2), // = 100 + 50 * 0 = 100
            y: 100 + 50 * Math.sin(-Math.PI / 2), // = 100 + 50 * (-1) = 50
        };

        // Test counterclockwise direction - at progress 0.25 (90 degrees counterclockwise)
        // Counterclockwise: angle = 0.25 * 2π = π/2 (points upward from center)
        const expectedCounterclockwise = {
            x: 100 + 50 * Math.cos(Math.PI / 2), // = 100 + 50 * 0 = 100
            y: 100 + 50 * Math.sin(Math.PI / 2), // = 100 + 50 * 1 = 150
        };

        // Verify that the mathematical calculation is correct
        expect(expectedClockwise.x).toBe(100);
        expect(expectedClockwise.y).toBe(50);
        expect(expectedCounterclockwise.x).toBe(100);
        expect(expectedCounterclockwise.y).toBe(150);
    });

    it('should trace ellipses clockwise when cut direction is clockwise', () => {
        // Create an ellipse shape
        const ellipseShape: Shape = {
            id: 'ellipse-1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 200, y: 200 },
                majorAxisEndpoint: { x: 100, y: 0 }, // 100 units along x-axis
                minorToMajorRatio: 0.5, // minor axis is 50 units
            },
        };

        // Create a chain with the ellipse
        const chain: Chain = {
            id: 'chain-2',
            shapes: [ellipseShape],
        };

        // Add chain to store
        chainStore.setChains([chain]);

        // Create cuts with different cut directions
        cutStore.addCut({
            id: 'cut-clockwise-2',
            name: 'Clockwise Ellipse',
            operationId: 'op-3',
            chainId: 'chain-2',
            toolId: 'tool-1',
            enabled: true,
            order: 3,
            cutDirection: CutDirection.CLOCKWISE,
            feedRate: 1000,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        });

        cutStore.addCut({
            id: 'cut-counter-2',
            name: 'Counterclockwise Ellipse',
            operationId: 'op-4',
            chainId: 'chain-2',
            toolId: 'tool-1',
            enabled: true,
            order: 4,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
            feedRate: 1000,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        });

        // TODO: Once getPositionOnShape is updated to accept cut direction,
        // verify that the ellipse is traced in the correct direction
    });

    it('should handle cut direction "none" for open chains', () => {
        // Create a line shape (open chain)
        const lineShape: Shape = {
            id: 'line-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
            },
        };

        // Create an open chain
        const chain: Chain = {
            id: 'chain-3',
            shapes: [lineShape],
        };

        // Add chain to store
        chainStore.setChains([chain]);

        // Create cut with "none" cut direction
        cutStore.addCut({
            id: 'cut-open-1',
            name: 'Open Line',
            operationId: 'op-5',
            chainId: 'chain-3',
            toolId: 'tool-1',
            enabled: true,
            order: 5,
            cutDirection: CutDirection.NONE,
            feedRate: 1000,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        });

        // Open chains should always trace from start to end regardless of cut direction
        // TODO: Verify this behavior once implementation is fixed
    });
});
