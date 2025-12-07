import { describe, it, expect } from 'vitest';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Chain } from './classes.svelte';

describe('Chain.clone()', () => {
    it('should create a new chain with a different ID', () => {
        const lineShape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Test Chain',
            shapes: [lineShape],
            clockwise: true,
        });

        const clonedChain = originalChain.clone();

        expect(clonedChain.id).not.toBe(originalChain.id);
        expect(clonedChain.id).toBeDefined();
    });

    it('should preserve chain name', () => {
        const lineShape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'My Special Chain',
            shapes: [lineShape],
        });

        const clonedChain = originalChain.clone();

        expect(clonedChain.name).toBe('My Special Chain');
    });

    it('should preserve clockwise property', () => {
        const lineShape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const clockwiseChain = new Chain({
            id: 'chain-1',
            name: 'CW Chain',
            shapes: [lineShape],
            clockwise: true,
        });

        const counterClockwiseChain = new Chain({
            id: 'chain-2',
            name: 'CCW Chain',
            shapes: [lineShape],
            clockwise: false,
        });

        const nullChain = new Chain({
            id: 'chain-3',
            name: 'Null Chain',
            shapes: [lineShape],
            clockwise: null,
        });

        expect(clockwiseChain.clone().clockwise).toBe(true);
        expect(counterClockwiseChain.clone().clockwise).toBe(false);
        expect(nullChain.clone().clockwise).toBe(null);
    });

    it('should preserve originalChainId property', () => {
        const lineShape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Test Chain',
            shapes: [lineShape],
            originalChainId: 'original-chain-id-123',
        });

        const clonedChain = originalChain.clone();

        expect(clonedChain.originalChainId).toBe('original-chain-id-123');
    });

    it('should deep clone all shapes preserving IDs by default', () => {
        const shape1: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const shape2: ShapeData = {
            id: 'shape-2',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 100, y: 50 },
                radius: 50,
                startAngle: -Math.PI / 2,
                endAngle: 0,
                clockwise: true,
            } as Arc,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Multi-Shape Chain',
            shapes: [shape1, shape2],
        });

        const clonedChain = originalChain.clone();

        // Verify number of shapes
        expect(clonedChain.shapes).toHaveLength(2);

        // Verify shapes preserve original IDs by default
        expect(clonedChain.shapes[0].id).toBe('shape-1');
        expect(clonedChain.shapes[1].id).toBe('shape-2');

        // Verify shapes are different instances (deep cloned)
        expect(clonedChain.shapes[0]).not.toBe(originalChain.shapes[0]);
        expect(clonedChain.shapes[1]).not.toBe(originalChain.shapes[1]);
    });

    it('should generate new shape IDs when preserveShapeIds is false', () => {
        const shape1: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const shape2: ShapeData = {
            id: 'shape-2',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 100, y: 50 },
                radius: 50,
                startAngle: -Math.PI / 2,
                endAngle: 0,
                clockwise: true,
            } as Arc,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Multi-Shape Chain',
            shapes: [shape1, shape2],
        });

        const clonedChain = originalChain.clone(false);

        // Verify number of shapes
        expect(clonedChain.shapes).toHaveLength(2);

        // Verify shapes have new IDs
        expect(clonedChain.shapes[0].id).not.toBe('shape-1');
        expect(clonedChain.shapes[1].id).not.toBe('shape-2');

        // Verify shapes are different instances
        expect(clonedChain.shapes[0]).not.toBe(originalChain.shapes[0]);
        expect(clonedChain.shapes[1]).not.toBe(originalChain.shapes[1]);
    });

    it('should deep clone shape geometry data', () => {
        const lineShape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 10, y: 20 },
                end: { x: 30, y: 40 },
            } as Line,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Test Chain',
            shapes: [lineShape],
        });

        const clonedChain = originalChain.clone();

        // Verify geometry values are copied
        const clonedGeometry = clonedChain.shapes[0].geometry as Line;
        expect(clonedGeometry.start.x).toBe(10);
        expect(clonedGeometry.start.y).toBe(20);
        expect(clonedGeometry.end.x).toBe(30);
        expect(clonedGeometry.end.y).toBe(40);

        // Modify cloned geometry
        clonedGeometry.start.x = 999;

        // Verify original is unchanged
        const originalGeometry = originalChain.shapes[0].geometry as Line;
        expect(originalGeometry.start.x).toBe(10);
    });

    it('should preserve shape layer information', () => {
        const shape1: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
            layer: 'Layer1',
        };

        const shape2: ShapeData = {
            id: 'shape-2',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 0, y: 100 },
            } as Line,
            layer: 'Layer2',
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Layered Chain',
            shapes: [shape1, shape2],
        });

        const clonedChain = originalChain.clone();

        expect(clonedChain.shapes[0].layer).toBe('Layer1');
        expect(clonedChain.shapes[1].layer).toBe('Layer2');
    });

    it('should handle chains with single shape', () => {
        const circleShape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 50, y: 50 },
                radius: 25,
            },
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Single Shape',
            shapes: [circleShape],
        });

        const clonedChain = originalChain.clone();

        expect(clonedChain.shapes).toHaveLength(1);
        expect(clonedChain.shapes[0].id).toBe('shape-1'); // Preserves ID by default
        expect(clonedChain.shapes[0].type).toBe(GeometryType.CIRCLE);
    });

    it('should handle chains with many shapes', () => {
        const shapes: ShapeData[] = [];
        for (let i = 0; i < 10; i++) {
            shapes.push({
                id: `shape-${i}`,
                type: GeometryType.LINE,
                geometry: {
                    start: { x: i * 10, y: 0 },
                    end: { x: i * 10 + 10, y: 0 },
                } as Line,
            });
        }

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Many Shapes',
            shapes,
        });

        const clonedChain = originalChain.clone();

        expect(clonedChain.shapes).toHaveLength(10);

        // Verify all shapes preserve IDs by default
        for (let i = 0; i < 10; i++) {
            expect(clonedChain.shapes[i].id).toBe(`shape-${i}`);
        }

        // Verify shapes are independent (geometry is deep cloned)
        (clonedChain.shapes[5].geometry as Line).start.x = 999;
        expect((originalChain.shapes[5].geometry as Line).start.x).toBe(50);
    });

    it('should create independent chain instances', () => {
        const shape: ShapeData = {
            id: 'shape-1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const originalChain = new Chain({
            id: 'chain-1',
            name: 'Original',
            shapes: [shape],
            clockwise: true,
        });

        const clonedChain = originalChain.clone();

        // Verify chains are independent by checking toData() returns different objects
        const originalData = originalChain.toData();
        const clonedData = clonedChain.toData();

        // Chain has new ID
        expect(originalData.id).not.toBe(clonedData.id);
        // Shapes preserve IDs by default
        expect(originalData.shapes[0].id).toBe(clonedData.shapes[0].id);

        // But geometry is deep cloned - verify independence
        (clonedChain.shapes[0].geometry as Line).start.x = 999;
        expect((originalChain.shapes[0].geometry as Line).start.x).toBe(0);
    });
});
