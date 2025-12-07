import { beforeEach, describe, expect, it } from 'vitest';
import type {
    ChainEndpoint,
    ShapePoint,
    TessellationPoint,
} from './interfaces';
import { generateChainEndpoints } from '$lib/stores/chains/functions';
import { generateShapePoints } from '$lib/stores/shape/functions';
import { overlayStore } from './store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { GeometryType } from '$lib/geometry/enums';

describe('overlayStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        overlayStore.clearAllOverlays();
    });

    describe('setCurrentStage', () => {
        it('should update current stage', () => {
            overlayStore.setCurrentStage(WorkflowStage.PROGRAM);

            expect(overlayStore.currentStage).toBe(WorkflowStage.PROGRAM);
        });
    });

    describe('getCurrentOverlay', () => {
        it('should return overlay for current stage', () => {
            overlayStore.setCurrentStage(WorkflowStage.PROGRAM);

            const overlay = overlayStore.getCurrentOverlay();

            expect(overlay).toBeDefined();
            expect(overlay?.stage).toBe(WorkflowStage.PROGRAM);
        });
    });

    describe('shape points management', () => {
        it('should set shape points for stage', () => {
            const points: ShapePoint[] = [
                { x: 0, y: 0, type: 'origin', shapeId: 'shape-1' },
                { x: 10, y: 0, type: 'start', shapeId: 'shape-1' },
                { x: 10, y: 10, type: 'end', shapeId: 'shape-1' },
            ];

            overlayStore.setShapePoints(WorkflowStage.PROGRAM, points);

            expect(overlayStore.overlays.program.shapePoints).toEqual(points);
        });

        it('should clear shape points for stage', () => {
            const points: ShapePoint[] = [
                { x: 0, y: 0, type: 'origin', shapeId: 'shape-1' },
            ];

            overlayStore.setShapePoints(WorkflowStage.PROGRAM, points);
            overlayStore.clearShapePoints(WorkflowStage.PROGRAM);

            expect(overlayStore.overlays.program.shapePoints).toHaveLength(0);
        });
    });

    describe('chain endpoints management', () => {
        it('should set chain endpoints for stage', () => {
            const endpoints: ChainEndpoint[] = [
                { x: 0, y: 0, type: 'start', chainId: 'chain-1' },
                { x: 100, y: 100, type: 'end', chainId: 'chain-1' },
            ];

            overlayStore.setChainEndpoints(WorkflowStage.PROGRAM, endpoints);

            expect(overlayStore.overlays.program.chainEndpoints).toEqual(
                endpoints
            );
        });

        it('should clear chain endpoints for stage', () => {
            const endpoints: ChainEndpoint[] = [
                { x: 0, y: 0, type: 'start', chainId: 'chain-1' },
            ];

            overlayStore.setChainEndpoints(WorkflowStage.PROGRAM, endpoints);
            overlayStore.clearChainEndpoints(WorkflowStage.PROGRAM);

            expect(overlayStore.overlays.program.chainEndpoints).toHaveLength(
                0
            );
        });
    });

    describe('tessellation points management', () => {
        it('should set tessellation points for stage', () => {
            const points: TessellationPoint[] = [
                { x: 5, y: 5, shapeId: 'shape-1', chainId: 'chain-1' },
                { x: 15, y: 15, shapeId: 'shape-2', chainId: 'chain-1' },
            ];

            overlayStore.setTessellationPoints(WorkflowStage.PROGRAM, points);

            expect(overlayStore.overlays.program.tessellationPoints).toEqual(
                points
            );
        });

        it('should clear tessellation points for stage', () => {
            const points: TessellationPoint[] = [
                { x: 5, y: 5, shapeId: 'shape-1', chainId: 'chain-1' },
            ];

            overlayStore.setTessellationPoints(WorkflowStage.PROGRAM, points);
            overlayStore.clearTessellationPoints(WorkflowStage.PROGRAM);

            expect(
                overlayStore.overlays.program.tessellationPoints
            ).toHaveLength(0);
        });
    });

    describe('tool head management', () => {
        it('should set tool head position', () => {
            const position: Point2D = { x: 50, y: 75 };

            overlayStore.setToolHead(WorkflowStage.SIMULATE, position);

            expect(overlayStore.overlays.simulate.toolHead).toEqual({
                x: 50,
                y: 75,
                visible: true,
            });
        });

        it('should clear tool head', () => {
            const position: Point2D = { x: 50, y: 75 };

            overlayStore.setToolHead(WorkflowStage.SIMULATE, position);
            overlayStore.clearToolHead(WorkflowStage.SIMULATE);

            expect(overlayStore.overlays.simulate.toolHead).toBeUndefined();
        });
    });

    describe('clearStageOverlay', () => {
        it('should clear all overlay data for stage', () => {
            const points: ShapePoint[] = [
                { x: 0, y: 0, type: 'origin', shapeId: 'shape-1' },
            ];
            const endpoints: ChainEndpoint[] = [
                { x: 0, y: 0, type: 'start', chainId: 'chain-1' },
            ];
            const tessPoints: TessellationPoint[] = [
                { x: 5, y: 5, shapeId: 'shape-1', chainId: 'chain-1' },
            ];

            overlayStore.setShapePoints(WorkflowStage.PROGRAM, points);
            overlayStore.setChainEndpoints(WorkflowStage.PROGRAM, endpoints);
            overlayStore.setTessellationPoints(
                WorkflowStage.PROGRAM,
                tessPoints
            );

            overlayStore.clearStageOverlay(WorkflowStage.PROGRAM);

            expect(overlayStore.overlays.program.shapePoints).toHaveLength(0);
            expect(overlayStore.overlays.program.chainEndpoints).toHaveLength(
                0
            );
            expect(
                overlayStore.overlays.program.tessellationPoints
            ).toHaveLength(0);
        });
    });

    describe('clearAllOverlays', () => {
        it('should clear all overlay data for all stages', () => {
            const points: ShapePoint[] = [
                { x: 0, y: 0, type: 'origin', shapeId: 'shape-1' },
            ];

            overlayStore.setShapePoints(WorkflowStage.PROGRAM, points);
            overlayStore.setShapePoints(WorkflowStage.PROGRAM, points);
            overlayStore.setShapePoints(WorkflowStage.PROGRAM, points);

            overlayStore.clearAllOverlays();

            Object.keys(overlayStore.overlays).forEach((stage) => {
                expect(
                    overlayStore.overlays[stage as WorkflowStage].shapePoints
                ).toHaveLength(0);
                expect(
                    overlayStore.overlays[stage as WorkflowStage].chainEndpoints
                ).toHaveLength(0);
                expect(
                    overlayStore.overlays[stage as WorkflowStage]
                        .tessellationPoints
                ).toHaveLength(0);
            });
        });
    });
});

