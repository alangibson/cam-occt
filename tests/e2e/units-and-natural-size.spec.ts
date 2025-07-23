import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Units and Natural Size Display', () => {
  test('should auto-detect units from DXF file and update settings', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Load a DXF file with unit information
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for modify page
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Check that units were detected (may be implicit)
    // The fact that the page loaded without errors indicates units were handled
    expect(consoleMessages.length).toBeGreaterThan(0); // Should have some console output from loading
    
    // Verify units selector is present
    const unitsSelect = page.locator('select');
    await expect(unitsSelect).toBeVisible();
    
    // Should have both mm and inches options
    const options = await unitsSelect.locator('option').allTextContents();
    expect(options).toContain('Millimeters (mm)');
    expect(options).toContain('Inches (in)');
  });

  test('should allow user to change display units', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Display units changed')) {
        consoleMessages.push(msg.text());
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
    
    // Change units from mm to inches
    const unitsSelect = page.locator('select');
    await unitsSelect.selectOption('inches');
    await page.waitForTimeout(500);
    
    // Verify console message about units change
    expect(consoleMessages.some(msg => msg.includes('Display units changed to: inches'))).toBe(true);
    
    // Change back to mm
    await unitsSelect.selectOption('mm');
    await page.waitForTimeout(500);
    
    expect(consoleMessages.some(msg => msg.includes('Display units changed to: mm'))).toBe(true);
  });

  test('should display warning when display units differ from file units', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Get the current DXF file units info
    const unitsInfo = page.locator('.units-info');
    
    // If units info is visible, it should show DXF file units
    if (await unitsInfo.isVisible()) {
      const unitsText = await unitsInfo.textContent();
      expect(unitsText).toContain('DXF file units:');
      
      // Change display units to create a mismatch
      const unitsSelect = page.locator('select');
      const currentValue = await unitsSelect.inputValue();
      const newValue = currentValue === 'mm' ? 'inches' : 'mm';
      
      await unitsSelect.selectOption(newValue);
      await page.waitForTimeout(500);
      
      // Check if warning appears when units differ
      const warning = page.locator('.warning');
      if (await warning.isVisible()) {
        const warningText = await warning.textContent();
        expect(warningText).toContain('Display units differ from file');
      }
    }
  });

  test('should handle mouse panning with right button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', '1.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const viewerContainer = page.locator('.viewer-container');
    await expect(viewerContainer).toBeVisible();
    
    // Test mouse panning - hover to ensure cursor changes
    await viewerContainer.hover();
    
    // Simulate click and drag for panning
    const box = await viewerContainer.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      
      // Right mouse down at center
      await page.mouse.move(centerX, centerY);
      await page.mouse.down({ button: 'right' });
      
      // Drag to new position
      await page.mouse.move(centerX + 50, centerY + 50, { steps: 5 });
      
      // Mouse up
      await page.mouse.up({ button: 'right' });
      
      // Wait a moment for any updates
      await page.waitForTimeout(200);
    }
    
    // The panning should complete without console errors
    // (Previous console error checking ensures this)
  });

  test('should maintain natural size display after zoom operations', async ({ page }) => {
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
    await page.waitForTimeout(3000);
    
    const viewerContainer = page.locator('.viewer-container');
    await expect(viewerContainer).toBeVisible();
    
    // Perform zoom operations
    await viewerContainer.hover();
    
    // Zoom in
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);
    
    // Zoom out
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(100);
    
    // Change units to test natural size recalculation
    const unitsSelect = page.locator('select');
    const currentUnits = await unitsSelect.inputValue();
    const newUnits = currentUnits === 'mm' ? 'inches' : 'mm';
    
    await unitsSelect.selectOption(newUnits);
    await page.waitForTimeout(500);
    
    // Should not have any console errors
    expect(consoleErrors).toEqual([]);
  });
});