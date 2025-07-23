import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Zoom Scaling Accuracy - CRITICAL REQUIREMENT', () => {
  
  test('should ensure displayed size matches zoom factor exactly', async ({ page }) => {
    await page.goto('/');

    // Import a DXF file with known dimensions
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Should start at 100% zoom for natural 1:1 scale
    const initialZoomText = await page.locator('.zoom-display').textContent();
    expect(initialZoomText).toContain('100%');

    // Get drawing dimensions at 100% zoom
    const dimensionsDisplay = page.locator('.dimensions-display');
    await expect(dimensionsDisplay).toBeVisible();
    const dimensionsText = await dimensionsDisplay.textContent();
    
    // Extract dimensions (format: "Drawing: XXX.XX × YYY.YY mm")
    const dimensionMatch = dimensionsText?.match(/Drawing: ([\d.]+) × ([\d.]+) (\w+)/);
    expect(dimensionMatch).toBeTruthy();
    
    const width = parseFloat(dimensionMatch![1]);
    const height = parseFloat(dimensionMatch![2]);
    const units = dimensionMatch![3];
    
    console.log(`Drawing dimensions: ${width} × ${height} ${units}`);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    // Test zoom to 200% - displayed size should double
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    
    // Zoom in to 200% (approximately 20 wheel events)
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(50);
    }
    
    const zoom200Text = await page.locator('.zoom-display').textContent();
    const zoom200Match = zoom200Text?.match(/(\d+)%/);
    const zoom200Value = zoom200Match ? parseInt(zoom200Match[1]) : 100;
    
    console.log(`Zoomed to: ${zoom200Value}%`);
    expect(zoom200Value).toBeGreaterThan(150); // Should be significantly zoomed in

    // At higher zoom, dimensions should remain the same (real-world size unchanged)
    const dimensions200Text = await dimensionsDisplay.textContent();
    expect(dimensions200Text).toContain(`${width.toFixed(2)} × ${height.toFixed(2)}`);
    
    // Test zoom back to exactly 100%
    while (true) {
      const currentZoomText = await page.locator('.zoom-display').textContent();
      const currentZoomMatch = currentZoomText?.match(/(\d+)%/);
      const currentZoom = currentZoomMatch ? parseInt(currentZoomMatch[1]) : 100;
      
      if (currentZoom === 100) break;
      if (currentZoom > 100) {
        await page.mouse.wheel(0, 120); // Zoom out
      } else {
        await page.mouse.wheel(0, -120); // Zoom in
      }
      await page.waitForTimeout(100);
    }

    // Verify we're back at 100%
    const finalZoomText = await page.locator('.zoom-display').textContent();
    expect(finalZoomText).toContain('100%');
    
    // Dimensions should still be accurate
    const finalDimensionsText = await dimensionsDisplay.textContent();
    expect(finalDimensionsText).toContain(`${width.toFixed(2)} × ${height.toFixed(2)}`);
  });

  test('should maintain zoom accuracy during shape selection and modification', async ({ page }) => {
    await page.goto('/');

    // Import file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Zoom to a specific level
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(50);
    }

    // Record zoom level
    const zoomedText = await page.locator('.zoom-display').textContent();
    const zoomMatch = zoomedText?.match(/(\d+)%/);
    const targetZoom = zoomMatch ? parseInt(zoomMatch[1]) : 100;
    expect(targetZoom).toBeGreaterThan(100);
    
    console.log(`Target zoom level: ${targetZoom}%`);

    // Select a shape - zoom must be preserved
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);

    const afterSelectionZoom = await page.locator('.zoom-display').textContent();
    expect(afterSelectionZoom).toContain(`${targetZoom}%`);

    // Modify shape properties if possible - zoom must still be preserved
    const hasSelectedEditor = await page.locator('.selected-shape-editor').isVisible();
    if (hasSelectedEditor) {
      const inputs = page.locator('.point-inputs input');
      const inputCount = await inputs.count();
      
      if (inputCount > 0) {
        const firstInput = inputs.first();
        const originalValue = await firstInput.inputValue();
        const newValue = (parseFloat(originalValue) + 15.75).toString();
        
        await firstInput.fill(newValue);
        await page.waitForTimeout(2000); // Wait for reactive change to process

        // CRITICAL: Zoom must remain unchanged after property modification
        const afterModificationZoom = await page.locator('.zoom-display').textContent();
        expect(afterModificationZoom).toContain(`${targetZoom}%`);
        
        console.log(`Zoom preserved after modification: ${afterModificationZoom}`);
      }
    }
  });

  test('should provide accurate unit scaling between mm and inches', async ({ page }) => {
    await page.goto('/');

    // Import file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Get dimensions in mm (default)
    const dimensionsDisplay = page.locator('.dimensions-display');
    const mmDimensionsText = await dimensionsDisplay.textContent();
    const mmMatch = mmDimensionsText?.match(/Drawing: ([\d.]+) × ([\d.]+) mm/);
    expect(mmMatch).toBeTruthy();
    
    const mmWidth = parseFloat(mmMatch![1]);
    const mmHeight = parseFloat(mmMatch![2]);
    
    console.log(`Dimensions in mm: ${mmWidth} × ${mmHeight}`);

    // Change units to inches
    const unitsSelect = page.locator('select').filter({ hasText: 'Millimeters' }).or(page.locator('select[value="mm"]'));
    if (await unitsSelect.isVisible()) {
      await unitsSelect.selectOption('inches');
      await page.waitForTimeout(1000);
    }

    // Get dimensions in inches
    const inchDimensionsText = await dimensionsDisplay.textContent();
    const inchMatch = inchDimensionsText?.match(/Drawing: ([\d.]+) × ([\d.]+) inches/);
    
    if (inchMatch) {
      const inchWidth = parseFloat(inchMatch[1]);
      const inchHeight = parseFloat(inchMatch[2]);
      
      console.log(`Dimensions in inches: ${inchWidth} × ${inchHeight}`);
      
      // Verify conversion accuracy: 1 inch = 25.4mm
      const expectedInchWidth = mmWidth / 25.4;
      const expectedInchHeight = mmHeight / 25.4;
      
      expect(inchWidth).toBeCloseTo(expectedInchWidth, 2);
      expect(inchHeight).toBeCloseTo(expectedInchHeight, 2);
    }

    // Zoom should remain at 100% when changing units
    const zoomText = await page.locator('.zoom-display').textContent();
    expect(zoomText).toContain('100%');
  });

  test('should reset zoom to 100% only for new file loads', async ({ page }) => {
    await page.goto('/');

    // Load first file
    await page.click('.stage-button:has-text("Import")');
    let fileInput = page.locator('input[type="file"]');
    const dxfPath1 = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath1);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Zoom in significantly
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(50);
    }

    const zoomedText = await page.locator('.zoom-display').textContent();
    const zoomMatch = zoomedText?.match(/(\d+)%/);
    const zoomedValue = zoomMatch ? parseInt(zoomMatch[1]) : 100;
    expect(zoomedValue).toBeGreaterThan(150);
    
    console.log(`First file zoom: ${zoomedValue}%`);

    // Load a different file - should reset zoom to 100%
    await page.click('.stage-button:has-text("Import")');
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    
    fileInput = page.locator('input[type="file"]');
    const dxfPath2 = path.join(__dirname, '../../test/dxf/2.dxf');
    await fileInput.setInputFiles(dxfPath2);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // New file should start at 100% zoom
    const newFileZoomText = await page.locator('.zoom-display').textContent();
    expect(newFileZoomText).toContain('100%');
    
    console.log(`New file zoom: ${newFileZoomText}`);
  });

  test('should maintain accurate zoom during delete operations', async ({ page }) => {
    await page.goto('/');

    // Import file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Set specific zoom level
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(50);
    }

    const zoomedText = await page.locator('.zoom-display').textContent();
    const zoomMatch = zoomedText?.match(/(\d+)%/);
    const targetZoom = zoomMatch ? parseInt(zoomMatch[1]) : 100;
    
    console.log(`Pre-delete zoom: ${targetZoom}%`);

    // Select and delete a shape
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);

    const deleteButton = page.locator('.btn-danger');
    if (await deleteButton.isEnabled()) {
      await deleteButton.click();
      await page.waitForTimeout(2000); // Wait for delete and refresh

      // CRITICAL: Zoom must be preserved after delete operation
      const afterDeleteZoom = await page.locator('.zoom-display').textContent();
      expect(afterDeleteZoom).toContain(`${targetZoom}%`);
      
      console.log(`Post-delete zoom: ${afterDeleteZoom}`);

      // Zoom controls should still work after delete
      await canvas.hover();
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(200);

      const finalZoomText = await page.locator('.zoom-display').textContent();
      const finalZoomMatch = finalZoomText?.match(/(\d+)%/);
      const finalZoom = finalZoomMatch ? parseInt(finalZoomMatch[1]) : 100;
      
      // Should have zoomed in from preserved level
      expect(finalZoom).toBeGreaterThan(targetZoom);
    }
  });

  test('should maintain selection highlighting until clicked again', async ({ page }) => {
    await page.goto('/');

    // Import file
    await page.click('.stage-button:has-text("Import")');
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);

    await page.waitForSelector('.file-info', { timeout: 10000 });
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Select a shape by clicking
    const canvas = page.locator('.viewer-container canvas');
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);

    // Verify selection UI is visible
    const hasSelectedEditor = await page.locator('.selected-shape-editor').isVisible();
    if (hasSelectedEditor) {
      // Verify delete button is enabled (indicates selection is active)
      await expect(page.locator('.btn-danger')).toBeEnabled();
      
      // Move mouse away from the selected shape and check it stays selected
      await canvas.hover({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(500);
      
      // Selection UI should still be visible
      await expect(page.locator('.selected-shape-editor')).toBeVisible();
      await expect(page.locator('.btn-danger')).toBeEnabled();
      
      // Click on the same shape again to deselect
      await canvas.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(1000);
      
      // Selection should be cleared
      await expect(page.locator('.selected-shape-editor')).not.toBeVisible();
      await expect(page.locator('.btn-danger')).toBeDisabled();
    }
  });
});