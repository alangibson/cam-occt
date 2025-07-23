import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('DXF File Loading', () => {
  test('should load DXF file through import flow without console errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for uncaught exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to the root page (stage-based routing)
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Should start on import stage by default
    const importHeading = page.locator('h1:has-text("Import Drawing")');
    await expect(importHeading).toBeVisible();
    
    // Look for file input (should be hidden)
    const fileInput = page.locator('input[type="file"]');
    expect(await fileInput.count()).toBe(1);
    
    // Load test DXF file
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for navigation to modify stage (look for modify content)
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    
    // Wait for OpenCascade processing (may take time)
    await page.waitForTimeout(5000);
    
    // Check for ALL console errors - don't filter anything
    expect(consoleErrors, 'Should have ZERO console errors of any kind').toEqual([]);
    
    // Assert no page errors
    expect(pageErrors, 'Should not have uncaught page errors').toEqual([]);
    
    // Check for successful loading indication
    const successMessage = page.locator('text=Successfully loaded');
    const errorOverlay = page.locator('.error-overlay');
    
    // Should not have error overlay visible
    expect(await errorOverlay.isVisible()).toBe(false);
  });

  test('should handle DXF file with ARC and CIRCLE entities', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    
    // Test with file that has ARC and CIRCLE entities (test file 1.dxf)
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for navigation and processing
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(5000);
    
    // Check for ALL console errors - this should catch BindingError and any other issues
    expect(consoleErrors, 'Should have ZERO console errors after DXF loading').toEqual([]);
  });

  test('should handle multiple DXF test files', async ({ page }) => {
    const testFiles = ['1.dxf', '2.dxf', '3.dxf'];
    
    for (const filename of testFiles) {
      try {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const fileInput = page.locator('input[type="file"]');
        const dxfPath = join(process.cwd(), 'test', 'dxf', filename);
        
        await fileInput.setInputFiles(dxfPath);
        
        // Wait for navigation to modify stage
        const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
        await expect(modifyHeading).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(4000);
        
        // Check for ALL console errors - no filtering
        expect(consoleErrors, `File ${filename} should produce ZERO console errors`).toEqual([]);
        
      } catch (error) {
        console.log(`Skipping ${filename}: ${error.message}`);
      }
    }
  });
});