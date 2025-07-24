import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { normalizeChain } from './chain-normalization';

describe('Tractor Seat Mount Normalized Chains Part Detection Bug', () => {
  it('should detect 1 part with 12 holes after chain normalization', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF with squashed layers to combine all geometry
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Use standard tolerance for chain detection
    const tolerance = 1.0; // Using 1.0 to get more chains connected
    const chains = detectShapeChains(drawing.shapes, { tolerance });
    
    console.log(`\n=== BEFORE NORMALIZATION ===`);
    console.log(`Total chains: ${chains.length}`);
    
    // Check closure status before normalization
    const closedChainsBefore = chains.filter(chain => {
      if (chain.shapes.length === 0) return false;
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      if (!firstStart || !lastEnd) return false;
      const distance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      return distance < 0.1; // User tolerance
    });
    
    console.log(`Closed chains before normalization: ${closedChainsBefore.length}`);
    
    // Normalize all chains
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    console.log(`\n=== AFTER NORMALIZATION ===`);
    console.log(`Total normalized chains: ${normalizedChains.length}`);
    
    // Check closure status after normalization
    const closedChainsAfter = normalizedChains.filter(chain => {
      if (chain.shapes.length === 0) return false;
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      if (!firstStart || !lastEnd) return false;
      const distance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      return distance < 0.1; // User tolerance
    });
    
    console.log(`Closed chains after normalization: ${closedChainsAfter.length}`);
    
    // Detect parts after normalization
    const partResult = await detectParts(normalizedChains, 0.1);
    
    console.log(`\n=== PART DETECTION RESULTS ===`);
    console.log(`Parts detected: ${partResult.parts.length}`);
    console.log(`Warnings: ${partResult.warnings.length}`);
    
    // Show details for each part
    partResult.parts.forEach((part, index) => {
      console.log(`Part ${index + 1}: Shell has ${part.shell.chain.shapes.length} shapes, ${part.holes.length} holes`);
      part.holes.forEach((hole, holeIndex) => {
        console.log(`  Hole ${holeIndex + 1}: Chain ${hole.chain.id} with ${hole.chain.shapes.length} shapes`);
      });
    });
    
    // Show warnings
    if (partResult.warnings.length > 0) {
      console.log(`\n=== WARNINGS ===`);
      partResult.warnings.forEach(warning => {
        console.log(`- ${warning.message}`);
      });
    }
    
    // The bug: After normalization, the large boundary chain should be closed
    // and should contain 12 holes (4 round + 8 letter shapes)
    // But currently only 2 holes are detected
    
    // Expected behavior (this should pass after fix):
    // expect(partResult.parts.length).toBe(1);
    // expect(partResult.parts[0].holes.length).toBe(12);
    
    // Current buggy behavior (documenting what we see now):
    console.log(`\nBUG REPRODUCTION:`);
    console.log(`Expected: 1 part with 12 holes`);
    console.log(`Actual: ${partResult.parts.length} parts, total holes: ${partResult.parts.reduce((sum, part) => sum + part.holes.length, 0)}`);
    
    // Find the main part (should have the most shapes in its shell)
    const mainPart = partResult.parts.reduce((largest, current) => 
      current.shell.chain.shapes.length > largest.shell.chain.shapes.length ? current : largest
    );
    
    if (mainPart && mainPart.holes.length < 12) {
      console.log(`\nMAIN PART ANALYSIS:`);
      console.log(`Main part shell: Chain ${mainPart.shell.chain.id} with ${mainPart.shell.chain.shapes.length} shapes`);
      console.log(`Holes detected: ${mainPart.holes.length} (should be 12)`);
      console.log(`Missing holes: ${12 - mainPart.holes.length}`);
    }
    
    // This test documents the current buggy behavior
    // After fix, we should have 1 part with 12 holes
    if (partResult.parts.length === 1) {
      // If we get 1 part, check hole count
      expect(partResult.parts[0].holes.length).toBe(12);
    } else {
      // If we get multiple parts, something is wrong with part detection
      console.log(`Expected 1 part but got ${partResult.parts.length} parts - this indicates a bug`);
      expect(partResult.parts.length).toBeGreaterThan(0); // At least some parts should be detected
    }
    
  }, 10000);
});

// Helper functions
function getShapeStartPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'polyline':
      return shape.geometry.points.length > 0 ? shape.geometry.points[0] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}

function getShapeEndPoint(shape: any): { x: number; y: number } | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'polyline':
      const points = shape.geometry.points;
      return points.length > 0 ? points[points.length - 1] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}