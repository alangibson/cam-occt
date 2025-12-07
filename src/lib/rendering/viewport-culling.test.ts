import { describe, expect, it, vi } from 'vitest';
import {
    type ShapeBounds,
    type ViewportBounds,
    calculateShapeBounds,
    calculateViewportBounds,
    cullShapesToViewport,
    isShapeInViewport,
} from './viewport-culling';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import { shapeBoundingBox } from '$lib/cam/shape/functions';

// Mock the bounding box function
vi.mock('$lib/cam/shape/functions', () => ({
    shapeBoundingBox: vi.fn(),
}));

describe('viewport-culling', () => {
    describe('calculateShapeBounds', () => {
        it('should convert bounding box to shape bounds format', async () => {
            const mockBoundingBox: BoundingBoxData = {
                min: { x: -5, y: -3 },
                max: { x: 15, y: 12 },
            };

            vi.mocked(shapeBoundingBox).mockReturnValue(mockBoundingBox);

            const shape: ShapeData = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -5, y: -3 },
                    end: { x: 15, y: 12 },
                } as Line,
            };

            const result = calculateShapeBounds(shape);

            expect(result).toEqual({
                minX: -5,
                maxX: 15,
                minY: -3,
                maxY: 12,
            });
        });

        it('should handle bounding box calculation errors', async () => {
            vi.mocked(shapeBoundingBox).mockImplementation(() => {
                throw new Error('Bounding box calculation failed');
            });

            const shape: ShapeData = {
                id: 'invalid-shape',
                type: GeometryType.LINE,
                geometry: {} as Line,
            };

            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = calculateShapeBounds(shape);

            expect(result).toEqual({
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0,
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Failed to calculate bounds for shape invalid-shape'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('isShapeInViewport', () => {
        const shapeBounds: ShapeBounds = {
            minX: 10,
            maxX: 20,
            minY: 5,
            maxY: 15,
        };

        const viewport: ViewportBounds = {
            minX: 0,
            maxX: 30,
            minY: 0,
            maxY: 25,
        };

        it('should return true when shape is completely inside viewport', () => {
            const result = isShapeInViewport(shapeBounds, viewport);
            expect(result).toBe(true);
        });

        it('should return true when shape partially overlaps viewport', () => {
            const partialViewport: ViewportBounds = {
                minX: 15, // Overlaps with shape maxX=20
                maxX: 50,
                minY: 10, // Overlaps with shape maxY=15
                maxY: 30,
            };

            const result = isShapeInViewport(shapeBounds, partialViewport);
            expect(result).toBe(true);
        });

        it('should return false when shape is completely outside viewport', () => {
            const outsideViewport: ViewportBounds = {
                minX: 50, // Shape maxX=20, no overlap
                maxX: 80,
                minY: 50, // Shape maxY=15, no overlap
                maxY: 80,
            };

            const result = isShapeInViewport(shapeBounds, outsideViewport);
            expect(result).toBe(false);
        });

        it('should handle margin correctly for inclusion', () => {
            const tightViewport: ViewportBounds = {
                minX: 25, // Shape maxX=20, outside by 5 units
                maxX: 50,
                minY: 20, // Shape maxY=15, outside by 5 units
                maxY: 50,
            };

            // Without margin - should be outside
            expect(isShapeInViewport(shapeBounds, tightViewport, 0)).toBe(
                false
            );

            // With sufficient margin - should be inside
            expect(isShapeInViewport(shapeBounds, tightViewport, 10)).toBe(
                true
            );
        });

        it('should handle edge cases where shape exactly touches viewport boundary', () => {
            const touchingViewport: ViewportBounds = {
                minX: 20, // Exactly at shape maxX
                maxX: 50,
                minY: 15, // Exactly at shape maxY
                maxY: 50,
            };

            const result = isShapeInViewport(shapeBounds, touchingViewport);
            expect(result).toBe(true); // Algorithm considers touching as intersecting
        });

        it('should return true when shape contains viewport', () => {
            const smallViewport: ViewportBounds = {
                minX: 12,
                maxX: 18,
                minY: 7,
                maxY: 13,
            };

            const result = isShapeInViewport(shapeBounds, smallViewport);
            expect(result).toBe(true);
        });
    });

    describe('calculateViewportBounds', () => {
        it('should calculate correct viewport bounds for standard setup', () => {
            const result = calculateViewportBounds(
                800, // canvasWidth
                600, // canvasHeight
                1.0, // scale
                { x: 0, y: 0 }, // offset
                1.0 // physicalScale
            );

            // Origin should be at 25% from left (200px), 75% from top (450px)
            // Top-left world coordinates: (0 - 200) / 1 = -200, -(0 - 450) / 1 = 450
            // Bottom-right world coordinates: (800 - 200) / 1 = 600, -(600 - 450) / 1 = -150

            expect(result).toEqual({
                minX: -200,
                maxX: 600,
                minY: -150,
                maxY: 450,
            });
        });

        it('should handle zoom scaling correctly', () => {
            const result = calculateViewportBounds(
                800,
                600,
                2.0, // 2x zoom
                { x: 0, y: 0 },
                1.0
            );

            // With 2x zoom, world coordinates are halved
            expect(result).toEqual({
                minX: -100,
                maxX: 300,
                minY: -75,
                maxY: 225,
            });
        });

        it('should handle pan offset correctly', () => {
            const result = calculateViewportBounds(
                800,
                600,
                1.0,
                { x: 100, y: -50 }, // Pan offset
                1.0
            );

            // Origin shifts by offset: (200 + 100, 450 - 50) = (300, 400)
            expect(result).toEqual({
                minX: -300,
                maxX: 500,
                minY: -200,
                maxY: 400,
            });
        });

        it('should handle physical scaling correctly', () => {
            const result = calculateViewportBounds(
                800,
                600,
                1.0,
                { x: 0, y: 0 },
                2.0 // 2x physical scale
            );

            // With 2x physical scale, total scale is 2x
            expect(result).toEqual({
                minX: -100,
                maxX: 300,
                minY: -75,
                maxY: 225,
            });
        });

        it('should handle combined scaling and offset', () => {
            const result = calculateViewportBounds(
                400, // Smaller canvas
                300,
                1.5, // Zoom
                { x: -25, y: 10 }, // Offset
                0.5 // Physical scale
            );

            const totalScale = 1.5 * 0.5; // 0.75
            const originX = 400 * 0.25 - 25; // 75
            const originY = 300 * 0.75 + 10; // 235

            expect(result).toEqual({
                minX: (0 - originX) / totalScale,
                maxX: (400 - originX) / totalScale,
                minY: -((300 - originY) / totalScale),
                maxY: -((0 - originY) / totalScale),
            });
        });
    });

    describe('cullShapesToViewport', () => {
        const viewport: ViewportBounds = {
            minX: 0,
            maxX: 100,
            minY: 0,
            maxY: 100,
        };

        it('should return all shapes when all are visible', async () => {
            // Mock all shapes to be within viewport
            vi.mocked(shapeBoundingBox)
                .mockReturnValueOnce({
                    min: { x: 10, y: 10 },
                    max: { x: 20, y: 20 },
                })
                .mockReturnValueOnce({
                    min: { x: 30, y: 30 },
                    max: { x: 40, y: 40 },
                })
                .mockReturnValueOnce({
                    min: { x: 50, y: 50 },
                    max: { x: 60, y: 60 },
                });

            const shapes: ShapeData[] = [
                { id: '1', type: GeometryType.CIRCLE, geometry: {} as Circle },
                { id: '2', type: GeometryType.CIRCLE, geometry: {} as Circle },
                { id: '3', type: GeometryType.CIRCLE, geometry: {} as Circle },
            ];

            const result = cullShapesToViewport(shapes, viewport);

            expect(result.visibleShapes).toHaveLength(3);
            expect(result.culledCount).toBe(0);
            expect(result.visibleShapes).toEqual(shapes);
        });

        it('should cull shapes outside viewport', async () => {
            // First shape inside, second outside, third inside
            vi.mocked(shapeBoundingBox)
                .mockReturnValueOnce({
                    min: { x: 10, y: 10 },
                    max: { x: 20, y: 20 },
                }) // Inside
                .mockReturnValueOnce({
                    min: { x: 200, y: 200 },
                    max: { x: 210, y: 210 },
                }) // Outside
                .mockReturnValueOnce({
                    min: { x: 80, y: 80 },
                    max: { x: 90, y: 90 },
                }); // Inside

            const shapes: ShapeData[] = [
                { id: '1', type: GeometryType.CIRCLE, geometry: {} as Circle },
                { id: '2', type: GeometryType.CIRCLE, geometry: {} as Circle },
                { id: '3', type: GeometryType.CIRCLE, geometry: {} as Circle },
            ];

            const result = cullShapesToViewport(shapes, viewport);

            expect(result.visibleShapes).toHaveLength(2);
            expect(result.culledCount).toBe(1);
            expect(result.visibleShapes[0].id).toBe('1');
            expect(result.visibleShapes[1].id).toBe('3');
        });

        it('should respect margin parameter', async () => {
            // Shape just outside viewport by 40 units
            vi.mocked(shapeBoundingBox).mockReturnValue({
                min: { x: 120, y: 120 },
                max: { x: 130, y: 130 },
            });

            const shapes: ShapeData[] = [
                { id: '1', type: GeometryType.CIRCLE, geometry: {} as Circle },
            ];

            // Without margin - should be culled
            const resultNoMargin = cullShapesToViewport(shapes, viewport, 0);
            expect(resultNoMargin.visibleShapes).toHaveLength(0);
            expect(resultNoMargin.culledCount).toBe(1);

            // With sufficient margin - should be visible
            const resultWithMargin = cullShapesToViewport(shapes, viewport, 50);
            expect(resultWithMargin.visibleShapes).toHaveLength(1);
            expect(resultWithMargin.culledCount).toBe(0);
        });

        it('should handle empty shape array', () => {
            const result = cullShapesToViewport([], viewport);

            expect(result.visibleShapes).toHaveLength(0);
            expect(result.culledCount).toBe(0);
        });

        it('should handle shapes with bounding box errors gracefully', async () => {
            vi.mocked(shapeBoundingBox)
                .mockImplementationOnce(() => {
                    throw new Error('Bounding box error');
                })
                .mockReturnValueOnce({
                    min: { x: 10, y: 10 },
                    max: { x: 20, y: 20 },
                });

            const shapes: ShapeData[] = [
                { id: '1', type: GeometryType.CIRCLE, geometry: {} as Circle },
                { id: '2', type: GeometryType.CIRCLE, geometry: {} as Circle },
            ];

            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = cullShapesToViewport(shapes, viewport);

            // First shape should be treated as having 0,0,0,0 bounds (visible)
            // Second shape should be normally processed
            expect(result.visibleShapes).toHaveLength(2);
            expect(result.culledCount).toBe(0);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should maintain shape order in visible shapes', async () => {
            // All shapes visible but in specific order
            vi.mocked(shapeBoundingBox)
                .mockReturnValueOnce({
                    min: { x: 10, y: 10 },
                    max: { x: 20, y: 20 },
                })
                .mockReturnValueOnce({
                    min: { x: 30, y: 30 },
                    max: { x: 40, y: 40 },
                })
                .mockReturnValueOnce({
                    min: { x: 50, y: 50 },
                    max: { x: 60, y: 60 },
                });

            const shapes: ShapeData[] = [
                {
                    id: 'first',
                    type: GeometryType.CIRCLE,
                    geometry: {} as Circle,
                },
                {
                    id: 'second',
                    type: GeometryType.CIRCLE,
                    geometry: {} as Circle,
                },
                {
                    id: 'third',
                    type: GeometryType.CIRCLE,
                    geometry: {} as Circle,
                },
            ];

            const result = cullShapesToViewport(shapes, viewport);

            expect(result.visibleShapes.map((s) => s.id)).toEqual([
                'first',
                'second',
                'third',
            ]);
        });
    });
});
