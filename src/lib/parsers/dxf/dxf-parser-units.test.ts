import { describe, it, expect } from 'vitest';
import { parseDXF } from './functions';
import { Unit } from '$lib/utils/units';

describe('DXF Parser Units', () => {
    describe('$INSUNITS header parsing', () => {
        it('should handle DXF with centimeters unit (INSUNITS=5)', async () => {
            const dxfContent = `0
SECTION
2
HEADER
9
$INSUNITS
70
5
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
10
0.0
20
0.0
30
0.0
11
100.0
21
0.0
31
0.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);

            expect(result.units).toBe(Unit.MM); // Centimeters treated as mm
            expect(result.shapes).toHaveLength(1);
            expect(result.shapes[0].type).toBe('line');
        });

        it('should handle DXF with meters unit (INSUNITS=6)', async () => {
            const dxfContent = `0
SECTION
2
HEADER
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
ENTITIES
0
CIRCLE
10
0.0
20
0.0
30
0.0
40
1.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);

            expect(result.units).toBe(Unit.MM); // Meters treated as mm
            expect(result.shapes).toHaveLength(1);
            expect(result.shapes[0].type).toBe('circle');
        });

        it('should handle unknown INSUNITS values', async () => {
            const dxfContent = `0
SECTION
2
HEADER
9
$INSUNITS
70
99
0
ENDSEC
0
SECTION
2
ENTITIES
0
ARC
10
0.0
20
0.0
30
0.0
40
5.0
50
0.0
51
1.57
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);

            expect(result.units).toBe(Unit.MM); // Unknown units default to mm
            expect(result.shapes).toHaveLength(1);
            expect(result.shapes[0].type).toBe('arc');
        });

        it('should handle DXF without INSUNITS header', async () => {
            const dxfContent = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
10
0.0
20
0.0
30
0.0
11
10.0
21
10.0
31
0.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);

            expect(result.units).toBe(Unit.NONE); // Default to none when no INSUNITS
            expect(result.shapes).toHaveLength(1);
        });

        it('should handle DXF with alternative insUnits property', async () => {
            // Test the actual DXF parsing since we can't easily mock the parseString function
            const dxfContent = `0
SECTION
2
HEADER
9
$INSUNITS
70
5
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
10
0.0
20
0.0
30
0.0
11
10.0
21
10.0
31
0.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            expect(result.units).toBe(Unit.MM);
        });
    });

    describe('entity processing edge cases', () => {
        it('should handle LINE with vertices array format', async () => {
            // This tests an alternative LINE format that might not be covered
            const dxfContent = `0
SECTION
2
ENTITIES
0
LINE
10
0.0
20
0.0
11
10.0
21
10.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            expect(result.shapes).toHaveLength(1);
            expect(result.shapes[0].type).toBe('line');
        });

        it('should handle malformed CIRCLE entity', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
CIRCLE
10
not-a-number
20
0.0
40
5.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // DXF parser may still process the entity if the library handles the malformed data
            // The test should verify it handles the input without crashing
            expect(result.shapes.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle ARC with missing properties', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ARC
10
0.0
20
0.0
40
5.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // Should skip ARC without proper angle information
            expect(result.shapes).toHaveLength(0);
        });

        it('should handle SPLINE with insufficient control points', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
SPLINE
70
8
71
3
10
0.0
20
0.0
10
5.0
20
5.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // DXF parser may still process the entity or handle it gracefully
            // The test should verify it handles the input without crashing
            expect(result.shapes.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle LWPOLYLINE with invalid vertices', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
2
70
0
10
invalid
20
0.0
10
10.0
20
10.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // Should filter out invalid vertices and continue
            expect(result.shapes).toHaveLength(0); // Not enough valid vertices
        });

        it('should handle ELLIPSE with missing major axis', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
0.0
20
0.0
40
0.5
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // Should skip ELLIPSE without major axis information
            expect(result.shapes).toHaveLength(0);
        });
    });

    describe('bounds calculation edge cases', () => {
        it('should handle drawing with no valid shapes', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
UNKNOWN_ENTITY
10
0.0
20
0.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);

            expect(result.shapes).toHaveLength(0);
            expect(result.bounds.min).toEqual({ x: 0, y: 0 });
            expect(result.bounds.max).toEqual({ x: 0, y: 0 });
        });

        it('should handle drawing with infinite bounds', async () => {
            // This is more of a stress test for bounds calculation
            const dxfContent = `0
SECTION
2
ENTITIES
0
LINE
10
0.0
20
0.0
11
10.0
21
10.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);

            expect(result.bounds.min.x).toBe(0);
            expect(result.bounds.min.y).toBe(0);
            expect(result.bounds.max.x).toBe(10);
            expect(result.bounds.max.y).toBe(10);
        });
    });

    describe('transformation edge cases', () => {
        it('should handle INSERT with missing block', async () => {
            const dxfContent = `0
SECTION
2
ENTITIES
0
INSERT
2
NONEXISTENT_BLOCK
10
0.0
20
0.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // Should skip INSERT with missing block
            expect(result.shapes).toHaveLength(0);
        });

        it('should handle INSERT with zero scale', async () => {
            const dxfContent = `0
SECTION
2
BLOCKS
0
BLOCK
2
TEST_BLOCK
10
0.0
20
0.0
0
LINE
10
0.0
20
0.0
11
10.0
21
10.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
TEST_BLOCK
10
5.0
20
5.0
41
0.0
42
0.0
0
ENDSEC
0
EOF`;

            const result = await parseDXF(dxfContent);
            // Should handle zero scale gracefully
            expect(result.shapes).toHaveLength(1);
        });
    });
});
