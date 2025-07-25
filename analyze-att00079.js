/**
 * Analysis script for ATT00079.dxf problematic chains
 * Examines the 5 chains that should be holes but are being detected as parts
 */

import { parseDxf } from './src/lib/parsers/dxf-parser.js';
import { detectChains } from './src/lib/algorithms/chain-detection.js';
import { detectParts } from './src/lib/algorithms/part-detection.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const problematicChains = ['chain-34', 'chain-65', 'chain-70', 'chain-85', 'chain-90'];

async function analyzeATT00079() {
  console.log('🔍 Analyzing ATT00079.dxf problematic chains...\n');
  
  // Load and parse the DXF file
  const filePath = join(process.cwd(), 'tests/dxf/ATT00079.dxf');
  const dxfContent = readFileSync(filePath, 'utf8');
  
  console.log('📁 Parsing DXF file...');
  const parseResult = parseDxf(dxfContent, {
    decomposePolylines: true,
    translateToPositiveQuadrant: true
  });
  
  console.log(`   Found ${parseResult.shapes.length} shapes`);
  
  // Detect chains
  console.log('🔗 Detecting chains...');
  const chainResult = detectChains(parseResult.shapes, { tolerance: 0.1 });
  console.log(`   Found ${chainResult.chains.length} chains`);
  
  // Detect parts
  console.log('🏗️  Detecting parts...');
  const partResult = await detectParts(chainResult.chains, 0.1);
  console.log(`   Found ${partResult.parts.length} parts (expected 21)`);
  
  // Find the closed chains
  const closedChains = chainResult.chains.filter(chain => {
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (!firstStart || !lastEnd) return false;
    
    const distance = Math.sqrt(
      Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
    );
    
    return distance < 0.1;
  });
  
  console.log(`   Found ${closedChains.length} closed chains\n`);
  
  // Analysis section
  console.log('📊 ANALYSIS OF PROBLEMATIC CHAINS:\n');
  console.log('==========================================\n');
  
  for (const chainId of problematicChains) {
    const chain = chainResult.chains.find(c => c.id === chainId);
    if (!chain) {
      console.log(`❌ Chain ${chainId} not found`);
      continue;
    }
    
    console.log(`🔍 CHAIN ${chainId}:`);
    console.log(`   Shapes: ${chain.shapes.length} (${chain.shapes.map(s => s.type).join(', ')})`);
    
    // Calculate bounding box
    const bounds = calculateChainBoundingBox(chain);
    console.log(`   Bounds: (${bounds.minX.toFixed(3)}, ${bounds.minY.toFixed(3)}) to (${bounds.maxX.toFixed(3)}, ${bounds.maxY.toFixed(3)})`);
    console.log(`   Size: ${(bounds.maxX - bounds.minX).toFixed(3)} × ${(bounds.maxY - bounds.minY).toFixed(3)}`);
    
    // Check if it's closed
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (firstStart && lastEnd) {
      const gapDistance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      console.log(`   Gap: ${gapDistance.toFixed(6)} (closed: ${gapDistance < 0.1})`);
    }
    
    // Look for potential containing chains
    console.log('   Potential containers:');
    let foundContainer = false;
    
    for (const otherChain of closedChains) {
      if (otherChain.id === chainId) continue;
      
      const otherBounds = calculateChainBoundingBox(otherChain);
      
      // Check bounding box containment
      const isContained = (
        bounds.minX >= otherBounds.minX &&
        bounds.maxX <= otherBounds.maxX &&
        bounds.minY >= otherBounds.minY &&
        bounds.maxY <= otherBounds.maxY
      );
      
      if (isContained) {
        const area1 = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
        const area2 = (otherBounds.maxX - otherBounds.minX) * (otherBounds.maxY - otherBounds.minY);
        const ratio = area1 / area2;
        
        console.log(`     ✅ ${otherChain.id}: bounds=(${otherBounds.minX.toFixed(1)}, ${otherBounds.minY.toFixed(1)}) to (${otherBounds.maxX.toFixed(1)}, ${otherBounds.maxY.toFixed(1)}), area ratio=${(ratio*100).toFixed(1)}%`);
        foundContainer = true;
      }
    }
    
    if (!foundContainer) {
      console.log('     ❌ No containing chains found (this explains why it\'s detected as a part)');
    }
    
    console.log('');
  }
  
  // Summary
  console.log('🎯 SUMMARY:');
  console.log('===========\n');
  console.log(`• Expected parts: 21`);
  console.log(`• Detected parts: ${partResult.parts.length}`);
  console.log(`• Extra parts: ${partResult.parts.length - 21} (these 5 problematic chains)`);
  console.log(`• All problematic chains should be contained within larger chains but aren't being detected as such`);
  console.log(`• This suggests an issue with the geometric containment algorithm in JSTS`);
}

// Helper functions (copied from part-detection.ts)
function getShapeStartPoint(shape) {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'polyline':
      return shape.geometry.points.length > 0 ? shape.geometry.points[0] : null;
    case 'arc':
      return {
        x: shape.geometry.center.x + shape.geometry.radius * Math.cos(shape.geometry.startAngle),
        y: shape.geometry.center.y + shape.geometry.radius * Math.sin(shape.geometry.startAngle)
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

function getShapeEndPoint(shape) {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'polyline':
      return shape.geometry.points.length > 0 ? shape.geometry.points[shape.geometry.points.length - 1] : null;
    case 'arc':
      return {
        x: shape.geometry.center.x + shape.geometry.radius * Math.cos(shape.geometry.endAngle),
        y: shape.geometry.center.y + shape.geometry.radius * Math.sin(shape.geometry.endAngle)
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

function calculateChainBoundingBox(chain) {
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

function getShapeBoundingBox(shape) {
  switch (shape.type) {
    case 'line':
      return {
        minX: Math.min(shape.geometry.start.x, shape.geometry.end.x),
        maxX: Math.max(shape.geometry.start.x, shape.geometry.end.x),
        minY: Math.min(shape.geometry.start.y, shape.geometry.end.y),
        maxY: Math.max(shape.geometry.start.y, shape.geometry.end.y)
      };
    
    case 'circle':
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    
    case 'arc':
      // Conservative approach - use full circle bounds
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    
    case 'polyline':
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const point of shape.geometry.points) {
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

// Run the analysis
analyzeATT00079().catch(console.error);