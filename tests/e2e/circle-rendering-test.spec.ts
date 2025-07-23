import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('CIRCLE Entity Rendering Tests', () => {
  test('should parse and render CIRCLE entities from DXF files', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Use the file that we know has a CIRCLE entity
    const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');
    
    console.log('DXF file contains CIRCLE entities:', dxfContent.includes('CIRCLE'));
    
    // Load the DXF file
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
    
    // Check that shapes were parsed including the circle
    const sidebarText = await page.locator('.sidebar').textContent();
    console.log(`Sidebar: ${sidebarText}`);
    
    // Should show 7 shapes (1 CIRCLE + 6 ARCs)
    expect(sidebarText).toMatch(/Shapes: 7/);
    
    // Check that content is actually rendered on canvas
    const hasContent = await page.evaluate(() => {
      const canvas = document.querySelector('.drawing-canvas') as HTMLCanvasElement;
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Check if canvas has any non-white pixels (indicating content)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (a > 0 && (r < 255 || g < 255 || b < 255)) {
          return true;
        }
      }
      return false;
    });
    
    expect(hasContent, 'DXF with CIRCLE should render visible content on canvas').toBe(true);
    console.log('✅ CIRCLE entities rendered successfully with visible content');
  });
  
  test('should take screenshot of CIRCLE rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const dxfContent = readFileSync('tests/dxf/2.dxf', 'utf-8');
    
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
    
    await page.waitForTimeout(3000);
    
    // Take screenshot to verify visual rendering
    const canvas = page.locator('.drawing-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveScreenshot('circle-and-arcs-rendered.png', {
      threshold: 0.3
    });
  });
});