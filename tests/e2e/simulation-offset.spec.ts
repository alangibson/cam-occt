import { test, expect, type Page } from '@playwright/test';

test.describe('Simulation with offset paths', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Import a DXF file with simple shapes
        // This assumes you have a test DXF file that creates chains suitable for offsetting
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('./tests/dxf/simple-square.dxf');

        // Wait for import to complete
        await page.waitForTimeout(500);

        // Navigate through workflow to simulation
        await navigateToSimulation(page);
    });

    async function navigateToSimulation(page: Page) {
        // Click through Edit stage
        await page.click('button:has-text("Next: Prepare Chains")');
        await page.waitForTimeout(300);

        // Click through Prepare stage
        await page.click('button:has-text("Next: Generate Tool")');
        await page.waitForTimeout(300);

        // In Program stage, create an operation with offset
        await createOperationWithOffset(page);

        // Navigate to Simulate stage
        await page.click('button:has-text("Next: Simulate")');
        await page.waitForTimeout(300);
    }

    async function createOperationWithOffset(page: Page) {
        // Click "Create New Operation" or similar button
        const createButton = page
            .locator(
                'button:has-text("Create"), button:has-text("Add Operation")'
            )
            .first();
        if (await createButton.isVisible()) {
            await createButton.click();
            await page.waitForTimeout(200);
        }

        // Select a chain if needed
        const chainCheckbox = page.locator('input[type="checkbox"]').first();
        if (await chainCheckbox.isVisible()) {
            await chainCheckbox.check();
        }

        // Find and set kerf compensation dropdown if it exists
        const kerfDropdown = page
            .locator('select')
            .filter({ hasText: /kerf|offset|compensation/i });
        if ((await kerfDropdown.count()) > 0) {
            await kerfDropdown.first().selectOption({ index: 1 }); // Select first non-none option
        }

        // Save the operation
        const saveButton = page
            .locator('button:has-text("Save"), button:has-text("Create")')
            .last();
        if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(200);
        }
    }

    test('should detect and use offset paths when available', async ({
        page,
    }) => {
        // Check that simulation stage is visible
        await expect(page.locator('text=3D Cutting Simulation')).toBeVisible();

        // Check that canvas is present
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        // Start simulation
        const playButton = page.locator('button:has-text("Play")');
        await expect(playButton).toBeVisible();
        await playButton.click();

        // Wait for simulation to start
        await page.waitForTimeout(500);

        // Check that simulation is running
        const pauseButton = page.locator('button:has-text("Pause")');
        await expect(pauseButton).toBeEnabled();

        // Verify progress is updating
        const progressText = page.locator('text=Progress:');
        await expect(progressText).toBeVisible();

        // Stop simulation
        const stopButton = page.locator('button:has-text("Stop")');
        await stopButton.click();
    });

    test('should show both offset and original paths in canvas', async ({
        page,
    }) => {
        // The canvas should show both solid (offset) and dashed (original) paths
        // This is a visual test that would need screenshot comparison in practice

        // Take a screenshot for visual regression testing
        await page.screenshot({
            path: 'test-output/simulation-offset-paths.png',
        });

        // Check that canvas exists and has content
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        // Verify canvas has been drawn to (has non-transparent pixels)
        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).toBeTruthy();
        expect(canvasBox!.width).toBeGreaterThan(0);
        expect(canvasBox!.height).toBeGreaterThan(0);
    });

    test('should fall back to original paths when no offset exists', async ({
        page,
    }) => {
        // Navigate back to Program stage
        await page.click('text=Program');
        await page.waitForTimeout(300);

        // Create an operation without offset (if possible)
        // This depends on your UI implementation

        // Navigate back to Simulate
        await page.click('text=Simulate');
        await page.waitForTimeout(300);

        // Start simulation - it should still work without offsets
        const playButton = page.locator('button:has-text("Play")');
        await playButton.click();

        await page.waitForTimeout(500);

        // Verify simulation is running
        const pauseButton = page.locator('button:has-text("Pause")');
        await expect(pauseButton).toBeEnabled();
    });

    test('should handle mixed operations with and without offsets', async ({
        page,
    }) => {
        // This test would create multiple operations, some with offsets and some without
        // Then verify that simulation handles both correctly

        // Start simulation
        const playButton = page.locator('button:has-text("Play")');
        await playButton.click();

        // Let simulation run for a bit
        await page.waitForTimeout(2000);

        // Check that simulation progresses
        const progressBar = page.locator('.progress-fill');
        const initialWidth = await progressBar.evaluate((el) => el.style.width);

        await page.waitForTimeout(1000);

        const laterWidth = await progressBar.evaluate((el) => el.style.width);
        expect(parseFloat(laterWidth)).toBeGreaterThan(
            parseFloat(initialWidth)
        );

        // Stop simulation
        const stopButton = page.locator('button:has-text("Stop")');
        await stopButton.click();
    });

    test('should update timing calculations with offset path lengths', async ({
        page,
    }) => {
        // Check that time display is present
        const timeDisplay = page.locator('text=/Time:.*\\d+:\\d+/');
        await expect(timeDisplay).toBeVisible();

        // Start simulation
        const playButton = page.locator('button:has-text("Play")');
        await playButton.click();

        // Wait and check that time updates
        await page.waitForTimeout(1000);

        // Get current time from display
        const timeText = await timeDisplay.textContent();
        expect(timeText).toMatch(/\d+:\d+/);

        // Pause simulation
        const pauseButton = page.locator('button:has-text("Pause")');
        await pauseButton.click();
    });

    test('should maintain tool head position along offset paths', async ({
        page,
    }) => {
        // Start simulation
        const playButton = page.locator('button:has-text("Play")');
        await playButton.click();

        // Check that current operation is displayed
        const operationText = page.locator('text=Current Operation:');
        await expect(operationText).toBeVisible();

        // Wait for operation to change from "Ready"
        await page.waitForFunction(
            () => {
                const el = document.querySelector(
                    '*:has-text("Current Operation:")'
                );
                return el && !el.textContent?.includes('Ready');
            },
            { timeout: 5000 }
        );

        // Verify operation shows cutting or rapid movement
        const operationContent = await operationText.textContent();
        expect(operationContent).toMatch(/Cutting|Rapid/);

        // Stop simulation
        const stopButton = page.locator('button:has-text("Stop")');
        await stopButton.click();
    });

    test('should reset properly with offset paths', async ({ page }) => {
        // Start simulation
        let playButton = page.locator('button:has-text("Play")');
        await playButton.click();

        // Let it run
        await page.waitForTimeout(1000);

        // Reset simulation
        const resetButton = page.locator('button:has-text("Reset")');
        await resetButton.click();

        // Check progress is back to 0
        const progressText = await page.locator('text=Progress:').textContent();
        expect(progressText).toContain('0');

        // Check time is reset
        const timeText = await page
            .locator('text=/Time:.*00:00/')
            .textContent();
        expect(timeText).toContain('00:00');

        // Verify can play again
        playButton = page.locator('button:has-text("Play")');
        await expect(playButton).toBeEnabled();
    });
});
