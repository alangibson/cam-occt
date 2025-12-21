import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';

describe('SVG Parser Error Handling', () => {
    it('should throw error for completely invalid content', () => {
        expect(() => parseSVG('not valid xml at all')).toThrow();
    });

    it('should throw error for non-SVG XML', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <text>This is not SVG</text>
</document>`;

        expect(() => parseSVG(xml)).toThrow('No SVG element found');
    });

    it('should throw error for malformed SVG', () => {
        const malformed = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <line x1="0" y1="0"
</svg>`;

        expect(() => parseSVG(malformed)).toThrow();
    });

    it('should handle empty string gracefully', () => {
        expect(() => parseSVG('')).toThrow();
    });

    it('should handle SVG with invalid line coordinates', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <line x1="invalid" y1="20" x2="30" y2="40" />
</svg>`;

        const result = parseSVG(svg);
        // Invalid coordinates should be filtered out
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle SVG with invalid circle coordinates', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50" cy="invalid" r="25" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle circle with negative radius', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50" cy="50" r="-25" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle circle with zero radius', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50" cy="50" r="0" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle ellipse with invalid radii', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <ellipse cx="100" cy="100" rx="0" ry="20" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle rect with invalid dimensions', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect x="10" y="20" width="-50" height="30" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle rect with zero dimensions', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect x="10" y="20" width="0" height="30" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle polyline with insufficient points', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <polyline points="10,10" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle polyline with no points attribute', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <polyline />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle polyline with malformed points', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <polyline points="abc def ghi" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle path with empty d attribute', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle path with no d attribute', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle path with invalid d attribute', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="invalid path data" />
</svg>`;

        const result = parseSVG(svg);
        // Parser should handle gracefully and return empty or filter out invalid
        expect(result.shapes).toBeDefined();
    });

    it('should handle mixed valid and invalid elements', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="50" cy="50" r="25" />
  <circle cx="invalid" cy="50" r="25" />
  <line x1="0" y1="0" x2="100" y2="100" />
  <rect x="10" y="10" width="-5" height="10" />
</svg>`;

        const result = parseSVG(svg);
        // Should successfully parse valid elements
        expect(result.shapes.length).toBeGreaterThan(0);
        // Should have filtered out invalid elements
        expect(result.shapes.length).toBeLessThan(4);
    });

    it('should handle SVG with missing attributes using defaults', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <line x2="100" y2="100" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        // Should default missing x1, y1 to 0
    });

    it('should handle Infinity values gracefully', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="Infinity" cy="50" r="25" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle NaN values gracefully', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <circle cx="NaN" cy="50" r="25" />
</svg>`;

        const result = parseSVG(svg);
        expect(result.shapes).toHaveLength(0);
    });

    it('should handle unknown SVG elements gracefully', () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <unknownelement x="10" y="10" />
  <circle cx="50" cy="50" r="25" />
</svg>`;

        const result = parseSVG(svg);
        // Should parse valid circle, ignore unknown element
        expect(result.shapes).toHaveLength(1);
    });
});
