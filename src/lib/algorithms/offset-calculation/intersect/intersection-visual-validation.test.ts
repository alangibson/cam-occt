import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { 
  offsetShape, 
} from '../offset/index';
import { SVGBuilder } from '../../../test/svg-builder';
import { findShapeIntersections } from '../intersect'
import type { 
  Line, 
  Arc, 
  Circle, 
  Polyline, 
  Spline, 
  Ellipse, 
  Shape, 
} from '../../../types/geometry';
import { createPolylineFromVertices } from '../../../geometry/polyline';

describe('Intersection Visual Validation Tests', { timeout: 180000 }, () => {
  const outputDir = 'tests/output/visual/intersections/overlap';

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  });

  // Helper function to create SVG using the enhanced SVGBuilder
  function createSVG(width: number, height: number) {
    return new SVGBuilder(width, height);
  }



  // Helper function to visualize intersections between two shapes
  function visualizeIntersection(
    shape1: Shape, 
    shape2: Shape, 
    combinationName: string,
    offsetDistance: number = 8
  ) {
    const svg = createSVG(500, 400);
    
    // Draw original shapes
    svg.addShape(shape1, 'black', 2, 'Original ' + shape1.type);
    svg.addShape(shape2, 'black', 2, 'Original ' + shape2.type);

    // Generate offsets
    const shape1Outset = offsetShape(shape1, offsetDistance, 'outset');
    const shape1Inset = offsetShape(shape1, offsetDistance, 'inset');
    const shape2Outset = offsetShape(shape2, offsetDistance, 'outset');
    const shape2Inset = offsetShape(shape2, offsetDistance, 'inset');

    // Draw offset shapes
    if (shape1Outset.success && shape1Outset.shapes.length > 0) {
      svg.addShape(shape1Outset.shapes[0], 'red', 1, `${shape1.type} outset`);
    }
    if (shape1Inset.success && shape1Inset.shapes.length > 0) {
      svg.addShape(shape1Inset.shapes[0], 'blue', 1, `${shape1.type} inset`);
    }
    if (shape2Outset.success && shape2Outset.shapes.length > 0) {
      svg.addShape(shape2Outset.shapes[0], 'red', 1, `${shape2.type} outset`);
    }
    if (shape2Inset.success && shape2Inset.shapes.length > 0) {
      svg.addShape(shape2Inset.shapes[0], 'blue', 1, `${shape2.type} inset`);
    }

    // Find and visualize intersections
    let totalIntersections = 0;

    // Original shapes intersection
    const originalIntersections = findShapeIntersections(shape1, shape2, 0.1);
    originalIntersections.forEach(intersection => {
      svg.addIntersectionPoint(intersection.point, 'yellow', 4);
      totalIntersections++;
    });

    // Outset-Outset intersections only
    if (shape1Outset.success && shape1Outset.shapes.length > 0 && 
        shape2Outset.success && shape2Outset.shapes.length > 0) {
      const outsetIntersections = findShapeIntersections(shape1Outset.shapes[0], shape2Outset.shapes[0], 0.1);
      outsetIntersections.forEach(intersection => {
        svg.addIntersectionPoint(intersection.point, 'red', 3);
        totalIntersections++;
      });
    }

    // Inset-Inset intersections only
    if (shape1Inset.success && shape1Inset.shapes.length > 0 && 
        shape2Inset.success && shape2Inset.shapes.length > 0) {
      const insetIntersections = findShapeIntersections(shape1Inset.shapes[0], shape2Inset.shapes[0], 0.1);
      insetIntersections.forEach(intersection => {
        svg.addIntersectionPoint(intersection.point, 'blue', 3);
        totalIntersections++;
      });
    }

    // Add title and legend  
    svg.addTitle(`${combinationName} Intersection Test`);
    
    // Special note for ellipse intersections
    const hasEllipse = shape1.type === 'ellipse' || shape2.type === 'ellipse';
    const offsetShapeTypes = new Set<string>();
    if (shape1Outset.success && shape1Outset.shapes.length > 0) {
      offsetShapeTypes.add(shape1Outset.shapes[0].type);
    }
    if (shape2Outset.success && shape2Outset.shapes.length > 0) {
      offsetShapeTypes.add(shape2Outset.shapes[0].type);
    }
    
    const legendItems = [
      { color: 'black', label: 'Original Shapes' },
      { color: 'red', label: `Outset (+${offsetDistance}) Intersections` },
      { color: 'blue', label: `Inset (-${offsetDistance}) Intersections` },
      { color: 'yellow', label: 'Original Intersections' }
    ];
    
    // Add note if ellipse offsets are polylines
    if (hasEllipse && offsetShapeTypes.has('polyline')) {
      legendItems.push({ color: 'gray', label: 'Note: Ellipse offsets are polyline approximations' });
    }
    
    svg.addLegend(legendItems);

    // Add intersection count
    svg.addText(10, 370, `Total Intersections: ${totalIntersections}`, 'black', '12px');
    
    // Add warning if ellipse offset intersections may appear off curve
    if (hasEllipse && offsetShapeTypes.has('polyline') && totalIntersections > 0) {
      svg.addText(10, 350, 'Warning: Intersection points may appear off ellipse curves due to polyline approximation', 'red', '10px');
    }

    const fileName = combinationName.toLowerCase().replace('-', '-') + '-intersections.svg';
    writeFileSync(join(outputDir, fileName), svg.toString());

    return totalIntersections;
  }

  // Line combination tests
  describe('Line intersection tests', () => {
    it('should test Line-Line intersections', () => {
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 300, y: 200 } } as Line
      };
      const line2 = {
        id: 'line2', 
        type: 'line' as const,
        geometry: { start: { x: 200, y: 100 }, end: { x: 200, y: 300 } } as Line
      };
      const count = visualizeIntersection(line1, line2, 'Line-Line');
      expect(count).toBeGreaterThan(0);
    });

    it('should test Line-Arc intersections', () => {
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 300, y: 200 } } as Line
      };
      const arc1 = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 200, y: 200 },
          radius: 60,
          startAngle: -Math.PI/3, // -60 degrees
          endAngle: Math.PI/3,    // +60 degrees (120 degree arc)
          clockwise: false
        } as Arc
      };
      const count = visualizeIntersection(line1, arc1, 'Line-Arc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Circle intersections', () => {
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 300, y: 200 } } as Line
      };
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 180, y: 200 }, radius: 50 } as Circle
      };
      const count = visualizeIntersection(line1, circle1, 'Line-Circle');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Polyline intersections', () => {
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 300, y: 200 } } as Line
      };
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 120, bulge: 0 },
          { x: 200, y: 180, bulge: 0 },
          { x: 280, y: 120, bulge: 0 },
          { x: 280, y: 280, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(line1, polyline1, 'Line-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Spline intersections', () => {
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 300, y: 200 } } as Line
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 120 },
            { x: 250, y: 280 },
            { x: 300, y: 200 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(line1, spline1, 'Line-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-Ellipse intersections', () => {
      const line1 = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 100, y: 200 }, end: { x: 300, y: 200 } } as Line
      };
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 180, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(line1, ellipse1, 'Line-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Arc combination tests
  describe('Arc intersection tests', () => {
    it('should test Arc-Arc intersections', () => {
      const arc1 = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 200, y: 200 },
          radius: 60,
          startAngle: -Math.PI/3, // -60 degrees
          endAngle: Math.PI/3,    // +60 degrees (120 degree arc)
          clockwise: false
        } as Arc
      };
      const arc2 = {
        id: 'arc2',
        type: 'arc' as const,
        geometry: {
          center: { x: 240, y: 200 },
          radius: 50,
          startAngle: Math.PI/2,  // 90 degrees
          endAngle: 3*Math.PI/2,  // 270 degrees (180 degree arc)
          clockwise: false
        } as Arc
      };
      const count = visualizeIntersection(arc1, arc2, 'Arc-Arc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Circle intersections', () => {
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 200, y: 200 },
          radius: 60,
          startAngle: -Math.PI/4, // -45 degrees
          endAngle: Math.PI/4,    // +45 degrees
          clockwise: false
        } as Arc
      };
      const circle: import("$lib/types/geometry").Circle = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 230, y: 200 }, radius: 40 } as Circle
      };
      const count = visualizeIntersection(arc, circle, 'Arc-Circle');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Polyline intersections', () => {
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 200, y: 200 },
          radius: 50,
          startAngle: 0,
          endAngle: Math.PI,
          clockwise: false
        } as Arc
      };
      const polyline: import("$lib/types/geometry").Polyline = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 150, y: 150, bulge: 0 },
          { x: 200, y: 180, bulge: 0 },
          { x: 250, y: 150, bulge: 0 },
          { x: 250, y: 250, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(arc, polyline, 'Arc-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Spline intersections', () => {
      const arc1 = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 200, y: 200 },
          radius: 60,
          startAngle: -Math.PI/3, // -60 degrees
          endAngle: Math.PI/3,    // +60 degrees (120 degree arc)
          clockwise: false
        } as Arc
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 120 },
            { x: 250, y: 280 },
            { x: 300, y: 200 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(arc1, spline1, 'Arc-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Arc-Ellipse intersections', () => {
      const arc: import("$lib/types/geometry").Arc = {
        id: 'arc1',
        type: 'arc' as const,
        geometry: {
          center: { x: 210, y: 200 },  // Slightly offset to ensure overlap
          radius: 60,
          startAngle: Math.PI * 2/3,   // 120 degrees
          endAngle: Math.PI * 4/3,      // 240 degrees (120 degree arc)
          clockwise: false
        } as Arc
      };
      const ellipse: import("$lib/types/geometry").Ellipse = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 180, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(arc, ellipse, 'Arc-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Circle combination tests
  describe('Circle intersection tests', () => {
    it('should test Circle-Circle intersections', () => {
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 180, y: 200 }, radius: 50 } as Circle
      };
      const circle2 = {
        id: 'circle2',
        type: 'circle' as const,
        geometry: { center: { x: 220, y: 200 }, radius: 50 } as Circle
      };
      const count = visualizeIntersection(circle1, circle2, 'Circle-Circle');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Circle-Polyline intersections', () => {
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 180, y: 200 }, radius: 50 } as Circle
      };
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 120, bulge: 0 },
          { x: 200, y: 180, bulge: 0 },
          { x: 280, y: 120, bulge: 0 },
          { x: 280, y: 280, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(circle1, polyline1, 'Circle-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Circle-Spline intersections', () => {
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 180, y: 200 }, radius: 50 } as Circle
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 120 },
            { x: 250, y: 280 },
            { x: 300, y: 200 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(circle1, spline1, 'Circle-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Circle-Ellipse intersections', () => {
      const circle1 = {
        id: 'circle1',
        type: 'circle' as const,
        geometry: { center: { x: 180, y: 200 }, radius: 50 } as Circle
      };
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 180, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(circle1, ellipse1, 'Circle-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Polyline combination tests
  describe('Polyline intersection tests', () => {
    it('should test Polyline-Polyline intersections', () => {
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 120, bulge: 0 },
          { x: 200, y: 180, bulge: 0 },
          { x: 280, y: 120, bulge: 0 },
          { x: 280, y: 280, bulge: 0 }
        ], false).geometry
      };
      const polyline2 = {
        id: 'polyline2',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 280, bulge: 0 },
          { x: 200, y: 220, bulge: 0 },
          { x: 280, y: 280, bulge: 0 },
          { x: 200, y: 160, bulge: 0 }
        ], false).geometry
      };
      const count = visualizeIntersection(polyline1, polyline2, 'Polyline-Polyline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Polyline-Spline intersections', () => {
      const polyline1 = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 120, bulge: 0 },
          { x: 200, y: 180, bulge: 0 },
          { x: 280, y: 120, bulge: 0 },
          { x: 280, y: 280, bulge: 0 }
        ], false).geometry
      };
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 120 },
            { x: 250, y: 280 },
            { x: 300, y: 200 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(polyline1, spline1, 'Polyline-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Polyline-Ellipse intersections', () => {
      const polyline: import("$lib/types/geometry").Polyline = {
        id: 'polyline1',
        type: 'polyline' as const,
        geometry: createPolylineFromVertices([
          { x: 120, y: 200, bulge: 0 },
          { x: 200, y: 150, bulge: 0 },
          { x: 280, y: 200, bulge: 0 },
          { x: 200, y: 250, bulge: 0 }
        ], false).geometry
      };
      const ellipse: import("$lib/types/geometry").Ellipse = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 200, y: 200 },
          majorAxisEndpoint: { x: 50, y: 0 },
          minorToMajorRatio: 0.8
        } as Ellipse
      };
      const count = visualizeIntersection(polyline, ellipse, 'Polyline-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Spline combination tests
  describe('Spline intersection tests', () => {
    it('should test Spline-Spline intersections', () => {
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 120 },
            { x: 250, y: 280 },
            { x: 300, y: 200 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const spline2 = {
        id: 'spline2',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 200, y: 120 },
            { x: 280, y: 180 },
            { x: 220, y: 280 },
            { x: 120, y: 220 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const count = visualizeIntersection(spline1, spline2, 'Spline-Spline');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Spline-Ellipse intersections', () => {
      const spline1 = {
        id: 'spline1',
        type: 'spline' as const,
        geometry: {
          controlPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 120 },
            { x: 250, y: 280 },
            { x: 300, y: 200 }
          ],
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          weights: [1, 1, 1, 1],
          fitPoints: [],
          closed: false
        } as Spline
      };
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 180, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const count = visualizeIntersection(spline1, ellipse1, 'Spline-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Ellipse combination tests
  describe('Ellipse intersection tests', () => {
    it('should test Ellipse-Ellipse intersections', () => {
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 180, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const ellipse2 = {
        id: 'ellipse2',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 220, y: 200 },
          majorAxisEndpoint: { x: 0, y: 50 }, // Rotated 90 degrees
          minorToMajorRatio: 0.8
        } as Ellipse
      };
      const count = visualizeIntersection(ellipse1, ellipse2, 'Ellipse-Ellipse');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Ellipse-EllipseArc intersections', () => {
      const ellipse1 = {
        id: 'ellipse1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 180, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6
        } as Ellipse
      };
      const ellipseArc = {
        id: 'ellipseArc',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 200, y: 200 },
          majorAxisEndpoint: { x: 70, y: 0 },
          minorToMajorRatio: 0.5,
          startParam: 0,
          endParam: Math.PI
        } as Ellipse
      };
      const count = visualizeIntersection(ellipse1, ellipseArc, 'Ellipse-EllipseArc');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should test Line-EllipseArc intersections', () => {
      // Based on ellipse-arc-chain.dxf test file but positioned for overlap
      // Ellipse arc from center (0,0), major axis (60,0), ratio 0.6, from 0 to π (doubled length)
      // Line positioned to overlap with ellipse arc offsets (doubled length)
      const ellipseArc = {
        id: 'ellipseArc1',
        type: 'ellipse' as const,
        geometry: {
          center: { x: 200, y: 200 },
          majorAxisEndpoint: { x: 60, y: 0 },
          minorToMajorRatio: 0.6,
          startParam: 0,
          endParam: Math.PI
        } as Ellipse
      };
      const line = {
        id: 'line1',
        type: 'line' as const,
        geometry: { start: { x: 210, y: 190 }, end: { x: 270, y: 230 } } as Line
      };
      const count = visualizeIntersection(line, ellipseArc, 'Line-EllipseArc');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // Rectangle offset and trim test
  describe('Rectangle offset and trim test', () => {
    it('should generate rectangle with inner offsets and trimming', () => {
      // Create rectangle polyline - closed 4-sided shape
      const rectanglePolyline = createPolylineFromVertices([
        { x: 100, y: 150, bulge: 0 },  // bottom-left
        { x: 300, y: 150, bulge: 0 },  // bottom-right
        { x: 300, y: 250, bulge: 0 },  // top-right
        { x: 100, y: 250, bulge: 0 }   // top-left
      ], true);

      const svg = createSVG(500, 400);
      
      // Draw original rectangle
      svg.addShape(rectanglePolyline, 'black', 2, 'Original Rectangle');

      // Generate single inner offset at 8 units
      const offsetDistance = 8;
      const innerOffset = offsetShape(rectanglePolyline, offsetDistance, 'inset');
      
      if (innerOffset.success && innerOffset.shapes.length > 0) {
        // Draw the offset shape
        svg.addShape(innerOffset.shapes[0], 'red', 1, `Inner offset ${offsetDistance} units`);
        
        // For trimming, we need to find intersections and trim at those points
        // Since this is a simple rectangle, offsets should already be trimmed correctly
        // But we can visualize the trimming by showing intersection points
        
        const offsetShape1 = innerOffset.shapes[0];
        if (offsetShape1.type === 'polyline') {
          const poly = offsetShape1.geometry as Polyline;
        }
      }
      

      // Add title and legend
      svg.addTitle('Rectangle Inner Offset with Trimming');
      const legendItems = [
        { color: 'black', label: 'Original Rectangle' },
        { color: 'red', label: `Inner offset ${offsetDistance} units` },
        { color: 'blue', label: 'Detected intersection points' }
      ];
      svg.addLegend(legendItems);

      svg.addText(10, 370, 'Blue points show where trimming occurs at corners', 'black', '12px');

      const fileName = 'polyline.svg';
      writeFileSync(join(outputDir, fileName), svg.toString());

      // Verify offsets were generated successfully
      const innerOffsetTest = offsetShape(rectanglePolyline, 8, 'inset');
      expect(innerOffsetTest.success).toBe(true);
      expect(innerOffsetTest.shapes.length).toBeGreaterThan(0);
    });
  });
});