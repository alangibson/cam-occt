import { describe, it, expect } from 'vitest';
import { calculateDrawingSize } from './drawing-size';
import type { Drawing } from '../../types';

describe('calculateDrawingSize', () => {
  it('returns null for empty drawing', () => {
    expect(calculateDrawingSize(null)).toBeNull();
  });

  it('returns null for drawing with no shapes', () => {
    const drawing: Drawing = {
      shapes: [],
      bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      units: 'mm'
    };
    
    expect(calculateDrawingSize(drawing)).toBeNull();
  });

  it('uses DXF bounds when valid', () => {
    const drawing: Drawing = {
      shapes: [
        {
          id: 'test',
          type: 'line',
          geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }
        }
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 50 } },
      units: 'mm'
    };
    
    const result = calculateDrawingSize(drawing);
    expect(result).toEqual({
      width: 100,
      height: 50,
      units: 'mm',
      source: 'calculated'
    });
  });

  it('falls back to calculated bounds when DXF bounds invalid', () => {
    const drawing: Drawing = {
      shapes: [
        {
          id: 'test',
          type: 'line',
          geometry: { start: { x: 5, y: 10 }, end: { x: 15, y: 20 } }
        }
      ],
      bounds: { min: { x: NaN, y: 0 }, max: { x: 100, y: 50 } },
      units: 'inch'
    };
    
    const result = calculateDrawingSize(drawing);
    expect(result).toEqual({
      width: 10,
      height: 10,
      units: 'inch',
      source: 'calculated'
    });
  });
});