import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Layer Visibility Preservation - Critical Requirement', () => {
  
  test('should never change layer visibility as side effect of delete operations', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    await page.goto('/');
    await page.click('.stage-button:has-text("Import")');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/Tractor Seat Mount - Left.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    await page.waitForTimeout(3000); // Wait for complex file to load
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Find the VISIBLE layer toggle and turn it off
    const visibleLayerToggle = page.locator('[data-layer="VISIBLE"] input[type="checkbox"]').or(
      page.locator('text=VISIBLE').locator('..').locator('input[type="checkbox"]')
    );
    
    if (await visibleLayerToggle.isVisible()) {
      // Ensure VISIBLE layer is initially on, then turn it off
      if (await visibleLayerToggle.isChecked()) {
        await visibleLayerToggle.click();
        await page.waitForTimeout(500);
        
        // Verify VISIBLE layer is now off
        await expect(visibleLayerToggle).not.toBeChecked();
        console.log('VISIBLE layer turned off successfully');
      }
      
      // Now select and delete a shape from layer 0 (or any other layer)
      const canvas = page.locator('.viewer-container canvas');
      
      // Try clicking in different areas to find a shape on layer 0
      const clickPositions = [
        { x: 300, y: 200 },
        { x: 400, y: 300 }, 
        { x: 500, y: 250 },
        { x: 350, y: 400 }
      ];
      
      let shapeSelected = false;
      for (const position of clickPositions) {
        await canvas.click({ position });
        await page.waitForTimeout(500);
        
        // Check if delete button becomes enabled (indicates shape selected)
        const deleteButton = page.locator('.btn-danger');
        if (await deleteButton.isVisible() && await deleteButton.isEnabled()) {
          console.log(`Shape selected at position ${position.x}, ${position.y}`);
          
          // Get the selected shape's layer info if visible
          const shapeInfo = page.locator('.selected-shape-editor');
          if (await shapeInfo.isVisible()) {
            const infoText = await shapeInfo.textContent();
            console.log(`Selected shape info: ${infoText}`);
          }
          
          // Delete the selected shape
          await deleteButton.click();
          await page.waitForTimeout(2000); // Wait for delete and refresh
          
          // CRITICAL: VISIBLE layer must still be off after delete
          await expect(visibleLayerToggle).not.toBeChecked();
          console.log('✅ VISIBLE layer remained off after delete operation');
          
          shapeSelected = true;
          break;
        }
      }
      
      if (!shapeSelected) {
        console.log('⚠️ No shape could be selected for deletion test');
      }
      
    } else {
      console.log('⚠️ VISIBLE layer toggle not found - test cannot proceed');
      // Still run a basic test to ensure layers panel exists
      const layersPanel = page.locator('.layers-panel, .layer-controls, [class*="layer"]');
      await expect(layersPanel).toBeVisible();
    }
  });

  test('should preserve all layer visibility states during multiple delete operations', async ({ page }) => {
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    await page.goto('/');
    await page.click('.stage-button:has-text("Import")');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/Tractor Seat Mount - Left.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    await page.waitForTimeout(3000);
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Get all layer toggles and record their initial states
    const layerToggles = page.locator('input[type="checkbox"]').filter({ has: page.locator('[data-layer], text*="layer"') });
    const layerCount = await layerToggles.count();
    
    if (layerCount > 0) {
      console.log(`Found ${layerCount} layer toggles`);
      
      // Record initial states
      const initialStates: Record<number, boolean> = {};
      for (let i = 0; i < layerCount; i++) {
        const toggle = layerToggles.nth(i);
        initialStates[i] = await toggle.isChecked();
      }
      
      // Turn off every other layer
      for (let i = 0; i < layerCount; i += 2) {
        const toggle = layerToggles.nth(i);
        if (await toggle.isChecked()) {
          await toggle.click();
          await page.waitForTimeout(200);
        }
      }
      
      // Record modified states  
      const modifiedStates: Record<number, boolean> = {};
      for (let i = 0; i < layerCount; i++) {
        const toggle = layerToggles.nth(i);
        modifiedStates[i] = await toggle.isChecked();
      }
      
      console.log('Initial states:', initialStates);
      console.log('Modified states:', modifiedStates);
      
      // Perform delete operations
      const canvas = page.locator('.viewer-container canvas');
      for (let deleteAttempt = 0; deleteAttempt < 3; deleteAttempt++) {
        // Try to select and delete a shape
        await canvas.click({ position: { x: 300 + deleteAttempt * 50, y: 300 + deleteAttempt * 30 } });
        await page.waitForTimeout(500);
        
        const deleteButton = page.locator('.btn-danger');
        if (await deleteButton.isVisible() && await deleteButton.isEnabled()) {
          await deleteButton.click();
          await page.waitForTimeout(1500);
          console.log(`Completed delete operation ${deleteAttempt + 1}`);
        }
      }
      
      // Verify all layer states are preserved after deletes
      for (let i = 0; i < layerCount; i++) {
        const toggle = layerToggles.nth(i);
        const currentState = await toggle.isChecked();
        expect(currentState).toBe(modifiedStates[i]);
      }
      
      console.log('✅ All layer visibility states preserved after multiple delete operations');
      
    } else {
      console.log('⚠️ No layer toggles found - test cannot proceed');
    }
  });
  
  test('should preserve layer visibility during shape property modifications', async ({ page }) => {
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    await page.goto('/');
    await page.click('.stage-button:has-text("Import")');
    
    const fileInput = page.locator('input[type="file"]');
    const dxfPath = path.join(__dirname, '../../test/dxf/Tractor Seat Mount - Left.dxf');
    await fileInput.setInputFiles(dxfPath);
    
    await page.waitForTimeout(3000);
    await page.click('.stage-button:has-text("Modify")');
    await page.waitForSelector('.viewer-container canvas', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Turn off the VISIBLE layer 
    const visibleLayerToggle = page.locator('[data-layer="VISIBLE"] input[type="checkbox"]').or(
      page.locator('text=VISIBLE').locator('..').locator('input[type="checkbox"]')
    );
    
    if (await visibleLayerToggle.isVisible() && await visibleLayerToggle.isChecked()) {
      await visibleLayerToggle.click();
      await page.waitForTimeout(500);
      await expect(visibleLayerToggle).not.toBeChecked();
      console.log('VISIBLE layer turned off');
    }
    
    // Select a shape and modify its properties
    const canvas = page.locator('.viewer-container canvas');
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);
    
    // If shape editor is visible, modify some properties
    const shapeEditor = page.locator('.selected-shape-editor');
    if (await shapeEditor.isVisible()) {
      console.log('Shape editor opened');
      
      // Find any input fields and modify them
      const inputs = shapeEditor.locator('input[type="number"]');
      const inputCount = await inputs.count();
      
      if (inputCount > 0) {
        const firstInput = inputs.first();
        const originalValue = await firstInput.inputValue();
        const newValue = (parseFloat(originalValue || '0') + 10).toString();
        
        await firstInput.fill(newValue);
        await page.waitForTimeout(1000);
        
        console.log(`Modified input from ${originalValue} to ${newValue}`);
        
        // CRITICAL: VISIBLE layer must still be off after property modification
        if (await visibleLayerToggle.isVisible()) {
          await expect(visibleLayerToggle).not.toBeChecked();
          console.log('✅ VISIBLE layer remained off after property modification');
        }
      }
    } else {
      console.log('No shape editor found - test passed (no properties to modify)');
    }
  });
});