describe('generateShapePoints', () => {
    const createLineShape = (
        id: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): ShapeData => ({
        id,
        type: GeometryType.LINE,
        geometry: {
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
        },
    });

    const createCircleShape = (
        id: string,
        cx: number,
        cy: number,
        r: number
    ): ShapeData => ({
        id,
        type: GeometryType.CIRCLE,
        geometry: {
            center: { x: cx, y: cy },
            radius: r,
        },
    });

    const createArcShape = (
        id: string,
        cx: number,
        cy: number,
        r: number,
        startAngle: number,
        endAngle: number
    ): ShapeData => ({
        id,
        type: GeometryType.ARC,
        geometry: {
            center: { x: cx, y: cy },
            radius: r,
            startAngle,
            endAngle,
        },
    });

    it('should generate points for selected line shapes', () => {
        const shapes: ShapeData[] = [
            createLineShape('line-1', 0, 0, 10, 10),
            createLineShape('line-2', 20, 20, 30, 30),
        ];
        const selectedIds = new Set(['line-1']);

        const points = generateShapePoints(shapes, selectedIds);

        expect(points).toHaveLength(3); // origin, start and end points (line has origin at start)
        expect(points).toContainEqual({
            x: 0,
            y: 0,
            type: 'start',
            shapeId: 'line-1',
        });
        expect(points).toContainEqual({
            x: 10,
            y: 10,
            type: 'end',
            shapeId: 'line-1',
        });
    });

    it('should generate points for selected circle shapes', () => {
        const shapes: ShapeData[] = [createCircleShape('circle-1', 5, 5, 10)];
        const selectedIds = new Set(['circle-1']);

        const points = generateShapePoints(shapes, selectedIds);

        expect(points).toHaveLength(3); // origin (center), start, and end points
        expect(points).toContainEqual({
            x: 5,
            y: 5,
            type: 'origin',
            shapeId: 'circle-1',
        });
    });

    it('should generate points for selected arc shapes', () => {
        const shapes: ShapeData[] = [
            createArcShape('arc-1', 0, 0, 5, 0, Math.PI / 2),
        ];
        const selectedIds = new Set(['arc-1']);

        const points = generateShapePoints(shapes, selectedIds);

        expect(points).toHaveLength(3); // origin (center), start, and end points
        expect(points).toContainEqual({
            x: 0,
            y: 0,
            type: 'origin',
            shapeId: 'arc-1',
        });
    });

    it('should only generate points for selected shapes', () => {
        const shapes: ShapeData[] = [
            createLineShape('line-1', 0, 0, 10, 10),
            createLineShape('line-2', 20, 20, 30, 30),
        ];
        const selectedIds = new Set(['line-1']);

        const points = generateShapePoints(shapes, selectedIds);

        expect(points.every((p) => p.shapeId === 'line-1')).toBe(true);
    });

    it('should return empty array when no shapes selected', () => {
        const shapes: ShapeData[] = [createLineShape('line-1', 0, 0, 10, 10)];
        const selectedIds = new Set<string>();

        const points = generateShapePoints(shapes, selectedIds);

        expect(points).toHaveLength(0);
    });
});

