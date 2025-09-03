import { describe, it, beforeAll } from 'vitest';
import { generateChainOffsetSVG } from './visual-tests';
import type { Shape } from '../../../../lib/types/geometry';
import type { OffsetChain } from './types';
import { detectShapeChains } from '../../chain-detection/chain-detection';
import { normalizeChain } from '../../chain-normalization/chain-normalization';
import { offsetChain } from './offset';
import { createPolylineFromVertices } from '$lib/geometry/polyline';
import { mkdirSync } from 'fs';
import { join } from 'path';

describe('visual-tests', () => {
  // Ensure output directory exists
  beforeAll(() => {
    const outputDir = join(process.cwd(), 'tests', 'output', 'visual', 'chain');
    mkdirSync(outputDir, { recursive: true });
  });

  // Helper to create shapes
  function createLine(x1: number, y1: number, x2: number, y2: number): Shape {
    return {
      id: `line-${Math.random()}`,
      type: 'line',
      geometry: {
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 }
      }
    };
  }

  function createArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, clockwise: boolean = false): Shape {
    return {
      id: `arc-${Math.random()}`,
      type: 'arc',
      geometry: {
        center: { x: cx, y: cy },
        radius,
        startAngle,
        endAngle,
        clockwise
      }
    };
  }

  it('should generate visualization for simple closed rectangle chain', () => {
    // Create a rectangle
    const shapes: Shape[] = [
      createLine(0, 0, 100, 0),     // bottom
      createLine(100, 0, 100, 50),  // right
      createLine(100, 50, 0, 50),   // top
      createLine(0, 50, 0, 0)       // left
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 'rectangle-chain');
  });

  it('should generate visualization for closed chain with mixed shapes', () => {
    // Create a rounded rectangle
    const shapes: Shape[] = [
      createLine(20, 0, 80, 0),                           // bottom
      createArc(80, 20, 20, -Math.PI/2, 0),              // bottom-right corner
      createLine(100, 20, 100, 80),                       // right
      createArc(80, 80, 20, 0, Math.PI/2),               // top-right corner
      createLine(80, 100, 20, 100),                       // top
      createArc(20, 80, 20, Math.PI/2, Math.PI),         // top-left corner
      createLine(0, 80, 0, 20),                           // left
      createArc(20, 20, 20, Math.PI, 3*Math.PI/2)        // bottom-left corner
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 'rounded-rectangle-chain');
  });

  it('should generate visualization for open L-shaped chain', () => {
    // Create an L-shaped chain
    const shapes: Shape[] = [
      createLine(0, 0, 100, 0),     // horizontal
      createLine(100, 0, 100, 80)   // vertical
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 'l-shaped-chain');
  });

  it('should generate visualization for open chain with curves', () => {
    // Create an S-curve
    const shapes: Shape[] = [
      createLine(0, 50, 30, 50),                        // start line
      createArc(50, 50, 20, Math.PI, 0),               // first arc (curves up, counter-clockwise)
      createLine(70, 50, 100, 50),                      // middle line
      createArc(120, 50, 20, Math.PI, 0, true),        // second arc (curves down, clockwise)
      createLine(140, 50, 170, 50)                      // end line
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 's-curve-chain', {
      width: 900,
      height: 400
    });
  });

  it('should generate visualization for comprehensive mixed-shape chain', () => {
    // Create a complex open chain with mixed shapes: line, arc, polyline, spline, ellipse arc
    const shapes: Shape[] = [
      createLine(50, 350, 150, 350),                        // line
      createArc(150, 320, 30, Math.PI/2, 0, true),        // arc (clockwise)
      createPolylineFromVertices([
        { x: 180, y: 320, bulge: 0 },
        { x: 220, y: 330, bulge: 0 },
        { x: 260, y: 310, bulge: 0 },
        { x: 300, y: 320, bulge: 0 }
      ], false, { id: 'polyline1' }),
      {
        id: 'spline1',
        type: 'spline',
        geometry: {
          controlPoints: [
            { x: 300, y: 320 },
            { x: 340, y: 330 },
            { x: 380, y: 310 },
            { x: 420, y: 320 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        }
      },
      {
        id: 'ellipse-arc1',
        type: 'ellipse',
        geometry: {
          center: { x: 445, y: 320 },
          majorAxisEndpoint: { x: 25, y: 0 },
          minorToMajorRatio: 0.8,
          startParam: Math.PI,
          endParam: Math.PI/2
        }
      }
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 'chain-open', {
      width: 1000,
      height: 500
    });
  });

  it('should generate visualization for closed mixed-shape chain', () => {
    // Create a complex closed chain
    const shapes: Shape[] = [
      createLine(100, 50, 200, 50),                         // bottom line
      createArc(200, 80, 30, -Math.PI/2, 0),               // bottom-right arc
      createLine(230, 80, 230, 150),                        // right line
      createPolylineFromVertices([
        { x: 230, y: 150, bulge: 0 },
        { x: 220, y: 170, bulge: 0 },
        { x: 200, y: 180, bulge: 0 },
        { x: 180, y: 170, bulge: 0 },
        { x: 160, y: 180, bulge: 0 }
      ], false, { id: 'polyline1' }),
      {
        id: 'spline1',
        type: 'spline',
        geometry: {
          controlPoints: [
            { x: 160, y: 180 },
            { x: 130, y: 170 },
            { x: 100, y: 150 },
            { x: 80, y: 120 },
            { x: 80, y: 80 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1],
          weights: [1, 1, 1, 1, 1],
          fitPoints: [],
          closed: false
        }
      },
      createLine(80, 80, 100, 50)                           // closing line
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 'chain-closed', {
      width: 1000,
      height: 600
    });
  });

  it('should generate visualization for closed mixed-shape chain with flipped arc sweep', () => {
    // Create a complex closed chain with arc that curves in the opposite direction
    // Original arc: center (200,80), goes from (200,50) to (230,80) - curves inward (concave)
    // Flipped arc: center (230,50), goes from (200,50) to (230,80) - curves outward (convex)
    const shapes: Shape[] = [
      createLine(100, 50, 200, 50),                         // bottom line
      {                                                     // bottom-right arc (flipped sweep - curves outward)
        id: `arc-${Math.random()}`,
        type: 'arc',
        geometry: {
          center: { x: 230, y: 50 },  // Different center to create outward curve
          radius: 30,
          startAngle: Math.PI,        // Start pointing left (toward 200,50)
          endAngle: Math.PI/2,        // End pointing up (toward 230,80)
          clockwise: true             // Clockwise direction
        }
      },
      createLine(230, 80, 230, 150),                        // right line
      createPolylineFromVertices([
        { x: 230, y: 150, bulge: 0 },
        { x: 220, y: 170, bulge: 0 },
        { x: 200, y: 180, bulge: 0 },
        { x: 180, y: 170, bulge: 0 },
        { x: 160, y: 180, bulge: 0 }
      ], false, { id: 'polyline1' }),
      {
        id: 'spline1',
        type: 'spline',
        geometry: {
          controlPoints: [
            { x: 160, y: 180 },
            { x: 130, y: 170 },
            { x: 100, y: 150 },
            { x: 80, y: 120 },
            { x: 80, y: 80 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1],
          weights: [1, 1, 1, 1, 1],
          fitPoints: [],
          closed: false
        }
      },
      createLine(80, 80, 100, 50)                           // closing line
    ];

    const detectedChains = detectShapeChains(shapes, { tolerance: 0.1 });
    const chain = normalizeChain(detectedChains[0], { traversalTolerance: 0.1, maxTraversalAttempts: 5 });

    // Generate actual chain offsets using the chain offset algorithm
    const offsetDistance = 8;
    const chainOffsetResult = offsetChain(chain, offsetDistance, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });

    // Collect all offset chains for visualization
    const offsets: OffsetChain[] = [];
    if (chainOffsetResult.innerChain) {
      offsets.push(chainOffsetResult.innerChain);
    }
    if (chainOffsetResult.outerChain) {
      offsets.push(chainOffsetResult.outerChain);
    }

    generateChainOffsetSVG(chain, offsets, 'chain-closed-flipped-arc', {
      width: 1000,
      height: 600
    });
  });
});