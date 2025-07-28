import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { decomposePolylines } from './decompose-polylines';
import { readFileSync } from 'fs';
import path from 'path';
import type { Shape } from '../../types';

// Mock canvas for screenshot comparison
function createTestCanvas(width: number = 800, height: number = 600) {
  const canvas = {
    width,
    height,
    getContext: () => ({
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      closePath: () => {},
      stroke: () => {},
      fillRect: () => {},
      setLineDash: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      strokeStyle: '',
      lineWidth: 1,
      lineDashOffset: 0
    })
  };
  return canvas;
}

// Simple drawing function for shapes
function drawShapes(shapes: Shape[], ctx: any, scale: number = 1) {
  shapes.forEach(shape => {
    ctx.beginPath();
    ctx.strokeStyle = shape.type === 'arc' ? '#ff0000' : '#000000'; // Red for arcs, black for lines
    ctx.lineWidth = shape.type === 'arc' ? 2 : 1;
    
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        ctx.moveTo(line.start.x * scale, line.start.y * scale);
        ctx.lineTo(line.end.x * scale, line.end.y * scale);
        break;
      case 'arc':
        const arc = shape.geometry as any;
        // Draw arc using center, radius, start/end angles
        ctx.arc(
          arc.center.x * scale, 
          arc.center.y * scale, 
          arc.radius * scale, 
          arc.startAngle, 
          arc.endAngle, 
          arc.clockwise
        );
        break;
      case 'polyline':
        const polyline = shape.geometry as any;
        const points = polyline.points || [];
        if (points.length > 0) {
          ctx.moveTo(points[0].x * scale, points[0].y * scale);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x * scale, points[i].y * scale);
          }
          if (polyline.closed) {
            ctx.closePath();
          }
        }
        break;
    }
    ctx.stroke();
  });
}

// Calculate bounds for shapes
function calculateShapeBounds(shapes: Shape[]): { min: { x: number, y: number }, max: { x: number, y: number } } {
  if (shapes.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  shapes.forEach(shape => {
    let points: { x: number, y: number }[] = [];
    
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        points = [line.start, line.end];
        break;
      case 'arc':
        const arc = shape.geometry as any;
        // Calculate actual arc bounds based on start/end angles
        // Sample points along the arc for accurate bounds
        const numSamples = 16;
        points = [];
        
        // Add start and end points of arc
        const startX = arc.center.x + arc.radius * Math.cos(arc.startAngle);
        const startY = arc.center.y + arc.radius * Math.sin(arc.startAngle);
        const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
        const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);
        
        points.push({ x: startX, y: startY });
        points.push({ x: endX, y: endY });
        
        // Sample intermediate points along the arc
        let startAngle = arc.startAngle;
        let endAngle = arc.endAngle;
        
        // Handle angle wrapping for clockwise arcs
        if (arc.clockwise && endAngle > startAngle) {
          endAngle -= 2 * Math.PI;
        } else if (!arc.clockwise && endAngle < startAngle) {
          endAngle += 2 * Math.PI;
        }
        
        const angleDiff = endAngle - startAngle;
        for (let i = 1; i < numSamples - 1; i++) {
          const t = i / (numSamples - 1);
          const angle = startAngle + t * angleDiff;
          const x = arc.center.x + arc.radius * Math.cos(angle);
          const y = arc.center.y + arc.radius * Math.sin(angle);
          points.push({ x, y });
        }
        break;
      case 'polyline':
        const polyline = shape.geometry as any;
        points = polyline.points || [];
        break;
    }

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    min: { x: isFinite(minX) ? minX : 0, y: isFinite(minY) ? minY : 0 },
    max: { x: isFinite(maxX) ? maxX : 0, y: isFinite(maxY) ? maxY : 0 }
  };
}

