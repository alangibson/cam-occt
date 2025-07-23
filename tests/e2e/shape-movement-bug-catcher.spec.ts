import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Shape Movement Bug Catcher', () => {

  test('PROVE BUG EXISTS: Shape origin change does not actually move the shape', async ({ page }) => {
    console.log('🚨 THIS TEST WILL FAIL IF THE BUG EXISTS 🚨');
    console.log('🎯 Purpose: Catch the fact that shape movement does not work');
    
    // Track console messages
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
      // Log important messages
      if (text.includes('🔄 Handling shape modification') || 
          text.includes('🔧 ShapeModifier.modifyShape') ||
          text.includes('🎯 translateShapeToOrigin') ||
          text.includes('Translation vector:') ||
          text.includes('✅ Shape transformed and metadata updated')) {
        console.log(`Browser: ${text}`);
      }
    });

    // Start test
    console.log('\n🧪 Starting shape movement bug detection test...');
    
    // Navigate to application and load DXF file
    await page.goto('http://localhost:5174');
    await page.click('text=Import');
    
    const dxfFilePath = path.resolve('./test/dxf/Tractor Light Mount - Left.dxf');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(dxfFilePath);
    
    console.log('⏳ Waiting for file to load...');
    await page.waitForTimeout(8000);
    
    // Navigate to modify page
    await page.click('text=Modify');
    await page.waitForTimeout(2000);
    
    // Select a shape by trying multiple positions
    const canvas = page.locator('canvas').first();
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (!canvasBounds) return;

    const testPositions = [
      { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 },
      { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
      { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 }
    ];

    let shapeSelected = false;
    let originalOriginX = '';
    let originalOriginY = '';
    
    for (const pos of testPositions) {
      console.log(`Trying to select shape at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
      await page.mouse.click(pos.x, pos.y);
      await page.waitForTimeout(1000);
      
      const shapeInfo = page.locator('.shape-info');
      if (await shapeInfo.isVisible()) {
        console.log('✅ Shape selected successfully');
        shapeSelected = true;
        
        // Get origin coordinates
        const originInputs = page.locator('label:has-text("X:") input');
        const originXInput = originInputs.nth(2); // Should be origin X input
        const originYInput = page.locator('label:has-text("Y:") input').nth(2); // Should be origin Y input
        
        originalOriginX = await originXInput.inputValue();
        originalOriginY = await originYInput.inputValue();
        
        console.log(`📍 Original origin coordinates: (${originalOriginX}, ${originalOriginY})`);
        break;
      }
    }
    
    expect(shapeSelected).toBe(true);
    expect(originalOriginX).not.toBe('');
    expect(originalOriginY).not.toBe('');
    
    // Calculate new coordinates (move by +10 X, +5 Y)
    const newOriginX = (parseFloat(originalOriginX) + 10).toString();
    const newOriginY = (parseFloat(originalOriginY) + 5).toString();
    
    console.log(`📍 Setting new origin coordinates: (${newOriginX}, ${newOriginY})`);
    console.log(`📏 Expected movement: X+10, Y+5`);
    
    // Change the coordinates
    const originXInput = page.locator('label:has-text("X:") input').nth(2);
    const originYInput = page.locator('label:has-text("Y:") input').nth(2);
    
    await originXInput.clear();
    await originXInput.fill(newOriginX);
    await originYInput.clear();
    await originYInput.fill(newOriginY);
    
    console.log('🔄 Applying changes...');
    
    // Clear previous logs and apply changes
    consoleLogs.length = 0;
    
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await applyButton.click();
    
    // Wait for modification to complete
    console.log('⏳ Waiting for modification to complete...');
    await page.waitForTimeout(5000);
    
    // Verify modification completed
    const modifyingButton = page.locator('button:has-text("Modifying...")');
    await expect(modifyingButton).not.toBeVisible();
    
    console.log('✅ Modification process completed');
    
    // Re-select the shape to check coordinates
    console.log('🔍 Re-selecting shape to check final coordinates...');
    const centerX = canvasBounds.x + canvasBounds.width * 0.5;
    const centerY = canvasBounds.y + canvasBounds.height * 0.5;
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(1000);
    
    // Get final coordinates
    const finalOriginX = await page.locator('label:has-text("X:") input').nth(2).inputValue();
    const finalOriginY = await page.locator('label:has-text("Y:") input').nth(2).inputValue();
    
    console.log(`📍 Final origin coordinates: (${finalOriginX}, ${finalOriginY})`);
    
    // Calculate actual movement
    const actualXMovement = parseFloat(finalOriginX) - parseFloat(originalOriginX);
    const actualYMovement = parseFloat(finalOriginY) - parseFloat(originalOriginY);
    
    console.log('\n🔍 MOVEMENT ANALYSIS:');
    console.log(`Expected X movement: +10, Actual X movement: ${actualXMovement.toFixed(3)}`);
    console.log(`Expected Y movement: +5, Actual Y movement: ${actualYMovement.toFixed(3)}`);
    
    const xMoved = Math.abs(actualXMovement) > 0.1;
    const yMoved = Math.abs(actualYMovement) > 0.1;
    const anyMovement = xMoved || yMoved;
    
    console.log(`X coordinate changed: ${xMoved}`);
    console.log(`Y coordinate changed: ${yMoved}`);
    console.log(`Any movement detected: ${anyMovement}`);
    
    // Check for evidence that the modification system is working
    const hasModificationLogs = consoleLogs.some(log => 
      log.includes('🔄 Handling shape modification') ||
      log.includes('🔧 ShapeModifier.modifyShape') ||
      log.includes('🎯 translateShapeToOrigin')
    );
    
    const hasTransformationLogs = consoleLogs.some(log => 
      log.includes('Translation vector:') ||
      log.includes('✅ Shape transformed and metadata updated')
    );
    
    console.log(`\nModification system activated: ${hasModificationLogs}`);
    console.log(`Transformation logs present: ${hasTransformationLogs}`);
    
    // Check for console errors
    if (consoleErrors.length > 0) {
      console.log('\n❌ Console errors during modification:');
      consoleErrors.forEach(error => console.log(`  ${error}`));
    }
    
    // THE CRITICAL TEST - this will FAIL if the bug exists
    if (!anyMovement) {
      console.log('\n🚨 BUG DETECTED! SHAPE DID NOT MOVE!');
      console.log('❌ Origin coordinates remain unchanged despite modification attempt');
      console.log('❌ This proves the shape movement functionality is broken');
      
      if (hasModificationLogs) {
        console.log('ℹ️  Modification system was activated but did not produce results');
      } else {
        console.log('ℹ️  Modification system may not have been activated at all');
      }
      
      // Show recent console logs for debugging
      console.log('\n📋 Recent console logs:');
      consoleLogs.slice(-15).forEach((log, i) => {
        console.log(`${i + 1}: ${log}`);
      });
    } else {
      console.log('\n✅ SHAPE MOVEMENT DETECTED!');
      console.log('✅ Origin coordinates changed successfully');
      console.log('✅ Shape movement functionality is working');
    }
    
    // This assertion will FAIL if the shape doesn't move, proving the bug exists
    expect(anyMovement).toBe(true);
    
    // If we get here, the movement worked
    console.log('\n🎉 Test passed - shape movement is working correctly!');
  });

});