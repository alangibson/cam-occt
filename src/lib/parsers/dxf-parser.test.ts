import { describe, it, expect } from 'vitest';
import { parseDXF } from './dxf-parser';

describe('DXF Parser', () => {
  it('should be able to import the DXF parser module without errors', async () => {
    expect(typeof parseDXF).toBe('function');
  });
  
  it('should handle empty DXF content gracefully', async () => {
    // Test with minimal DXF that won't have entities
    const emptyDXF = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;
    
    // This should parse successfully and return empty shapes array
    const result = await parseDXF(emptyDXF);
    expect(result).toBeDefined();
    expect(result.shapes).toBeDefined();
    expect(Array.isArray(result.shapes)).toBe(true);
    expect(result.shapes).toHaveLength(0);
  });
});