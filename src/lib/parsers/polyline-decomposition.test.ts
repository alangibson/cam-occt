import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';
import { readFileSync } from 'fs';
import path from 'path';

describe('Polyline Decomposition', () => {
  it('should decompose polylines with bulges into lines and arcs', async () => {
    // Read the test file with bulges
    const dxfPath = path.resolve('tests/dxf/polylines_with_bulge.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse with decomposition enabled
    const drawingDecomposed = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // Parse without decomposition for comparison
    const drawingOriginal = await parseDXF(dxfContent, { decomposePolylines: false });
    
    console.log('Original (polylines):', drawingOriginal.shapes.length, 'shapes');
    console.log('Shape types:', drawingOriginal.shapes.map(s => s.type));
    
    console.log('Decomposed:', drawingDecomposed.shapes.length, 'shapes');
    console.log('Shape types:', drawingDecomposed.shapes.map(s => s.type));
    
    // Should have more shapes when decomposed
    expect(drawingDecomposed.shapes.length).toBeGreaterThan(drawingOriginal.shapes.length);
    
    // Should contain both lines and arcs
    const shapeTypes = drawingDecomposed.shapes.map(s => s.type);
    expect(shapeTypes).toContain('line');
    expect(shapeTypes).toContain('arc');
    
    // Original should only contain polylines
    expect(drawingOriginal.shapes.every(s => s.type === 'polyline')).toBe(true);
  });
  
  it('should preserve layer information when decomposing', async () => {
    const dxfPath = path.resolve('tests/dxf/polylines_with_bulge.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    const drawing = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // All decomposed shapes should have layer information
    drawing.shapes.forEach(shape => {
      expect(shape.layer).toBeDefined();
    });
  });
  
  it('should handle straight segments (zero bulge) as lines', async () => {
    const dxfPath = path.resolve('tests/dxf/polylines_with_bulge.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    const drawing = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // Should have at least one line (straight segment)
    const lines = drawing.shapes.filter(s => s.type === 'line');
    expect(lines.length).toBeGreaterThan(0);
    
    // Lines should have valid start and end points
    lines.forEach(line => {
      const geometry = line.geometry as any;
      expect(geometry.start).toBeDefined();
      expect(geometry.end).toBeDefined();
      expect(typeof geometry.start.x).toBe('number');
      expect(typeof geometry.start.y).toBe('number');
      expect(typeof geometry.end.x).toBe('number');
      expect(typeof geometry.end.y).toBe('number');
    });
  });
  
  it('should handle bulged segments as arcs with correct properties', async () => {
    const dxfPath = path.resolve('tests/dxf/polylines_with_bulge.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    const drawing = await parseDXF(dxfContent, { decomposePolylines: true });
    
    // Should have at least one arc (bulged segment)
    const arcs = drawing.shapes.filter(s => s.type === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
    
    // Arcs should have valid geometry
    arcs.forEach(arc => {
      const geometry = arc.geometry as any;
      expect(geometry.center).toBeDefined();
      expect(geometry.radius).toBeDefined();
      expect(geometry.startAngle).toBeDefined();
      expect(geometry.endAngle).toBeDefined();
      expect(typeof geometry.clockwise).toBe('boolean');
      
      // Radius should be positive
      expect(geometry.radius).toBeGreaterThan(0);
      
      // Angles should be valid numbers
      expect(isFinite(geometry.startAngle)).toBe(true);
      expect(isFinite(geometry.endAngle)).toBe(true);
    });
  });
});