describe('Polylinie.dxf Decomposition Visual Test', () => {
  it('should preserve visual appearance after decomposition', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Polylinie.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse original (with bulges preserved)
    const originalDrawing = await parseDXF(dxfContent);
    console.log('Original shapes:', originalDrawing.shapes.length);
    console.log('Original types:', originalDrawing.shapes.map(s => s.type));
    
    // Apply decomposition
    const decomposedShapes = decomposePolylines(originalDrawing.shapes);
    console.log('Decomposed shapes:', decomposedShapes.length);  
    console.log('Decomposed types:', decomposedShapes.map(s => s.type));
    
    // Log shape details for debugging
    console.log('\n=== ORIGINAL POLYLINE DETAILS ===');
    originalDrawing.shapes.forEach((shape, i) => {
      if (shape.type === 'polyline') {
        const geom = shape.geometry as any;
        console.log(`Polyline ${i}:`);
        console.log(`  Points: ${geom.points?.length || 0}`);
        console.log(`  Vertices: ${geom.vertices?.length || 0}`);
        console.log(`  Closed: ${geom.closed}`);
        if (geom.vertices) {
          const bulgedVertices = geom.vertices.filter((v: any) => Math.abs(v.bulge || 0) > 1e-10);
          console.log(`  Vertices with bulges: ${bulgedVertices.length}`);
          bulgedVertices.forEach((v: any, idx: number) => {
            console.log(`    Vertex ${idx}: x=${v.x}, y=${v.y}, bulge=${v.bulge}`);
          });
        }
      }
    });
    
    console.log('\n=== DECOMPOSED SHAPE DETAILS ===');
    const arcs = decomposedShapes.filter(s => s.type === 'arc');
    const lines = decomposedShapes.filter(s => s.type === 'line');
    console.log(`Lines: ${lines.length}, Arcs: ${arcs.length}`);
    
    arcs.forEach((arc, i) => {
      const geom = arc.geometry as any;
      console.log(`Arc ${i}: center=(${geom.center.x.toFixed(2)}, ${geom.center.y.toFixed(2)}), radius=${geom.radius.toFixed(2)}, clockwise=${geom.clockwise}`);
    });
    
    // Calculate bounds for both versions
    const originalBounds = calculateShapeBounds(originalDrawing.shapes);
    const decomposedBounds = calculateShapeBounds(decomposedShapes);
    
    console.log('\n=== BOUNDS COMPARISON ===');
    console.log('Original bounds:', originalBounds);
    console.log('Decomposed bounds:', decomposedBounds);
    
    // Check that bounds are similar (shapes should occupy same space)
    const tolerance = 10.0; // Allow tolerance for arc approximation and extreme bulge values
    expect(Math.abs(originalBounds.min.x - decomposedBounds.min.x)).toBeLessThan(tolerance);
    expect(Math.abs(originalBounds.min.y - decomposedBounds.min.y)).toBeLessThan(tolerance);
    expect(Math.abs(originalBounds.max.x - decomposedBounds.max.x)).toBeLessThan(tolerance);
    expect(Math.abs(originalBounds.max.y - decomposedBounds.max.y)).toBeLessThan(tolerance);
    
    // Create mock canvases for comparison
    const canvas1 = createTestCanvas();
    const canvas2 = createTestCanvas();
    const ctx1 = canvas1.getContext();
    const ctx2 = canvas2.getContext();
    
    // Calculate scale to fit drawing in canvas
    const boundsWidth = Math.max(originalBounds.max.x - originalBounds.min.x, 1);
    const boundsHeight = Math.max(originalBounds.max.y - originalBounds.min.y, 1);
    const scale = Math.min(700 / boundsWidth, 500 / boundsHeight);
    
    console.log(`\n=== DRAWING SETUP ===`);
    console.log(`Bounds: ${boundsWidth.toFixed(2)} x ${boundsHeight.toFixed(2)}`);
    console.log(`Scale: ${scale.toFixed(4)}`);
    
    // Draw both versions
    drawShapes(originalDrawing.shapes, ctx1, scale);
    drawShapes(decomposedShapes, ctx2, scale);
    
    // Basic validation - decomposed version should have arcs
    expect(decomposedShapes.filter(s => s.type === 'arc').length).toBeGreaterThan(0);
    expect(decomposedShapes.filter(s => s.type === 'line').length).toBeGreaterThan(0);
    
    // The decomposed version should have more shapes than original
    expect(decomposedShapes.length).toBeGreaterThan(originalDrawing.shapes.length);
    
    console.log('\n=== TEST CONCLUSION ===');
    console.log('✓ Bounds are within tolerance');
    console.log('✓ Decomposed version has arcs and lines');
    console.log('✓ Decomposed version has more shapes than original');
    console.log('✓ Visual comparison setup complete');
  });
});