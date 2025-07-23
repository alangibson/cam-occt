import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';
import { readFileSync } from 'fs';

describe('DXF Parser', () => {
  it('should be able to import the DXF parser module without errors', async () => {
    expect(typeof parseDXF).toBe('function');
  });
  
  it('should handle empty DXF content gracefully', async () => {
    // Test with minimal DXF that won't have entities
    const emptyDXF = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;
    
    // This should parse successfully and return empty shapes array
    const result = await parseDXF(emptyDXF);
    expect(result).toBeDefined();
    expect(result.shapes).toBeDefined();
    expect(Array.isArray(result.shapes)).toBe(true);
    expect(result.shapes).toHaveLength(0);
  });
  
  it('should parse ARC entities from real DXF file', async () => {
    const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');
    
    console.log('DXF file contains ARC entities:', dxfContent.includes('ARC'));
    
    const drawing = await parseDXF(dxfContent);
    
    console.log('Parsed drawing shapes:', drawing.shapes.length);
    console.log('Shape types:', drawing.shapes.map(s => s.type));
    
    // Should have parsed some shapes
    expect(drawing.shapes.length).toBeGreaterThan(0);
    
    // Should contain ARC entities
    const arcShapes = drawing.shapes.filter(s => s.type === 'arc');
    console.log('ARC shapes found:', arcShapes.length);
    
    expect(arcShapes.length).toBeGreaterThan(0);
  });
  
  it('should debug DXF parsing with raw library output', async () => {
    const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');
    
    // Test the raw DXF parsing library directly
    const { parseString } = await import('dxf');
    const parsed = parseString(dxfContent);
    
    console.log('Raw DXF parse result structure:');
    console.log('- Has entities:', !!parsed.entities);
    console.log('- Entity count:', parsed.entities?.length || 0);
    console.log('- Entity types:', parsed.entities?.map((e: any) => e.type) || []);
    console.log('- ARC entities:', parsed.entities?.filter((e: any) => e.type === 'ARC') || []);
    console.log('- Sample ARC entity:', JSON.stringify(parsed.entities?.find((e: any) => e.type === 'ARC'), null, 2));
    
    expect(parsed.entities).toBeDefined();
    expect(parsed.entities.length).toBeGreaterThan(0);
  });

  it('should debug SPLINE parsing with raw library output', async () => {
    const dxfContent = readFileSync('tests/dxf/polygons/nested-splines.dxf', 'utf-8');
    
    // Test the raw DXF parsing library directly
    const { parseString } = await import('dxf');
    const parsed = parseString(dxfContent);
    
    console.log('SPLINE DXF parse result structure:');
    console.log('- Has entities:', !!parsed.entities);
    console.log('- Entity count:', parsed.entities?.length || 0);
    console.log('- Entity types:', parsed.entities?.map((e: any) => e.type) || []);
    console.log('- SPLINE entities count:', parsed.entities?.filter((e: any) => e.type === 'SPLINE').length || 0);
    
    const splineEntity = parsed.entities?.find((e: any) => e.type === 'SPLINE');
    if (splineEntity) {
      console.log('- Sample SPLINE entity structure:');
      console.log('  - controlPoints:', splineEntity.controlPoints?.length || 0, 'points');
      console.log('  - knots:', splineEntity.knots?.length || 0, 'knots');
      console.log('  - degree:', splineEntity.degree);
      console.log('  - fitPoints:', splineEntity.fitPoints?.length || 0, 'fit points');
      console.log('  - Full SPLINE:', JSON.stringify(splineEntity, null, 2));
    }
    
    expect(parsed.entities).toBeDefined();
    expect(parsed.entities.length).toBeGreaterThan(0);
  });

  it('should parse CIRCLE entities from real DXF file', async () => {
    const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');
    
    // Test the raw DXF parsing library directly
    const { parseString } = await import('dxf');
    const parsed = parseString(dxfContent);
    
    console.log('CIRCLE entities in raw parse:', parsed.entities?.filter((e: any) => e.type === 'CIRCLE') || []);
    console.log('Sample CIRCLE entity:', JSON.stringify(parsed.entities?.find((e: any) => e.type === 'CIRCLE'), null, 2));
    
    const drawing = await parseDXF(dxfContent);
    
    console.log('Parsed drawing shapes:', drawing.shapes.length);
    console.log('Shape types:', drawing.shapes.map(s => s.type));
    
    // Should contain CIRCLE entities
    const circleShapes = drawing.shapes.filter(s => s.type === 'circle');
    console.log('CIRCLE shapes found:', circleShapes.length);
    
    if (parsed.entities?.some((e: any) => e.type === 'CIRCLE')) {
      expect(circleShapes.length).toBeGreaterThan(0);
    }
  });

  it('should parse SPLINE entities from real DXF file', async () => {
    const dxfContent = readFileSync('tests/dxf/polygons/nested-splines.dxf', 'utf-8');
    
    console.log('DXF file contains SPLINE entities:', dxfContent.includes('SPLINE'));
    
    const drawing = await parseDXF(dxfContent);
    
    console.log('Parsed drawing shapes:', drawing.shapes.length);
    console.log('Shape types:', drawing.shapes.map(s => s.type));
    
    // Should have parsed some shapes
    expect(drawing.shapes.length).toBeGreaterThan(0);
    
    // Should contain SPLINE entities (might be converted to other shapes)
    const splineShapes = drawing.shapes.filter(s => s.type === 'spline');
    const polylineShapes = drawing.shapes.filter(s => s.type === 'polyline');
    console.log('SPLINE shapes found:', splineShapes.length);
    console.log('POLYLINE shapes found (might be converted splines):', polylineShapes.length);
    
    // Either should have splines or converted polylines
    expect(splineShapes.length + polylineShapes.length).toBeGreaterThan(0);
  });
});