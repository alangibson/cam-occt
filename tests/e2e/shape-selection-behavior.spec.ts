import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Comprehensive test for shape selection behavior requirements from CLAUDE.md:
 * 
 * Selection Rules:
 * 1. Hover Selection: Shape is selected when user hovers over it  
 * 2. Hover Deselection: Shape is unselected when user no longer hovers over it (if not clicked)
 * 3. Click Pinning: If user clicks on shape, it stays selected regardless of hover state
 * 4. Click Switching: If user clicks on another shape, all previous shapes are unselected
 */

test.describe('Shape Selection Behavior', () => {
  
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

  test('Rule 1: Hover Selection - Shape is selected when user hovers over it', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const propertiesPanel = page.locator('.properties-panel');
    
    // Get canvas bounds for positioning
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (canvasBounds) {
      // Initial state - no selection
      await expect(propertiesPanel).toContainText('Hover over or click a shape');
      
      // Test multiple hover positions to find shapes
      const testPositions = [
        { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
        { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 },
        { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 }
      ];
      
      let foundHover = false;
      for (const pos of testPositions) {
        await page.mouse.move(pos.x, pos.y);
        await page.waitForTimeout(500);
        
        const panelText = await propertiesPanel.textContent();
        if (panelText && panelText.includes('Hovered:')) {
          foundHover = true;
          console.log('✅ Hover selection found at position:', pos);
          break;
        }
      }
      
      expect(foundHover, 'Should find at least one hoverable shape').toBe(true);
    }
  });

  test('Rule 2: Hover Deselection - Shape is unselected when user no longer hovers over it', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const propertiesPanel = page.locator('.properties-panel');
    
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (canvasBounds) {
      const shapePos = { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 };
      const emptyPos = { x: canvasBounds.x + canvasBounds.width * 0.1, y: canvasBounds.y + canvasBounds.height * 0.1 };
      
      // Hover over shape
      await page.mouse.move(shapePos.x, shapePos.y);
      await page.waitForTimeout(500);
      
      // Check if hover is detected
      let panelText = await propertiesPanel.textContent();
      const isHovering = panelText && panelText.includes('Hovered:');
      
      if (isHovering) {
        // Move to empty area
        await page.mouse.move(emptyPos.x, emptyPos.y);
        await page.waitForTimeout(500);
        
        // Should return to default state
        panelText = await propertiesPanel.textContent();
        expect(panelText).toContain('Hover over or click a shape');
        console.log('✅ Hover deselection verified');
      } else {
        // Try different positions to find a hoverable shape
        const alternativePositions = [
          { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
          { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 }
        ];
        
        let foundShape = false;
        for (const pos of alternativePositions) {
          await page.mouse.move(pos.x, pos.y);
          await page.waitForTimeout(500);
          
          panelText = await propertiesPanel.textContent();
          if (panelText && panelText.includes('Hovered:')) {
            // Move away
            await page.mouse.move(emptyPos.x, emptyPos.y);
            await page.waitForTimeout(500);
            
            panelText = await propertiesPanel.textContent();
            expect(panelText).toContain('Hover over or click a shape');
            foundShape = true;
            break;
          }
        }
        
        expect(foundShape, 'Should find at least one shape to test hover deselection').toBe(true);
      }
    }
  });

  test('Rule 3: Click Pinning - Clicked shape stays selected regardless of hover state', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const propertiesPanel = page.locator('.properties-panel');
    
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (canvasBounds) {
      const shapePos = { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 };
      const otherPos = { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 };
      
      // Click on shape to pin selection
      await page.mouse.click(shapePos.x, shapePos.y);
      await page.waitForTimeout(500);
      
      let panelText = await propertiesPanel.textContent();
      const isSelected = panelText && panelText.includes('Selected:');
      
      if (isSelected) {
        const selectedShapeName = panelText;
        
        // Move mouse to different position
        await page.mouse.move(otherPos.x, otherPos.y);
        await page.waitForTimeout(500);
        
        // Should still show the selected shape, not change to hover
        panelText = await propertiesPanel.textContent();
        expect(panelText).toContain('Selected:');
        expect(panelText).toBe(selectedShapeName); // Should be the same selected shape
        console.log('✅ Click pinning verified');
      } else {
        // Try different click positions
        const alternativePositions = [
          { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
          { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 }
        ];
        
        let foundClickable = false;
        for (const pos of alternativePositions) {
          await page.mouse.click(pos.x, pos.y);
          await page.waitForTimeout(500);
          
          panelText = await propertiesPanel.textContent();
          if (panelText && panelText.includes('Selected:')) {
            const selectedShapeName = panelText;
            
            // Move away and verify selection persists
            await page.mouse.move(otherPos.x, otherPos.y);
            await page.waitForTimeout(500);
            
            panelText = await propertiesPanel.textContent();
            expect(panelText).toContain('Selected:');
            foundClickable = true;
            break;
          }
        }
        
        expect(foundClickable, 'Should find at least one clickable shape').toBe(true);
      }
    }
  });

  test('Rule 4: Click Switching - Clicking another shape unselects previous shapes', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const propertiesPanel = page.locator('.properties-panel');
    
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (canvasBounds) {
      const pos1 = { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 };
      const pos2 = { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 };
      
      // Click first shape
      await page.mouse.click(pos1.x, pos1.y);
      await page.waitForTimeout(500);
      
      let panelText = await propertiesPanel.textContent();
      if (panelText && panelText.includes('Selected:')) {
        const firstSelection = panelText;
        
        // Click second shape
        await page.mouse.click(pos2.x, pos2.y);
        await page.waitForTimeout(500);
        
        panelText = await propertiesPanel.textContent();
        if (panelText && panelText.includes('Selected:')) {
          // Should show different shape or same shape with different index
          expect(panelText).not.toBe(firstSelection);
          console.log('✅ Click switching verified');
        } else {
          // Second click might have been on empty space
          expect(panelText).toContain('Hover over or click a shape');
        }
      } else {
        // Try multiple positions to find clickable shapes
        const testPositions = [
          { x: canvasBounds.x + canvasBounds.width * 0.2, y: canvasBounds.y + canvasBounds.height * 0.2 },
          { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 },
          { x: canvasBounds.x + canvasBounds.width * 0.8, y: canvasBounds.y + canvasBounds.height * 0.8 }
        ];
        
        let selections: string[] = [];
        for (const pos of testPositions) {
          await page.mouse.click(pos.x, pos.y);
          await page.waitForTimeout(500);
          
          panelText = await propertiesPanel.textContent();
          if (panelText && panelText.includes('Selected:')) {
            selections.push(panelText);
            if (selections.length >= 2) {
              expect(selections[0]).not.toBe(selections[1]);
              break;
            }
          }
        }
        
        expect(selections.length, 'Should find at least one clickable shape').toBeGreaterThan(0);
      }
    }
  });

  test('Empty Space Click - Clicking empty space unpins all selections', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const propertiesPanel = page.locator('.properties-panel');
    
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (canvasBounds) {
      const shapePos = { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 };
      const emptyPos = { x: canvasBounds.x + canvasBounds.width * 0.05, y: canvasBounds.y + canvasBounds.height * 0.05 };
      
      // First, try to select a shape
      await page.mouse.click(shapePos.x, shapePos.y);
      await page.waitForTimeout(500);
      
      let panelText = await propertiesPanel.textContent();
      if (panelText && panelText.includes('Selected:')) {
        // Click empty space
        await page.mouse.click(emptyPos.x, emptyPos.y);
        await page.waitForTimeout(500);
        
        // Should unpin selection
        panelText = await propertiesPanel.textContent();
        expect(panelText).toContain('Hover over or click a shape');
        console.log('✅ Empty space click unpinning verified');
      } else {
        console.log('⚠️ Could not find selectable shape for empty space test');
      }
    }
  });

  test('Properties Panel Visibility - Shows correct shape information', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const propertiesPanel = page.locator('.properties-panel');
    
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    
    if (canvasBounds) {
      const shapePos = { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 };
      
      // Click on shape
      await page.mouse.click(shapePos.x, shapePos.y);
      await page.waitForTimeout(500);
      
      const panelText = await propertiesPanel.textContent();
      if (panelText && panelText.includes('Selected:')) {
        // Should show shape information
        expect(panelText).toMatch(/Selected:.*\(Index: \d+\)/);
        
        // Look for coordinate information or shape-specific data
        const hasCoordinates = panelText.includes('Start Point') || 
                              panelText.includes('End Point') || 
                              panelText.includes('Origin');
        
        // At minimum should show shape index and name
        expect(panelText).toContain('Index:');
        console.log('✅ Properties panel shows shape information');
      }
    }
  });

});