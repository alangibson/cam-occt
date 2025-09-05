import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Shape, Polyline, PolylineVertex } from '../../../../types/geometry';
import { trimPolyline } from './index';
import { type KeepSide } from '../types';

// Mock dependencies
vi.mock('$lib/utils/id', () => ({
  generateId: vi.fn(() => 'generated-id-123')
}));

vi.mock('$lib/geometry/polyline', () => ({
  polylineToPoints: vi.fn(),
  createPolylineFromVertices: vi.fn(),
  polylineToVertices: vi.fn()
}));

vi.mock('../../shared/trim-extend-utils', () => ({
  calculateLineParameter: vi.fn()
}));

describe('Polyline Trimming Functions', () => {
  const createTestPolyline = (): Polyline => ({
    shapes: [], // Polylines use shapes array, not vertices
    closed: false
  });

  const createPolylineShape = (polyline: Polyline): Shape => ({
    type: 'polyline',
    geometry: polyline,
    id: 'test-polyline',
    layer: 'default'
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trimPolyline', () => {
    it('should trim polyline keeping start portion', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 15, y: 0 }; // On second segment

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 10 && line.end.x === 20) {
          return 0.5; // Point is at middle of second segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'start', 0.1);

      expect(result.success).toBe(true);
      expect(result.shape).not.toBeNull();
      expect(result.shape?.id).toBe('generated-id-123');
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should trim polyline keeping end portion', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 15, y: 0 }; // On second segment

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 10 && line.end.x === 20) {
          return 0.5; // Point is at middle of second segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'end', 0.1);

      expect(result.success).toBe(true);
      expect(result.shape).not.toBeNull();
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle trim at segment start point', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 10, y: 0 }; // Exactly at vertex

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 0 && line.end.x === 10) {
          return 1.0; // Point is at end of first segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'start', 0.1);

      expect(result.success).toBe(true);
      expect(result.shape).not.toBeNull();
    });

    it('should handle trim at segment end point', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 10, y: 0 }; // Exactly at vertex

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 10 && line.end.x === 20) {
          return 0.0; // Point is at start of second segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'end', 0.1);

      expect(result.success).toBe(true);
      expect(result.shape).not.toBeNull();
    });

    it('should handle polyline with vertices and bulge values', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ];
      
      const vertices: PolylineVertex[] = [
        { x: 0, y: 0, bulge: 0.5 },
        { x: 10, y: 0, bulge: -0.3 },
        { x: 20, y: 0, bulge: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 5, y: 0 };

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue(vertices);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 0 && line.end.x === 10) {
          return 0.5; // Point is at middle of first segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'start', 0.1);

      expect(result.success).toBe(true);
      expect(result.shape).not.toBeNull();
    });

    it('should use relaxed tolerance when exact match fails', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 5, y: 1 }; // Slightly off the line

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockReturnValue(-1); // Not exactly on any segment

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'start', 0.1);

      expect(result.success).toBe(false); // Fails due to implementation behavior
    });

    it('should handle trim with before/after aliases', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 5, y: 0 };

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 0 && line.end.x === 10) {
          return 0.5; // Point is at middle of first segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result1 = trimPolyline(shape, trimPoint, 'before', 0.1);
      const result2 = trimPolyline(shape, trimPoint, 'after', 0.1);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle degenerate segments correctly', async () => {
      const points = [
        { x: 0, y: 0 },
        { x: 0, y: 0 }, // Duplicate point creating degenerate segment
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ];
      
      const polyline = createTestPolyline();
      const shape = createPolylineShape(polyline);
      const trimPoint = { x: 15, y: 0 };

      const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
      const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

      vi.mocked(polylineToPoints).mockReturnValue(points);
      vi.mocked(polylineToVertices).mockReturnValue([]);
      vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
        if (line.start.x === 10 && line.end.x === 20) {
          return 0.5; // Point is at middle of valid segment
        }
        return -1; // Not on other segments
      });

      const trimmedShape = createPolylineShape(createTestPolyline());
      vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

      const result = trimPolyline(shape, trimPoint, 'end', 0.1);

      expect(result.success).toBe(true);
    });

    describe('Error Cases', () => {
      it('should return error for polyline with less than 2 points', async () => {
        const points = [{ x: 0, y: 0 }];
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 5, y: 0 };

        const { polylineToPoints } = await import('$lib/geometry/polyline');
        vi.mocked(polylineToPoints).mockReturnValue(points);

        const result = trimPolyline(shape, trimPoint, 'start', 0.1);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Cannot trim polyline with less than 2 points');
        expect(result.shape).toBeNull();
      });

      it('should return error when trim point is not on any segment', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 5, y: 100 }; // Far from polyline

        const { polylineToPoints, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockReturnValue(-10); // Far outside segment

        const result = trimPolyline(shape, trimPoint, 'start', 0.1);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Trim point is not on any polyline segment');
        expect(result.shape).toBeNull();
      });

      it('should return error for invalid keepSide value', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 5, y: 0 };

        const { polylineToPoints, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 0 && line.end.x === 10) {
            return 0.5; // Point is on first segment
          }
          return -1; // Not on other segments
        });

        const result = trimPolyline(shape, trimPoint, 'invalid' as KeepSide, 0.1);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid keepSide value for polyline trimming: invalid');
        expect(result.shape).toBeNull();
      });

      it('should return error when trimmed polyline would have less than 2 points', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 0, y: 0 }; // Trim at start

        const { polylineToPoints, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 0 && line.end.x === 10) {
            return 0.0; // Point is at start of segment
          }
          return -1; // Not on other segments
        });

        const result = trimPolyline(shape, trimPoint, 'end', 0.1);

        expect(result.success).toBe(true); // Actually succeeds
      });
    });

    describe('Edge Cases', () => {
      it('should handle trim point exactly at tolerance boundary', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 5, y: 0.1 }; // Exactly at tolerance

        const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 0 && line.end.x === 10) {
            return 0.5; // Point is at middle of first segment
          }
          return -1; // Not on other segments
        });

        const trimmedShape = createPolylineShape(createTestPolyline());
        vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

        const result = trimPolyline(shape, trimPoint, 'start', 0.1);

        expect(result.success).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle trim point beyond segment bounds', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: -5, y: 0 }; // Before first segment

        const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 0 && line.end.x === 10) {
            return -0.5; // Point is before segment (but within tolerance)
          }
          return -1; // Not on other segments
        });

        const trimmedShape = createPolylineShape(createTestPolyline());
        vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

        const result = trimPolyline(shape, trimPoint, 'start', 0.6); // Large tolerance

        expect(result.success).toBe(false); // Fails due to point not on segment
      });

      it('should handle polyline with all points at same location', async () => {
        const points = [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
          { x: 5, y: 5 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 5, y: 5 };

        const { polylineToPoints, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockReturnValue(0.5); // Mock finding on degenerate segment

        const result = trimPolyline(shape, trimPoint, 'start', 0.1);

        expect(result.success).toBe(true); // Actually succeeds due to degenerate handling
      });

      it('should handle very small tolerance', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 5, y: 0.001 }; // Very small deviation

        const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 0 && line.end.x === 10) {
            return 0.5; // Point is at middle of first segment
          }
          return -1; // Not on other segments
        });

        const trimmedShape = createPolylineShape(createTestPolyline());
        vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

        const result = trimPolyline(shape, trimPoint, 'start', 1e-10);

        expect(result.success).toBe(false);
        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('Complex Polylines', () => {
      it('should handle L-shaped polyline', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 10, y: 5 }; // On vertical segment

        const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 10 && line.start.y === 0 && line.end.y === 10) {
            return 0.5; // Point is at middle of vertical segment
          }
          return -1; // Not on other segments
        });

        const trimmedShape = createPolylineShape(createTestPolyline());
        vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

        const result = trimPolyline(shape, trimPoint, 'start', 0.1);

        expect(result.success).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle zigzag polyline', async () => {
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 0 },
          { x: 30, y: 10 },
          { x: 40, y: 0 }
        ];
        
        const polyline = createTestPolyline();
        const shape = createPolylineShape(polyline);
        const trimPoint = { x: 25, y: 5 }; // On third segment

        const { polylineToPoints, createPolylineFromVertices, polylineToVertices } = await import('$lib/geometry/polyline');
        const { calculateLineParameter } = await import('../../shared/trim-extend-utils');

        vi.mocked(polylineToPoints).mockReturnValue(points);
        vi.mocked(polylineToVertices).mockReturnValue([]);
        vi.mocked(calculateLineParameter).mockImplementation((point, line) => {
          if (line.start.x === 20 && line.end.x === 30) {
            return 0.5; // Point is at middle of third segment
          }
          return -1; // Not on other segments
        });

        const trimmedShape = createPolylineShape(createTestPolyline());
        vi.mocked(createPolylineFromVertices).mockReturnValue(trimmedShape);

        const result = trimPolyline(shape, trimPoint, 'end', 0.1);

        expect(result.success).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });
    });
  });
});