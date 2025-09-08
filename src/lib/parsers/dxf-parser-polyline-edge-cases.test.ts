import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';
import { getBoundingBoxForShape } from '../geometry/bounding-box';
import type { Shape, Polyline } from '../types/geometry';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DXF Parser - Polyline Edge Cases', () => {
  it('should handle polylines with zero vertices', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
0
70
0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(0);
  });

  it('should handle polylines with single vertex', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
1
70
0
10
5.0
20
10.0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(0);
  });

  it('should handle polylines with two valid vertices', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
2
70
0
10
5.0
20
10.0
10
15.0
20
20.0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(1);
    expect(drawing.shapes[0].type).toBe('polyline');
    
    const polyline = drawing.shapes[0].geometry as Polyline;
    expect(polyline.shapes).toHaveLength(1);
    expect(polyline.closed).toBe(false);
  });

  it('should filter out vertices with undefined coordinates', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
3
70
0
10
5.0
20
10.0
10

20
20.0
10
25.0
20
30.0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    // Should still create polyline with the two valid vertices (first and last)
    expect(drawing.shapes).toHaveLength(1);
    const polyline = drawing.shapes[0].geometry as Polyline;
    // Two valid vertices create one line segment
    expect(polyline.shapes).toHaveLength(1);
    expect(polyline.shapes[0].type).toBe('line');
  });

  it('should handle closed polylines correctly', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
3
70
1
10
0.0
20
0.0
10
10.0
20
0.0
10
5.0
20
10.0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(1);
    
    const polyline = drawing.shapes[0].geometry as Polyline;
    expect(polyline.closed).toBe(true);
    expect(polyline.shapes).toHaveLength(3);
  });

  it('should handle DOGLABPLAQUE.dxf polylines without errors', async () => {
    // Simulate a polyline from DOGLABPLAQUE.dxf that was causing issues
    const dxfContent = `0
SECTION
2
HEADER
9
$INSUNITS
70
1
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
5
116
8
Layer_1
62
7
90
2
70
0
10
3.598145
20
8.465983
30
0.0
10
2.935527
20
8.465983
30
0.0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(1);
    expect(drawing.shapes[0].type).toBe('polyline');
    
    const polyline = drawing.shapes[0].geometry as Polyline;
    expect(polyline.shapes).toHaveLength(1);
    expect(polyline.shapes[0].type).toBe('line');
  });

  it('should not create polylines when all vertices are invalid', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
2
70
0
10

20

10

20

0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(0);
  });

  it('should handle polylines with bulge values', async () => {
    const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
Layer_1
90
3
70
0
10
0.0
20
0.0
42
0.5
10
10.0
20
0.0
42
0.0
10
10.0
20
10.0
0
ENDSEC
0
EOF`;
    
    const drawing = await parseDXF(dxfContent);
    expect(drawing.shapes).toHaveLength(1);
    
    const polyline = drawing.shapes[0].geometry as Polyline;
    expect(polyline.shapes).toHaveLength(2);
    // First segment should be an arc due to bulge
    expect(polyline.shapes[0].type).toBe('arc');
    // Second segment should be a line (no bulge)
    expect(polyline.shapes[1].type).toBe('line');
  });

  it('should load DOGLABPLAQUE.dxf without bounding box errors', async () => {
    const dxfPath = join(process.cwd(), 'tests', 'dxf', 'DOGLABPLAQUE.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf8');
    
    const drawing = await parseDXF(dxfContent);
    
    // Should have shapes
    expect(drawing.shapes.length).toBeGreaterThan(0);
    
    // All polyline shapes should have valid bounding boxes (no errors)
    const polylineShapes = drawing.shapes.filter(s => s.type === 'polyline');
    expect(polylineShapes.length).toBeGreaterThan(0);
    
    for (const shape of polylineShapes) {
      const polyline = shape.geometry as Polyline;
      
      // Each polyline should have at least one segment
      expect(polyline.shapes.length).toBeGreaterThan(0);
      
      // Should be able to calculate bounding box without errors
      expect(() => getBoundingBoxForShape(shape)).not.toThrow();
      
      const bbox = getBoundingBoxForShape(shape);
      expect(bbox).toBeDefined();
      expect(bbox.min).toBeDefined();
      expect(bbox.max).toBeDefined();
      expect(isFinite(bbox.min.x)).toBe(true);
      expect(isFinite(bbox.min.y)).toBe(true);
      expect(isFinite(bbox.max.x)).toBe(true);
      expect(isFinite(bbox.max.y)).toBe(true);
    }
  });
});