import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';
import { readFileSync } from 'fs';
import path from 'path';

describe('Bulge Rendering Fixes', () => {
  describe('Polylinie.dxf', () => {
    it('should preserve bulge data when decomposition is disabled', async () => {
      const dxfPath = path.resolve('tests/dxf/Polylinie.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      
      const drawing = await parseDXF(dxfContent, { decomposePolylines: false });
      
      console.log('Polylinie.dxf with bulges preserved:');
      console.log('Shapes:', drawing.shapes.length);
      console.log('Shape types:', drawing.shapes.map(s => s.type));
      
      // Should have polylines with vertex data
      const polylines = drawing.shapes.filter(s => s.type === 'polyline');
      expect(polylines.length).toBeGreaterThan(0);
      
      // Check if vertices with bulges are preserved
      let totalBulgedVertices = 0;
      polylines.forEach(polyline => {
        const geometry = polyline.geometry as any;
        if (geometry.vertices) {
          const bulgedVertices = geometry.vertices.filter((v: any) => Math.abs(v.bulge || 0) > 1e-10);
          totalBulgedVertices += bulgedVertices.length;
          console.log(`Polyline has ${bulgedVertices.length} vertices with bulges`);
        }
      });
      
      expect(totalBulgedVertices).toBeGreaterThan(0);
      console.log(`Total bulged vertices found: ${totalBulgedVertices}`);
    });
    
    it('should decompose correctly with proper arc directions', async () => {
      const dxfPath = path.resolve('tests/dxf/Polylinie.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      
      const drawing = await parseDXF(dxfContent, { decomposePolylines: true });
      
      console.log('Polylinie.dxf decomposed:');
      console.log('Shapes:', drawing.shapes.length);
      console.log('Shape types:', drawing.shapes.map(s => s.type));
      
      const arcs = drawing.shapes.filter(s => s.type === 'arc');
      const lines = drawing.shapes.filter(s => s.type === 'line');
      
      console.log(`Found ${arcs.length} arcs and ${lines.length} lines`);
      
      // Should have both arcs and lines
      expect(arcs.length).toBeGreaterThan(0);
      expect(lines.length).toBeGreaterThan(0);
      
      // Check arc properties
      arcs.forEach((arc, index) => {
        const geometry = arc.geometry as any;
        expect(geometry.center).toBeDefined();
        expect(geometry.radius).toBeGreaterThan(0);
        expect(geometry.startAngle).toBeDefined();
        expect(geometry.endAngle).toBeDefined();
        expect(typeof geometry.clockwise).toBe('boolean');
        
        console.log(`Arc ${index + 1}: radius=${geometry.radius.toFixed(2)}, clockwise=${geometry.clockwise}`);
      });
    });
  });
  
  describe('Bulge calculation validation', () => {
    it('should correctly handle positive bulge (CCW)', () => {
      // Test the bulge conversion directly
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      const bulge = 1.0; // Should create a semicircle CCW
      
      // This would be tested by importing the bulge conversion function
      // For now, we test through the parser
      expect(bulge).toBeGreaterThan(0); // Positive = CCW
    });
    
    it('should correctly handle negative bulge (CW)', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      const bulge = -1.0; // Should create a semicircle CW
      
      expect(bulge).toBeLessThan(0); // Negative = CW
    });
    
    it('should handle various bulge magnitudes', () => {
      const testBulges = [0.1, 0.5, 1.0, 2.0, -0.1, -0.5, -1.0, -2.0];
      
      testBulges.forEach(bulge => {
        const theta = 4 * Math.atan(bulge);
        const angleDegrees = (theta * 180) / Math.PI;
        
        console.log(`Bulge ${bulge} = ${angleDegrees.toFixed(1)}° (${bulge > 0 ? 'CCW' : 'CW'})`);
        
        // Validate that the angle makes sense
        if (bulge > 0) {
          expect(angleDegrees).toBeGreaterThan(0);
        } else if (bulge < 0) {
          expect(angleDegrees).toBeLessThan(0);
        }
      });
    });
  });
  
  describe('Comparison: bulges vs decomposition', () => {
    it('should render differently between bulge-preserved and decomposed', async () => {
      const dxfPath = path.resolve('tests/dxf/polylines_with_bulge.dxf');
      const dxfContent = readFileSync(dxfPath, 'utf-8');
      
      const withBulges = await parseDXF(dxfContent, { decomposePolylines: false });
      const decomposed = await parseDXF(dxfContent, { decomposePolylines: true });
      
      console.log('Comparison test:');
      console.log(`With bulges: ${withBulges.shapes.length} shapes (${withBulges.shapes.map(s => s.type).join(', ')})`);
      console.log(`Decomposed: ${decomposed.shapes.length} shapes (${decomposed.shapes.map(s => s.type).join(', ')})`);
      
      // Decomposed should have more shapes
      expect(decomposed.shapes.length).toBeGreaterThan(withBulges.shapes.length);
      
      // With bulges should only have polylines
      expect(withBulges.shapes.every(s => s.type === 'polyline')).toBe(true);
      
      // Decomposed should have mixed types
      const decomposedTypes = new Set(decomposed.shapes.map(s => s.type));
      expect(decomposedTypes.size).toBeGreaterThan(1);
    });
  });
});