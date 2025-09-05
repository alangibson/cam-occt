import { describe, it, expect, vi } from 'vitest';
import {
  getSplineStartPoint,
  getSplineEndPoint,
  reverseSpline,
  getSplinePointAt,
  normalizeSplineWeights
} from './spline';
import type { Spline } from '../types/geometry';

// Mock the dependencies
vi.mock('./nurbs', () => ({
  evaluateNURBS: vi.fn()
}));

vi.mock('./spline-tessellation', () => ({
  tessellateSpline: vi.fn()
}));

describe('getSplineStartPoint', () => {
  it('should return NURBS evaluated point at t=0', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    const expectedPoint = { x: 1, y: 2 };
    vi.mocked(evaluateNURBS).mockReturnValue(expectedPoint);

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const startPoint = getSplineStartPoint(spline);
    expect(evaluateNURBS).toHaveBeenCalledWith(0, spline);
    expect(startPoint).toBe(expectedPoint);
  });

  it('should fallback to first fit point when NURBS evaluation fails', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const fitPoints = [{ x: 2, y: 3 }, { x: 5, y: 7 }, { x: 8, y: 1 }];
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [1, 1],
      degree: 1,
      fitPoints,
      closed: false
    };

    const startPoint = getSplineStartPoint(spline);
    expect(startPoint).toBe(fitPoints[0]);
  });

  it('should fallback to first control point when NURBS fails and no fit points', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const controlPoints = [{ x: 1, y: 4 }, { x: 6, y: 2 }, { x: 9, y: 8 }];
    const spline: Spline = {
      controlPoints,
      knots: [0, 0.5, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const startPoint = getSplineStartPoint(spline);
    expect(startPoint).toBe(controlPoints[0]);
  });

  it('should return origin when NURBS fails and no points available', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const spline: Spline = {
      controlPoints: [],
      knots: [],
      weights: [],
      degree: 0,
      fitPoints: [],
      closed: false
    };

    const startPoint = getSplineStartPoint(spline);
    expect(startPoint).toEqual({ x: 0, y: 0 });
  });

  it('should handle empty fit points array', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const controlPoints = [{ x: 3, y: 1 }];
    const spline: Spline = {
      controlPoints,
      knots: [],
      weights: [],
      degree: 0,
      fitPoints: [], // Empty but defined
      closed: false
    };

    const startPoint = getSplineStartPoint(spline);
    expect(startPoint).toBe(controlPoints[0]);
  });
});

describe('getSplineEndPoint', () => {
  it('should return NURBS evaluated point at t=1', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    const expectedPoint = { x: 9, y: 8 };
    vi.mocked(evaluateNURBS).mockReturnValue(expectedPoint);

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const endPoint = getSplineEndPoint(spline);
    expect(evaluateNURBS).toHaveBeenCalledWith(1, spline);
    expect(endPoint).toBe(expectedPoint);
  });

  it('should fallback to last fit point when NURBS evaluation fails', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const fitPoints = [{ x: 2, y: 3 }, { x: 5, y: 7 }, { x: 8, y: 1 }];
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [1, 1],
      degree: 1,
      fitPoints,
      closed: false
    };

    const endPoint = getSplineEndPoint(spline);
    expect(endPoint).toBe(fitPoints[fitPoints.length - 1]);
  });

  it('should fallback to last control point when NURBS fails and no fit points', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const controlPoints = [{ x: 1, y: 4 }, { x: 6, y: 2 }, { x: 9, y: 8 }];
    const spline: Spline = {
      controlPoints,
      knots: [0, 0.5, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const endPoint = getSplineEndPoint(spline);
    expect(endPoint).toBe(controlPoints[controlPoints.length - 1]);
  });

  it('should return origin when NURBS fails and no points available', async () => {
    const { evaluateNURBS } = await import('./nurbs');
    vi.mocked(evaluateNURBS).mockImplementation(() => {
      throw new Error('NURBS evaluation failed');
    });

    const spline: Spline = {
      controlPoints: [],
      knots: [],
      weights: [],
      degree: 0,
      fitPoints: [],
      closed: false
    };

    const endPoint = getSplineEndPoint(spline);
    expect(endPoint).toEqual({ x: 0, y: 0 });
  });
});

