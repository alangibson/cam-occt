import { describe, expect, it } from 'vitest';
import { parseSVG } from './functions';
import { readFileSync } from 'fs';
import { DEFAULT_LAYER_NAME } from './constants';

describe('SVG Layer Detection', () => {
    it('should assign default layer when no groups present', async () => {
        const svgContent = readFileSync('tests/svg/no-layers.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);
        expect(result.shapes.every((s) => s.layer === DEFAULT_LAYER_NAME)).toBe(
            true
        );
    });

    it('should detect top-level groups as layers', async () => {
        const svgContent = readFileSync('tests/svg/with-layers.svg', 'utf-8');
        const result = await parseSVG(svgContent);

        expect(result.shapes.length).toBeGreaterThan(0);

        // Find shapes from layer1
        const layer1Shapes = result.shapes.filter((s) => s.layer === 'layer1');
        expect(layer1Shapes.length).toBeGreaterThan(0);

        // Find shapes from layer2
        const layer2Shapes = result.shapes.filter((s) => s.layer === 'layer2');
        expect(layer2Shapes.length).toBeGreaterThan(0);
    });

    it('should use group id attribute as layer name', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g id="custom-layer">
    <line x1="0" y1="0" x2="100" y2="100" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].layer).toBe('custom-layer');
    });

    it('should use default layer name for groups without id', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g>
    <circle cx="50" cy="50" r="25" />
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes).toHaveLength(1);
        expect(result.shapes[0].layer).toBe(DEFAULT_LAYER_NAME);
    });

    it('should handle nested groups', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g id="outer">
    <line x1="0" y1="0" x2="10" y2="10" />
    <g id="inner">
      <circle cx="50" cy="50" r="20" />
    </g>
  </g>
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBe(2);

        // Outer line should be in 'outer' layer
        const outerShapes = result.shapes.filter((s) => s.layer === 'outer');
        expect(outerShapes.length).toBe(1);

        // Inner circle should be in 'inner' layer
        const innerShapes = result.shapes.filter((s) => s.layer === 'inner');
        expect(innerShapes.length).toBe(1);
    });

    it('should handle mixed content with and without groups', async () => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <line x1="0" y1="0" x2="10" y2="10" />
  <g id="grouped">
    <circle cx="50" cy="50" r="20" />
  </g>
  <rect x="100" y="100" width="50" height="50" />
</svg>`;

        const result = await parseSVG(svg);
        expect(result.shapes.length).toBeGreaterThan(0);

        // Ungrouped shapes should be in default layer
        const defaultLayerShapes = result.shapes.filter(
            (s) => s.layer === DEFAULT_LAYER_NAME
        );
        expect(defaultLayerShapes.length).toBeGreaterThan(0);

        // Grouped shape should be in 'grouped' layer
        const groupedShapes = result.shapes.filter(
            (s) => s.layer === 'grouped'
        );
        expect(groupedShapes.length).toBe(1);
    });
});
