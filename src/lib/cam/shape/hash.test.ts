import { describe, it, expect } from 'vitest';
import { Shape } from './classes';
import { hashShape } from './functions';
import type { ShapeData } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { generateId } from '$lib/domain/id';

describe('Shape Hash Functions', () => {
    describe('hashShape', () => {
        it('should produce same hash for identical point shapes', async () => {
            const shape1 = new Shape({
                id: 'test-1',
                type: GeometryType.POINT,
                geometry: { x: 1, y: 2 },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: 'test-2',
                type: GeometryType.POINT,
                geometry: { x: 1, y: 2 },
                layer: 'test',
            });

            const hash1 = await hashShape(shape1);
            const hash2 = await hashShape(shape2);

            expect(hash1).toBe(hash2);
        });

        it('should produce same hash for identical line shapes', async () => {
            const shape1 = new Shape({
                id: 'test-1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: 'test-2',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'test',
            });

            const hash1 = await hashShape(shape1);
            const hash2 = await hashShape(shape2);

            expect(hash1).toBe(hash2);
        });

        it('should produce same hash for identical circle shapes', async () => {
            const shape1 = new Shape({
                id: 'test-1',
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: 'test-2',
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'test',
            });

            const hash1 = await hashShape(shape1);
            const hash2 = await hashShape(shape2);

            expect(hash1).toBe(hash2);
        });

        it('should produce same hash for identical arc shapes', async () => {
            const shape1 = new Shape({
                id: 'test-1',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: 'test-2',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
                layer: 'test',
            });

            const hash1 = await hashShape(shape1);
            const hash2 = await hashShape(shape2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different geometry', async () => {
            const shape1 = new Shape({
                id: 'test-1',
                type: GeometryType.POINT,
                geometry: { x: 1, y: 2 },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: 'test-2',
                type: GeometryType.POINT,
                geometry: { x: 1, y: 3 },
                layer: 'test',
            });

            const hash1 = await hashShape(shape1);
            const hash2 = await hashShape(shape2);

            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hashes for different shape types', async () => {
            const shape1 = new Shape({
                id: 'test-1',
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: 'test-2',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
                layer: 'test',
            });

            const hash1 = await hashShape(shape1);
            const hash2 = await hashShape(shape2);

            expect(hash1).not.toBe(hash2);
        });

        it('should return 64-character hex string', async () => {
            const shape = new Shape({
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'test',
            });

            const hash = await hashShape(shape);

            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('Shape.hash()', () => {
        it('should produce same hash as hashShape function', async () => {
            const shape = new Shape({
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'test',
            });

            const hash1 = await shape.hash();
            const hash2 = await hashShape(shape);

            expect(hash1).toBe(hash2);
        });

        it('should be deterministic - same shape produces same hash', async () => {
            const shapeData: ShapeData = {
                id: generateId(),
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                layer: 'test',
            };

            const shape1 = new Shape(shapeData);
            const shape2 = new Shape(shapeData);

            const hash1 = await shape1.hash();
            const hash2 = await shape2.hash();

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for modified geometry', async () => {
            const shape1 = new Shape({
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 5 },
                layer: 'test',
            });
            const shape2 = new Shape({
                id: generateId(),
                type: GeometryType.CIRCLE,
                geometry: { center: { x: 0, y: 0 }, radius: 10 },
                layer: 'test',
            });

            const hash1 = await shape1.hash();
            const hash2 = await shape2.hash();

            expect(hash1).not.toBe(hash2);
        });

        it('should work with ellipse shapes', async () => {
            const shape = new Shape({
                id: generateId(),
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    majorAxisEndpoint: { x: 10, y: 0 },
                    minorToMajorRatio: 0.5,
                },
                layer: 'test',
            });

            const hash = await shape.hash();

            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should work with polyline shapes', async () => {
            const shape = new Shape({
                id: generateId(),
                type: GeometryType.POLYLINE,
                geometry: {
                    closed: false,
                    shapes: [],
                },
                layer: 'test',
            });

            const hash = await shape.hash();

            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should work with spline shapes', async () => {
            const shape = new Shape({
                id: generateId(),
                type: GeometryType.SPLINE,
                geometry: {
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 10, y: 10 },
                    ],
                    knots: [0, 0, 1, 1],
                    weights: [1, 1],
                    degree: 1,
                    fitPoints: [],
                    closed: false,
                },
                layer: 'test',
            });

            const hash = await shape.hash();

            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });
});
