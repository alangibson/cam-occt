import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('Canvas Visual Test', () => {
  test('should render DXF content visually on canvas', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot (empty state)
    await expect(page.locator('.drawing-canvas')).toBeVisible();
    await expect(page.locator('.drawing-canvas')).toHaveScreenshot('empty-canvas.png');
    
    // Load a simple DXF file
    const dxfContent = readFileSync('tests/dxf/1.dxf', 'utf-8');
    
    await page.evaluate(async (content) => {
      const file = new File([content], 'test.dxf', { type: 'application/dxf' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, dxfContent);
    
    // Wait for processing and rendering
    await page.waitForTimeout(3000);
    
    // Take screenshot after loading
    await expect(page.locator('.drawing-canvas')).toHaveScreenshot('canvas-with-dxf.png');
    
    // Check if canvas actually has content by examining pixel data
    const hasContent = await page.evaluate(() => {
      const canvas = document.querySelector('.drawing-canvas') as HTMLCanvasElement;
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      // Get the actual canvas dimensions
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let pixelCount = 0;
      let nonWhitePixels = 0;
      
      // Check for any non-white/non-transparent pixels
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        pixelCount++;
        
        // Count pixels that are not white or transparent
        if (a > 0 && (r < 255 || g < 255 || b < 255)) {
          nonWhitePixels++;
        }
      }
      
      console.log(`Canvas analysis: ${nonWhitePixels} non-white pixels out of ${pixelCount} total pixels`);
      return nonWhitePixels > 0;
    });
    
    console.log('Canvas has content:', hasContent);
    expect(hasContent, 'Canvas should have visible content after loading DXF').toBe(true);
  });
});