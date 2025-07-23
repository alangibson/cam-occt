import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Drawing Dimensions Display', () => {
  test('should display drawing dimensions in footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Load a DXF file
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'ADLER.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    // Wait for modify page to load
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000); // Allow geometry to load
    
    // Check that dimensions are displayed in footer
    const dimensionsDisplay = page.locator('.dimensions-display');
    await expect(dimensionsDisplay).toBeVisible();
    
    const dimensionsText = await dimensionsDisplay.textContent();
    console.log('Dimensions display:', dimensionsText);
    
    // Should show "Drawing: X.XX × Y.YY units" format
    expect(dimensionsText).toMatch(/Drawing: \d+\.\d+ × \d+\.\d+ (mm|inches)/);
    
    // Should start with mm units (ADLER.dxf has no defined units, defaults to mm)
    expect(dimensionsText).toContain('mm');
  });

  test('should reinterpret dimensions when units change', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Load ADLER.dxf (allows units change)
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'ADLER.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const dimensionsDisplay = page.locator('.dimensions-display');
    const unitsSelect = page.locator('select');
    
    // Get initial dimensions (should be in mm)
    await expect(dimensionsDisplay).toBeVisible();
    const initialDimensions = await dimensionsDisplay.textContent();
    console.log('Initial dimensions:', initialDimensions);
    expect(initialDimensions).toContain('mm');
    
    // Extract the numeric values
    const mmMatch = initialDimensions?.match(/Drawing: (\d+\.\d+) × (\d+\.\d+) mm/);
    const mmWidth = mmMatch ? parseFloat(mmMatch[1]) : 0;
    const mmHeight = mmMatch ? parseFloat(mmMatch[2]) : 0;
    
    // Check if we can change units (ADLER.dxf should allow this)
    const isDisabled = await unitsSelect.isDisabled();
    if (!isDisabled) {
      // Change to inches
      await unitsSelect.selectOption('inches');
      await page.waitForTimeout(1000);
      
      const updatedDimensions = await dimensionsDisplay.textContent();
      console.log('Updated dimensions:', updatedDimensions);
      expect(updatedDimensions).toContain('inches');
      
      // Extract inch values
      const inchMatch = updatedDimensions?.match(/Drawing: (\d+\.\d+) × (\d+\.\d+) inches/);
      const inchWidth = inchMatch ? parseFloat(inchMatch[1]) : 0;
      const inchHeight = inchMatch ? parseFloat(inchMatch[2]) : 0;
      
      // Verify unit reinterpretation (not conversion)
      // The numeric values should stay the same, only the unit label changes
      expect(inchWidth).toEqual(mmWidth);
      expect(inchHeight).toEqual(mmHeight);
      
      console.log(`Unit reinterpretation: ${mmWidth}mm → ${inchWidth}inches, ${mmHeight}mm → ${inchHeight}inches`);
    } else {
      console.log('Units are locked for this file - skipping conversion test');
    }
  });

  test('should display both zoom and dimensions in footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'ADLER.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Both zoom and dimensions should be visible
    const zoomDisplay = page.locator('.zoom-display');
    const dimensionsDisplay = page.locator('.dimensions-display');
    
    await expect(zoomDisplay).toBeVisible();
    await expect(dimensionsDisplay).toBeVisible();
    
    const zoomText = await zoomDisplay.textContent();
    const dimensionsText = await dimensionsDisplay.textContent();
    
    console.log('Footer - Zoom:', zoomText);
    console.log('Footer - Dimensions:', dimensionsText);
    
    expect(zoomText).toContain('%');
    expect(dimensionsText).toMatch(/Drawing: \d+\.\d+ × \d+\.\d+ (mm|inches)/);
  });

  test('should calculate dimensions from bounding box when no explicit dimensions in DXF', async ({ page }) => {
    // This test verifies that we're using bounding box calculation
    // since our DXF files don't have explicit dimension entities
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = join(process.cwd(), 'test', 'dxf', 'Blocktest.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    const modifyHeading = page.locator('h2:has-text("Modify Drawing")');
    await expect(modifyHeading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const dimensionsDisplay = page.locator('.dimensions-display');
    await expect(dimensionsDisplay).toBeVisible();
    
    const dimensionsText = await dimensionsDisplay.textContent();
    console.log('Blocktest.dxf dimensions:', dimensionsText);
    
    // Should show meaningful dimensions (not 0.00 × 0.00)
    expect(dimensionsText).not.toContain('0.00 × 0.00');
    
    // Should have proper format
    expect(dimensionsText).toMatch(/Drawing: \d+\.\d+ × \d+\.\d+ (mm|inches)/);
    
    // Extract numeric values to ensure they're reasonable
    const match = dimensionsText?.match(/Drawing: (\d+\.\d+) × (\d+\.\d+)/);
    const width = match ? parseFloat(match[1]) : 0;
    const height = match ? parseFloat(match[2]) : 0;
    
    // Dimensions should be positive and reasonable
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeLessThan(10000); // Sanity check
    expect(height).toBeLessThan(10000); // Sanity check
  });
});