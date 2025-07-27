import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Drawing Drift Issue - Simple Test', () => {
  test('canvas should not grow in height continuously', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`Browser console: ${msg.text()}`);
      }
    });
    
    // Navigate to the app
    await page.goto('/');
    
    // Load a DXF file
    const testFile = path.join(__dirname, '../dxf/1.dxf');
    await page.setInputFiles('input[type="file"]', testFile);
    
    // Wait a bit for file to load
    await page.waitForTimeout(2000);
    
    // Navigate to edit stage if not already there
    const editButton = page.locator('text=Edit');
    if (await editButton.isVisible()) {
      await editButton.click();
    }
    
    // Wait for canvas to be visible
    const canvas = page.locator('canvas.drawing-canvas');
    await expect(canvas).toBeVisible();
    
    // Get initial canvas height
    const initialHeight = await canvas.evaluate(el => el.getBoundingClientRect().height);
    console.log('Initial canvas height:', initialHeight);
    
    // Wait 3 seconds
    await page.waitForTimeout(3000);
    
    // Get canvas height after waiting
    const afterHeight = await canvas.evaluate(el => el.getBoundingClientRect().height);
    console.log('Canvas height after 3s:', afterHeight);
    
    // Canvas height should not have grown
    expect(afterHeight).toBe(initialHeight);
    
    // Also check the internal canvas height attribute
    const initialCanvasHeight = await canvas.evaluate(el => (el as HTMLCanvasElement).height);
    await page.waitForTimeout(2000);
    const afterCanvasHeight = await canvas.evaluate(el => (el as HTMLCanvasElement).height);
    
    console.log('Initial canvas.height:', initialCanvasHeight);
    console.log('After canvas.height:', afterCanvasHeight);
    
    expect(afterCanvasHeight).toBe(initialCanvasHeight);
  });
});