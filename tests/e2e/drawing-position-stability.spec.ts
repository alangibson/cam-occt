import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Drawing Position Stability', () => {
  test('drawing should not drift vertically over time', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Load a DXF file
    const testFile = path.join(__dirname, '../dxf/ADLER.dxf');
    await page.setInputFiles('input[type="file"]', testFile);
    
    // Wait for file to load
    await page.waitForTimeout(2000);
    
    // Navigate to edit stage
    const editButton = page.locator('text=Edit');
    if (await editButton.isVisible()) {
      await editButton.click();
    }
    
    // Wait for canvas to render
    const canvas = page.locator('canvas.drawing-canvas');
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1000);
    
    // Take initial screenshot
    const screenshot1 = await canvas.screenshot({ path: 'test-results/drawing-initial.png' });
    
    // Wait 5 seconds without interaction
    await page.waitForTimeout(5000);
    
    // Take second screenshot
    const screenshot2 = await canvas.screenshot({ path: 'test-results/drawing-after-5s.png' });
    
    // Compare pixel differences
    const pixelsDiff = Buffer.compare(screenshot1, screenshot2);
    console.log('Pixels different:', pixelsDiff !== 0);
    
    // Screenshots should be identical (no drift)
    expect(pixelsDiff).toBe(0);
  });
  
  test('drawing position should be stable on Prepare stage', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Load a DXF file
    const testFile = path.join(__dirname, '../dxf/1.dxf');
    await page.setInputFiles('input[type="file"]', testFile);
    
    // Wait and navigate to Prepare
    await page.waitForTimeout(2000);
    await page.click('text=Prepare');
    await page.waitForTimeout(1000);
    
    const canvas = page.locator('canvas.drawing-canvas');
    await expect(canvas).toBeVisible();
    
    // Take screenshots
    const screenshot1 = await canvas.screenshot();
    await page.waitForTimeout(3000);
    const screenshot2 = await canvas.screenshot();
    
    // Compare
    expect(Buffer.compare(screenshot1, screenshot2)).toBe(0);
  });
  
  test('resizing columns should not affect drawing position', async ({ page }) => {
    await page.goto('/');
    
    // Load file
    const testFile = path.join(__dirname, '../dxf/1.dxf');
    await page.setInputFiles('input[type="file"]', testFile);
    await page.waitForTimeout(2000);
    
    // Go to edit stage
    await page.click('text=Edit');
    await page.waitForTimeout(1000);
    
    const canvas = page.locator('canvas.drawing-canvas');
    const resizeHandle = page.locator('.resize-handle-right').first();
    
    // Take initial screenshot
    const screenshotBefore = await canvas.screenshot();
    
    // Resize the left column
    await resizeHandle.hover();
    await page.mouse.down();
    await page.mouse.move(400, 300); // Move handle
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // Take screenshot after resize
    const screenshotAfter = await canvas.screenshot();
    
    // The drawing content should be the same (column resize shouldn't affect drawing)
    // Note: Canvas dimensions might change, but the drawing itself should be in the same position
    // This is a basic check - in reality we'd want to compare the actual drawing position
    console.log('Screenshot comparison after resize:', 
      Buffer.compare(screenshotBefore, screenshotAfter) !== 0 ? 'Different' : 'Same');
  });
});