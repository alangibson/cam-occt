import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection/chain-detection';
import { detectParts } from './part-detection';
import { getShapeStartPoint, getShapeEndPoint } from '$lib/geometry';
import { polylineToPoints } from '../geometry/polyline';

describe('Tractor Seat Mount Debug Analysis', () => {
  it('should analyze why part detection finds 11 parts instead of 1', async () => {
    const dxfPath = join(process.cwd(), 'tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');


    // Test different parsing options
    const scenarios = [
      { name: 'Default parsing (no squashing)', options: { decomposePolylines: true, squashLayers: false } },
      { name: 'With layer squashing', options: { decomposePolylines: true, squashLayers: true } },
      { name: 'No polyline decomposition', options: { decomposePolylines: false, squashLayers: false } },
      { name: 'No polyline decomposition + layer squashing', options: { decomposePolylines: false, squashLayers: true } },
    ];

    for (const scenario of scenarios) {

      const parsed = await parseDXF(dxfContent, scenario.options);

      // Analyze layers
      const layerStats: Record<string, number> = {};
      parsed.shapes.forEach(shape => {
        const layer = shape.layer || 'NO_LAYER';
        layerStats[layer] = (layerStats[layer] || 0) + 1;
      });

      Object.entries(layerStats).forEach(([layer, count]) => {
      });

      // Analyze shape types
      const shapeStats: Record<string, number> = {};
      parsed.shapes.forEach(shape => {
        shapeStats[shape.type] = (shapeStats[shape.type] || 0) + 1;
      });

      Object.entries(shapeStats).forEach(([type, count]) => {
      });

      // Test different tolerance values for chain detection
      const tolerances = [0.01, 0.05, 0.1, 0.5, 1.0];
      
      for (const tolerance of tolerances) {
        const chains = detectShapeChains(parsed.shapes, { tolerance });
        
        // Analyze chains
        const closedChains = chains.filter(chain => isChainClosed(chain));
        const openChains = chains.filter(chain => !isChainClosed(chain));
        

        // Show chain details
        chains.forEach((chain, index) => {
          const bbox = calculateChainBoundingBox(chain);
          const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
          const closed = isChainClosed(chain);
        });

        // Only proceed with part detection if we have reasonable number of chains
        if (chains.length > 0 && chains.length <= 20) {
          const partResult = await detectParts(chains);

          if (partResult.warnings.length > 0) {
            partResult.warnings.forEach((warning, i) => {
            });
          }

          partResult.parts.forEach((part, index) => {
            const shellArea = (part.shell.boundingBox.maxX - part.shell.boundingBox.minX) * 
                            (part.shell.boundingBox.maxY - part.shell.boundingBox.minY);
            part.holes.forEach((hole, holeIndex) => {
              const holeArea = (hole.boundingBox.maxX - hole.boundingBox.minX) * 
                              (hole.boundingBox.maxY - hole.boundingBox.minY);
            });
          });

          // Check for obvious containment issues
          if (partResult.parts.length > 1) {
            const sortedParts = partResult.parts.sort((a, b) => {
              const aArea = (a.shell.boundingBox.maxX - a.shell.boundingBox.minX) * 
                           (a.shell.boundingBox.maxY - a.shell.boundingBox.minY);
              const bArea = (b.shell.boundingBox.maxX - b.shell.boundingBox.minX) * 
                           (b.shell.boundingBox.maxY - b.shell.boundingBox.minY);
              return bArea - aArea; // Largest first
            });

            const largestPart = sortedParts[0];
            
            for (let i: number = 1; i < sortedParts.length; i++) {
              const smallerPart = sortedParts[i];
              const isContained = isBoundingBoxContained(
                smallerPart.shell.boundingBox, 
                largestPart.shell.boundingBox
              );
            }
          }
        }
      }
    }

    // Summary and analysis

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
  
  
  const tolerance = 0.01;
  const distance: number = Math.sqrt(
    Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
  );
  
  return distance < tolerance;
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
      const points = polylineToPoints(shape.geometry);
      for (const point of points) {
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