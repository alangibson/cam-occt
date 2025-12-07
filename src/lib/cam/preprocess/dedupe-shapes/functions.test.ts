import { describe, it, expect } from 'vitest';
import { deduplicateShapes } from './functions';
import { GeometryType } from '$lib/geometry/enums';
import { generateId } from '$lib/domain/id';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';

describe('deduplicateShapes', () => {
    it('should remove exact duplicate shapes within same layer', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 10, y: 10 }, radius: 3 },
                layer: 'layer1',
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(2);
        expect(result[0].toData()).toEqual(shapes[0]);
        expect(result[1].toData()).toEqual(shapes[2]);
    });

    it('should not deduplicate across different layers', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer2',
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(2);
        expect(result[0].toData()).toEqual(shapes[0]);
        expect(result[1].toData()).toEqual(shapes[1]);
    });

    it('should preserve order of first occurrence', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 5, y: 5 }, radius: 2 },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'layer1',
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(2);
        expect(result[0].toData()).toEqual(shapes[0]);
        expect(result[1].toData()).toEqual(shapes[1]);
    });

    it('should handle empty array', async () => {
        const result = await deduplicateShapes([]);
        expect(result).toHaveLength(0);
    });

    it('should handle single shape', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(1);
        expect(result[0].toData()).toEqual(shapes[0]);
    });

    it('should handle shapes without layer property', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(1);
    });

    it('should handle multiple duplicates', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'layer1',
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(1);
        expect(result[0].toData()).toEqual(shapes[0]);
    });

    it('should handle different geometry types', async () => {
        const shapes: ShapeData[] = [
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 5, y: 5 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
                layer: 'layer1',
            },
            {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'layer1',
            },
        ];

        const result = await deduplicateShapes(shapes.map((s) => new Shape(s)));

        expect(result).toHaveLength(2);
        expect(result[0].type).toBe(GeometryType.LINE);
        expect(result[1].type).toBe(GeometryType.ARC);
    });
});
