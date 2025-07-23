import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('Drawing Size Bug Tests', () => {
  test('should never show Infinity x Infinity in footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Initially should show "No drawing loaded"
    await expect(page.locator('footer .no-drawing')).toBeVisible();
    
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
    
    // Get the footer text and check for Infinity values
    const footerText = await page.locator('footer').textContent();
    console.log('Footer text:', footerText);
    
    // Should not contain "Infinity" anywhere in the footer
    expect(footerText).not.toContain('Infinity');
    expect(footerText).not.toContain('NaN');
    
    // Should show proper size format like "Size: X.XX mm × Y.YY mm"
    expect(footerText).toMatch(/Size: \d+\.\d+ mm × \d+\.\d+ mm/);
    
    // The size values should be reasonable (not 0, not huge)
    const sizeMatch = footerText?.match(/Size: (\d+\.\d+) mm × (\d+\.\d+) mm/);
    if (sizeMatch) {
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      
      // Check that dimensions are reasonable positive numbers
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(width).toBeLessThan(10000); // Reasonable upper bound
      expect(height).toBeLessThan(10000); // Reasonable upper bound
      
      console.log(`✅ Drawing size: ${width} × ${height} mm`);
    } else {
      throw new Error(`Invalid footer format: ${footerText}`);
    }
  });
  
  test('should handle multiple DXF files without Infinity', async ({ page }) => {
    const testFiles = ['tests/dxf/1.dxf', 'tests/dxf/3.dxf', 'tests/dxf/ADLER.dxf'];
    
    for (const dxfFile of testFiles) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const dxfContent = readFileSync(dxfFile, 'utf-8');
      
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
      
      const footerText = await page.locator('footer').textContent();
      console.log(`${dxfFile} footer:`, footerText);
      
      // No Infinity or NaN values
      expect(footerText).not.toContain('Infinity');
      expect(footerText).not.toContain('NaN');
      
      // Should show valid size format
      expect(footerText).toMatch(/Size: \d+\.\d+ mm × \d+\.\d+ mm/);
    }
  });
});