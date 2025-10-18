import { describe, it, expect, beforeEach } from 'vitest';
import { createCutsFromOperation } from './functions';
import type { Operation } from './interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { KerfCompensation } from '$lib/stores/operations/enums';

describe('Optimize Starts for Operations', () => {
    let mockTool: Tool;
    let squareChain: Chain;
    let operation: Operation;

    beforeEach(() => {
        // Create a tool
        mockTool = {
            id: 'tool-1',
            toolNumber: 1,
            toolName: 'Test Tool',
            feedRate: 100,
            pierceHeight: 5,
            pierceDelay: 0.5,
            cutHeight: 1,
            kerfWidth: 1,
            plungeRate: 50,
            arcVoltage: 120,
            thcEnable: true,
            gasPressure: 70,
            pauseAtEnd: 0,
            puddleJumpHeight: 0,
            puddleJumpDelay: 0,
        };

        // Create a square chain starting at (0, 0) going clockwise
        // Bottom: (0,0) -> (10,0)
        // Right: (10,0) -> (10,10)
        // Top: (10,10) -> (0,10)
        // Left: (0,10) -> (0,0)
        const bottomLine: Shape = {
            id: 'line-bottom',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        };

        const rightLine: Shape = {
            id: 'line-right',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 10, y: 0 },
                end: { x: 10, y: 10 },
            } as Line,
        };

        const topLine: Shape = {
            id: 'line-top',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 10, y: 10 },
                end: { x: 0, y: 10 },
            } as Line,
        };

        const leftLine: Shape = {
            id: 'line-left',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 10 },
                end: { x: 0, y: 0 },
            } as Line,
        };

        squareChain = {
            id: 'chain-square',
            shapes: [bottomLine, rightLine, topLine, leftLine],
            clockwise: true, // Closed square
        };

        // Create operation with Optimize Starts set to Midpoint
        operation = {
            id: 'op-1',
            name: 'Test Operation',
            toolId: mockTool.id,
            targetType: 'chains',
            targetIds: ['chain-square'],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.NONE,
                length: 0,
                angle: 0,
                flipSide: false,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.NONE,
                length: 0,
                angle: 0,
                flipSide: false,
                fit: false,
            },
            kerfCompensation: KerfCompensation.NONE,
            optimizeStarts: OptimizeStarts.MIDPOINT,
        };
    });

    it('should split the first line and start at its midpoint when Optimize Starts is set to Midpoint', async () => {
        // Generate cuts from the operation
        const result = await createCutsFromOperation(
            operation,
            [squareChain],
            [], // no parts
            [mockTool],
            0.01 // tolerance
        );

        // Should generate one cut
        expect(result.cuts).toHaveLength(1);

        const cut = result.cuts[0];
        expect(cut).toBeDefined();
        expect(cut.cutChain).toBeDefined();

        const cutChain = cut.cutChain!;

        // The original chain had 4 shapes
        // After optimization, the first line should be split, giving us 5 shapes total
        expect(cutChain.shapes.length).toBe(5);

        // The first shape in the optimized chain should start at the midpoint of the original first line
        // Original first line: (0,0) -> (10,0), midpoint is (5,0)
        const firstShape = cutChain.shapes[0];
        expect(firstShape.type).toBe(GeometryType.LINE);

        const firstLineGeom = firstShape.geometry as Line;

        // The start point should be at (5,0) - the midpoint of the original bottom line
        expect(firstLineGeom.start.x).toBeCloseTo(5, 1);
        expect(firstLineGeom.start.y).toBeCloseTo(0, 1);
        // And it should end at (10, 0) - completing the second half of the split line
        expect(firstLineGeom.end.x).toBeCloseTo(10, 1);
        expect(firstLineGeom.end.y).toBeCloseTo(0, 1);

        // The last shape should be the first half of the split line
        const lastShape = cutChain.shapes[4];
        expect(lastShape.type).toBe(GeometryType.LINE);

        const lastLineGeom = lastShape.geometry as Line;
        // Should start at (0, 0) and end at (5, 0)
        expect(lastLineGeom.start.x).toBeCloseTo(0, 1);
        expect(lastLineGeom.start.y).toBeCloseTo(0, 1);
        expect(lastLineGeom.end.x).toBeCloseTo(5, 1);
        expect(lastLineGeom.end.y).toBeCloseTo(0, 1);
    });

    it('should not modify the chain when Optimize Starts is set to None', async () => {
        // Update operation to disable optimization
        operation.optimizeStarts = OptimizeStarts.NONE;

        // Generate cuts from the operation
        const result = await createCutsFromOperation(
            operation,
            [squareChain],
            [], // no parts
            [mockTool],
            0.01 // tolerance
        );

        // Should generate one cut
        expect(result.cuts).toHaveLength(1);

        const cut = result.cuts[0];
        expect(cut).toBeDefined();
        expect(cut.cutChain).toBeDefined();

        const cutChain = cut.cutChain!;

        // The chain should still have 4 shapes (no optimization)
        expect(cutChain.shapes.length).toBe(4);

        // The first shape should start at (0,0) - the original start point
        const firstShape = cutChain.shapes[0];
        expect(firstShape.type).toBe(GeometryType.LINE);

        const firstLineGeom = firstShape.geometry as Line;
        expect(firstLineGeom.start.x).toBeCloseTo(0, 1);
        expect(firstLineGeom.start.y).toBeCloseTo(0, 1);
    });
});
