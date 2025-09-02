import { describe, it, expect, beforeEach } from 'vitest';
import { CoordinateTransformer } from './CoordinateTransformer';
import type { Point2D } from '../../lib/types/geometry';

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

  describe('updateCanvas', () => {
    it('should update canvas dimensions', () => {
      const newCanvas = { width: 1000, height: 800 };
      transformer.updateCanvas(newCanvas);
      
      const origin = transformer.getScreenOrigin();
      expect(origin.x).toBe(newCanvas.width * 0.25);
      expect(origin.y).toBe(newCanvas.height * 0.75);
    });

    it('should maintain transformations after canvas update', () => {
      const worldPoint = { x: 50, y: 30 };
      const screenBefore = transformer.worldToScreen(worldPoint);
      
      transformer.updateCanvas({ width: 1000, height: 800 });
      
      // Screen coordinates should change due to new origin
      const screenAfter = transformer.worldToScreen(worldPoint);
      expect(screenAfter).not.toEqual(screenBefore);
      
      // But world to screen to world should still work
      const worldBack = transformer.screenToWorld(screenAfter);
      expect(worldBack.x).toBeCloseTo(worldPoint.x);
      expect(worldBack.y).toBeCloseTo(worldPoint.y);
    });
  });

  describe('updateTransform', () => {
    it('should update scale and offset', () => {
      const newScale = 2.5;
      const newOffset = { x: 100, y: -50 };
      
      transformer.updateTransform(newScale, newOffset);
      
      expect(transformer.getScale()).toBe(newScale);
      expect(transformer.getOffset()).toEqual(newOffset);
      expect(transformer.getTotalScale()).toBe(newScale); // physicalScale = 1
    });

    it('should update physical scale when provided', () => {
      const newScale = 1.5;
      const newOffset = { x: 0, y: 0 };
      const newPhysicalScale = 3.0;
      
      transformer.updateTransform(newScale, newOffset, newPhysicalScale);
      
      expect(transformer.getScale()).toBe(newScale);
      expect(transformer.getPhysicalScale()).toBe(newPhysicalScale);
      expect(transformer.getTotalScale()).toBe(newScale * newPhysicalScale);
    });

    it('should not update physical scale when undefined', () => {
      const originalPhysicalScale = transformer.getPhysicalScale();
      
      transformer.updateTransform(2, { x: 0, y: 0 });
      
      expect(transformer.getPhysicalScale()).toBe(originalPhysicalScale);
      expect(transformer.getTotalScale()).toBe(2 * originalPhysicalScale);
    });
  });

  describe('getScreenOrigin', () => {
    it('should return correct origin without offset', () => {
      const origin = transformer.getScreenOrigin();
      
      expect(origin.x).toBe(canvas.width * 0.25);
      expect(origin.y).toBe(canvas.height * 0.75);
    });

    it('should apply offset to origin', () => {
      const offset = { x: 50, y: -30 };
      transformer.updateTransform(1, offset);
      
      const origin = transformer.getScreenOrigin();
      
      expect(origin.x).toBe(canvas.width * 0.25 + offset.x);
      expect(origin.y).toBe(canvas.height * 0.75 + offset.y);
    });

    it('should handle negative offsets', () => {
      const offset = { x: -100, y: 75 };
      transformer.updateTransform(1, offset);
      
      const origin = transformer.getScreenOrigin();
      
      expect(origin.x).toBe(canvas.width * 0.25 - 100);
      expect(origin.y).toBe(canvas.height * 0.75 + 75);
    });
  });

  describe('calculateZoomOffset', () => {
    it('should calculate offset to keep zoom point fixed', () => {
      const zoomPoint = { x: 400, y: 300 };
      const oldScale = 1;
      const newScale = 2;
      
      const newOffset = transformer.calculateZoomOffset(zoomPoint, oldScale, newScale);
      
      // Create new transformer with calculated offset
      const newTransformer = new CoordinateTransformer(canvas, newScale, newOffset);
      
      // The world point under the zoom point should remain at same screen position
      const originalWorldPoint = transformer.screenToWorld(zoomPoint);
      const newScreenPoint = newTransformer.worldToScreen(originalWorldPoint);
      
      expect(newScreenPoint.x).toBeCloseTo(zoomPoint.x, 1);
      expect(newScreenPoint.y).toBeCloseTo(zoomPoint.y, 1);
    });

    it('should handle zoom out correctly', () => {
      const transformer2x = new CoordinateTransformer(canvas, 2, { x: 0, y: 0 });
      const zoomPoint = { x: 300, y: 200 };
      const oldScale = 2;
      const newScale = 0.5;
      
      const newOffset = transformer2x.calculateZoomOffset(zoomPoint, oldScale, newScale);
      
      const newTransformer = new CoordinateTransformer(canvas, newScale, newOffset);
      
      const originalWorldPoint = transformer2x.screenToWorld(zoomPoint);
      const newScreenPoint = newTransformer.worldToScreen(originalWorldPoint);
      
      expect(newScreenPoint.x).toBeCloseTo(zoomPoint.x, 1);
      expect(newScreenPoint.y).toBeCloseTo(zoomPoint.y, 1);
    });

    it('should handle physical scale in zoom calculations', () => {
      const physicalScale = 2;
      const transformerWithPhys = new CoordinateTransformer(canvas, 1, { x: 0, y: 0 }, physicalScale);
      const zoomPoint = { x: 350, y: 250 };
      const oldScale = 1;
      const newScale = 3;
      
      const newOffset = transformerWithPhys.calculateZoomOffset(zoomPoint, oldScale, newScale);
      
      const newTransformer = new CoordinateTransformer(canvas, newScale, newOffset, physicalScale);
      
      const originalWorldPoint = transformerWithPhys.screenToWorld(zoomPoint);
      const newScreenPoint = newTransformer.worldToScreen(originalWorldPoint);
      
      expect(newScreenPoint.x).toBeCloseTo(zoomPoint.x, 1);
      expect(newScreenPoint.y).toBeCloseTo(zoomPoint.y, 1);
    });
  });

  describe('getTotalScale', () => {
    it('should return scale times physical scale', () => {
      const scale = 2.5;
      const physicalScale = 1.5;
      const transformerScaled = new CoordinateTransformer(canvas, scale, { x: 0, y: 0 }, physicalScale);
      
      expect(transformerScaled.getTotalScale()).toBe(scale * physicalScale);
    });

    it('should update when scale changes', () => {
      transformer.updateTransform(3, { x: 0, y: 0 });
      expect(transformer.getTotalScale()).toBe(3);
      
      transformer.updateTransform(0.5, { x: 0, y: 0 });
      expect(transformer.getTotalScale()).toBe(0.5);
    });
  });

  describe('getScale', () => {
    it('should return current user scale', () => {
      const scale = 2.7;
      transformer.updateTransform(scale, { x: 0, y: 0 });
      
      expect(transformer.getScale()).toBe(scale);
    });
  });

  describe('getPhysicalScale', () => {
    it('should return current physical scale', () => {
      const physicalScale = 1.8;
      const transformerWithPhys = new CoordinateTransformer(canvas, 1, { x: 0, y: 0 }, physicalScale);
      
      expect(transformerWithPhys.getPhysicalScale()).toBe(physicalScale);
    });

    it('should return 1 when not specified', () => {
      expect(transformer.getPhysicalScale()).toBe(1);
    });
  });

  describe('getOffset', () => {
    it('should return a copy of current offset', () => {
      const offset = { x: 123, y: -456 };
      transformer.updateTransform(1, offset);
      
      const returnedOffset = transformer.getOffset();
      
      expect(returnedOffset).toEqual(offset);
      expect(returnedOffset).not.toBe(offset); // Should be a copy
    });

    it('should not allow mutation of internal offset', () => {
      const offset = { x: 10, y: 20 };
      transformer.updateTransform(1, offset);
      
      const returnedOffset = transformer.getOffset();
      returnedOffset.x = 999;
      
      expect(transformer.getOffset().x).toBe(10); // Should be unchanged
    });
  });

  describe('worldToScreenDistance', () => {
    it('should convert world distance to screen pixels', () => {
      const worldDistance = 100;
      const screenDistance = transformer.worldToScreenDistance(worldDistance);
      
      expect(screenDistance).toBe(worldDistance * transformer.getTotalScale());
    });

    it('should handle scale factor correctly', () => {
      transformer.updateTransform(2.5, { x: 0, y: 0 });
      const worldDistance = 50;
      const screenDistance = transformer.worldToScreenDistance(worldDistance);
      
      expect(screenDistance).toBe(125);
    });

    it('should handle physical scale factor', () => {
      const physicalScale = 3;
      const transformerWithPhys = new CoordinateTransformer(canvas, 2, { x: 0, y: 0 }, physicalScale);
      const worldDistance = 10;
      const screenDistance = transformerWithPhys.worldToScreenDistance(worldDistance);
      
      expect(screenDistance).toBe(60); // 10 * 2 * 3
    });
  });

  describe('screenToWorldDistance', () => {
    it('should convert screen pixels to world distance', () => {
      const screenDistance = 200;
      const worldDistance = transformer.screenToWorldDistance(screenDistance);
      
      expect(worldDistance).toBe(screenDistance / transformer.getTotalScale());
    });

    it('should be inverse of worldToScreenDistance', () => {
      const originalWorldDistance = 75;
      const screenDistance = transformer.worldToScreenDistance(originalWorldDistance);
      const worldDistanceBack = transformer.screenToWorldDistance(screenDistance);
      
      expect(worldDistanceBack).toBeCloseTo(originalWorldDistance);
    });

    it('should handle combined scale factors', () => {
      const scale = 1.5;
      const physicalScale = 2.5;
      const transformerScaled = new CoordinateTransformer(canvas, scale, { x: 0, y: 0 }, physicalScale);
      
      const screenDistance = 150;
      const worldDistance = transformerScaled.screenToWorldDistance(screenDistance);
      
      expect(worldDistance).toBe(screenDistance / (scale * physicalScale));
    });
  });

  describe('Extreme Values and Edge Cases', () => {
    it('should handle extremely small scale values', () => {
      const verySmallScale = 0.001;
      const transformerSmall = new CoordinateTransformer(canvas, verySmallScale, { x: 0, y: 0 });
      
      const worldPoint = { x: 1, y: 1 };
      const screenPoint = transformerSmall.worldToScreen(worldPoint);
      const worldBack = transformerSmall.screenToWorld(screenPoint);
      
      expect(worldBack.x).toBeCloseTo(worldPoint.x, 3);
      expect(worldBack.y).toBeCloseTo(worldPoint.y, 3);
    });

    it('should handle extremely large scale values', () => {
      const veryLargeScale = 1000;
      const transformerLarge = new CoordinateTransformer(canvas, veryLargeScale, { x: 0, y: 0 });
      
      const worldPoint = { x: 0.001, y: 0.001 };
      const screenPoint = transformerLarge.worldToScreen(worldPoint);
      const worldBack = transformerLarge.screenToWorld(screenPoint);
      
      expect(worldBack.x).toBeCloseTo(worldPoint.x, 6);
      expect(worldBack.y).toBeCloseTo(worldPoint.y, 6);
    });

    it('should handle extreme offsets', () => {
      const extremeOffset = { x: -10000, y: 50000 };
      transformer.updateTransform(1, extremeOffset);
      
      const worldPoint = { x: 100, y: -200 };
      const screenPoint = transformer.worldToScreen(worldPoint);
      const worldBack = transformer.screenToWorld(screenPoint);
      
      expect(worldBack.x).toBeCloseTo(worldPoint.x);
      expect(worldBack.y).toBeCloseTo(worldPoint.y);
    });

    it('should handle zero world coordinates with various scales', () => {
      const scales = [0.1, 1, 10, 100];
      const worldZero = { x: 0, y: 0 };
      
      scales.forEach(scale => {
        const t = new CoordinateTransformer(canvas, scale, { x: 0, y: 0 });
        const screenPoint = t.worldToScreen(worldZero);
        const worldBack = t.screenToWorld(screenPoint);
        
        expect(worldBack.x).toBeCloseTo(0, 10);
        expect(worldBack.y).toBeCloseTo(0, 10);
      });
    });
  });
});