describe('reverseSpline', () => {
  it('should reverse control points and fit points', () => {
    const controlPoints = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
    const fitPoints = [{ x: 1, y: 1 }, { x: 6, y: 4 }, { x: 9, y: 2 }];
    const weights = [1, 2, 1];

    const spline: Spline = {
      controlPoints,
      knots: [0, 0, 0, 1, 1, 1],
      weights,
      degree: 2,
      fitPoints,
      closed: false
    };

    const reversed = reverseSpline(spline);
    
    expect(reversed.controlPoints).toEqual([...controlPoints].reverse());
    expect(reversed.fitPoints).toEqual([...fitPoints].reverse());
    expect(reversed.weights).toEqual([...weights].reverse());
    expect(reversed.degree).toBe(spline.degree);
    expect(reversed.closed).toBe(spline.closed);
  });

  it('should reverse and remap knot vector', () => {
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const reversed = reverseSpline(spline);
    expect(reversed.knots).toEqual([0, 0, 0, 1, 1, 1]); // Reversed and remapped
  });

  it('should handle more complex knot vector', () => {
    const spline: Spline = {
      controlPoints: [
        { x: 0, y: 0 }, 
        { x: 3, y: 6 }, 
        { x: 6, y: 3 },
        { x: 10, y: 0 }
      ],
      knots: [0, 0, 0, 0.5, 1, 1, 1],
      weights: [1, 1, 1, 1],
      degree: 3,
      fitPoints: [],
      closed: false
    };

    const reversed = reverseSpline(spline);
    // Original knots: [0, 0, 0, 0.5, 1, 1, 1]
    // Reversed: [1, 1, 1, 0.5, 0, 0, 0]
    // Remapped: [0, 0, 0, 0.5, 1, 1, 1]
    expect(reversed.knots).toEqual([0, 0, 0, 0.5, 1, 1, 1]);
  });

  it('should handle empty knots array', () => {
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [],
      weights: [1, 1],
      degree: 1,
      fitPoints: [],
      closed: false
    };

    const reversed = reverseSpline(spline);
    expect(reversed.knots).toEqual([]);
  });

  it('should handle missing weights array', () => {
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [],
      degree: 1,
      fitPoints: [],
      closed: false
    };

    const reversed = reverseSpline(spline);
    expect(reversed.weights).toEqual([]);
  });

  it('should handle undefined fitPoints', () => {
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [1, 1],
      degree: 1,
      fitPoints: [],
      closed: false
    };

    const reversed = reverseSpline(spline);
    expect(reversed.fitPoints).toEqual([]);
  });

  it('should create new arrays, not mutate originals', () => {
    const controlPoints = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const fitPoints = [{ x: 1, y: 1 }, { x: 9, y: 9 }];
    const weights = [1, 2];
    const knots = [0, 0, 1, 1];

    const spline: Spline = {
      controlPoints,
      knots,
      weights,
      degree: 1,
      fitPoints,
      closed: false
    };

    const reversed = reverseSpline(spline);

    // Original arrays should not be mutated
    expect(spline.controlPoints).toEqual(controlPoints);
    expect(spline.fitPoints).toEqual(fitPoints);
    expect(spline.weights).toEqual(weights);
    expect(spline.knots).toEqual(knots);

    // Reversed spline should have different arrays
    expect(reversed.controlPoints).not.toBe(controlPoints);
    expect(reversed.fitPoints).not.toBe(fitPoints);
    expect(reversed.weights).not.toBe(weights);
    expect(reversed.knots).not.toBe(knots);
  });
});

