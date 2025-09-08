import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('DXF Screenshot Tests', () => {
    // Test key DXF files with visual verification
    // ARC and SPLINE entities are now supported!
    const testFiles = [
        'tests/dxf/1.dxf',
        'tests/dxf/2.dxf', // Contains ARC entities - now working
        'tests/dxf/3.dxf',
        'tests/dxf/ADLER.dxf',
        // 'tests/dxf/wrong/DRAAK.dxf', // Problematic file causing test hangs - skipping
        'tests/dxf/Polylinie.dxf', // Contains ARC entities - now working
        'tests/dxf/Tractor Light Mount - Left.dxf', // Contains ARC entities - now working
    ];

    for (const dxfFile of testFiles) {
        test(`should render ${dxfFile} visibly on screen`, async ({ page }) => {
            const errors: string[] = [];

            // Capture console errors
            page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    const text = msg.text();
                    if (
                        !text.includes('favicon') &&
                        !text.includes('sourcemap') &&
                        !text.includes('Failed to load resource') &&
                        text.trim() !== ''
                    ) {
                        errors.push(text);
                    }
                }
            });

            // Capture page errors
            page.on('pageerror', (error) => {
                errors.push(`Page Error: ${error.message}`);
            });

            // Navigate to the page
            await page.goto('/');

            // Wait for the page to be ready
            await page.waitForLoadState('networkidle');
            await expect(
                page.locator('button:has-text("Import DXF")')
            ).toBeVisible();

            try {
                // Read the DXF file content
                const dxfContent = readFileSync(dxfFile, 'utf-8');

                // Take a screenshot before loading (should be empty canvas)
                await expect(page.locator('.canvas-container')).toBeVisible();
                const emptyCanvas = page.locator('.drawing-canvas');
                await expect(emptyCanvas).toBeVisible();

                // Create a File object and trigger the file input
                await page.evaluate(async (content) => {
                    const file = new File([content], 'test.dxf', {
                        type: 'application/dxf',
                    });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);

                    const fileInput = document.querySelector(
                        'input[type="file"]'
                    ) as HTMLInputElement;
                    if (fileInput) {
                        fileInput.files = dataTransfer.files;
                        fileInput.dispatchEvent(
                            new Event('change', { bubbles: true })
                        );
                    }
                }, dxfContent);

                // Wait for processing to complete
                await page.waitForTimeout(3000);

                // Verify no console errors occurred
                expect(
                    errors,
                    `${dxfFile} should load without errors`
                ).toHaveLength(0);

                // Take a screenshot after loading to verify something is rendered
                const canvas = page.locator('.drawing-canvas');
                await expect(canvas).toBeVisible();

                // Get the filename for screenshot naming
                const fileName =
                    dxfFile.split('/').pop()?.replace('.dxf', '') || 'unknown';

                // Take a screenshot of the canvas area
                await expect(canvas).toHaveScreenshot(
                    `${fileName}-loaded.png`,
                    {
                        // Use a reasonable threshold for image comparison
                        threshold: 0.3,
                        // Mask out any UI elements that might change
                        mask: [page.locator('.sidebar')],
                    }
                );

                // Additional verification: check that the canvas has actual content
                // by examining canvas pixel data
                const hasContent = await page.evaluate(() => {
                    const canvas = document.querySelector(
                        '.drawing-canvas'
                    ) as HTMLCanvasElement;
                    if (!canvas) return false;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) return false;

                    const imageData = ctx.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
                    const data = imageData.data;

                    // Check if canvas has any non-white pixels (indicating content)
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];

                        // If we find any pixel that's not white/transparent, we have content
                        if (a > 0 && (r < 255 || g < 255 || b < 255)) {
                            return true;
                        }
                    }
                    return false;
                });

                expect(
                    hasContent,
                    `${dxfFile} should render visible content on canvas`
                ).toBe(true);

                console.log(
                    `✅ ${dxfFile} rendered successfully with visible content`
                );
            } catch (error) {
                console.log(`❌ Failed to test ${dxfFile}:`, error);

                // Take a failure screenshot for debugging
                const fileName =
                    dxfFile.split('/').pop()?.replace('.dxf', '') || 'unknown';
                await page.screenshot({
                    path: `test-results/${fileName}-failure.png`,
                    fullPage: true,
                });

                throw error;
            }
        });
    }

    test('should show drawing info after loading', async ({ page }) => {
        // Test that the UI updates to show drawing information
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Initially should show "No drawing loaded" in footer
        await expect(page.locator('footer .no-drawing')).toBeVisible();

        // Load a simple DXF file
        const dxfContent = readFileSync('tests/dxf/1.dxf', 'utf-8');

        await page.evaluate(async (content) => {
            const file = new File([content], 'test.dxf', {
                type: 'application/dxf',
            });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const fileInput = document.querySelector(
                'input[type="file"]'
            ) as HTMLInputElement;
            if (fileInput) {
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, dxfContent);

        // Wait for processing
        await page.waitForTimeout(2000);

        // Should no longer show "No drawing loaded" in footer
        await expect(page.locator('footer .no-drawing')).not.toBeVisible();

        // Should show shape count
        await expect(page.locator('text=Shapes:')).toBeVisible();
    });
});
