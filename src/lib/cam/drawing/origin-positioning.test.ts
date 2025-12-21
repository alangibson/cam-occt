import { describe, expect, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { OriginLocation } from '$lib/cam/drawing/enums';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Drawing Origin Positioning', () => {
    describe('ADLER.dxf positioning', () => {
        it('should position ADLER.dxf with origin at bottom left (0,0)', async () => {
            // Load the actual ADLER.dxf file
            const dxfPath = join(process.cwd(), 'tests/dxf/ADLER.dxf');
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF
            const drawingData = await parseDXF(dxfContent);
            const drawing = new Drawing(drawingData);

            // Apply origin transformation
            drawing.originTo(OriginLocation.BOTTOM_LEFT);

            // Verify origin is at bottom left
            expect(drawing.bounds.min.x).toBeCloseTo(0, 10);
            expect(drawing.bounds.min.y).toBeCloseTo(0, 10);

            // Verify bounds are in positive quadrant
            expect(drawing.bounds.max.x).toBeGreaterThan(0);
            expect(drawing.bounds.max.y).toBeGreaterThan(0);
        });
    });

    describe('1997.dxf positioning', () => {
        it('should position 1997.dxf with origin at bottom left (0,0)', async () => {
            // Load the actual 1997.dxf file
            const dxfPath = join(process.cwd(), 'tests/dxf/1997.dxf');
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF
            const drawingData = await parseDXF(dxfContent);
            const drawing = new Drawing(drawingData);

            // Apply origin transformation
            drawing.originTo(OriginLocation.BOTTOM_LEFT);

            // Verify origin is at bottom left
            expect(drawing.bounds.min.x).toBeCloseTo(0, 10);
            expect(drawing.bounds.min.y).toBeCloseTo(0, 10);

            // Verify bounds are in positive quadrant
            expect(drawing.bounds.max.x).toBeGreaterThan(0);
            expect(drawing.bounds.max.y).toBeGreaterThan(0);
        });
    });

    describe('SVGThumbnail files positioning consistency', () => {
        // Test the specific files mentioned in FileGallery.svelte that need proper origin positioning
        const testFiles = ['ADLER.dxf', '1997.dxf'];

        testFiles.forEach((filename) => {
            it(`should position ${filename} with origin at bottom left for SVGThumbnail display`, async () => {
                const dxfPath = join(process.cwd(), 'tests/dxf', filename);
                const dxfContent = readFileSync(dxfPath, 'utf-8');

                const drawingData = await parseDXF(dxfContent);
                const drawing = new Drawing(drawingData);

                // Apply origin transformation (as done in FileGallery.svelte)
                drawing.originTo(OriginLocation.BOTTOM_LEFT);

                // Verify origin is at bottom left
                expect(drawing.bounds.min.x).toBeCloseTo(0, 10);
                expect(drawing.bounds.min.y).toBeCloseTo(0, 10);

                // Verify bounds are in positive quadrant
                expect(drawing.bounds.max.x).toBeGreaterThan(0);
                expect(drawing.bounds.max.y).toBeGreaterThan(0);
            });
        });
    });
});
