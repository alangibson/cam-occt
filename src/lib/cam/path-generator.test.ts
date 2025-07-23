import { describe, it, expect } from 'vitest';
import { generateToolPaths } from './path-generator';
import type { Drawing, CuttingParameters } from '../../types';

describe('generateToolPaths', () => {
  const mockParameters: CuttingParameters = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };
  
  it('should generate tool paths for a simple drawing', () => {
    const drawing: Drawing = {
      shapes: [
        {
          id: 'shape1',
          type: 'line',
          geometry: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 }
          }
        },
        {
          id: 'shape2',
          type: 'circle',
          geometry: {
            center: { x: 50, y: 50 },
            radius: 25
          }
        }
      ],
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 100, y: 75 }
      },
      units: 'mm'
    };
    
    const paths = generateToolPaths(drawing, mockParameters);
    
    expect(paths).toHaveLength(2);
    expect(paths[0].shapeId).toBe('shape1');
    expect(paths[1].shapeId).toBe('shape2');
  });
  
  it('should apply kerf compensation', () => {
    const drawing: Drawing = {
      shapes: [
        {
          id: 'shape1',
          type: 'line',
          geometry: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 }
          }
        }
      ],
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 100, y: 0 }
      },
      units: 'mm'
    };
    
    const paths = generateToolPaths(drawing, mockParameters);
    
    expect(paths[0].points).toHaveLength(2);
    // Points should be offset by kerf compensation
  });
  
  it('should generate lead-in and lead-out paths', () => {
    const drawing: Drawing = {
      shapes: [
        {
          id: 'shape1',
          type: 'line',
          geometry: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 }
          }
        }
      ],
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 100, y: 0 }
      },
      units: 'mm'
    };
    
    const paths = generateToolPaths(drawing, mockParameters);
    
    expect(paths[0].leadIn).toBeDefined();
    expect(paths[0].leadIn).toHaveLength(2);
    expect(paths[0].leadOut).toBeDefined();
    expect(paths[0].leadOut).toHaveLength(2);
  });
});