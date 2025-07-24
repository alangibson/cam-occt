import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';

describe('Simple Chain Comparison - Find Root Differences', () => {
  it('should compare properties of working vs failing chains', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Detect chains
    const tolerance = 1.0;
    const chains = detectShapeChains(drawing.shapes, { tolerance });
    
    // Normalize chains
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    // Find the specific chains
    const chain7 = normalizedChains.find(chain => chain.id === 'chain-7');
    const chain8 = normalizedChains.find(chain => chain.id === 'chain-8');
    const chain9 = normalizedChains.find(chain => chain.id === 'chain-9');
    
    expect(chain7).toBeDefined();
    expect(chain8).toBeDefined();
    expect(chain9).toBeDefined();
    
    console.log(`\n=== BASIC CHAIN COMPARISON ===`);
    
    const chainsToCompare = [
      { name: 'chain-7 (WORKS)', chain: chain7!, status: 'CONTAINED' },
      { name: 'chain-8 (FAILS)', chain: chain8!, status: 'NOT CONTAINED' },
      { name: 'chain-9 (WORKS)', chain: chain9!, status: 'CONTAINED' }
    ];
    
    for (const { name, chain, status } of chainsToCompare) {
      console.log(`\n${name}:`);
      console.log(`  Shapes: ${chain.shapes.length}`);
      
      // Check gap distance
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      if (firstStart && lastEnd) {
        const gapDistance = Math.sqrt(
          Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
        );
        console.log(`  Gap: ${gapDistance.toFixed(6)} (closed: ${gapDistance < 0.1})`);
      }
      
      // Analyze shape types
      const shapeTypes = chain.shapes.map(shape => shape.type);
      const typeCounts = shapeTypes.reduce((counts, type) => {
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      console.log(`  Shape types: ${Object.entries(typeCounts).map(([type, count]) => `${type}:${count}`).join(', ')}`);
      
      // Check connectivity between sequential shapes
      let maxSequentialGap = 0;
      let connectivityIssues = 0;
      
      for (let i = 0; i < chain.shapes.length - 1; i++) {
        const currentEnd = getShapeEndPoint(chain.shapes[i]);
        const nextStart = getShapeStartPoint(chain.shapes[i + 1]);
        
        if (currentEnd && nextStart) {
          const gap = Math.sqrt(
            Math.pow(currentEnd.x - nextStart.x, 2) + Math.pow(currentEnd.y - nextStart.y, 2)
          );
          maxSequentialGap = Math.max(maxSequentialGap, gap);
          
          if (gap > 0.1) {
            connectivityIssues++;
          }
        }
      }
      
      console.log(`  Max sequential gap: ${maxSequentialGap.toFixed(6)}`);
      console.log(`  Connectivity issues: ${connectivityIssues}`);
      console.log(`  Expected result: ${status}`);
    }
    
    console.log(`\n=== KEY OBSERVATIONS ===`);
    
    // Compare the working chains vs the failing one
    const workingChains = [chain7!, chain9!];
    const failingChain = chain8!;
    
    // Check if there's a pattern in shape counts
    const workingShapeCounts = workingChains.map(c => c.shapes.length);
    const failingShapeCount = failingChain.shapes.length;
    
    console.log(`Working chain shapes: ${workingShapeCounts.join(', ')}`);
    console.log(`Failing chain shapes: ${failingShapeCount}`);
    
    // Check shape type patterns
    const getShapeTypePattern = (chain: any) => {
      const types = chain.shapes.map((s: any) => s.type);
      const counts = types.reduce((c: any, t: string) => { c[t] = (c[t] || 0) + 1; return c; }, {});
      return counts;
    };
    
    const workingPatterns = workingChains.map(getShapeTypePattern);
    const failingPattern = getShapeTypePattern(failingChain);
    
    console.log(`Working patterns:`);
    workingPatterns.forEach((pattern, i) => {
      console.log(`  Chain ${i + 1}: ${JSON.stringify(pattern)}`);
    });
    console.log(`Failing pattern: ${JSON.stringify(failingPattern)}`);
    
    // Look for differences
    const hasPolylines = (pattern: any) => pattern.polyline > 0;
    const hasLines = (pattern: any) => pattern.line > 0;
    
    const workingHavePolylines = workingPatterns.every(hasPolylines);
    const workingHaveLines = workingPatterns.every(hasLines);
    const failingHasPolylines = hasPolylines(failingPattern);
    const failingHasLines = hasLines(failingPattern);
    
    console.log(`\nPattern Analysis:`);
    console.log(`  Working chains have polylines: ${workingHavePolylines}`);
    console.log(`  Working chains have lines: ${workingHaveLines}`);
    console.log(`  Failing chain has polylines: ${failingHasPolylines}`);
    console.log(`  Failing chain has lines: ${failingHasLines}`);
    
    if (workingHavePolylines !== failingHasPolylines || workingHaveLines !== failingHasLines) {
      console.log(`  🔍 PATTERN DIFFERENCE DETECTED!`);
    }
    
    expect(chain7!.shapes.length).toBeGreaterThan(0);
    
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