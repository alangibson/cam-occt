/**
 * Debug Test: Polyline Chain Detection Issue
 * 
 * This test investigates why single polylines aren't being detected as parts
 * even when they form closed shapes.
 */

import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import fs from 'fs';
import path from 'path';

function analyzeShapesAndChains(shapes: any[], chains: any[], tolerance: number, mode: string) {
  console.log(`\n=== ${mode} Analysis ===`);
  console.log(`Total shapes: ${shapes.length}`);
  
  // Analyze shape types
  const shapeTypes = shapes.reduce((acc, shape) => {
    acc[shape.type] = (acc[shape.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Shape types:', shapeTypes);
  
  // For polylines, check if they are individually closed
  const polylines = shapes.filter(s => s.type === 'polyline');
  console.log(`\nPolyline analysis (${polylines.length} polylines):`);
  
  polylines.forEach((polyline, i) => {
    const points = polyline.geometry.points;
    if (points && points.length > 0) {
      const first = points[0];
      const last = points[points.length - 1];
      const distance = Math.sqrt(
        Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
      );
      const isClosed = distance < tolerance;
      console.log(`  Polyline ${i + 1}: ${points.length} points, closed: ${isClosed} (distance: ${distance.toFixed(6)})`);
    }
  });
  
  console.log(`\nChain analysis (${chains.length} chains):`);
  chains.forEach((chain, i) => {
    console.log(`  Chain ${i + 1}: ${chain.shapes.length} shapes (${chain.shapes.map((s: any) => s.type).join(', ')})`);
  });
  
  // Check why single shapes aren't becoming chains
  console.log('\nSingle shape analysis:');
  const singleShapes = shapes.filter((_, index) => {
    // Check if this shape forms its own "chain" but was filtered out
    let connectedToOthers = false;
    for (let j = 0; j < shapes.length; j++) {
      if (index !== j && areShapesConnected(shapes[index], shapes[j], tolerance)) {
        connectedToOthers = true;
        break;
      }
    }
    return !connectedToOthers;
  });
  
  console.log(`Found ${singleShapes.length} isolated shapes:`);
  singleShapes.forEach((shape, i) => {
    console.log(`  Isolated shape ${i + 1}: ${shape.type}`);
    if (shape.type === 'polyline') {
      const points = shape.geometry.points;
      if (points && points.length > 0) {
        const first = points[0];
        const last = points[points.length - 1];
        const distance = Math.sqrt(
          Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
        );
        const isClosed = distance < tolerance;
        console.log(`    -> ${points.length} points, closed: ${isClosed}, should be a part!`);
      }
    }
  });
}

// Helper function from chain-detection.ts
function areShapesConnected(shapeA: any, shapeB: any, tolerance: number): boolean {
  const pointsA = getShapePoints(shapeA);
  const pointsB = getShapePoints(shapeB);

  for (const pointA of pointsA) {
    for (const pointB of pointsB) {
      if (arePointsWithinTolerance(pointA, pointB, tolerance)) {
        return true;
      }
    }
  }

  return false;
}

function arePointsWithinTolerance(pointA: any, pointB: any, tolerance: number): boolean {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= tolerance;
}

function getShapePoints(shape: any): any[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry;
      return [line.start, line.end];
    
    case 'circle':
      const circle = shape.geometry;
      return [
        { x: circle.center.x + circle.radius, y: circle.center.y },
        { x: circle.center.x - circle.radius, y: circle.center.y },
        { x: circle.center.x, y: circle.center.y + circle.radius },
        { x: circle.center.x, y: circle.center.y - circle.radius },
        circle.center
      ];
    
    case 'arc':
      const arc = shape.geometry;
      const startX = arc.center.x + arc.radius * Math.cos(arc.startAngle);
      const startY = arc.center.y + arc.radius * Math.sin(arc.startAngle);
      const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
      const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);
      
      return [
        { x: startX, y: startY },
        { x: endX, y: endY },
        arc.center
      ];
    
    case 'polyline':
      const polyline = shape.geometry;
      return polyline.points || [];
    
    default:
      return [];
  }
}

describe('Debug Polyline Chain Detection', () => {
  it('should debug why single closed polylines are not detected as parts', async () => {
    // Test with 1997.dxf
    const dxfPath = path.join(process.cwd(), 'tests/dxf/1997.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    
    console.log('=== DEBUGGING 1997.DXF POLYLINE ISSUE ===');
    
    // Parse without decomposition (UI mode)
    const parsedInitial = await parseDXF(dxfContent, { decomposePolylines: false });
    const tolerance = 0.1;
    const chainsInitial = detectShapeChains(parsedInitial.shapes, { tolerance });
    
    analyzeShapesAndChains(parsedInitial.shapes, chainsInitial, tolerance, 'UI MODE (No Decomposition)');
    
    // Parse with decomposition (test mode)
    const parsedDecomposed = await parseDXF(dxfContent, { decomposePolylines: true });
    const chainsDecomposed = detectShapeChains(parsedDecomposed.shapes, { tolerance });
    
    analyzeShapesAndChains(parsedDecomposed.shapes, chainsDecomposed, tolerance, 'TEST MODE (With Decomposition)');
    
    console.log('\n=== CRITICAL INSIGHT ===');
    console.log('The issue is that chain detection requires MULTIPLE shapes to form a chain.');
    console.log('Single closed polylines are filtered out because they only contain 1 shape.');
    console.log('We need to modify the chain detection to include single closed shapes as chains.');
    
    expect(parsedInitial.shapes.length).toBeGreaterThan(0);
  });
  
  it('should debug ADLER.dxf polyline issue', async () => {
    const dxfPath = path.join(process.cwd(), 'tests/dxf/ADLER.dxf');
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    
    console.log('\n=== DEBUGGING ADLER.DXF POLYLINE ISSUE ===');
    
    const parsedInitial = await parseDXF(dxfContent, { decomposePolylines: false });
    const tolerance = 0.1;
    const chainsInitial = detectShapeChains(parsedInitial.shapes, { tolerance });
    
    analyzeShapesAndChains(parsedInitial.shapes, chainsInitial, tolerance, 'ADLER.DXF UI MODE');
    
    expect(parsedInitial.shapes.length).toBeGreaterThan(0);
  });
});