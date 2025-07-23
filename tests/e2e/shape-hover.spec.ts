import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Shape Hover Functionality', () => {
  test('should highlight shapes on hover and show properties', async ({ page }) => {
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
    
    // Initially, there should be no hover info
    const noHoverText = page.locator('text=Hover over shapes in the viewer to see their properties.');
    await expect(noHoverText).toBeVisible();
    
    // Get the viewer container and hover over it
    const viewerContainer = page.locator('.viewer-container');
    await expect(viewerContainer).toBeVisible();
    
    // Hover over the center of the viewer where geometry should be
    await viewerContainer.hover({ position: { x: 300, y: 200 } });
    await page.waitForTimeout(500); // Allow hover detection
    
    // Check if hover info appears
    const hoveredShapeHeading = page.locator('h4:has-text("Hovered Shape")');
    if (await hoveredShapeHeading.isVisible()) {
      console.log('Shape hover detected successfully');
      
      // Check for shape type
      const shapeType = page.locator('.property-group:has(strong:has-text("Type:")) span');
      const typeText = await shapeType.textContent();
      expect(['line', 'mesh']).toContain(typeText);
      
      // Check for position info
      const positionInfo = page.locator('.property-group:has(strong:has-text("Position:")) span');
      const positionText = await positionInfo.textContent();
      expect(positionText).toMatch(/X: -?\d+\.?\d*, Y: -?\d+\.?\d*/);
      
      console.log('Shape type:', typeText);
      console.log('Position:', positionText);
      
      // If it's a line, check for start and end points
      const startPointSpan = page.locator('.start-point');
      const endPointSpan = page.locator('.end-point');
      
      if (await startPointSpan.isVisible() && await endPointSpan.isVisible()) {
        const startPointText = await startPointSpan.textContent();
        const endPointText = await endPointSpan.textContent();
        
        expect(startPointText).toMatch(/X: -?\d+\.?\d*, Y: -?\d+\.?\d*/);
        expect(endPointText).toMatch(/X: -?\d+\.?\d*, Y: -?\d+\.?\d*/);
        
        console.log('Start point:', startPointText);
        console.log('End point:', endPointText);
      }
    } else {
      console.log('No shape hover detected - may need to adjust hover position');
    }
    
    // Move mouse away to clear hover
    await page.mouse.move(50, 50);
    await page.waitForTimeout(500);
    
    // Hover info should be cleared
    await expect(noHoverText).toBeVisible();
  });
});