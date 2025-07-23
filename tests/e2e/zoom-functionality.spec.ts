import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Zoom and Layout Functionality', () => {
  test('should handle mouse wheel zoom without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate and load DXF file
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for modify page and processing
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Test mouse wheel zoom functionality
    const viewerContainer = page.locator('.viewer-container');
    await expect(viewerContainer).toBeVisible();
    
    // Simulate wheel events for zooming
    await viewerContainer.hover();
    
    // Zoom in (wheel down)
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
    
    // Zoom out (wheel up)
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(100);
    
    // Multiple zoom operations
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -50);
      await page.waitForTimeout(50);
    }
    
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 50);
      await page.waitForTimeout(50);
    }
    
    // Check that zoom operations didn't cause console errors
    expect(consoleErrors, 'Zoom operations should not cause console errors').toEqual([]);
  });

  test('should handle layout changes when viewport height changes', async ({ page }) => {
    // Set initial viewport size
    await page.setViewportSize({ width: 1200, height: 800 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for modify page
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Get initial viewer container dimensions
    const viewerContainer = page.locator('.viewer-container');
    const initialBox = await viewerContainer.boundingBox();
    expect(initialBox).not.toBeNull();
    
    // Simulate developer console opening by reducing viewport height
    await page.setViewportSize({ width: 1200, height: 400 });
    await page.waitForTimeout(500);
    
    // Check that viewer container still exists and has reasonable dimensions
    const newBox = await viewerContainer.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.height).toBeGreaterThan(100); // Should still have reasonable height
    
    // Restore viewport size
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    // Verify layout recovers (allow for some tolerance in height comparison)
    const restoredBox = await viewerContainer.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(restoredBox!.height).toBeGreaterThanOrEqual(newBox!.height);
  });

  test('should maintain viewer functionality during dynamic resize', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    const viewerContainer = page.locator('.viewer-container');
    
    // Perform multiple resize operations
    const sizes = [
      { width: 1200, height: 800 },
      { width: 800, height: 600 },
      { width: 1400, height: 900 },
      { width: 1000, height: 400 }, // Simulate console opening
      { width: 1200, height: 800 }  // Back to normal
    ];
    
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      
      // Verify viewer is still visible and functional
      await expect(viewerContainer).toBeVisible();
      
      // Test zoom still works after resize
      await viewerContainer.hover();
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(100);
    }
    
    // Should have no console errors from resize operations
    expect(consoleErrors, 'Resize operations should not cause errors').toEqual([]);
  });
});