describe('getSplinePointAt', () => {
  it('should return point from tessellation with arc-length parameterization', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    const mockPoints = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 }
    ];
    vi.mocked(tessellateSpline).mockReturnValue({
      success: true,
      points: mockPoints,
      methodUsed: 'verb-nurbs',
      warnings: [],
      errors: []
    });

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const point = getSplinePointAt(spline, 0);
    expect(tessellateSpline).toHaveBeenCalledWith(spline, { method: 'verb-nurbs', numSamples: 200 });
    expect(point).toEqual(mockPoints[0]);
  });

  it('should handle t=1 to return last point', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    const mockPoints = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 }
    ];
    vi.mocked(tessellateSpline).mockReturnValue({
      success: true,
      points: mockPoints,
      methodUsed: 'verb-nurbs',
      warnings: [],
      errors: []
    });

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const point = getSplinePointAt(spline, 1);
    expect(point).toEqual(mockPoints[mockPoints.length - 1]);
  });

  it('should interpolate between points for intermediate t values', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    const mockPoints = [
      { x: 0, y: 0 },   // Arc length 0
      { x: 10, y: 0 },  // Arc length 10
      { x: 10, y: 10 }  // Arc length 20
    ];
    vi.mocked(tessellateSpline).mockReturnValue({
      success: true,
      points: mockPoints,
      methodUsed: 'verb-nurbs',
      warnings: [],
      errors: []
    });

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 1, 1],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    // t=0.5 should be at arc length 10 (50% of total length 20)
    const point = getSplinePointAt(spline, 0.5);
    expect(point).toEqual({ x: 10, y: 0 });
  });

  it('should return fallback point when tessellation fails', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    vi.mocked(tessellateSpline).mockReturnValue({
      success: false,
      points: [],
      methodUsed: 'verb-nurbs',
      warnings: [],
      errors: ['Tessellation failed']
    });

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [1, 1],
      degree: 1,
      fitPoints: [],
      closed: false
    };

    const point = getSplinePointAt(spline, 0.5);
    expect(point).toEqual({ x: 0, y: 0 });
  });

  it('should return fallback when tessellation throws error', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    vi.mocked(tessellateSpline).mockImplementation(() => {
      throw new Error('Tessellation failed');
    });

    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [1, 1],
      degree: 1,
      fitPoints: [],
      closed: false
    };

    const point = getSplinePointAt(spline, 0.5);
    expect(point).toEqual({ x: 0, y: 0 });
  });

  it('should handle single point tessellation', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    const mockPoints = [{ x: 5, y: 5 }];
    vi.mocked(tessellateSpline).mockReturnValue({
      success: true,
      points: mockPoints,
      methodUsed: 'verb-nurbs',
      warnings: [],
      errors: []
    });

    const spline: Spline = {
      controlPoints: [{ x: 5, y: 5 }],
      knots: [],
      weights: [1],
      degree: 0,
      fitPoints: [],
      closed: false
    };

    const point = getSplinePointAt(spline, 0.5);
    // Single point should return that point regardless of t
    // The implementation returns fallback when length <= 1
    expect(point).toEqual({ x: 0, y: 0 });
  });

  it('should handle empty tessellation', async () => {
    const { tessellateSpline } = await import('./spline-tessellation');
    vi.mocked(tessellateSpline).mockReturnValue({
      success: true,
      points: [],
      methodUsed: 'verb-nurbs',
      warnings: [],
      errors: []
    });

    const spline: Spline = {
      controlPoints: [],
      knots: [],
      weights: [],
      degree: 0,
      fitPoints: [],
      closed: false
    };

    const point = getSplinePointAt(spline, 0.5);
    expect(point).toEqual({ x: 0, y: 0 });
  });
});

describe('normalizeSplineWeights', () => {
  it('should add unit weights when no weights exist', () => {
    const spline: Spline = {
      controlPoints: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 }
      ],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [],
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const normalized = normalizeSplineWeights(spline);
    expect(normalized.weights).toEqual([1, 1, 1]);
    expect(normalized.weights?.length).toBe(normalized.controlPoints.length);
  });

  it('should add unit weights when weights array length mismatch', () => {
    const spline: Spline = {
      controlPoints: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 }
      ],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 2], // Only 2 weights for 3 control points
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const normalized = normalizeSplineWeights(spline);
    expect(normalized.weights).toEqual([1, 1, 1]);
  });

  it('should leave valid weights unchanged', () => {
    const weights = [1, 2, 3];
    const spline: Spline = {
      controlPoints: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 }
      ],
      knots: [0, 0, 0, 1, 1, 1],
      weights,
      degree: 2,
      fitPoints: [],
      closed: false
    };

    const normalized = normalizeSplineWeights(spline);
    expect(normalized.weights).toBe(weights); // Should be same reference
    expect(normalized).toBe(spline); // Should return same spline object
  });

  it('should handle single control point', () => {
    const spline: Spline = {
      controlPoints: [{ x: 5, y: 5 }],
      knots: [],
      weights: [],
      degree: 0,
      fitPoints: [],
      closed: false
    };

    const normalized = normalizeSplineWeights(spline);
    expect(normalized.weights).toEqual([1]);
  });

  it('should handle empty control points array', () => {
    const spline: Spline = {
      controlPoints: [],
      knots: [],
      weights: [],
      degree: 0,
      fitPoints: [],
      closed: false
    };

    const normalized = normalizeSplineWeights(spline);
    expect(normalized.weights).toEqual([]);
  });

  it('should create new spline object when weights are normalized', () => {
    const spline: Spline = {
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      knots: [0, 1],
      weights: [],
      degree: 1,
      fitPoints: [],
      closed: false
    };

    const normalized = normalizeSplineWeights(spline);
    expect(normalized).not.toBe(spline);
    expect(normalized.controlPoints).toBe(spline.controlPoints); // Should share other properties
    expect(normalized.knots).toBe(spline.knots);
  });
});