import { describe, it, expect } from 'vitest';
import { samplePathAtDistanceIntervals, normalizeVector } from './index';
import type { Shape, Line, Arc } from '../types';

describe('samplePathAtDistanceIntervals', () => {
  describe('Cut Direction Handling', () => {
    it('should produce correct direction vectors for counterclockwise cuts on simple line', () => {
      // Create a simple horizontal line from (0,0) to (10,0)
      const line: Shape = {
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 }
        } as Line
      };
      
      const shapes = [line];
      const samples = samplePathAtDistanceIntervals(shapes, 5, 'counterclockwise');
      
      // For counterclockwise cuts, direction should be reversed (pointing left)
      expect(samples.length).toBeGreaterThan(0);
      
      // First sample should be pointing in negative X direction (left)
      const firstSample = samples[0];
      expect(firstSample.direction.x).toBeLessThan(0);
      expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be essentially 0
      
      // Direction should be normalized
      const magnitude = Math.sqrt(firstSample.direction.x ** 2 + firstSample.direction.y ** 2);
      expect(magnitude).toBeCloseTo(1.0, 2);
    });
    
    it('should produce correct direction vectors for clockwise cuts on simple line', () => {
      // Create a simple horizontal line from (0,0) to (10,0)
      const line: Shape = {
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 }
        } as Line
      };
      
      const shapes = [line];
      const samples = samplePathAtDistanceIntervals(shapes, 5, 'clockwise');
      
      // For clockwise cuts, direction should be natural (pointing right)
      expect(samples.length).toBeGreaterThan(0);
      
      // First sample should be pointing in positive X direction (right)
      const firstSample = samples[0];
      expect(firstSample.direction.x).toBeGreaterThan(0);
      expect(Math.abs(firstSample.direction.y)).toBeLessThan(0.1); // Should be essentially 0
      
      // Direction should be normalized
      const magnitude = Math.sqrt(firstSample.direction.x ** 2 + firstSample.direction.y ** 2);
      expect(magnitude).toBeCloseTo(1.0, 2);
    });
    
    it('should produce opposite directions for same shape with different cut directions', () => {
      // Create a vertical line from (0,0) to (0,10)
      const line: Shape = {
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 0, y: 10 }
        } as Line
      };
      
      const shapes = [line];
      const clockwiseSamples = samplePathAtDistanceIntervals(shapes, 5, 'clockwise');
      const counterclockwiseSamples = samplePathAtDistanceIntervals(shapes, 5, 'counterclockwise');
      
      expect(clockwiseSamples.length).toBeGreaterThan(0);
      expect(counterclockwiseSamples.length).toBeGreaterThan(0);
      
      // Directions should be opposite
      const cwDir = clockwiseSamples[0].direction;
      const ccwDir = counterclockwiseSamples[0].direction;
      
      expect(cwDir.x).toBeCloseTo(-ccwDir.x, 2);
      expect(cwDir.y).toBeCloseTo(-ccwDir.y, 2);
    });
    
    it('should handle multi-shape paths correctly', () => {
      // Create an L-shaped path: horizontal line then vertical line
      const horizontalLine: Shape = {
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 }
        } as Line
      };
      
      const verticalLine: Shape = {
        type: 'line',
        geometry: {
          start: { x: 10, y: 0 },
          end: { x: 10, y: 10 }
        } as Line
      };
      
      const shapes = [horizontalLine, verticalLine];
      
      const clockwiseSamples = samplePathAtDistanceIntervals(shapes, 5, 'clockwise');
      const counterclockwiseSamples = samplePathAtDistanceIntervals(shapes, 5, 'counterclockwise');
      
      // Should have samples from both shapes
      expect(clockwiseSamples.length).toBeGreaterThanOrEqual(2);
      expect(counterclockwiseSamples.length).toBeGreaterThanOrEqual(2);
      
      // For clockwise, first samples should point right (positive X)
      const cwFirstSample = clockwiseSamples[0];
      expect(cwFirstSample.direction.x).toBeGreaterThan(0);
      
      // For counterclockwise, first samples should point left (negative X) due to reversal
      const ccwFirstSample = counterclockwiseSamples[0];
      expect(ccwFirstSample.direction.x).toBeLessThan(0);
    });
  });
  
  describe('Regular Distance Sampling', () => {
    it('should sample at regular intervals', () => {
      // Create a 20-unit long line
      const line: Shape = {
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 20, y: 0 }
        } as Line
      };
      
      const shapes = [line];
      const samples = samplePathAtDistanceIntervals(shapes, 5, 'clockwise'); // Sample every 5 units
      
      // Should have samples at positions ~5, ~10, ~15 (and possibly one more at end)
      expect(samples.length).toBeGreaterThanOrEqual(3);
      expect(samples.length).toBeLessThanOrEqual(4);
      
      // Check positions are approximately correct for the first few samples
      expect(samples[0].point.x).toBeCloseTo(5, 1);
      expect(samples[1].point.x).toBeCloseTo(10, 1);
      if (samples.length >= 3) {
        expect(samples[2].point.x).toBeCloseTo(15, 1);
      }
      
      // All samples should be on the Y=0 line
      samples.forEach(sample => {
        expect(Math.abs(sample.point.y)).toBeLessThan(0.1);
      });
    });
    
    it('should handle edge cases gracefully', () => {
      // Empty shapes array
      expect(samplePathAtDistanceIntervals([], 5, 'clockwise')).toEqual([]);
      
      // Zero interval distance
      const line: Shape = {
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 }
        } as Line
      };
      expect(samplePathAtDistanceIntervals([line], 0, 'clockwise')).toEqual([]);
      
      // Negative interval distance
      expect(samplePathAtDistanceIntervals([line], -5, 'clockwise')).toEqual([]);
    });
  });
});

describe('Cut Direction Regression Tests', () => {
  it('should prevent the commit 3d71ad4 regression where arrows always pointed clockwise', () => {
    // This test specifically catches the bug where direction calculation didn't respect cut direction
    // The bug was: samplePathAtDistanceIntervals always calculated direction in natural parameter order
    // regardless of cut direction, while calling code reversed shape order
    
    const line: Shape = {
      type: 'line',
      geometry: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 }  // Horizontal line pointing right
      } as Line
    };
    
    // When DrawingCanvas calls with counterclockwise and reversed shape order,
    // the direction vectors should point in the opposite direction to match the reversal
    const samples = samplePathAtDistanceIntervals([line], 5, 'counterclockwise');
    
    expect(samples.length).toBeGreaterThan(0);
    
    // Direction should be reversed (pointing left) for counterclockwise
    const direction = samples[0].direction;
    expect(direction.x).toBeLessThan(0); // Should point left, not right
    expect(Math.abs(direction.y)).toBeLessThan(0.1); // Should be horizontal
    
    // The bug would cause direction.x > 0 (pointing right) even for counterclockwise cuts
  });
});