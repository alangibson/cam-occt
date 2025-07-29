import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { normalizeChain } from './chain-normalization';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ShapeChain } from './chain-detection';
import type { Shape, Point2D } from '../../types';

// Helper function to test chain closure (copied from part-detection.ts)
function isChainClosedTest(chain: ShapeChain, tolerance: number = 0.1): boolean {
  if (chain.shapes.length === 0) return false;
  
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPointTest(firstShape);
  const lastEnd = getShapeEndPointTest(lastShape);
  
  if (!firstStart || !lastEnd) return false;
  
  // Check if the chain is closed (end connects to start within tolerance)
  const distance = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  return distance < tolerance;
}

function getShapeStartPointTest(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.start;
    case 'circle':
      const circle = shape.geometry as any;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[0] : null;
    case 'spline':
      const spline = shape.geometry as any;
      try {
        // Import and use NURBS evaluation for accurate start point
        const { evaluateNURBS } = require('../geometry/nurbs');
        return evaluateNURBS(0, spline);
      } catch (error) {
        // Fallback to fit points or control points
        if (spline.fitPoints && spline.fitPoints.length > 0) {
          return spline.fitPoints[0];
        }
        return spline.controlPoints.length > 0 ? spline.controlPoints[0] : null;
      }
    default:
      return null;
  }
}

function getShapeEndPointTest(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.end;
    case 'circle':
      const circle = shape.geometry as any;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[polyline.points.length - 1] : null;
    case 'spline':
      const spline = shape.geometry as any;
      try {
        // Import and use NURBS evaluation for accurate end point
        const { evaluateNURBS } = require('../geometry/nurbs');
        return evaluateNURBS(1, spline);
      } catch (error) {
        // Fallback to fit points or control points
        if (spline.fitPoints && spline.fitPoints.length > 0) {
          return spline.fitPoints[spline.fitPoints.length - 1];
        }
        return spline.controlPoints.length > 0 ? spline.controlPoints[spline.controlPoints.length - 1] : null;
      }
    default:
      return null;
  }
}

function calculateChainGapDistanceTest(chain: ShapeChain): number {
  if (chain.shapes.length === 0) return 0;
  
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPointTest(firstShape);
  const lastEnd = getShapeEndPointTest(lastShape);
  
  if (!firstStart || !lastEnd) return 0;
  
  return Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
}

describe('Part Detection - Tractor Light Mount Issue', () => {
  it('should detect 1 part for Tractor Light Mount - Left.dxf, not 7', async () => {
    // Load the test file
    const filePath = join(process.cwd(), 'tests/dxf/Tractor Light Mount - Left.dxf');
    const dxfContent = readFileSync(filePath, 'utf-8');
    
    // Parse the DXF file with layer squashing enabled
    const drawing = await parseDXF(dxfContent, { squashLayers: true });
    console.log(`Parsed ${drawing.shapes.length} shapes from Tractor Light Mount - Left.dxf`);
    
    // Log shape types for debugging
    const shapeTypes = new Map<string, number>();
    drawing.shapes.forEach(shape => {
      const count = shapeTypes.get(shape.type) || 0;
      shapeTypes.set(shape.type, count + 1);
    });
    console.log('Shape types:', Object.fromEntries(shapeTypes));
    
    // Use the standard default tolerance (0.1) as would be used from Program page
    const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
    console.log(`Detected ${chains.length} chains with default tolerance 0.1`);
    
    // CRITICAL: Normalize chains before analysis (matching part detection behavior)
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    // Detect parts using the same tolerance as chain detection
    const partResult = await detectParts(chains, 0.1);
    
    console.log(`Detected ${partResult.parts.length} parts`);
    console.log('Closed chains analysis (after normalization):');
    normalizedChains.forEach(chain => {
      const isClosed = isChainClosedTest(chain, 0.1);
      const gapDistance = calculateChainGapDistanceTest(chain);
      console.log(`  ${chain.id}: ${chain.shapes.length} shapes, closed: ${isClosed}, gap: ${gapDistance.toFixed(3)}`);
    });
    console.log('Part details:', partResult.parts.map(part => ({
      id: part.id,
      shellShapes: part.shell.chain.shapes.length,
      holeCount: part.holes.length,
      holeShapes: part.holes.map(hole => hole.chain.shapes.length)
    })));
    
    if (partResult.warnings.length > 0) {
      console.log('Warnings:', partResult.warnings);
    }
    
    // FIXED: Spline support has been added to chain detection
    // - Chain detection now properly handles splines for connectivity
    // - Single closed splines are now detected correctly  
    // - Result: 16 chains detected (correct!) with 1 shell + 15 holes
    console.log(`Fixed behavior: detecting ${partResult.parts.length} parts with ${partResult.parts[0]?.holes.length || 0} holes`);
    console.log(`Chains detected: ${chains.length} (fixed with spline support)`);
    
    // Verify correct part detection: 1 part with 15 holes
    expect(partResult.parts).toHaveLength(1);
    const part = partResult.parts[0];
    expect(part.shell).toBeDefined();
    expect(part.holes.length).toBe(15); // Now correctly detecting all 15 holes
    
    // Chain detection is now working correctly - detects all 16 closed chains: 
    // - chain-3: shell (14 shapes)
    // - chains 1,2,4-16: all holes (15 holes total)
    // - chain-16 is the large missing hole (39 shapes) that was previously undetected
    const closedChains = normalizedChains.filter(chain => isChainClosedTest(chain, 0.1));
    expect(closedChains.length).toBe(16); // All 16 chains are now properly detected as closed
  });
  
  it('should correctly detect 1 part for Tractor Seat Mount - Left.dxf as reference', async () => {
    // Load the working reference file
    const filePath = join(process.cwd(), 'tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(filePath, 'utf-8');
    
    // Parse the DXF file with layer squashing enabled
    const drawing = await parseDXF(dxfContent, { squashLayers: true });
    console.log(`Parsed ${drawing.shapes.length} shapes from Tractor Seat Mount - Left.dxf`);
    
    // Use the standard default tolerance (0.1) as would be used from Program page
    const chains = detectShapeChains(drawing.shapes, { tolerance: 0.1 });
    console.log(`Reference - Detected ${chains.length} chains with default tolerance 0.1`);
    
    // Detect parts using the same tolerance as chain detection
    const partResult = await detectParts(chains, 0.1);
    
    console.log(`Reference file detected ${partResult.parts.length} parts`);
    
    // CORRECT BEHAVIOR: Should detect 1 part  
    console.log(`Reference behavior: detecting ${partResult.parts.length} parts (should be 1)`);
    
    // Should detect 1 part as expected
    expect(partResult.parts).toHaveLength(1);
    // const part = partResult.parts[0];
    // expect(part.shell).toBeDefined();
    // expect(part.holes.length).toBeGreaterThan(0);
  });
});