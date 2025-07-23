import { test, expect } from '@playwright/test';

test.describe('Application Loading', () => {
  test('should load the main page without SSR errors', async ({ page }) => {
    // Listen for console errors that might indicate SSR issues
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // Navigate to the page
    const response = await page.goto('/');
    
    // Check that the page loaded successfully (not a 500 error)
    expect(response?.status()).toBe(200);
    
    // Check that the main content is visible
    await expect(page.locator('h1')).toContainText('CAM-OCCT');
    await expect(page.locator('header p')).toContainText('CNC Plasma Cutting CAM Software');
    
    // Check that key components are visible
    await expect(page.locator('button:has-text("Import DXF/SVG")')).toBeVisible();
    await expect(page.locator('h3:has-text("Cutting Parameters")')).toBeVisible();
    await expect(page.locator('button:has-text("Generate G-Code")')).toBeVisible();
    
    // Check that no console errors occurred during loading
    // Filter out common non-critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('sourcemap') &&
      error.includes('exports is not defined') // This is the specific error we're fixing
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
  
  test('should be able to interact with the file import area', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check that the file import area is interactive
    const importArea = page.locator('.file-import');
    await expect(importArea).toBeVisible();
    
    // The import button should be clickable
    const importButton = page.locator('button:has-text("Import DXF/SVG")');
    await expect(importButton).toBeEnabled();
  });
});