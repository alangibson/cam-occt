import { describe, it, expect } from 'vitest';
import { drawingStore } from './drawing';
import {
    createPolylineFromVertices,
    polylineToPoints,
    polylineToVertices,
} from '../geometry/polyline';
import type { Shape, Point2D, Drawing, Polyline } from '../../lib/types';

describe('Polyline Dragging Bug Fixes', () => {
    describe('moveShape function', () => {
        it('should move polylines with bulges correctly', () => {
            // Create a polyline with bulge data (similar to ADLER.dxf)
            const polylineShape: Shape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0.5 }, // Arc segment
                    { x: 100, y: 0, bulge: 0 }, // Straight segment
                    { x: 100, y: 100, bulge: 0 },
                ],
                false,
                {
                    id: 'test-polyline-1',
                    layer: '0',
                }
            );

            const delta: Point2D = { x: 50, y: 25 };

            // Set up the drawing store
            drawingStore.setDrawing({
                shapes: [polylineShape],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                units: 'mm',
            });

            // Move the polyline
            drawingStore.moveShapes([polylineShape.id], delta);

            // Get the updated drawing
            let updatedDrawing: Drawing | null = null;
            const unsubscribe = drawingStore.subscribe((state) => {
                updatedDrawing = state.drawing;
            });

            // Check that both points and vertices arrays were updated
            expect(updatedDrawing).not.toBeNull();
            const movedPolyline = updatedDrawing!.shapes[0];
            const geometry = movedPolyline.geometry;

            // Verify points array was moved
            const points = polylineToPoints(
                geometry as import('../types/geometry').Polyline
            );
            expect(points).toHaveLength(3);
            expect(points[0].x).toBeCloseTo(50, 10);
            expect(points[0].y).toBeCloseTo(25, 10);
            expect(points[1].x).toBeCloseTo(150, 10);
            expect(points[1].y).toBeCloseTo(25, 10);
            expect(points[2].x).toBeCloseTo(150, 10);
            expect(points[2].y).toBeCloseTo(125, 10);

            // Verify vertices array was moved (preserving bulge data)
            const vertices = polylineToVertices(
                geometry as import('../types/geometry').Polyline
            );
            expect(vertices).toHaveLength(3);
            expect(vertices[0].x).toBeCloseTo(50, 10);
            expect(vertices[0].y).toBeCloseTo(25, 10);
            expect(vertices[0].bulge).toBeCloseTo(0.5, 10);
            expect(vertices[1].x).toBeCloseTo(150, 10);
            expect(vertices[1].y).toBeCloseTo(25, 10);
            expect(vertices[1].bulge).toBeCloseTo(0, 10);
            expect(vertices[2].x).toBeCloseTo(150, 10);
            expect(vertices[2].y).toBeCloseTo(125, 10);
            expect(vertices[2].bulge).toBeCloseTo(0, 10);

            unsubscribe();
        });

        it('should handle polylines without vertices array', () => {
            // Create a simple polyline without bulge data
            const simplePolyline: Shape = createPolylineFromVertices(
                [
                    { x: 0, y: 0 },
                    { x: 50, y: 50 },
                ],
                false,
                {
                    id: 'test-polyline-2',
                    layer: '0',
                }
            );

            const delta: Point2D = { x: 10, y: 20 };

            drawingStore.setDrawing({
                shapes: [simplePolyline],
                bounds: { min: { x: 0, y: 0 }, max: { x: 50, y: 50 } },
                units: 'mm',
            });

            drawingStore.moveShapes([simplePolyline.id], delta);

            let updatedDrawing: Drawing | null = null;
            const unsubscribe = drawingStore.subscribe((state) => {
                updatedDrawing = state.drawing;
            });

            expect(updatedDrawing).not.toBeNull();
            const movedPolyline = updatedDrawing!.shapes[0];
            const geometry = movedPolyline.geometry;

            // Verify points array was moved
            const points = polylineToPoints(
                geometry as import('../types/geometry').Polyline
            );
            expect(points).toEqual([
                { x: 10, y: 20 },
                { x: 60, y: 70 },
            ]);

            // Verify vertices can still be obtained (will have bulge: 0 for all vertices)
            const vertices = polylineToVertices(
                geometry as import('../types/geometry').Polyline
            );
            expect(vertices).toEqual([
                { x: 10, y: 20, bulge: 0 },
                { x: 60, y: 70, bulge: 0 },
            ]);

            unsubscribe();
        });
    });

    describe('Scale and rotate operations', () => {
        it('should scale polylines with bulges correctly', () => {
            const polylineShape: Shape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 1.0 }, // Semicircle
                    { x: 100, y: 0, bulge: 0 },
                ],
                false,
                {
                    id: 'test-polyline-3',
                    layer: '0',
                }
            );

            const scaleFactor = 2.0;
            const origin: Point2D = { x: 0, y: 0 };

            drawingStore.setDrawing({
                shapes: [polylineShape],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
                units: 'mm',
            });

            drawingStore.scaleShapes([polylineShape.id], scaleFactor, origin);

            let updatedDrawing: Drawing | null = null;
            const unsubscribe = drawingStore.subscribe((state) => {
                updatedDrawing = state.drawing;
            });

            expect(updatedDrawing).not.toBeNull();
            const scaledPolyline = updatedDrawing!.shapes[0];
            const geometry = scaledPolyline.geometry;

            // Verify both arrays were scaled
            const points = polylineToPoints(
                geometry as import('../types/geometry').Polyline
            );
            expect(points).toHaveLength(2);
            expect(points[0].x).toBeCloseTo(0, 10);
            expect(points[0].y).toBeCloseTo(0, 10);
            expect(points[1].x).toBeCloseTo(200, 10);
            expect(points[1].y).toBeCloseTo(0, 10);

            const vertices = polylineToVertices(
                geometry as import('../types/geometry').Polyline
            );
            expect(vertices).toHaveLength(2);
            expect(vertices[0].x).toBeCloseTo(0, 10);
            expect(vertices[0].y).toBeCloseTo(0, 10);
            expect(vertices[0].bulge).toBeCloseTo(1.0, 10); // Bulge preserved
            expect(vertices[1].x).toBeCloseTo(200, 10);
            expect(vertices[1].y).toBeCloseTo(0, 10);
            expect(vertices[1].bulge).toBeCloseTo(0, 10);

            unsubscribe();
        });

        it('should rotate polylines with bulges correctly', () => {
            const polylineShape: Shape = createPolylineFromVertices(
                [
                    { x: 100, y: 0, bulge: 0.5 },
                    { x: 200, y: 0, bulge: 0 },
                ],
                false,
                {
                    id: 'test-polyline-4',
                    layer: '0',
                }
            );

            const angle: number = Math.PI / 2; // 90 degrees
            const origin: Point2D = { x: 0, y: 0 };

            drawingStore.setDrawing({
                shapes: [polylineShape],
                bounds: { min: { x: 100, y: 0 }, max: { x: 200, y: 0 } },
                units: 'mm',
            });

            drawingStore.rotateShapes([polylineShape.id], angle, origin);

            let updatedDrawing: Drawing | null = null;
            const unsubscribe = drawingStore.subscribe((state) => {
                updatedDrawing = state.drawing;
            });

            expect(updatedDrawing).not.toBeNull();
            const rotatedPolyline = updatedDrawing!.shapes[0];
            const geometry = rotatedPolyline.geometry;

            // After 90° rotation around origin, (100,0) becomes (0,100) and (200,0) becomes (0,200)
            const points = polylineToPoints(
                geometry as import('../types/geometry').Polyline
            );
            expect(points[0].x).toBeCloseTo(0, 5);
            expect(points[0].y).toBeCloseTo(100, 5);
            expect(points[1].x).toBeCloseTo(0, 5);
            expect(points[1].y).toBeCloseTo(200, 5);

            // Verify vertices array was also rotated with bulge preserved
            const vertices = polylineToVertices(
                geometry as import('../types/geometry').Polyline
            );
            expect(vertices[0].x).toBeCloseTo(0, 5);
            expect(vertices[0].y).toBeCloseTo(100, 5);
            expect(vertices[0].bulge).toBe(0.5);
            expect(vertices[1].x).toBeCloseTo(0, 5);
            expect(vertices[1].y).toBeCloseTo(200, 5);
            expect(vertices[1].bulge).toBe(0);

            unsubscribe();
        });
    });

    describe('Integration test', () => {
        it('should handle complete move/scale/rotate workflow for ADLER.dxf-like polylines', () => {
            // Simulate a complex polyline similar to what might be found in ADLER.dxf
            const complexPolyline: Shape = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0.2 }, // Slight arc
                    { x: 50, y: 0, bulge: -0.5 }, // CW arc
                    { x: 100, y: 50, bulge: 0 }, // Straight line
                    { x: 50, y: 100, bulge: 0.8 }, // Large CCW arc
                    { x: 0, y: 50, bulge: 0 }, // Closing straight line
                ],
                true,
                {
                    id: 'adler-like-polyline',
                    layer: 'PARTS',
                }
            );

            drawingStore.setDrawing({
                shapes: [complexPolyline],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                units: 'mm',
            });

            // Test 1: Move the polyline
            const moveDelta: Point2D = { x: 25, y: 15 };
            drawingStore.moveShapes([complexPolyline.id], moveDelta);

            let currentDrawing: Drawing | null = null;
            const unsubscribe = drawingStore.subscribe((state) => {
                currentDrawing = state.drawing;
            });

            let movedPolyline = currentDrawing!.shapes[0];

            // Verify all vertices moved correctly with bulges preserved
            const movedVertices = polylineToVertices(
                movedPolyline.geometry as Polyline
            );
            expect(movedVertices).toHaveLength(5);
            expect(movedVertices[0].x).toBeCloseTo(25, 10);
            expect(movedVertices[0].y).toBeCloseTo(15, 10);
            expect(movedVertices[0].bulge).toBeCloseTo(0.2, 10);
            expect(movedVertices[1].x).toBeCloseTo(75, 10);
            expect(movedVertices[1].y).toBeCloseTo(15, 10);
            expect(movedVertices[1].bulge).toBeCloseTo(-0.5, 10);
            expect(movedVertices[2].x).toBeCloseTo(125, 10);
            expect(movedVertices[2].y).toBeCloseTo(65, 10);
            expect(movedVertices[2].bulge).toBeCloseTo(0, 10);
            expect(movedVertices[3].x).toBeCloseTo(75, 10);
            expect(movedVertices[3].y).toBeCloseTo(115, 10);
            expect(movedVertices[3].bulge).toBeCloseTo(0.8, 10);
            expect(movedVertices[4].x).toBeCloseTo(25, 10);
            expect(movedVertices[4].y).toBeCloseTo(65, 10);
            expect(movedVertices[4].bulge).toBeCloseTo(0, 10);

            // Test 2: Scale the moved polyline
            const scaleFactor = 1.5;
            const scaleOrigin: Point2D = { x: 25, y: 15 }; // Use first vertex as origin
            drawingStore.scaleShapes(
                [complexPolyline.id],
                scaleFactor,
                scaleOrigin
            );

            movedPolyline = currentDrawing!.shapes[0];

            // First vertex should remain at origin, others should be scaled
            const scaledVertices = polylineToVertices(
                movedPolyline.geometry as Polyline
            );
            expect(scaledVertices[0].x).toBeCloseTo(25, 10);
            expect(scaledVertices[0].y).toBeCloseTo(15, 10);
            expect(scaledVertices[0].bulge).toBeCloseTo(0.2, 10);
            expect(scaledVertices[1].x).toBeCloseTo(100, 5); // 25 + (75-25)*1.5
            expect(scaledVertices[1].y).toBeCloseTo(15, 5); // 15 + (15-15)*1.5
            expect(scaledVertices[1].bulge).toBeCloseTo(-0.5, 10); // Bulge preserved

            // Test 3: Rotate the scaled polyline
            const rotateAngle = Math.PI / 4; // 45 degrees
            const rotateOrigin: Point2D = { x: 25, y: 15 };
            drawingStore.rotateShapes(
                [complexPolyline.id],
                rotateAngle,
                rotateOrigin
            );

            movedPolyline = currentDrawing!.shapes[0];

            // First vertex should remain at rotation origin
            const finalVertices = polylineToVertices(
                movedPolyline.geometry as Polyline
            );
            expect(finalVertices[0].x).toBeCloseTo(25, 5);
            expect(finalVertices[0].y).toBeCloseTo(15, 5);
            expect(finalVertices[0].bulge).toBeCloseTo(0.2, 10); // Bulge preserved

            // All bulge values should be preserved throughout transformations
            expect(finalVertices[0].bulge).toBeCloseTo(0.2, 10);
            expect(finalVertices[1].bulge).toBeCloseTo(-0.5, 10);
            expect(finalVertices[2].bulge).toBeCloseTo(0, 10);
            expect(finalVertices[3].bulge).toBeCloseTo(0.8, 10);
            expect(finalVertices[4].bulge).toBeCloseTo(0, 10);

            unsubscribe();
        });
    });
});
