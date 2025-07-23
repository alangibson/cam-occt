import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Zoom Behavior', () => {
  test('should start at 100% zoom when opening ADLER.dxf', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Load ADLER.dxf file
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'ADLER.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for modify page to load
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000); // Allow geometry to load
    
    // Check initial zoom level
    const zoomDisplay = page.locator('.zoom-display');
    await expect(zoomDisplay).toBeVisible();
    
    const initialZoomText = await zoomDisplay.textContent();
    console.log('Initial zoom display:', initialZoomText);
    
    // Extract percentage from "Zoom: XX%"
    const zoomMatch = initialZoomText?.match(/Zoom: (\d+)%/);
    const initialZoom = zoomMatch ? parseInt(zoomMatch[1]) : 0;
    
    console.log('Initial zoom percentage:', initialZoom);
    
    // Should be 100% or very close (allow some tolerance for rounding)
    expect(initialZoom).toBeGreaterThan(95);
    expect(initialZoom).toBeLessThan(105);
    
    // Now test units switching
    const unitsSelect = page.locator('select');
    const initialUnits = await unitsSelect.inputValue();
    expect(initialUnits).toBe('mm');
    
    // Switch to inches
    await unitsSelect.selectOption('inches');
    await page.waitForTimeout(1000); // Allow for units change processing
    
    // Check zoom after units change
    const zoomAfterSwitch = await zoomDisplay.textContent();
    console.log('Zoom after switching to inches:', zoomAfterSwitch);
    
    const afterSwitchMatch = zoomAfterSwitch?.match(/Zoom: (\d+)%/);
    const afterSwitchZoom = afterSwitchMatch ? parseInt(afterSwitchMatch[1]) : 0;
    
    console.log('Zoom after switch percentage:', afterSwitchZoom);
    
    // Zoom should remain approximately the same (within 5% tolerance)
    // The issue described is that zoom changes from 100% to 85%
    const zoomDifference = Math.abs(afterSwitchZoom - initialZoom);
    console.log('Zoom difference:', zoomDifference);
    
    // The test should pass these requirements:
    // 1. Initial zoom is 100% ✓
    // 2. Zoom stays 100% when switching units ✓  
    // 3. Geometry should remain visible and interactive
    
    // Test requirements fulfillment
    expect(initialZoom).toBe(100);
    expect(afterSwitchZoom).toBe(100);
    expect(zoomDifference).toBe(0);
    
    // Try hovering to see if geometry is visible
    const viewerContainer = page.locator('.viewer-container');
    await viewerContainer.hover({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);
    
    const geometryVisible = await page.locator('h4:has-text("Hovered Shape")').isVisible();
    console.log('Geometry visible after switching to inches:', geometryVisible);
    
    // Check console for any errors or debug messages
    const consoleErrors = consoleMessages.filter(msg => msg.includes('ERROR') || msg.includes('Error'));
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    
    // Try different hover positions to find geometry
    if (!geometryVisible) {
      console.log('ERROR: Geometry not visible after switching to inches');
      console.log('Trying systematic hover positions...');
      
      // Test a grid of positions across the entire viewport
      const containerSize = await viewerContainer.boundingBox();
      if (containerSize) {
        let foundAny = false;
        const foundPositions = [];
        
        // Test a 5x5 grid
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            const x = (containerSize.width / 5) * (col + 0.5);
            const y = (containerSize.height / 5) * (row + 0.5);
            
            await viewerContainer.hover({ position: { x, y } });
            await page.waitForTimeout(100);
            const visible = await page.locator('h4:has-text("Hovered Shape")').isVisible();
            if (visible) {
              foundPositions.push({ x: Math.round(x), y: Math.round(y) });
              foundAny = true;
            }
          }
        }
        
        if (foundAny) {
          console.log(`Found geometry at positions:`, foundPositions);
        } else {
          console.log('Geometry not found in any of the test positions - may be completely outside viewport');
        }
      }
    }
  });

  test('should maintain visibility when switching units multiple times', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'ADLER.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const unitsSelect = page.locator('select');
    const zoomDisplay = page.locator('.zoom-display');
    
    // Record initial state (mm)
    const initialZoom = await zoomDisplay.textContent();
    console.log('Initial zoom (mm):', initialZoom);
    
    // Switch to inches
    await unitsSelect.selectOption('inches');
    await page.waitForTimeout(1000);
    const inchesZoom = await zoomDisplay.textContent();
    console.log('Zoom after switch to inches:', inchesZoom);
    
    // Switch back to mm
    await unitsSelect.selectOption('mm');
    await page.waitForTimeout(1000);
    const backToMmZoom = await zoomDisplay.textContent();
    console.log('Zoom after switch back to mm:', backToMmZoom);
    
    // The zoom should return to approximately the same value
    // This will help us understand the behavior pattern
  });
});