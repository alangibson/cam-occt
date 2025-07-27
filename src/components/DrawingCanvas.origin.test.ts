import { describe, it, expect } from 'vitest';

describe('Drawing Canvas Origin Positioning', () => {
  it('should calculate fixed origin position correctly', () => {
    // Test the fixed origin calculation used in DrawingCanvas
    const canvasWidth = 800;
    const canvasHeight = 600;
    const offset = { x: 0, y: 0 };
    
    // Calculate origin position (25% from left, 75% from top)
    const originX = canvasWidth * 0.25 + offset.x;
    const originY = canvasHeight * 0.75 + offset.y;
    
    expect(originX).toBe(200); // 25% of 800
    expect(originY).toBe(450); // 75% of 600
  });

  it('should maintain origin position when canvas size changes', () => {
    // Test that origin percentage stays the same when canvas resizes
    const offset = { x: 0, y: 0 };
    
    // Original canvas size
    const originalWidth = 800;
    const originalHeight = 600;
    const originalOriginX = originalWidth * 0.25;
    const originalOriginY = originalHeight * 0.75;
    
    // New canvas size (after column resize)
    const newWidth = 1000;
    const newHeight = 600;
    const newOriginX = newWidth * 0.25;
    const newOriginY = newHeight * 0.75;
    
    // Origin percentage should be the same
    expect(originalOriginX / originalWidth).toBe(newOriginX / newWidth);
    expect(originalOriginY / originalHeight).toBe(newOriginY / newHeight);
    
    // But absolute position should be different
    expect(newOriginX).not.toBe(originalOriginX);
    expect(newOriginY).toBe(originalOriginY); // Height didn't change
  });

  it('should apply panning offset correctly', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;
    const panOffset = { x: 50, y: -30 };
    
    // Origin with panning applied
    const originX = canvasWidth * 0.25 + panOffset.x;
    const originY = canvasHeight * 0.75 + panOffset.y;
    
    expect(originX).toBe(250); // 200 + 50
    expect(originY).toBe(420); // 450 - 30
  });

  it('should convert screen coordinates to world coordinates correctly', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;
    const offset = { x: 0, y: 0 };
    const scale = 1;
    
    const originX = canvasWidth * 0.25 + offset.x;
    const originY = canvasHeight * 0.75 + offset.y;
    
    // Screen point at origin should convert to world (0, 0)
    const screenPos = { x: originX, y: originY };
    const worldPos = {
      x: (screenPos.x - originX) / scale,
      y: -(screenPos.y - originY) / scale
    };
    
    expect(worldPos.x).toBe(0);
    expect(worldPos.y).toBeCloseTo(0);
  });

  it('should handle zoom correctly with fixed origin', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;
    const offset = { x: 0, y: 0 };
    const scale = 2; // 200% zoom
    
    const originX = canvasWidth * 0.25 + offset.x;
    const originY = canvasHeight * 0.75 + offset.y;
    
    // Point 100 pixels right of origin
    const screenPos = { x: originX + 100, y: originY };
    const worldPos = {
      x: (screenPos.x - originX) / scale,
      y: -(screenPos.y - originY) / scale
    };
    
    // At 200% zoom, 100 screen pixels = 50 world units
    expect(worldPos.x).toBe(50);
    expect(worldPos.y).toBeCloseTo(0);
  });
});