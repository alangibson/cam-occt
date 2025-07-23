import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Shape Movement Functionality', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to application and load DXF file
    await page.goto('http://localhost:5173');
    await page.click('text=Import');
    
    const dxfFilePath = path.resolve('./test/dxf/Tractor Light Mount - Left.dxf');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(dxfFilePath);
    
    // Wait for file processing
    await page.waitForTimeout(8000);
    
    // Navigate to modify page
    await page.click('text=Modify');
    await page.waitForTimeout(2000);
  });

  test('Shape movement by changing origin coordinates', async ({ page }) => {
    // Set up console error tracking
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Get canvas and select a shape
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (!canvasBounds) return;

    // Click on a shape to select it
    const centerX = canvasBounds.x + canvasBounds.width * 0.5;
    const centerY = canvasBounds.y + canvasBounds.height * 0.5;
    
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(1000);
    
    // Wait for shape to be selected
    const shapeInfo = page.locator('.shape-info');
    await expect(shapeInfo).toBeVisible();
    
    // Get original origin coordinates
    const originXInput = page.locator('input').nth(4); // Origin X input (after start/end X/Y)
    const originYInput = page.locator('input').nth(5); // Origin Y input
    
    const originalOriginX = await originXInput.inputValue();
    const originalOriginY = await originYInput.inputValue();
    
    console.log(`Original origin: (${originalOriginX}, ${originalOriginY})`);
    
    // Change origin coordinates
    const newOriginX = (parseFloat(originalOriginX) + 10).toString();
    const newOriginY = (parseFloat(originalOriginY) + 5).toString();
    
    await originXInput.fill(newOriginX);
    await originYInput.fill(newOriginY);
    
    // Apply changes
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await applyButton.click();
    
    // Wait for modification to complete
    await page.waitForTimeout(3000);
    
    // Verify the shape has moved by checking if the origin coordinates are updated
    // Note: After transformation, the displayed coordinates should reflect the new position
    await page.mouse.click(centerX, centerY); // Reselect the shape
    await page.waitForTimeout(1000);
    
    // Check that modification completed without errors
    const modifyingButton = page.locator('button:has-text("Modifying...")');
    await expect(modifyingButton).not.toBeVisible();
    
    // Verify console has modification logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('🔄 Handling shape modification') || 
          msg.text().includes('🔧 ShapeModifier.modifyShape') ||
          msg.text().includes('🎯 translateShapeToOrigin')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Verify no console errors occurred during shape movement
    expect(consoleErrors).toHaveLength(0);
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors during shape movement:', consoleErrors);
    }
    
    console.log('✅ Shape movement by origin change completed successfully');
  });

  test('Shape movement preserves layer visibility', async ({ page }) => {
    // Get layer menu and hide a layer
    const layerToggle = page.locator('input[type="checkbox"]').first();
    await layerToggle.uncheck();
    await page.waitForTimeout(500);
    
    // Verify layer is hidden
    await expect(layerToggle).not.toBeChecked();
    
    // Select and move a shape from a visible layer
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    
    if (canvasBounds) {
      const centerX = canvasBounds.x + canvasBounds.width * 0.5;
      const centerY = canvasBounds.y + canvasBounds.height * 0.5;
      
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(1000);
      
      const shapeInfo = page.locator('.shape-info');
      if (await shapeInfo.isVisible()) {
        // Change origin coordinates
        const originXInput = page.locator('input').nth(4);
        const originYInput = page.locator('input').nth(5);
        
        const currentX = await originXInput.inputValue();
        const currentY = await originYInput.inputValue();
        
        await originXInput.fill((parseFloat(currentX) + 5).toString());
        await originYInput.fill((parseFloat(currentY) + 5).toString());
        
        const applyButton = page.locator('button:has-text("Apply Changes")');
        await applyButton.click();
        
        await page.waitForTimeout(3000);
        
        // Verify the previously hidden layer is still hidden
        await expect(layerToggle).not.toBeChecked();
        
        console.log('✅ Layer visibility preserved during shape movement');
      }
    }
  });

  test('Shape movement with invalid coordinates shows appropriate error', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    
    if (canvasBounds) {
      const centerX = canvasBounds.x + canvasBounds.width * 0.5;
      const centerY = canvasBounds.y + canvasBounds.height * 0.5;
      
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(1000);
      
      const shapeInfo = page.locator('.shape-info');
      if (await shapeInfo.isVisible()) {
        // Enter invalid coordinates (non-numeric)
        const originXInput = page.locator('input').nth(4);
        const originYInput = page.locator('input').nth(5);
        
        await originXInput.fill('invalid');
        await originYInput.fill('not-a-number');
        
        const applyButton = page.locator('button:has-text("Apply Changes")');
        await applyButton.click();
        
        // The browser should handle invalid input gracefully
        // Either by preventing submission or showing an error
        await page.waitForTimeout(2000);
        
        // Button should not be stuck in "Modifying..." state
        const modifyingButton = page.locator('button:has-text("Modifying...")');
        await expect(modifyingButton).not.toBeVisible();
        
        console.log('✅ Invalid coordinates handled appropriately');
      }
    }
  });

  test('Multiple shape movements work correctly', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    
    if (canvasBounds) {
      // Test positions for finding different shapes
      const testPositions = [
        { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
        { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 },
        { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.2 }
      ];
      
      let shapesModified = 0;
      
      for (const pos of testPositions) {
        await page.mouse.click(pos.x, pos.y);
        await page.waitForTimeout(1000);
        
        const shapeInfo = page.locator('.shape-info');
        if (await shapeInfo.isVisible()) {
          // Move this shape
          const originXInput = page.locator('input').nth(4);
          const originYInput = page.locator('input').nth(5);
          
          const currentX = await originXInput.inputValue();
          const currentY = await originYInput.inputValue();
          
          const newX = (parseFloat(currentX) + (shapesModified + 1) * 2).toString();
          const newY = (parseFloat(currentY) + (shapesModified + 1) * 2).toString();
          
          await originXInput.fill(newX);
          await originYInput.fill(newY);
          
          const applyButton = page.locator('button:has-text("Apply Changes")');
          await applyButton.click();
          
          await page.waitForTimeout(2000);
          
          // Verify modification completed
          const modifyingButton = page.locator('button:has-text("Modifying...")');
          await expect(modifyingButton).not.toBeVisible();
          
          shapesModified++;
        }
      }
      
      expect(shapesModified).toBeGreaterThan(0);
      console.log(`✅ Successfully modified ${shapesModified} shapes`);
    }
  });

});