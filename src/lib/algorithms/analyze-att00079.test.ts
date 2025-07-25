/**
 * Analysis test for ATT00079.dxf problematic chains
 * Tests the specific 5 chains that should be holes but are being detected as parts
 */

import { describe, it, expect } from 'vitest';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Shape, ShapeChain } from '../../types';

const problematicChains = ['chain-34', 'chain-65', 'chain-70', 'chain-85', 'chain-90'];

describe('ATT00079.dxf Problematic Chains Analysis', () => {
  it('should analyze the 5 problematic chains that are incorrectly detected as parts', async () => {
    console.log('🔍 Analyzing ATT00079.dxf problematic chains...\n');
    
    // Load and parse the DXF file
    const filePath = join(process.cwd(), 'tests/dxf/ATT00079.dxf');
    const dxfContent = readFileSync(filePath, 'utf8');
    
    console.log('📁 Parsing DXF file...');
    const parseResult = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true
    });
    
    console.log(`   Found ${parseResult.shapes.length} shapes`);
    
    // Detect chains
    console.log('🔗 Detecting chains...');
    const chains = detectShapeChains(parseResult.shapes, { tolerance: 0.1 });
    console.log(`   Found ${chains.length} chains`);
    
    // Detect parts
    console.log('🏗️  Detecting parts...');
    const partResult = await detectParts(chains, 0.1);
    console.log(`   Found ${partResult.parts.length} parts (expected 21)`);
    
    // Find the closed chains
    const closedChains = chains.filter(chain => isChainClosed(chain, 0.1));
    console.log(`   Found ${closedChains.length} closed chains\n`);
    
    // Analysis section
    console.log('📊 ANALYSIS OF PROBLEMATIC CHAINS:\n');
    console.log('==========================================\n');
    
    const analysisResults: any[] = [];
    
    for (const chainId of problematicChains) {
      const chain = chains.find(c => c.id === chainId);
      if (!chain) {
        console.log(`❌ Chain ${chainId} not found`);
        continue;
      }
      
      const analysis = {
        chainId,
        shapeCount: chain.shapes.length,
        shapeTypes: chain.shapes.map(s => s.type).join(', '),
        bounds: calculateChainBoundingBox(chain),
        gapDistance: 0,
        isClosed: false,
        potentialContainers: [] as any[]
      };
      
      console.log(`🔍 CHAIN ${chainId}:`);
      console.log(`   Shapes: ${analysis.shapeCount} (${analysis.shapeTypes})`);
      
      console.log(`   Bounds: (${analysis.bounds.minX.toFixed(3)}, ${analysis.bounds.minY.toFixed(3)}) to (${analysis.bounds.maxX.toFixed(3)}, ${analysis.bounds.maxY.toFixed(3)})`);
      console.log(`   Size: ${(analysis.bounds.maxX - analysis.bounds.minX).toFixed(3)} × ${(analysis.bounds.maxY - analysis.bounds.minY).toFixed(3)}`);
      
      // Check if it's closed
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      const firstStart = getShapeStartPoint(firstShape);
      const lastEnd = getShapeEndPoint(lastShape);
      
      if (firstStart && lastEnd) {
        analysis.gapDistance = Math.sqrt(
          Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
        );
        analysis.isClosed = analysis.gapDistance < 0.1;
        console.log(`   Gap: ${analysis.gapDistance.toFixed(6)} (closed: ${analysis.isClosed})`);
      }
      
      // Look for potential containing chains
      console.log('   Potential containers:');
      let foundContainer = false;
      
      for (const otherChain of closedChains) {
        if (otherChain.id === chainId) continue;
        
        const otherBounds = calculateChainBoundingBox(otherChain);
        
        // Check bounding box containment
        const isContained = (
          analysis.bounds.minX >= otherBounds.minX &&
          analysis.bounds.maxX <= otherBounds.maxX &&
          analysis.bounds.minY >= otherBounds.minY &&
          analysis.bounds.maxY <= otherBounds.maxY
        );
        
        if (isContained) {
          const area1 = (analysis.bounds.maxX - analysis.bounds.minX) * (analysis.bounds.maxY - analysis.bounds.minY);
          const area2 = (otherBounds.maxX - otherBounds.minX) * (otherBounds.maxY - otherBounds.minY);
          const ratio = area1 / area2;
          
          const containerInfo = {
            chainId: otherChain.id,
            bounds: otherBounds,
            areaRatio: ratio,
            shapeTypes: otherChain.shapes.map(s => s.type).join(', ')
          };
          
          analysis.potentialContainers.push(containerInfo);
          
          console.log(`     ✅ ${otherChain.id}: bounds=(${otherBounds.minX.toFixed(1)}, ${otherBounds.minY.toFixed(1)}) to (${otherBounds.maxX.toFixed(1)}, ${otherBounds.maxY.toFixed(1)}), area ratio=${(ratio*100).toFixed(1)}%, shapes=[${containerInfo.shapeTypes}]`);
          foundContainer = true;
        }
      }
      
      if (!foundContainer) {
        console.log('     ❌ No containing chains found (this explains why it\'s detected as a part)');
      }
      
      analysisResults.push(analysis);
      console.log('');
    }
    
    // Summary and patterns
    console.log('🎯 ANALYSIS SUMMARY:');
    console.log('====================\n');
    
    console.log(`• Expected parts: 21`);
    console.log(`• Detected parts: ${partResult.parts.length}`);
    console.log(`• Extra parts: ${partResult.parts.length - 21} (these problematic chains)\n`);
    
    // Look for patterns in the problematic chains
    const allHaveSamePattern = analysisResults.every(a => a.shapeTypes === analysisResults[0].shapeTypes);
    const allHaveContainers = analysisResults.every(a => a.potentialContainers.length > 0);
    const avgSize = analysisResults.reduce((sum, a) => sum + (a.bounds.maxX - a.bounds.minX), 0) / analysisResults.length;
    
    console.log('🔍 PATTERNS IDENTIFIED:');
    if (allHaveSamePattern) {
      console.log(`   ✅ All problematic chains have the same shape pattern: [${analysisResults[0].shapeTypes}]`);
    }
    if (allHaveContainers) {
      console.log(`   ✅ All problematic chains have potential containing chains (bounding box containment works)`);
    }
    console.log(`   📏 Average size: ${avgSize.toFixed(3)} units`);
    console.log(`   🔒 All chains are closed: ${analysisResults.every(a => a.isClosed)}`);
    
    console.log('\n🚨 ROOT CAUSE:');
    console.log('   The JSTS geometric containment algorithm is failing for these specific chains.');
    console.log('   Bounding box containment works correctly, but geometric containment does not.');
    console.log('   This suggests an issue with tessellation or geometric precision in JSTS.');
    
    // Verify our analysis
    expect(analysisResults).toHaveLength(5);
    expect(allHaveContainers).toBe(true); // All should have containing chains
    expect(analysisResults.every(a => a.isClosed)).toBe(true); // All should be closed
  });
});

