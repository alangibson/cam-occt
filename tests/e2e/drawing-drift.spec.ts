import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Drawing Drift Issue', () => {
    test('should detect vertical drift of drawing on Edit stage', async ({
        page,
    }) => {
        // Navigate to the app
        await page.goto('/');

        // Load a DXF file
        const testFile = path.join(__dirname, '../dxf/1.dxf');
        await page.setInputFiles('input[type="file"]', testFile);

        // Wait for file to be loaded and auto-advance to Edit stage
        await page.waitForURL('**/edit', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000); // Give canvas time to render

        // Take initial screenshot of the drawing canvas
        const canvas = page.locator('canvas.drawing-canvas');
        await expect(canvas).toBeVisible();

        // Take initial screenshot
        const screenshot1 = await canvas.screenshot();

        // Get initial bounding box of the canvas
        const bbox1 = await canvas.boundingBox();
        expect(bbox1).not.toBeNull();

        // Wait 5 seconds without any user interaction
        await page.waitForTimeout(5000);

        // Take second screenshot
        const screenshot2 = await canvas.screenshot();

        // Get second bounding box
        const bbox2 = await canvas.boundingBox();
        expect(bbox2).not.toBeNull();

        // Compare screenshots pixel by pixel to detect movement
        // If drawing has drifted, the screenshots should be different
        const pixelsDiff = Buffer.compare(screenshot1, screenshot2);

        // Log for debugging
        console.log('Canvas position 1:', bbox1);
        console.log('Canvas position 2:', bbox2);
        console.log('Pixels different:', pixelsDiff !== 0);

        // The test should fail if drawing has drifted
        // We expect the screenshots to be identical (no drift)
        expect(pixelsDiff).toBe(0);

        // Also check if canvas itself moved (though it shouldn't)
        expect(bbox2!.y).toBe(bbox1!.y);
    });

    test('should detect vertical drift on Prepare stage', async ({ page }) => {
        // Navigate to the app
        await page.goto('/');

        // Load a DXF file
        const testFile = path.join(__dirname, '../dxf/1.dxf');
        await page.setInputFiles('input[type="file"]', testFile);

        // Wait for auto-advance to Edit stage
        await page.waitForURL('**/edit', { waitUntil: 'networkidle' });

        // Navigate to Prepare stage
        await page.click('text=Prepare');
        await page.waitForURL('**/prepare', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Take initial screenshot of the drawing canvas
        const canvas = page.locator('canvas.drawing-canvas');
        await expect(canvas).toBeVisible();

        const screenshot1 = await canvas.screenshot();

        // Wait 5 seconds
        await page.waitForTimeout(5000);

        // Take second screenshot
        const screenshot2 = await canvas.screenshot();

        // Compare screenshots
        const pixelsDiff = Buffer.compare(screenshot1, screenshot2);

        // The test should fail if drawing has drifted
        expect(pixelsDiff).toBe(0);
    });

    test('should NOT drift on Program stage (control test)', async ({
        page,
    }) => {
        // Navigate to the app
        await page.goto('/');

        // Load a DXF file
        const testFile = path.join(__dirname, '../dxf/1.dxf');
        await page.setInputFiles('input[type="file"]', testFile);

        // Navigate through stages to Program
        await page.waitForURL('**/edit', { waitUntil: 'networkidle' });
        await page.click('text=Prepare');
        await page.waitForURL('**/prepare', { waitUntil: 'networkidle' });
        await page.click('text=Program');
        await page.waitForURL('**/program', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Take screenshots
        const canvas = page.locator('canvas.drawing-canvas');
        const screenshot1 = await canvas.screenshot();

        await page.waitForTimeout(5000);

        const screenshot2 = await canvas.screenshot();

        // Program stage should NOT have drift
        const pixelsDiff = Buffer.compare(screenshot1, screenshot2);
        expect(pixelsDiff).toBe(0);
    });
});
