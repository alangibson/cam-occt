import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Optimize Starts Feature', () => {
    test('should show Optimize Starts button and optimize chain start points', async ({
        page,
    }) => {
        // Navigate to the app
        await page.goto('/');

        // Click on import stage in workflow
        await page.click('button:has-text("Import")');

        // Upload a test DXF file with closed chains
        const dxfFile = path.join(__dirname, '../dxf/6_polygons.dxf');
        await page.setInputFiles('input[type="file"]', dxfFile);

        // Wait for file to be processed
        await page.waitForTimeout(1000);

        // Navigate to prepare stage
        await page.click('button:has-text("Prepare")');

        // Click detect chains
        await page.click('button:has-text("Detect Chains")');

        // Wait for chains to be detected
        await page.waitForTimeout(500);

        // Verify the Optimize Starts button appears and is enabled
        const optimizeButton = page.locator(
            'button:has-text("Optimize Starts")'
        );
        await expect(optimizeButton).toBeVisible();
        await expect(optimizeButton).toBeEnabled();

        // Click the Optimize Starts button
        await optimizeButton.click();

        // Wait for optimization to complete
        await page.waitForTimeout(500);

        // Verify button shows "Optimizing..." while processing
        // (This would need to be tested with a slower operation or mocking)

        // Verify chains are still detected after optimization
        const chainsPanel = page.locator(
            'text=/Chains.*chains with.*connected shapes/'
        );
        await expect(chainsPanel).toBeVisible();
    });

    test('Optimize Starts button should be disabled when no chains detected', async ({
        page,
    }) => {
        // Navigate to the app
        await page.goto('/');

        // Click on import stage
        await page.click('button:has-text("Import")');

        // Upload a simple DXF file
        const dxfFile = path.join(__dirname, '../dxf/6_polygons.dxf');
        await page.setInputFiles('input[type="file"]', dxfFile);

        // Wait for file to be processed
        await page.waitForTimeout(1000);

        // Navigate to prepare stage
        await page.click('button:has-text("Prepare")');

        // Without detecting chains, the button should be disabled
        const optimizeButton = page.locator(
            'button:has-text("Optimize Starts")'
        );
        await expect(optimizeButton).toBeVisible();
        await expect(optimizeButton).toBeDisabled();
    });
});
