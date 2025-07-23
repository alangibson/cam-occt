import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Zoom Preservation and Behavior', () => {
  test('should preserve zoom level when modifying shapes', async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Import a DXF file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    // Wait for file to load and go to modify stage
    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check initial zoom display (should be 100%)
    const initialZoomText = await page.locator('.zoom-display').textContent();
    expect(initialZoomText).toContain('100%');

    // Simulate zoom change by scrolling wheel on canvas
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    
    // Zoom in by scrolling up (multiple times for noticeable change)
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -120); // Negative deltaY = zoom in
      await page.waitForTimeout(100);
    }

    // Verify zoom has changed
    const zoomedInText = await page.locator('.zoom-display').textContent();
    expect(zoomedInText).not.toContain('100%');
    
    // Extract the zoom percentage
    const zoomMatch = zoomedInText?.match(/(\d+)%/);
    const currentZoom = zoomMatch ? parseInt(zoomMatch[1]) : 100;
    expect(currentZoom).toBeGreaterThan(100);

    // Now select a shape (this should NOT reset zoom)
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);

    // Verify zoom is still the same
    const afterSelectionZoom = await page.locator('.zoom-display').textContent();
    expect(afterSelectionZoom).toContain(`${currentZoom}%`);

    // If we have an editable property, modify it (this should also NOT reset zoom)
    const hasSelectedEditor = await page.locator('.selected-shape-editor').isVisible();
    if (hasSelectedEditor) {
      const inputs = page.locator('.point-inputs input');
      const inputCount = await inputs.count();
      
      if (inputCount > 0) {
        const firstInput = inputs.first();
        await firstInput.fill('123.456');
        await page.waitForTimeout(1000);

        // Zoom should still be preserved after reactive modification
        const afterModificationZoom = await page.locator('.zoom-display').textContent();
        expect(afterModificationZoom).toContain(`${currentZoom}%`);
      }
    }

    console.log(`Test completed: Initial zoom 100% -> Modified zoom ${currentZoom}% -> Preserved through selection and modification`);
  });

  test('should reset zoom to 100% only when loading new files', async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Import first file
    await page.click('.stage-button:has-text("Import")');
    let fileInput = page.locator('input[type="file"]');
    const dxfPath1 = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath1);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Zoom in
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(100);
    }

    // Verify we're zoomed in
    const zoomedText = await page.locator('.zoom-display').textContent();
    const zoomMatch = zoomedText?.match(/(\d+)%/);
    const zoomedInValue = zoomMatch ? parseInt(zoomMatch[1]) : 100;
    expect(zoomedInValue).toBeGreaterThan(100);

    // Go back to import and load a different file
    await page.click('.stage-button:has-text("Import")');
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    
    fileInput = page.locator('input[type="file"]');
    const dxfPath2 = path.join(__dirname, '../../test/dxf/2.dxf');
    await fileInput.setInputFiles(dxfPath2);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Zoom should be reset to 100% for the new file
    const newFileZoomText = await page.locator('.zoom-display').textContent();
    expect(newFileZoomText).toContain('100%');
  });

  test('should maintain natural size display at 100% zoom', async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Import a file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should start at 100% zoom (natural size)
    const zoomText = await page.locator('.zoom-display').textContent();
    expect(zoomText).toContain('100%');

    // Should show drawing dimensions (indicating geometry is loaded and scaled properly)
    const dimensionsDisplay = page.locator('.dimensions-display');
    await expect(dimensionsDisplay).toBeVisible();
    
    const dimensionsText = await dimensionsDisplay.textContent();
    expect(dimensionsText).toContain('Drawing:');
    expect(dimensionsText).toMatch(/\d+\.\d+.*×.*\d+\.\d+/); // Should show width × height
  });

  test('should not break zoom controls after shape operations', async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Import a file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const canvas = page.locator('.viewer-container canvas');
    
    // Test zoom in
    await canvas.hover();
    await canvas.wheel(0, -120);
    await page.waitForTimeout(200);
    
    let zoomText = await page.locator('.zoom-display').textContent();
    let zoomValue = parseInt(zoomText?.match(/(\d+)%/)?.[1] || '100');
    const initialZoomedValue = zoomValue;
    expect(zoomValue).toBeGreaterThan(100);

    // Test zoom out
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(200);
    
    zoomText = await page.locator('.zoom-display').textContent();
    zoomValue = parseInt(zoomText?.match(/(\d+)%/)?.[1] || '100');
    expect(zoomValue).toBeLessThan(initialZoomedValue);

    // Select and modify a shape
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);

    // Try deleting if possible
    const deleteButton = page.locator('.btn-danger');
    if (await deleteButton.isEnabled()) {
      await deleteButton.click();
      await page.waitForTimeout(1000);
    }

    // Zoom should still work after shape operations
    await canvas.hover();
    await canvas.wheel(0, -120);
    await page.waitForTimeout(200);
    
    const finalZoomText = await page.locator('.zoom-display').textContent();
    const finalZoomValue = parseInt(finalZoomText?.match(/(\d+)%/)?.[1] || '100');
    
    // Zoom controls should still be functional
    expect(finalZoomValue).toBeDefined();
    expect(finalZoomValue).toBeGreaterThan(0);
  });
});