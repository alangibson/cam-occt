#!/usr/bin/env node

/**
 * Analysis script for "Tractor Seat Mount - Left.dxf" part detection issue
 * 
 * This script will:
 * 1. Parse the DXF file using the existing parser
 * 2. Detect chains from the shapes 
 * 3. Analyze chain closure status
 * 4. Calculate bounding boxes and containment relationships
 * 5. Show why 11 parts are detected instead of 1
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the necessary modules (we'll need to adjust these paths)
let dxfParser, chainDetector, partDetector;

async function loadModules() {
  try {
    // Load modules dynamically since they're TypeScript
    const { parseDXF } = await import('./src/lib/parsers/dxf-parser.js');
    const { detectShapeChains } = await import('./src/lib/algorithms/chain-detection.js');
    const { detectParts } = await import('./src/lib/algorithms/part-detection.js');
    
    dxfParser = parseDXF;
    chainDetector = detectShapeChains;
    partDetector = detectParts;
  } catch (error) {
    console.error('Error loading modules:', error);
    console.log('This script needs to be run after building the TypeScript modules');
    process.exit(1);
  }
}

async function analyzeDXF() {
  const dxfPath = path.join(__dirname, 'tests', 'dxf', 'Tractor Seat Mount - Left.dxf');
  
  try {
    console.log('📄 Reading DXF file:', dxfPath);
    const dxfContent = await readFile(dxfPath, 'utf8');
    
    console.log('🔍 Parsing DXF content...');
    const parseResult = await dxfParser(dxfContent);
    
    if (!parseResult.success) {
      console.error('❌ Failed to parse DXF:', parseResult.error);
      return;
    }
    
    const { shapes, layers } = parseResult.data;
    
    console.log('\n📊 BASIC STATISTICS:');
    console.log(`   Total shapes: ${shapes.length}`);
    console.log(`   Total layers: ${layers.length}`);
    
    // Show layer breakdown
    const layerStats = {};
    shapes.forEach(shape => {
      const layer = shape.layer || 'default';
      layerStats[layer] = (layerStats[layer] || 0) + 1;
    });
    
    console.log('\n📋 LAYER BREAKDOWN:');
    Object.entries(layerStats).forEach(([layer, count]) => {
      console.log(`   ${layer}: ${count} shapes`);
    });
    
    // Show shape type breakdown
    const shapeStats = {};
    shapes.forEach(shape => {
      shapeStats[shape.type] = (shapeStats[shape.type] || 0) + 1;
    });
    
    console.log('\n🔧 SHAPE TYPE BREAKDOWN:');
    Object.entries(shapeStats).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} shapes`);
    });
    
    console.log('\n🔗 Detecting chains...');
    const chains = chainDetector(shapes, { tolerance: 0.05 });
    
    console.log(`   Found ${chains.length} chains`);
    
    // Analyze each chain
    console.log('\n📐 CHAIN ANALYSIS:');
    chains.forEach((chain, index) => {
      console.log(`\n   Chain ${index + 1} (${chain.id}):`);
      console.log(`     Shapes: ${chain.shapes.length}`);
      console.log(`     Shape types: ${chain.shapes.map(s => s.type).join(', ')}`);
      
      // Check if chain is closed
      const isClosed = isChainClosed(chain);
      console.log(`     Closed: ${isClosed}`);
      
      // Calculate bounding box
      const bbox = calculateChainBoundingBox(chain);
      console.log(`     Bounding box: (${bbox.minX.toFixed(2)}, ${bbox.minY.toFixed(2)}) to (${bbox.maxX.toFixed(2)}, ${bbox.maxY.toFixed(2)})`);
      console.log(`     Dimensions: ${(bbox.maxX - bbox.minX).toFixed(2)} x ${(bbox.maxY - bbox.minY).toFixed(2)}`);
      
      // Show layers in this chain
      const chainLayers = [...new Set(chain.shapes.map(s => s.layer || 'default'))];
      console.log(`     Layers: ${chainLayers.join(', ')}`);
    });
    
    console.log('\n🎯 Detecting parts...');
    const partResult = await partDetector(chains);
    
    console.log(`   Found ${partResult.parts.length} parts`);
    console.log(`   Warnings: ${partResult.warnings.length}`);
    
    if (partResult.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      partResult.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. [${warning.chainId}] ${warning.message}`);
      });
    }
    
    console.log('\n🏗️  PARTS BREAKDOWN:');
    partResult.parts.forEach((part, index) => {
      console.log(`\n   Part ${index + 1} (${part.id}):`);
      console.log(`     Shell: ${part.shell.chain.id} (${part.shell.chain.shapes.length} shapes)`);
      console.log(`     Shell bbox: (${part.shell.boundingBox.minX.toFixed(2)}, ${part.shell.boundingBox.minY.toFixed(2)}) to (${part.shell.boundingBox.maxX.toFixed(2)}, ${part.shell.boundingBox.maxY.toFixed(2)})`);
      console.log(`     Holes: ${part.holes.length}`);
      
      part.holes.forEach((hole, holeIndex) => {
        console.log(`       Hole ${holeIndex + 1}: ${hole.chain.id} (${hole.chain.shapes.length} shapes)`);
        console.log(`         Hole bbox: (${hole.boundingBox.minX.toFixed(2)}, ${hole.boundingBox.minY.toFixed(2)}) to (${hole.boundingBox.maxX.toFixed(2)}, ${hole.boundingBox.maxY.toFixed(2)})`);
        if (hole.holes.length > 0) {
          console.log(`         Nested holes: ${hole.holes.length}`);
        }
      });
    });
    
    // Analysis of the containment issue
    console.log('\n🔍 CONTAINMENT ANALYSIS:');
    const closedChains = chains.filter(chain => isChainClosed(chain));
    console.log(`   Closed chains: ${closedChains.length}`);
    console.log(`   Open chains: ${chains.length - closedChains.length}`);
    
    if (closedChains.length > 1) {
      console.log('\n   Analyzing containment relationships...');
      
      // Sort chains by area (largest first)
      const chainAreas = closedChains.map(chain => {
        const bbox = calculateChainBoundingBox(chain);
        const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
        return { chain, area, bbox };
      }).sort((a, b) => b.area - a.area);
      
      console.log('\n   Chains by area (largest first):');
      chainAreas.forEach((item, index) => {
        console.log(`     ${index + 1}. ${item.chain.id}: ${item.area.toFixed(2)} sq units`);
      });
      
      // Check which chains should be contained within the largest
      const largestChain = chainAreas[0];
      console.log(`\n   Expected containment (all should be inside ${largestChain.chain.id}):`);
      
      for (let i = 1; i < chainAreas.length; i++) {
        const smallerChain = chainAreas[i];
        const bboxContained = isContainedWithin(smallerChain.bbox, largestChain.bbox);
        console.log(`     ${smallerChain.chain.id}: bbox contained = ${bboxContained}`);
        
        if (!bboxContained) {
          console.log(`       ❌ This chain should be inside the largest but bounding box suggests otherwise!`);
        }
      }
    }
    
    // Summary
    console.log('\n📋 SUMMARY:');
    if (partResult.parts.length === 11) {
      console.log('   ❌ Found 11 parts instead of expected 1');
      console.log('   🔍 This suggests the containment hierarchy is not being detected correctly');
      console.log('   🎯 All smaller chains should be detected as holes within the largest chain');
    } else if (partResult.parts.length === 1) {
      console.log('   ✅ Found 1 part as expected');
    } else {
      console.log(`   ⚠️  Found ${partResult.parts.length} parts - unexpected count`);
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('   1. Check if geometric containment is working correctly');
    console.log('   2. Verify chain closure detection is accurate');
    console.log('   3. Consider if layer-based grouping is needed');
    console.log('   4. Check tolerance values for chain detection');
    
  } catch (error) {
    console.error('❌ Error analyzing DXF:', error);
  }
}

// Helper functions (simplified versions of the ones in the modules)
function isChainClosed(chain) {
  if (chain.shapes.length === 0) return false;
  
  // Simple check: if it's a single circle, it's closed
  if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
    return true;
  }
  
  // For other cases, check if first and last points connect
  const firstShape = chain.shapes[0];
  const lastShape = chain.shapes[chain.shapes.length - 1];
  
  const firstStart = getShapeStartPoint(firstShape);
  const lastEnd = getShapeEndPoint(lastShape);
  
  if (!firstStart || !lastEnd) return false;
  
  const tolerance = 0.01;
  const distance = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  return distance < tolerance;
}

function getShapeStartPoint(shape) {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    case 'arc':
      return {
        x: shape.geometry.center.x + shape.geometry.radius * Math.cos(shape.geometry.startAngle),
        y: shape.geometry.center.y + shape.geometry.radius * Math.sin(shape.geometry.startAngle)
      };
    case 'polyline':
      return shape.geometry.points?.[0] || null;
    default:
      return null;
  }
}

function getShapeEndPoint(shape) {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    case 'arc':
      return {
        x: shape.geometry.center.x + shape.geometry.radius * Math.cos(shape.geometry.endAngle),
        y: shape.geometry.center.y + shape.geometry.radius * Math.sin(shape.geometry.endAngle)
      };
    case 'polyline':
      const points = shape.geometry.points;
      return points?.[points.length - 1] || null;
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
      return {
        minX: shape.geometry.center.x - shape.geometry.radius,
        maxX: shape.geometry.center.x + shape.geometry.radius,
        minY: shape.geometry.center.y - shape.geometry.radius,
        maxY: shape.geometry.center.y + shape.geometry.radius
      };
    case 'polyline':
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const point of shape.geometry.points || []) {
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

function isContainedWithin(inner, outer) {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY &&
    !(inner.minX === outer.minX && inner.maxX === outer.maxX && 
      inner.minY === outer.minY && inner.maxY === outer.maxY)
  );
}

// Run the analysis
async function main() {
  console.log('🔬 DXF Part Detection Analysis Tool');
  console.log('==================================');
  
  await loadModules();
  await analyzeDXF();
}

main().catch(console.error);