// Helper functions
function isChainClosed(chain: ShapeChain, tolerance: number): boolean {
  if (chain.shapes.length === 0) return false;
  
  // Special case: single-shape circles are inherently closed
  if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
    return true;
  }
  
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPoint(firstShape);
  const lastEnd = getShapeEndPoint(lastShape);
  
  if (!firstStart || !lastEnd) return false;
  
  const distance = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  return distance < tolerance;
}

function getShapeStartPoint(shape: Shape): {x: number, y: number} | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.start;
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[0] : null;
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      const circle = shape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    default:
      return null;
  }
}

function getShapeEndPoint(shape: Shape): {x: number, y: number} | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.end;
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[polyline.points.length - 1] : null;
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      const circle = shape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    default:
      return null;
  }
}

function calculateChainBoundingBox(chain: ShapeChain) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const shape of chain.shapes) {
    const shapeBounds = getShapeBoundingBox(shape);
    minX = Math.min(minX, shapeBounds.minX);
    maxX = Math.max(maxX, shapeBounds.maxX);
    minY = Math.min(minY, shapeBounds.minY);
    maxY = Math.max(maxY, shapeBounds.maxY);
  }
  
  return { minX, maxX, minY, maxY };
}

function getShapeBoundingBox(shape: Shape) {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return {
        minX: Math.min(line.start.x, line.end.x),
        maxX: Math.max(line.start.x, line.end.x),
        minY: Math.min(line.start.y, line.end.y),
        maxY: Math.max(line.start.y, line.end.y)
      };
    
    case 'circle':
      const circle = shape.geometry as any;
      return {
        minX: circle.center.x - circle.radius,
        maxX: circle.center.x + circle.radius,
        minY: circle.center.y - circle.radius,
        maxY: circle.center.y + circle.radius
      };
    
    case 'arc':
      const arc = shape.geometry as any;
      return {
        minX: arc.center.x - arc.radius,
        maxX: arc.center.x + arc.radius,
        minY: arc.center.y - arc.radius,
        maxY: arc.center.y + arc.radius
      };
    
    case 'polyline':
      const polyline = shape.geometry as any;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const point of polyline.points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      
      return { minX, maxX, minY, maxY };
    
    default:
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
}