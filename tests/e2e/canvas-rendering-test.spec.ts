import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('Canvas Rendering Test', () => {
  test('should actually render DXF content on canvas immediately after loading', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
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
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Debug: Check if drawing data is loaded
    const drawingData = await page.evaluate(() => {
      // Check if we can access the drawing store
      const canvasElement = document.querySelector('.drawing-canvas');
      return {
        canvasExists: !!canvasElement,
        canvasWidth: canvasElement ? (canvasElement as HTMLCanvasElement).width : 0,
        canvasHeight: canvasElement ? (canvasElement as HTMLCanvasElement).height : 0
      };
    });
    
    console.log('Drawing data:', drawingData);
    
    // Check if canvas has actual rendering
    const renderingInfo = await page.evaluate(() => {
      const canvas = document.querySelector('.drawing-canvas') as HTMLCanvasElement;
      if (!canvas) return { error: 'Canvas not found' };
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'Context not found' };
      
      // Check canvas dimensions
      console.log('Canvas size:', canvas.width, 'x', canvas.height);
      
      // Sample some pixels to see if anything is drawn
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      
      const samplePixels = [];
      for (let x = centerX - 50; x <= centerX + 50; x += 10) {
        for (let y = centerY - 50; y <= centerY + 50; y += 10) {
          if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            samplePixels.push({
              x, y,
              r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3]
            });
          }
        }
      }
      
      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        samplePixels,
        hasNonWhitePixels: samplePixels.some(p => p.a > 0 && (p.r < 255 || p.g < 255 || p.b < 255))
      };
    });
    
    console.log('Rendering info:', renderingInfo);
    
    // This test should fail if canvas is not rendering
    expect(renderingInfo.hasNonWhitePixels, 'Canvas should have visible content after DXF load').toBe(true);
  });
});