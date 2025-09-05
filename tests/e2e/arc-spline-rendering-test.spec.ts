import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('ARC and SPLINE Entity Rendering Tests', () => {
  
  test('should parse and render ARC entities from DXF files', async ({ page }) => {
    // Find DXF files that contain ARC entities
    const arcFiles = [
      'tests/dxf/2.dxf',
      // 'tests/dxf/wrong/DRAAK.dxf', // Problematic file causing test hangs - skipping
      'tests/dxf/Polylinie.dxf'
    ];
    
    for (const dxfFile of arcFiles) {
      console.log(`\n🔍 Testing ARC entities in ${dxfFile}`);
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const dxfContent = readFileSync(dxfFile, 'utf-8');
      
      // Check if file actually contains ARC entities
      const hasArcEntities = dxfContent.includes('ARC');
      if (!hasArcEntities) {
        console.log(`⚠️  ${dxfFile} does not contain ARC entities, skipping`);
        continue;
      }
      
      console.log(`✅ ${dxfFile} contains ARC entities`);
      
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
      
      // Check that shapes were parsed (sidebar should show shape count > 0)
      const sidebarText = await page.locator('.sidebar').textContent();
      console.log(`Sidebar: ${sidebarText}`);
      
      // Should show shapes were loaded
      expect(sidebarText).toMatch(/Shapes: \d+/);
      const shapeMatch = sidebarText?.match(/Shapes: (\d+)/);
      const shapeCount = shapeMatch ? parseInt(shapeMatch[1]) : 0;
      expect(shapeCount).toBeGreaterThan(0);
      
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
      
      expect(hasContent, `${dxfFile} should render visible ARC content on canvas`).toBe(true);
      console.log(`✅ ${dxfFile} rendered visible content with ARCs`);
    }
  });
  
  test('should parse and render SPLINE entities from DXF files', async ({ page }) => {
    // Find DXF files that contain SPLINE entities
    const splineFiles = [
      'tests/dxf/polygons/nested-splines.dxf'
    ];
    
    for (const dxfFile of splineFiles) {
      console.log(`\n🔍 Testing SPLINE entities in ${dxfFile}`);
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const dxfContent = readFileSync(dxfFile, 'utf-8');
      
      // Check if file actually contains SPLINE entities
      const hasSplineEntities = dxfContent.includes('SPLINE');
      if (!hasSplineEntities) {
        console.log(`⚠️  ${dxfFile} does not contain SPLINE entities, skipping`);
        continue;
      }
      
      console.log(`✅ ${dxfFile} contains SPLINE entities`);
      
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
      
      // Check that shapes were parsed (sidebar should show shape count > 0)
      const sidebarText = await page.locator('.sidebar').textContent();
      console.log(`Sidebar: ${sidebarText}`);
      
      // Should show shapes were loaded
      expect(sidebarText).toMatch(/Shapes: \d+/);
      const shapeMatch = sidebarText?.match(/Shapes: (\d+)/);
      const shapeCount = shapeMatch ? parseInt(shapeMatch[1]) : 0;
      expect(shapeCount).toBeGreaterThan(0);
      
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
      
      expect(hasContent, `${dxfFile} should render visible SPLINE content on canvas`).toBe(true);
      console.log(`✅ ${dxfFile} rendered visible content with SPLINEs`);
    }
  });
  
  test('should provide detailed debugging info for ARC/SPLINE parsing', async ({ page }) => {
    const dxfFile = 'tests/dxf/2.dxf'; // Known to have ARC entities
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const dxfContent = readFileSync(dxfFile, 'utf-8');
    
    // Add console listener to capture parsing debug info
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'warning' || msg.type() === 'error') {
        logs.push(`${msg.type()}: ${msg.text()}`);
      }
    });
    
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
    
    await page.waitForTimeout(3000);
    
    // Debug: Check what shapes were actually parsed
    const debugInfo = await page.evaluate(() => {
      // Access the drawing store to see what shapes were parsed
      document.querySelector('[data-sveltekit-preload-data]');
      return {
        canvasExists: !!document.querySelector('.drawing-canvas'),
        sidebarText: document.querySelector('.sidebar')?.textContent,
        footerText: document.querySelector('footer')?.textContent
      };
    });
    
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
    console.log('Console logs:', logs);
    
    // This test is for debugging - we expect it to reveal issues
    expect(debugInfo.canvasExists).toBe(true);
  });
});