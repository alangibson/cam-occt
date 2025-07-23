import { describe, it, expect } from 'vitest';
import { drawingStore } from './drawing';
import type { Shape, Point2D } from '../../types';

describe('Polyline Dragging Bug Fixes', () => {
  describe('moveShape function', () => {
    it('should move polylines with bulges correctly', () => {
      // Create a polyline with bulge data (similar to ADLER.dxf)
      const polylineShape: Shape = {
        id: 'test-polyline-1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 }
          ],
          closed: false,
          vertices: [
            { x: 0, y: 0, bulge: 0.5 },  // Arc segment
            { x: 100, y: 0, bulge: 0 },  // Straight segment
            { x: 100, y: 100, bulge: 0 }
          ]
        },
        layer: '0'
      };

      const delta: Point2D = { x: 50, y: 25 };

      // Set up the drawing store
      drawingStore.setDrawing({
        shapes: [polylineShape],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        units: 'mm'
      });

      // Move the polyline
      drawingStore.moveShapes([polylineShape.id], delta);

      // Get the updated drawing
      let updatedDrawing: any = null;
      const unsubscribe = drawingStore.subscribe(state => {
        updatedDrawing = state.drawing;
      });

      // Check that both points and vertices arrays were updated
      const movedPolyline = updatedDrawing.shapes[0];
      const geometry = movedPolyline.geometry;

      // Verify points array was moved
      expect(geometry.points).toEqual([
        { x: 50, y: 25 },
        { x: 150, y: 25 },
        { x: 150, y: 125 }
      ]);

      // Verify vertices array was moved (preserving bulge data)
      expect(geometry.vertices).toEqual([
        { x: 50, y: 25, bulge: 0.5 },
        { x: 150, y: 25, bulge: 0 },
        { x: 150, y: 125, bulge: 0 }
      ]);

      unsubscribe();
    });

    it('should handle polylines without vertices array', () => {
      // Create a simple polyline without bulge data
      const simplePolyline: Shape = {
        id: 'test-polyline-2',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 50 }
          ],
          closed: false
          // No vertices array
        },
        layer: '0'
      };

      const delta: Point2D = { x: 10, y: 20 };

      drawingStore.setDrawing({
        shapes: [simplePolyline],
        bounds: { min: { x: 0, y: 0 }, max: { x: 50, y: 50 } },
        units: 'mm'
      });

      drawingStore.moveShapes([simplePolyline.id], delta);

      let updatedDrawing: any = null;
      const unsubscribe = drawingStore.subscribe(state => {
        updatedDrawing = state.drawing;
      });

      const movedPolyline = updatedDrawing.shapes[0];
      const geometry = movedPolyline.geometry;

      // Verify points array was moved
      expect(geometry.points).toEqual([
        { x: 10, y: 20 },
        { x: 60, y: 70 }
      ]);

      // Verify vertices array remains undefined
      expect(geometry.vertices).toBeUndefined();

      unsubscribe();
    });
  });

  describe('Scale and rotate operations', () => {
    it('should scale polylines with bulges correctly', () => {
      const polylineShape: Shape = {
        id: 'test-polyline-3',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 }
          ],
          closed: false,
          vertices: [
            { x: 0, y: 0, bulge: 1.0 },  // Semicircle
            { x: 100, y: 0, bulge: 0 }
          ]
        },
        layer: '0'
      };

      const scaleFactor = 2.0;
      const origin: Point2D = { x: 0, y: 0 };

      drawingStore.setDrawing({
        shapes: [polylineShape],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
        units: 'mm'
      });

      drawingStore.scaleShapes([polylineShape.id], scaleFactor, origin);

      let updatedDrawing: any = null;
      const unsubscribe = drawingStore.subscribe(state => {
        updatedDrawing = state.drawing;
      });

      const scaledPolyline = updatedDrawing.shapes[0];
      const geometry = scaledPolyline.geometry;

      // Verify both arrays were scaled
      expect(geometry.points).toEqual([
        { x: 0, y: 0 },
        { x: 200, y: 0 }
      ]);

      expect(geometry.vertices).toEqual([
        { x: 0, y: 0, bulge: 1.0 },  // Bulge preserved
        { x: 200, y: 0, bulge: 0 }
      ]);

      unsubscribe();
    });

    it('should rotate polylines with bulges correctly', () => {
      const polylineShape: Shape = {
        id: 'test-polyline-4',
        type: 'polyline',
        geometry: {
          points: [
            { x: 100, y: 0 },
            { x: 200, y: 0 }
          ],
          closed: false,
          vertices: [
            { x: 100, y: 0, bulge: 0.5 },
            { x: 200, y: 0, bulge: 0 }
          ]
        },
        layer: '0'
      };

      const angle = Math.PI / 2; // 90 degrees
      const origin: Point2D = { x: 0, y: 0 };

      drawingStore.setDrawing({
        shapes: [polylineShape],
        bounds: { min: { x: 100, y: 0 }, max: { x: 200, y: 0 } },
        units: 'mm'
      });

      drawingStore.rotateShapes([polylineShape.id], angle, origin);

      let updatedDrawing: any = null;
      const unsubscribe = drawingStore.subscribe(state => {
        updatedDrawing = state.drawing;
      });

      const rotatedPolyline = updatedDrawing.shapes[0];
      const geometry = rotatedPolyline.geometry;

      // After 90° rotation around origin, (100,0) becomes (0,100) and (200,0) becomes (0,200)
      expect(geometry.points[0].x).toBeCloseTo(0, 5);
      expect(geometry.points[0].y).toBeCloseTo(100, 5);
      expect(geometry.points[1].x).toBeCloseTo(0, 5);
      expect(geometry.points[1].y).toBeCloseTo(200, 5);

      // Verify vertices array was also rotated with bulge preserved
      expect(geometry.vertices[0].x).toBeCloseTo(0, 5);
      expect(geometry.vertices[0].y).toBeCloseTo(100, 5);
      expect(geometry.vertices[0].bulge).toBe(0.5);
      expect(geometry.vertices[1].x).toBeCloseTo(0, 5);
      expect(geometry.vertices[1].y).toBeCloseTo(200, 5);
      expect(geometry.vertices[1].bulge).toBe(0);

      unsubscribe();
    });
  });

  describe('Integration test', () => {
    it('should handle complete move/scale/rotate workflow for ADLER.dxf-like polylines', () => {
      // Simulate a complex polyline similar to what might be found in ADLER.dxf
      const complexPolyline: Shape = {
        id: 'adler-like-polyline',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 0 },
            { x: 100, y: 50 },
            { x: 50, y: 100 },
            { x: 0, y: 50 }
          ],
          closed: true,
          vertices: [
            { x: 0, y: 0, bulge: 0.2 },     // Slight arc
            { x: 50, y: 0, bulge: -0.5 },   // CW arc  
            { x: 100, y: 50, bulge: 0 },    // Straight line
            { x: 50, y: 100, bulge: 0.8 },  // Large CCW arc
            { x: 0, y: 50, bulge: 0 }       // Closing straight line
          ]
        },
        layer: 'PARTS'
      };

      drawingStore.setDrawing({
        shapes: [complexPolyline],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        units: 'mm'
      });

      // Test 1: Move the polyline
      const moveDelta: Point2D = { x: 25, y: 15 };
      drawingStore.moveShapes([complexPolyline.id], moveDelta);

      let currentDrawing: any = null;
      const unsubscribe = drawingStore.subscribe(state => {
        currentDrawing = state.drawing;
      });

      let movedPolyline = currentDrawing.shapes[0];
      
      // Verify all vertices moved correctly with bulges preserved
      expect(movedPolyline.geometry.vertices).toEqual([
        { x: 25, y: 15, bulge: 0.2 },
        { x: 75, y: 15, bulge: -0.5 },
        { x: 125, y: 65, bulge: 0 },
        { x: 75, y: 115, bulge: 0.8 },
        { x: 25, y: 65, bulge: 0 }
      ]);

      // Test 2: Scale the moved polyline
      const scaleFactor = 1.5;
      const scaleOrigin: Point2D = { x: 25, y: 15 }; // Use first vertex as origin
      drawingStore.scaleShapes([complexPolyline.id], scaleFactor, scaleOrigin);

      movedPolyline = currentDrawing.shapes[0];
      
      // First vertex should remain at origin, others should be scaled
      expect(movedPolyline.geometry.vertices[0]).toEqual({ x: 25, y: 15, bulge: 0.2 });
      expect(movedPolyline.geometry.vertices[1].x).toBeCloseTo(100, 5); // 25 + (75-25)*1.5
      expect(movedPolyline.geometry.vertices[1].y).toBeCloseTo(15, 5);   // 15 + (15-15)*1.5
      expect(movedPolyline.geometry.vertices[1].bulge).toBe(-0.5); // Bulge preserved

      // Test 3: Rotate the scaled polyline
      const rotateAngle = Math.PI / 4; // 45 degrees
      const rotateOrigin: Point2D = { x: 25, y: 15 };
      drawingStore.rotateShapes([complexPolyline.id], rotateAngle, rotateOrigin);

      movedPolyline = currentDrawing.shapes[0];
      
      // First vertex should remain at rotation origin
      expect(movedPolyline.geometry.vertices[0].x).toBeCloseTo(25, 5);
      expect(movedPolyline.geometry.vertices[0].y).toBeCloseTo(15, 5);
      expect(movedPolyline.geometry.vertices[0].bulge).toBe(0.2); // Bulge preserved

      // All bulge values should be preserved throughout transformations
      const finalBulges = movedPolyline.geometry.vertices.map((v: any) => v.bulge);
      expect(finalBulges).toEqual([0.2, -0.5, 0, 0.8, 0]);

      unsubscribe();
    });
  });
});