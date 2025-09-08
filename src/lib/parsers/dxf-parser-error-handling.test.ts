import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';

describe('DXF Parser Error Handling', () => {
    it('should handle entities without vertices gracefully', async () => {
        // This test should catch the error where entities don't have vertices property
        const dxfWithMissingVertices = `0
SECTION
2
ENTITIES
0
LINE
8
0
10
0.0
20
0.0
11
100.0
21
0.0
0
ENDSEC
0
EOF`;

        // This should not throw an error
        await expect(parseDXF(dxfWithMissingVertices)).resolves.toBeDefined();
    });

    it('should handle empty or malformed DXF entities', async () => {
        // Test with various edge cases that might cause undefined access
        const problematicDXF = `0
SECTION
2
ENTITIES
0
CIRCLE
8
0
10
50.0
20
50.0
40
25.0
0
ARC
8
0
10
0.0
20
0.0
40
10.0
50
0.0
51
90.0
0
ENDSEC
0
EOF`;

        // This should parse without throwing errors
        const result = await parseDXF(problematicDXF);
        expect(result).toBeDefined();
        expect(result.shapes).toBeDefined();
        expect(Array.isArray(result.shapes)).toBe(true);
    });

    it('should handle polyline entities without proper structure', async () => {
        const polylineDXF = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
0
90
4
10
0.0
20
0.0
10
100.0
20
0.0
10
100.0
20
100.0
10
0.0
20
100.0
70
1
0
ENDSEC
0
EOF`;

        const result = await parseDXF(polylineDXF);
        expect(result).toBeDefined();
        expect(result.shapes).toBeDefined();
    });
});