describe('generateChainEndpoints', () => {
    const createTestChain = (id: string, shapes: ShapeData[]): ChainData => ({
        id,
        name: id,
        shapes,
    });

    const createLineShape = (
        id: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): ShapeData => ({
        id,
        type: GeometryType.LINE,
        geometry: {
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
        },
    });

    it('should generate endpoints for open chain', () => {
        const shapes: ShapeData[] = [
            createLineShape('line-1', 0, 0, 10, 0),
            createLineShape('line-2', 10, 0, 20, 0),
        ];
        const chains: ChainData[] = [createTestChain('chain-1', shapes)];

        const endpoints = generateChainEndpoints(chains);

        expect(endpoints).toHaveLength(2);
        expect(endpoints).toContainEqual({
            x: 0,
            y: 0,
            type: 'start',
            chainId: 'chain-1',
        });
        expect(endpoints).toContainEqual({
            x: 20,
            y: 0,
            type: 'end',
            chainId: 'chain-1',
        });
    });

    it('should generate single endpoint for closed chain', () => {
        const shapes: ShapeData[] = [
            createLineShape('line-1', 0, 0, 10, 0),
            createLineShape('line-2', 10, 0, 10, 10),
            createLineShape('line-3', 10, 10, 0, 10),
            createLineShape('line-4', 0, 10, 0, 0), // Closes the loop
        ];
        const chains: ChainData[] = [createTestChain('chain-1', shapes)];

        const endpoints = generateChainEndpoints(chains);

        expect(endpoints).toHaveLength(1); // Only start point since it's closed
        expect(endpoints[0]).toEqual({
            x: 0,
            y: 0,
            type: 'start',
            chainId: 'chain-1',
        });
    });

    it('should skip empty chains', () => {
        const chains: ChainData[] = [
            createTestChain('empty-chain', []),
            createTestChain('chain-1', [
                createLineShape('line-1', 0, 0, 10, 0),
            ]),
        ];

        const endpoints = generateChainEndpoints(chains);

        expect(endpoints).toHaveLength(2); // Only from chain-1
        expect(endpoints.every((e) => e.chainId === 'chain-1')).toBe(true);
    });

    it('should handle chains with single shape', () => {
        const shapes: ShapeData[] = [createLineShape('line-1', 0, 0, 10, 10)];
        const chains: ChainData[] = [createTestChain('chain-1', shapes)];

        const endpoints = generateChainEndpoints(chains);

        expect(endpoints).toHaveLength(2);
        expect(endpoints).toContainEqual({
            x: 0,
            y: 0,
            type: 'start',
            chainId: 'chain-1',
        });
        expect(endpoints).toContainEqual({
            x: 10,
            y: 10,
            type: 'end',
            chainId: 'chain-1',
        });
    });

    it('should handle multiple chains', () => {
        const chain1Shapes: ShapeData[] = [
            createLineShape('line-1', 0, 0, 10, 0),
        ];
        const chain2Shapes: ShapeData[] = [
            createLineShape('line-2', 20, 0, 30, 0),
        ];
        const chains: ChainData[] = [
            createTestChain('chain-1', chain1Shapes),
            createTestChain('chain-2', chain2Shapes),
        ];

        const endpoints = generateChainEndpoints(chains);

        expect(endpoints).toHaveLength(4); // 2 endpoints per chain
        expect(endpoints.filter((e) => e.chainId === 'chain-1')).toHaveLength(
            2
        );
        expect(endpoints.filter((e) => e.chainId === 'chain-2')).toHaveLength(
            2
        );
    });
});
