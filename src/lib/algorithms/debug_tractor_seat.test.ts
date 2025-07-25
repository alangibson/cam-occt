import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { detectParts } from './part-detection';

describe('Tractor Seat Mount Debug Analysis', () => {
  it('should analyze why part detection finds 11 parts instead of 1', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');

    console.log('\n🔍 ANALYZING TRACTOR SEAT MOUNT - LEFT.DXF');
    console.log('==========================================');

    // Test different parsing options
    const scenarios = [
      { name: 'Default parsing (no squashing)', options: { decomposePolylines: true, squashLayers: false } },
      { name: 'With layer squashing', options: { decomposePolylines: true, squashLayers: true } },
      { name: 'No polyline decomposition', options: { decomposePolylines: false, squashLayers: false } },
      { name: 'No polyline decomposition + layer squashing', options: { decomposePolylines: false, squashLayers: true } },
    ];

    for (const scenario of scenarios) {
      console.log(`\n📋 SCENARIO: ${scenario.name}`);
      console.log('=' + '='.repeat(scenario.name.length + 10));

      const parsed = await parseDXF(dxfContent, scenario.options);
      console.log(`   Total shapes: ${parsed.shapes.length}`);

      // Analyze layers
      const layerStats: Record<string, number> = {};
      parsed.shapes.forEach(shape => {
        const layer = (shape as any).layer || 'NO_LAYER';
        layerStats[layer] = (layerStats[layer] || 0) + 1;
      });

      console.log('   Layer breakdown:');
      Object.entries(layerStats).forEach(([layer, count]) => {
        console.log(`     ${layer}: ${count} shapes`);
      });

      // Analyze shape types
      const shapeStats: Record<string, number> = {};
      parsed.shapes.forEach(shape => {
        shapeStats[shape.type] = (shapeStats[shape.type] || 0) + 1;
      });

      console.log('   Shape type breakdown:');
      Object.entries(shapeStats).forEach(([type, count]) => {
        console.log(`     ${type}: ${count} shapes`);
      });

      // Test different tolerance values for chain detection
      const tolerances = [0.01, 0.05, 0.1, 0.5, 1.0];
      
      for (const tolerance of tolerances) {
        console.log(`\n   🔗 Chain detection with tolerance: ${tolerance}`);
        const chains = detectShapeChains(parsed.shapes, { tolerance });
        console.log(`     Found ${chains.length} chains`);
        
        // Analyze chains
        const closedChains = chains.filter(chain => isChainClosed(chain));
        const openChains = chains.filter(chain => !isChainClosed(chain));
        
        console.log(`     Closed chains: ${closedChains.length}`);
        console.log(`     Open chains: ${openChains.length}`);

        // Show chain details
        chains.forEach((chain, index) => {
          const bbox = calculateChainBoundingBox(chain);
          const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
          const closed = isChainClosed(chain);
          console.log(`       Chain ${index + 1} (${chain.id}): ${chain.shapes.length} shapes, area=${area.toFixed(2)}, closed=${closed}`);
        });

        // Only proceed with part detection if we have reasonable number of chains
        if (chains.length > 0 && chains.length <= 20) {
          console.log(`\n   🎯 Part detection:`);
          const partResult = await detectParts(chains);
          console.log(`     Found ${partResult.parts.length} parts`);
          console.log(`     Warnings: ${partResult.warnings.length}`);

          if (partResult.warnings.length > 0) {
            console.log('     Warning details:');
            partResult.warnings.forEach((warning, i) => {
              console.log(`       ${i + 1}. [${warning.chainId}] ${warning.message}`);
            });
          }

          partResult.parts.forEach((part, index) => {
            const shellArea = (part.shell.boundingBox.maxX - part.shell.boundingBox.minX) * 
                            (part.shell.boundingBox.maxY - part.shell.boundingBox.minY);
            console.log(`       Part ${index + 1}: Shell (${part.shell.chain.id}, area=${shellArea.toFixed(2)}) with ${part.holes.length} holes`);
            part.holes.forEach((hole, holeIndex) => {
              const holeArea = (hole.boundingBox.maxX - hole.boundingBox.minX) * 
                              (hole.boundingBox.maxY - hole.boundingBox.minY);
              console.log(`         Hole ${holeIndex + 1}: ${hole.chain.id} (area=${holeArea.toFixed(2)})`);
            });
          });

          // Check for obvious containment issues
          if (partResult.parts.length > 1) {
            console.log('\n     🔍 Containment analysis:');
            const sortedParts = partResult.parts.sort((a, b) => {
              const aArea = (a.shell.boundingBox.maxX - a.shell.boundingBox.minX) * 
                           (a.shell.boundingBox.maxY - a.shell.boundingBox.minY);
              const bArea = (b.shell.boundingBox.maxX - b.shell.boundingBox.minX) * 
                           (b.shell.boundingBox.maxY - b.shell.boundingBox.minY);
              return bArea - aArea; // Largest first
            });

            const largestPart = sortedParts[0];
            console.log(`       Largest part: ${largestPart.id} (shell: ${largestPart.shell.chain.id})`);
            
            for (let i = 1; i < sortedParts.length; i++) {
              const smallerPart = sortedParts[i];
              const isContained = isBoundingBoxContained(
                smallerPart.shell.boundingBox, 
                largestPart.shell.boundingBox
              );
              console.log(`       ${smallerPart.id} contained in largest: ${isContained}`);
            }
          }
        }
      }
    }

    // Summary and analysis
    console.log('\n📊 SUMMARY AND ANALYSIS');
    console.log('=======================');
    console.log('Based on the analysis above, the issue likely stems from:');
    console.log('1. Multiple layers containing similar geometry');
    console.log('2. Chain tolerance affecting connectivity detection');  
    console.log('3. Geometric containment not working correctly');
    console.log('4. Possible duplicate geometry across layers');
    console.log('\nRecommendations:');
    console.log('- Use layer squashing to combine geometry from all layers');
    console.log('- Adjust chain detection tolerance based on drawing scale');
    console.log('- Debug geometric containment algorithm');
    console.log('- Check for duplicate/overlapping geometry');

    // For now, just verify we can run the analysis
    expect(true).toBe(true);
  }, 120000); // 2 minute timeout
});

// Helper functions
function isChainClosed(chain: any): boolean {
  if (chain.shapes.length === 0) return false;
  
  // Single circle is always closed
  if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
    return true;
  }
  
  // Check if first and last points connect
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

function getShapeStartPoint(shape: any): any {
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

function getShapeEndPoint(shape: any): any {
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

function calculateChainBoundingBox(chain: any): any {
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

function getShapeBoundingBox(shape: any): any {
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

function isBoundingBoxContained(inner: any, outer: any): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY &&
    !(inner.minX === outer.minX && inner.maxX === outer.maxX && 
      inner.minY === outer.minY && inner.maxY === outer.maxY)
  );
}