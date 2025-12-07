import { describe, it, expect } from 'vitest';
import { Drawing } from './classes.svelte';
import type { DrawingData } from './interfaces';
import { Unit } from '$lib/config/units/units';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import { Shape } from '$lib/cam/shape/classes';

describe('Drawing class', () => {
    describe('toData()', () => {
        it('should serialize all DrawingData fields including fileName', () => {
            const drawingData: DrawingData = {
                shapes: [],
                units: Unit.MM,
                fileName: 'test-drawing.dxf',
            };

            const drawing = new Drawing(drawingData);

            const serialized = drawing.toData();

            expect(serialized).toEqual({
                shapes: [],
                units: Unit.MM,
                fileName: 'test-drawing.dxf',
            });
        });

        it('should include fileName even when modified after construction', () => {
            const drawingData: DrawingData = {
                shapes: [],
                units: Unit.MM,
                fileName: '',
            };

            const drawing = new Drawing(drawingData);
            drawing.fileName = 'modified-name.dxf';

            const serialized = drawing.toData();

            expect(serialized.fileName).toBe('modified-name.dxf');
        });

        it('should handle missing fileName gracefully', () => {
            const drawingData: DrawingData = {
                shapes: [],
                units: Unit.MM,
                fileName: '',
            };

            const drawing = new Drawing(drawingData);

            const serialized = drawing.toData();

            expect(serialized.fileName).toBe('');
        });

        it('should serialize current shapes from layers, not original stale data', () => {
            // Create a drawing with a line shape at specific coordinates
            const originalShapeData: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                layer: '0',
                geometry: {
                    start: { x: 10, y: 20 },
                    end: { x: 30, y: 40 },
                },
            };

            const drawingData: DrawingData = {
                shapes: [originalShapeData],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const drawing = new Drawing(drawingData);

            // Modify the shape via layer.shapes (simulating what auto-preprocessing does)
            const layer = drawing.layers['0'];
            const modifiedShapeData: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                layer: '0',
                geometry: {
                    start: { x: 100, y: 200 },
                    end: { x: 300, y: 400 },
                },
            };
            layer.shapes = [new Shape(modifiedShapeData)];

            // Serialize and verify it returns the MODIFIED shapes, not the original
            const serialized = drawing.toData();

            expect(serialized.shapes).toHaveLength(1);
            const serializedLine = serialized.shapes[0].geometry as Line;
            expect(serializedLine.start).toEqual({ x: 100, y: 200 });
            expect(serializedLine.end).toEqual({ x: 300, y: 400 });

            // Verify it's NOT the original coordinates
            expect(serializedLine.start).not.toEqual({ x: 10, y: 20 });
            expect(serializedLine.end).not.toEqual({ x: 30, y: 40 });
        });
    });
});
