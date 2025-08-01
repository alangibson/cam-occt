import { describe, it, expect, beforeEach } from 'vitest';
import { CoordinateTransformer } from './CoordinateTransformer';
import type { Point2D } from '../../types/geometry';

describe('CoordinateTransformer', () => {
  let transformer: CoordinateTransformer;
  const canvas = { width: 800, height: 600 };
  
  beforeEach(() => {
    transformer = new CoordinateTransformer(canvas, 1, { x: 0, y: 0 });
  });

  describe('Fixed Origin Position', () => {
    it('should position origin at 25% from left, 75% from top', () => {
      const worldOrigin = { x: 0, y: 0 };
      const screenOrigin = transformer.worldToScreen(worldOrigin);
      
      expect(screenOrigin.x).toBe(canvas.width * 0.25); // 200
      expect(screenOrigin.y).toBe(canvas.height * 0.75); // 450
    });

    it('should maintain origin position when canvas resizes', () => {
      const worldOrigin = { x: 0, y: 0 };
      
      // Original canvas
      const screenOrigin1 = transformer.worldToScreen(worldOrigin);
      expect(screenOrigin1.x).toBe(200);
      expect(screenOrigin1.y).toBe(450);
      
      // Resized canvas
      const resizedCanvas = { width: 1200, height: 800 };
      const transformer2 = new CoordinateTransformer(resizedCanvas, 1, { x: 0, y: 0 });
      const screenOrigin2 = transformer2.worldToScreen(worldOrigin);
      
      expect(screenOrigin2.x).toBe(resizedCanvas.width * 0.25); // 300
      expect(screenOrigin2.y).toBe(resizedCanvas.height * 0.75); // 600
    });
  });

  describe('Screen to World Transformation', () => {
    it('should convert screen origin to world origin', () => {
      const screenPoint = { x: 200, y: 450 }; // Screen origin
      const worldPoint = transformer.screenToWorld(screenPoint);
      
      expect(worldPoint.x).toBeCloseTo(0);
      expect(worldPoint.y).toBeCloseTo(0);
    });

    it('should handle Y-axis flip correctly', () => {
      const screenPoint = { x: 200, y: 350 }; // 100 pixels above origin
      const worldPoint = transformer.screenToWorld(screenPoint);
      
      expect(worldPoint.x).toBeCloseTo(0);
      expect(worldPoint.y).toBeCloseTo(100); // Positive Y in world space
    });

    it('should apply scale correctly', () => {
      const transformer2x = new CoordinateTransformer(canvas, 2, { x: 0, y: 0 });
      const screenPoint = { x: 300, y: 450 }; // 100 pixels right of origin
      const worldPoint = transformer2x.screenToWorld(screenPoint);
      
      expect(worldPoint.x).toBeCloseTo(50); // 100 / 2
      expect(worldPoint.y).toBeCloseTo(0);
    });

    it('should apply offset correctly', () => {
      const transformerOffset = new CoordinateTransformer(canvas, 1, { x: 50, y: -50 });
      const screenPoint = { x: 250, y: 400 }; // Origin shifted by offset
      const worldPoint = transformerOffset.screenToWorld(screenPoint);
      
      expect(worldPoint.x).toBeCloseTo(0);
      expect(worldPoint.y).toBeCloseTo(0);
    });

    it('should handle physical scale factor', () => {
      const transformerPhys = new CoordinateTransformer(canvas, 1, { x: 0, y: 0 }, 2);
      const screenPoint = { x: 400, y: 450 }; // 200 pixels right of origin
      const worldPoint = transformerPhys.screenToWorld(screenPoint);
      
      expect(worldPoint.x).toBeCloseTo(100); // 200 / 2
      expect(worldPoint.y).toBeCloseTo(0);
    });
  });

  describe('World to Screen Transformation', () => {
    it('should be inverse of screenToWorld', () => {
      const worldPoint = { x: 50, y: -30 };
      const screenPoint = transformer.worldToScreen(worldPoint);
      const worldPointBack = transformer.screenToWorld(screenPoint);
      
      expect(worldPointBack.x).toBeCloseTo(worldPoint.x);
      expect(worldPointBack.y).toBeCloseTo(worldPoint.y);
    });

    it('should handle negative world coordinates', () => {
      const worldPoint = { x: -100, y: -50 };
      const screenPoint = transformer.worldToScreen(worldPoint);
      
      expect(screenPoint.x).toBe(100); // 200 - 100
      expect(screenPoint.y).toBe(500); // 450 + 50
    });

    it('should apply combined scale correctly', () => {
      const transformer3x = new CoordinateTransformer(canvas, 3, { x: 0, y: 0 }, 2);
      const worldPoint = { x: 10, y: 10 };
      const screenPoint = transformer3x.worldToScreen(worldPoint);
      
      expect(screenPoint.x).toBe(260); // 200 + 10 * 6
      expect(screenPoint.y).toBe(390); // 450 - 10 * 6
    });
  });

  describe('World to Canvas Transformation', () => {
    it('should only flip Y-axis', () => {
      const worldPoint = { x: 50, y: 30 };
      const canvasPoint = transformer.worldToCanvas(worldPoint);
      
      expect(canvasPoint.x).toBe(50);
      expect(canvasPoint.y).toBe(-30);
    });

    it('should handle negative Y coordinates', () => {
      const worldPoint = { x: 25, y: -40 };
      const canvasPoint = transformer.worldToCanvas(worldPoint);
      
      expect(canvasPoint.x).toBe(25);
      expect(canvasPoint.y).toBe(40);
    });
  });

  describe('Canvas to World Transformation', () => {
    it('should be inverse of worldToCanvas', () => {
      const canvasPoint = { x: 75, y: -25 };
      const worldPoint = transformer.canvasToWorld(canvasPoint);
      const canvasPointBack = transformer.worldToCanvas(worldPoint);
      
      expect(canvasPointBack.x).toBeCloseTo(canvasPoint.x);
      expect(canvasPointBack.y).toBeCloseTo(canvasPoint.y);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero scale gracefully', () => {
      // This should be prevented in the implementation
      const transformerZero = new CoordinateTransformer(canvas, 0.01, { x: 0, y: 0 });
      const worldPoint = { x: 1, y: 1 };
      const screenPoint = transformerZero.worldToScreen(worldPoint);
      
      expect(Number.isFinite(screenPoint.x)).toBe(true);
      expect(Number.isFinite(screenPoint.y)).toBe(true);
    });

    it('should handle very large coordinates', () => {
      const worldPoint = { x: 1e6, y: -1e6 };
      const screenPoint = transformer.worldToScreen(worldPoint);
      const worldPointBack = transformer.screenToWorld(screenPoint);
      
      expect(worldPointBack.x).toBeCloseTo(worldPoint.x, 2);
      expect(worldPointBack.y).toBeCloseTo(worldPoint.y, 2);
    });

    it('should maintain precision for small values', () => {
      const worldPoint = { x: 0.001, y: 0.001 };
      const screenPoint = transformer.worldToScreen(worldPoint);
      const worldPointBack = transformer.screenToWorld(screenPoint);
      
      expect(worldPointBack.x).toBeCloseTo(worldPoint.x, 6);
      expect(worldPointBack.y).toBeCloseTo(worldPoint.y, 6);
    });
  });

  describe('Zoom Behavior', () => {
    it('should zoom toward a specific point correctly', () => {
      // Zoom to 2x at point (400, 300) on screen
      const zoomPoint = { x: 400, y: 300 };
      const worldZoomPoint = transformer.screenToWorld(zoomPoint);
      
      // Create new transformer with 2x scale
      const transformer2x = new CoordinateTransformer(canvas, 2, { x: 0, y: 0 });
      
      // The world point under mouse should remain at same screen position
      const newScreenPoint = transformer2x.worldToScreen(worldZoomPoint);
      
      // Calculate required offset to keep point fixed
      const requiredOffset = {
        x: zoomPoint.x - newScreenPoint.x,
        y: zoomPoint.y - newScreenPoint.y
      };
      
      // Create transformer with corrected offset
      const transformerWithOffset = new CoordinateTransformer(
        canvas, 2, requiredOffset
      );
      
      const finalScreenPoint = transformerWithOffset.worldToScreen(worldZoomPoint);
      expect(finalScreenPoint.x).toBeCloseTo(zoomPoint.x);
      expect(finalScreenPoint.y).toBeCloseTo(zoomPoint.y);
    });
  });

  describe('Physical Scale Integration', () => {
    it('should handle mm to pixel conversion at 96 DPI', () => {
      // 1 inch = 25.4mm = 96 pixels
      const mmToPixels = 96 / 25.4; // ~3.78
      const transformerMM = new CoordinateTransformer(
        canvas, 1, { x: 0, y: 0 }, mmToPixels
      );
      
      // 100mm in world should be ~378 pixels on screen
      const worldPoint = { x: 100, y: 0 };
      const screenPoint = transformerMM.worldToScreen(worldPoint);
      
      expect(screenPoint.x - 200).toBeCloseTo(378, 0);
    });

    it('should handle inch to pixel conversion at 96 DPI', () => {
      const inchToPixels = 96;
      const transformerInch = new CoordinateTransformer(
        canvas, 1, { x: 0, y: 0 }, inchToPixels
      );
      
      // 2 inches in world should be 192 pixels on screen
      const worldPoint = { x: 2, y: 0 };
      const screenPoint = transformerInch.worldToScreen(worldPoint);
      
      expect(screenPoint.x - 200).toBe(192);
    });
  });
});