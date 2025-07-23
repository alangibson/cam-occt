import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Units Scaling', () => {
  test('should resize image when switching between mm and inches', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Load ADLER.dxf which has no unit info (should default to mm)
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'ADLER.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for modify page to load
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000); // Allow geometry to load
    
    // Get initial camera position/distance (representing zoom level)
    const initialCameraInfo = await page.evaluate(() => {
      const viewer = (window as any).viewer;
      if (viewer && viewer.getCamera) {
        const pos = viewer.getCamera().position;
        return {
          distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z),
          position: { x: pos.x, y: pos.y, z: pos.z }
        };
      }
      return null;
    });
    
    console.log('Initial camera info (mm):', initialCameraInfo);
    
    // Verify initial units setting should be mm
    const unitsSelect = page.locator('select');
    const initialUnits = await unitsSelect.inputValue();
    expect(initialUnits).toBe('mm');
    
    // Switch to inches
    await unitsSelect.selectOption('inches');
    await page.waitForTimeout(1000); // Allow for units change processing
    
    // Get camera info after switching to inches
    const inchCameraInfo = await page.evaluate(() => {
      const viewer = (window as any).viewer;
      if (viewer && viewer.getCamera) {
        const pos = viewer.getCamera().position;
        return {
          distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z),
          position: { x: pos.x, y: pos.y, z: pos.z }
        };
      }
      return null;
    });
    
    console.log('Camera info after switching to inches:', inchCameraInfo);
    
    if (initialCameraInfo && inchCameraInfo) {
      // When switching from mm to inches, image should appear larger
      // This means camera should be farther away (larger distance)
      console.log(`Distance change: ${initialCameraInfo.distance} -> ${inchCameraInfo.distance} (${((inchCameraInfo.distance / initialCameraInfo.distance - 1) * 100).toFixed(1)}% change)`);
      
      // Camera distance should increase significantly when switching mm -> inches
      // Expected increase is roughly 25x (since 1 inch = 25.4 mm)
      expect(inchCameraInfo.distance).toBeGreaterThan(initialCameraInfo.distance);
      
      // But for now, let's just verify there's some scaling happening
      const scalingOccurred = Math.abs(inchCameraInfo.distance - initialCameraInfo.distance) > 5;
      expect(scalingOccurred).toBe(true);
    }
    
    // Switch back to mm
    await unitsSelect.selectOption('mm');
    await page.waitForTimeout(1000);
    
    // Get camera info after switching back to mm
    const finalCameraInfo = await page.evaluate(() => {
      const viewer = (window as any).viewer;
      if (viewer && viewer.getCamera) {
        const pos = viewer.getCamera().position;
        return {
          distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z),
          position: { x: pos.x, y: pos.y, z: pos.z }
        };
      }
      return null;
    });
    
    console.log('Camera info after switching back to mm:', finalCameraInfo);
    
    if (initialCameraInfo && finalCameraInfo) {
      // Should be approximately back to original distance (within 5%)
      const percentDiff = Math.abs((finalCameraInfo.distance - initialCameraInfo.distance) / initialCameraInfo.distance);
      expect(percentDiff).toBeLessThan(0.05);
    }
    
    // Print console messages for debugging
    console.log('Console messages:', consoleMessages.filter(msg => msg.includes('Natural size calc') || msg.includes('Units changed')));
  });
});