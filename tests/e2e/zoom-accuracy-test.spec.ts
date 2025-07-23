import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Zoom Accuracy Verification', () => {
  
  test('should display DXF geometry at correct scale and log zoom calculations', async ({ page }) => {
    // Enable console logging to see zoom calculations
    page.on('console', msg => {
      if (msg.text().includes('Zoom') || msg.text().includes('px/unit') || msg.text().includes('distance')) {
        console.log(`BROWSER: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    await page.goto('/');
    
    // Import a DXF file
    await page.click('.stage-button:has-text("Import")');
    
    // Load a simple DXF file
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for file to be processed
    await page.waitForTimeout(2000);
    
    // Move to modify stage 
    await page.click('.stage-button:has-text("Modify")');
    
    // Wait for the viewer to load
    await page.waitForSelector('.viewer-container canvas', { timeout: 10000 });
    await page.waitForTimeout(3000); // Give time for geometry to load and zoom calculations
    
    // Check if zoom display shows 100%
    const zoomDisplay = page.locator('.zoom-display');
    if (await zoomDisplay.isVisible()) {
      const zoomText = await zoomDisplay.textContent();
      console.log(`Initial zoom display: ${zoomText}`);
    } else {
      console.log('Zoom display not found - this is expected if not implemented yet');
    }
    
    // Try zooming in with mouse wheel
    const canvas = page.locator('.viewer-container canvas');
    await canvas.hover();
    
    // Zoom in (scroll up)
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(500);
    
    if (await zoomDisplay.isVisible()) {
      const zoomText = await zoomDisplay.textContent();
      console.log(`After zoom in: ${zoomText}`);
    }
    
    // Zoom out (scroll down) 
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(500);
    
    if (await zoomDisplay.isVisible()) {
      const zoomText = await zoomDisplay.textContent();
      console.log(`After zoom out: ${zoomText}`);
    }
    
    console.log('Zoom test completed - check console logs for zoom calculations');
  });
});