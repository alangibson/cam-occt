import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Shape Movement Verification - Actual Position Changes', () => {

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

  test('Shape origin change actually moves the shape geometry', async ({ page }) => {
    console.log('🧪 Testing if shape actually moves when origin coordinates change...');
    
    // Set up console message capture to track shape modification process
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('🔄 Handling shape modification') || 
          text.includes('🔧 ShapeModifier.modifyShape') ||
          text.includes('🎯 translateShapeToOrigin') ||
          text.includes('Translation vector:') ||
          text.includes('Current origin:') ||
          text.includes('New origin:')) {
        console.log(`Browser: ${text}`);
      }
    });

    // Track any console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`Browser Error: ${msg.text()}`);
      }
    });

    // Get canvas and select a shape
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (!canvasBounds) return;

    // Try multiple positions to find a selectable shape
    const testPositions = [
      { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 },
      { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
      { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 },
      { x: canvasBounds.x + canvasBounds.width * 0.4, y: canvasBounds.y + canvasBounds.height * 0.6 }
    ];

    let shapeFound = false;
    let originalOriginX = '';
    let originalOriginY = '';
    
    for (const pos of testPositions) {
      console.log(`Trying to select shape at position (${pos.x}, ${pos.y})`);
      
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(1000);
      
      // Check if a shape was selected
      const shapeInfo = page.locator('.shape-info');
      if (await shapeInfo.isVisible()) {
        console.log('✅ Shape selected successfully');
        shapeFound = true;
        
        // Get the origin input fields (should be the 5th and 6th input elements)
        const originXInput = page.locator('label:has-text("X:") input').nth(2); // Origin X (after Start X/Y, End X/Y)
        const originYInput = page.locator('label:has-text("Y:") input').nth(2); // Origin Y
        
        // Store original coordinates
        originalOriginX = await originXInput.inputValue();
        originalOriginY = await originYInput.inputValue();
        
        console.log(`Original Origin: (${originalOriginX}, ${originalOriginY})`);
        
        // Verify we have valid coordinates
        expect(originalOriginX).not.toBe('');
        expect(originalOriginY).not.toBe('');
        expect(parseFloat(originalOriginX)).not.toBeNaN();
        expect(parseFloat(originalOriginY)).not.toBeNaN();
        
        break;
      }
    }
    
    expect(shapeFound).toBe(true);
    
    // Record the drawing dimensions before modification
    const drawingDimensionsText = await page.locator('text=Drawing Dimensions').textContent();
    console.log('Drawing dimensions before:', drawingDimensionsText);
    
    // Calculate new coordinates (move by 10 units in X and 5 units in Y)
    const newOriginX = (parseFloat(originalOriginX) + 10).toString();
    const newOriginY = (parseFloat(originalOriginY) + 5).toString();
    
    console.log(`New Origin Coordinates: (${newOriginX}, ${newOriginY})`);
    
    // Change the origin coordinates
    const originXInput = page.locator('label:has-text("X:") input').nth(2);
    const originYInput = page.locator('label:has-text("Y:") input').nth(2);
    
    await originXInput.clear();
    await originXInput.fill(newOriginX);
    await originYInput.clear();
    await originYInput.fill(newOriginY);
    
    console.log('Coordinates entered, clicking Apply Changes...');
    
    // Apply the changes
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await applyButton.click();
    
    // Wait for modification to complete
    console.log('Waiting for modification to complete...');
    await page.waitForTimeout(5000);
    
    // Verify the modification completed (button should not be stuck in "Modifying..." state)
    const modifyingButton = page.locator('button:has-text("Modifying...")');
    await expect(modifyingButton).not.toBeVisible();
    
    console.log('Modification process completed');
    
    // Wait a bit more for visualization to update
    await page.waitForTimeout(2000);
    
    // Re-select the shape to check if coordinates actually changed
    console.log('Re-selecting shape to verify movement...');
    
    // Click at the original position first
    const centerX = canvasBounds.x + canvasBounds.width * 0.5;
    const centerY = canvasBounds.y + canvasBounds.height * 0.5;
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(1000);
    
    // Check if shape is still selectable at original position or if we need to find it elsewhere
    let shapeStillSelected = await page.locator('.shape-info').isVisible();
    
    if (!shapeStillSelected) {
      console.log('Shape not found at original position - checking if it moved to new position...');
      
      // Try to find the shape at different positions
      for (const pos of testPositions) {
        await page.mouse.click(pos.x, pos.y);
        await page.waitForTimeout(500);
        
        if (await page.locator('.shape-info').isVisible()) {
          console.log(`Found shape at position (${pos.x}, ${pos.y})`);
          shapeStillSelected = true;
          break;
        }
      }
    }
    
    expect(shapeStillSelected).toBe(true);
    
    // Get the current origin coordinates after modification
    const currentOriginX = await page.locator('label:has-text("X:") input').nth(2).inputValue();
    const currentOriginY = await page.locator('label:has-text("Y:") input').nth(2).inputValue();
    
    console.log(`Current Origin After Modification: (${currentOriginX}, ${currentOriginY})`);
    
    // Check console logs for evidence of shape modification
    const hasModificationLogs = consoleLogs.some(log => 
      log.includes('🔄 Handling shape modification') ||
      log.includes('🔧 ShapeModifier.modifyShape') ||
      log.includes('🎯 translateShapeToOrigin')
    );
    
    console.log(`Modification logs found: ${hasModificationLogs}`);
    
    // Check for translation vector logs (evidence that translation was calculated)
    const hasTranslationLogs = consoleLogs.some(log => 
      log.includes('Translation vector:') && 
      (log.includes('dx') || log.includes('dy'))
    );
    
    console.log(`Translation vector logs found: ${hasTranslationLogs}`);
    
    // Verify no console errors occurred
    expect(consoleErrors.length).toBe(0);
    if (consoleErrors.length > 0) {
      console.error('Console errors during shape modification:', consoleErrors);
    }
    
    // The critical test: Check if the origin coordinates actually changed
    // This will CATCH THE BUG if the shape modification doesn't work properly
    console.log('\n🔍 CRITICAL VERIFICATION:');
    console.log(`Original Origin: (${originalOriginX}, ${originalOriginY})`);
    console.log(`Expected New Origin: (${newOriginX}, ${newOriginY})`);
    console.log(`Actual Current Origin: (${currentOriginX}, ${currentOriginY})`);
    
    // Check if the shape's origin actually moved
    const originXMoved = Math.abs(parseFloat(currentOriginX) - parseFloat(originalOriginX)) > 0.1;
    const originYMoved = Math.abs(parseFloat(currentOriginY) - parseFloat(originalOriginY)) > 0.1;
    
    console.log(`Origin X moved: ${originXMoved} (difference: ${Math.abs(parseFloat(currentOriginX) - parseFloat(originalOriginX))})`);
    console.log(`Origin Y moved: ${originYMoved} (difference: ${Math.abs(parseFloat(currentOriginY) - parseFloat(originalOriginY))})`);
    
    // This test will FAIL if the shape didn't actually move - THIS CATCHES THE BUG
    if (!originXMoved && !originYMoved) {
      console.log('❌ SHAPE DID NOT MOVE - Origin coordinates unchanged!');
      console.log('❌ BUG DETECTED: Shape modification is not working correctly.');
      console.log('❌ This indicates DXF metadata is not being updated after OpenCascade transformation.');
      console.log('Available console logs:', consoleLogs.slice(-10)); // Show last 10 logs
      
      // Check specifically for evidence that the fix is working
      const hasMetadataUpdate = consoleLogs.some(log => log.includes('✅ Shape transformed and metadata updated'));
      const hasUpdateDetails = consoleLogs.some(log => log.includes('Updated shape data:'));
      
      console.log(`Fix evidence - Metadata update log: ${hasMetadataUpdate ? 'Found' : 'MISSING'}`);
      console.log(`Fix evidence - Update details log: ${hasUpdateDetails ? 'Found' : 'MISSING'}`);
      
      if (!hasMetadataUpdate) {
        console.log('❌ CRITICAL: DXF metadata update logs not found - fix may not be working!');
      }
    }
    
    // Assert that at least one coordinate changed significantly
    // This assertion will FAIL and catch the bug if the fix doesn't work
    expect(originXMoved || originYMoved).toBe(true);
    
    // If the test passes, verify the coordinates moved correctly
    if (originXMoved || originYMoved) {
      console.log('✅ SHAPE MOVEMENT DETECTED - Fix is working!');
      
      // Verify the coordinates moved in the expected direction and amount
      const expectedXChange = parseFloat(newOriginX) - parseFloat(originalOriginX);
      const actualXChange = parseFloat(currentOriginX) - parseFloat(originalOriginX);
      const expectedYChange = parseFloat(newOriginY) - parseFloat(originalOriginY);
      const actualYChange = parseFloat(currentOriginY) - parseFloat(originalOriginY);
      
      console.log(`Expected X change: ${expectedXChange}, Actual X change: ${actualXChange}`);
      console.log(`Expected Y change: ${expectedYChange}, Actual Y change: ${actualYChange}`);
      
      // Verify the movement is approximately correct (within 1 unit tolerance)
      const xChangeCorrect = Math.abs(actualXChange - expectedXChange) < 1.0;
      const yChangeCorrect = Math.abs(actualYChange - expectedYChange) < 1.0;
      
      console.log(`X change correct: ${xChangeCorrect}`);
      console.log(`Y change correct: ${yChangeCorrect}`);
      
      // Additional assertion to verify movement direction is correct
      expect(xChangeCorrect || yChangeCorrect).toBe(true);
      
      // Check for evidence that the fix worked
      const hasMetadataUpdate = consoleLogs.some(log => log.includes('✅ Shape transformed and metadata updated'));
      expect(hasMetadataUpdate).toBe(true);
      
      console.log('✅ All movement verification checks passed - shape movement fix confirmed!');
    }
    
    console.log('\n✅ Shape movement verification test completed');
  });

});