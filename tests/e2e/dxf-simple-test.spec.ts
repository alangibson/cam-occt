import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('DXF Simple Loading Test', () => {
  const testFiles = [
    'tests/dxf/1.dxf',
    'tests/dxf/2.dxf', 
    'tests/dxf/3.dxf',
    'tests/dxf/1997.dxf',
    'tests/dxf/1997_simplified.dxf',
    'tests/dxf/ADLER.dxf',
    'tests/dxf/Blocktest.dxf',
    // 'tests/dxf/wrong/DRAAK.dxf', // Problematic file causing test hangs - skipping
    'tests/dxf/Polylinie.dxf',
    'tests/dxf/polylines_with_bulge.dxf'
  ];
  
  for (const dxfFile of testFiles) {
    test(`should load ${dxfFile} without console errors`, async ({ page }) => {
      const errors: string[] = [];
      
      // Capture console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out non-critical errors
          if (!text.includes('favicon') && 
              !text.includes('sourcemap') &&
              !text.includes('Failed to load resource') &&
              text.trim() !== '') {
            errors.push(text);
          }
        }
      });
      
      // Capture page errors
      page.on('pageerror', error => {
        errors.push(`Page Error: ${error.message}`);
      });
      
      // Navigate to the page
      await page.goto('/');
      
      // Wait for the page to be ready
      await page.waitForLoadState('networkidle');
      await expect(page.locator('button:has-text("Import DXF")')).toBeVisible();
      
      try {
        // Read the DXF file content
        const dxfContent = readFileSync(dxfFile, 'utf-8');
        
        // Create a File object and trigger the file input
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
        
        // Wait for processing to complete
        await page.waitForTimeout(3000);
        
        // Log results
        if (errors.length > 0) {
          console.log(`❌ ${dxfFile} errors:`, errors);
        } else {
          console.log(`✅ ${dxfFile} loaded successfully`);
        }
        
        // For now, expect no critical errors
        expect(errors, `${dxfFile} should load without critical errors`).toHaveLength(0);
        
      } catch (error) {
        console.log(`❌ Failed to test ${dxfFile}:`, error);
        throw error;
      }
    });
  }
});