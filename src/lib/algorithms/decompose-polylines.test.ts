import { describe, it, expect } from 'vitest';
import { decomposePolylines } from './decompose-polylines';
import type { Shape } from '../../types';

describe('Decompose Polylines Algorithm', () => {
  describe('Basic Functionality', () => {
    it('should decompose a simple open polyline into line segments', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        },
        layer: 'test'
      }];

      const result = decomposePolylines(shapes);
      
      // Should create 2 line segments from 3 points
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('line');
      expect(result[1].type).toBe('line');
      
      // Check first line segment
      const line1 = result[0].geometry as any;
      expect(line1.start).toEqual({ x: 0, y: 0 });
      expect(line1.end).toEqual({ x: 10, y: 0 });
      
      // Check second line segment
      const line2 = result[1].geometry as any;
      expect(line2.start).toEqual({ x: 10, y: 0 });
      expect(line2.end).toEqual({ x: 10, y: 10 });
    });

    it('should decompose a closed polyline with closing segment', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          closed: true
        },
        layer: 'test'
      }];

      const result = decomposePolylines(shapes);
      
      // Should create 4 line segments: 3 from consecutive points + 1 closing segment
      expect(result).toHaveLength(4);
      
      // Check closing segment (last point back to first)
      const closingLine = result[3].geometry as any;
      expect(closingLine.start).toEqual({ x: 0, y: 10 });
      expect(closingLine.end).toEqual({ x: 0, y: 0 });
    });

    it('should preserve non-polyline shapes unchanged', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: 'line',
          geometry: {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 }
          }
        },
        {
          id: 'circle1',
          type: 'circle',
          geometry: {
            center: { x: 5, y: 5 },
            radius: 3
          }
        }
      ];

      const result = decomposePolylines(shapes);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(shapes[0]);
      expect(result[1]).toEqual(shapes[1]);
    });

    it('should preserve layer information on decomposed segments', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ],
          closed: false
        },
        layer: 'construction'
      }];

      const result = decomposePolylines(shapes);
      
      expect(result).toHaveLength(1);
      expect(result[0].layer).toBe('construction');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty shape array', () => {
      const result = decomposePolylines([]);
      expect(result).toHaveLength(0);
    });

    it('should handle polyline with only 2 points', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ],
          closed: false
        }
      }];

      const result = decomposePolylines(shapes);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('line');
    });

    it('should handle polyline with single point', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [{ x: 0, y: 0 }],
          closed: false
        }
      }];

      const result = decomposePolylines(shapes);
      
      // Single point polyline produces no line segments
      expect(result).toHaveLength(0);
    });

    it('should not add closing segment for closed polyline with less than 3 points', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ],
          closed: true // Closed but only 2 points
        }
      }];

      const result = decomposePolylines(shapes);
      
      // Should only create 1 line segment, no closing segment for < 3 points
      expect(result).toHaveLength(1);
    });
  });

  describe('Mixed Shapes', () => {
    it('should process mixed shape types correctly', () => {
      const shapes: Shape[] = [
        {
          id: 'line1',
          type: 'line',
          geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } }
        },
        {
          id: 'poly1',
          type: 'polyline',
          geometry: {
            points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }],
            closed: false
          }
        },
        {
          id: 'circle1',
          type: 'circle',
          geometry: { center: { x: 30, y: 30 }, radius: 5 }
        }
      ];

      const result = decomposePolylines(shapes);
      
      // Should have: 1 original line + 2 decomposed lines + 1 original circle = 4 shapes
      expect(result).toHaveLength(4);
      
      // First should be original line
      expect(result[0].id).toBe('line1');
      expect(result[0].type).toBe('line');
      
      // Middle two should be decomposed polyline segments
      expect(result[1].type).toBe('line');
      expect(result[2].type).toBe('line');
      
      // Last should be original circle
      expect(result[3].id).toBe('circle1');
      expect(result[3].type).toBe('circle');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs for decomposed segments', () => {
      const shapes: Shape[] = [{
        id: 'poly1',
        type: 'polyline',
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      }];

      const result = decomposePolylines(shapes);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
      expect(result[0].id).not.toBe(result[1].id);
      expect(result[0].id).not.toBe('poly1');
      expect(result[1].id).not.toBe('poly1');
    });
  });
});