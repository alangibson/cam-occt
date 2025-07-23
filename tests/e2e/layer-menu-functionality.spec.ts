import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Layer Menu Functionality', () => {
  test('should display layer menu on modify page', async ({ page }) => {
    // Set up console error capture
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.location().url}:${msg.location().lineNumber}: ${msg.text()}`);
      }
    });

    await page.goto('/');
    
    // Navigate to import page first
    await page.click('button:has-text("Import")');
    
    // Upload a DXF file with multiple layers - using Blocktest.dxf which has layers
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(__dirname, '../../test/dxf/Blocktest.dxf');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for processing to complete
    await page.waitForTimeout(3000);
    
    // Navigate to modify page
    await page.click('button:has-text("Modify")');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for console errors during navigation and loading
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
      throw new Error(`Console errors detected: ${consoleErrors.join(', ')}`);
    }
    
    // Verify layer menu is present
    const layerMenu = page.locator('.layer-menu');
    await expect(layerMenu).toBeVisible();
    
    // Verify layer menu header
    const layerHeader = layerMenu.locator('h3:has-text("Layers")');
    await expect(layerHeader).toBeVisible();
    
    // Wait for layer information to load
    await page.waitForTimeout(1000);
    
    // Verify layer items are present (Blocktest.dxf should have multiple layers)
    const layerItems = layerMenu.locator('.layer-item');
    const layerCount = await layerItems.count();
    expect(layerCount).toBeGreaterThan(0);
    
    // Verify first layer has required elements
    if (layerCount > 0) {
      const firstLayer = layerItems.first();
      
      // Check visibility toggle button exists
      const toggleButton = firstLayer.locator('.layer-toggle');
      await expect(toggleButton).toBeVisible();
      
      // Check layer name exists
      const layerName = firstLayer.locator('.name');
      await expect(layerName).toBeVisible();
      
      // Check entity count exists
      const entityCount = firstLayer.locator('.entity-count');
      await expect(entityCount).toBeVisible();
      
      // Check entity type badges exist
      const entityBadges = firstLayer.locator('.entity-type-badge');
      const badgeCount = await entityBadges.count();
      expect(badgeCount).toBeGreaterThan(0);
    }
    
    // Verify no console errors occurred during layer menu display
    if (consoleErrors.length > 0) {
      console.log('Console errors after layer menu display:', consoleErrors);
      throw new Error(`Console errors after layer menu display: ${consoleErrors.join(', ')}`);
    }
  });

  test('should toggle layer visibility when clicking toggle button', async ({ page }) => {
    // Set up console error capture
    const consoleErrors: string[] = [];
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.location().url}:${msg.location().lineNumber}: ${msg.text()}`);
      } else if (msg.type() === 'log' && msg.text().includes('Layer')) {
        consoleLogs.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Navigate to import page
    await page.click('button:has-text("Import")');
    
    // Upload a DXF file with multiple layers
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(__dirname, '../../test/dxf/Blocktest.dxf');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Navigate to modify page
    await page.click('button:has-text("Modify")');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check initial console errors
    if (consoleErrors.length > 0) {
      throw new Error(`Initial console errors: ${consoleErrors.join(', ')}`);
    }
    
    // Find layer menu and get first layer
    const layerMenu = page.locator('.layer-menu');
    const layerItems = layerMenu.locator('.layer-item');
    const layerCount = await layerItems.count();
    
    if (layerCount > 0) {
      const firstLayer = layerItems.first();
      const toggleButton = firstLayer.locator('.layer-toggle');
      const layerName = await firstLayer.locator('.name').textContent();
      
      // Get initial visibility state
      const initialVisibilityIcon = await firstLayer.locator('.visibility-icon').textContent();
      const initiallyVisible = initialVisibilityIcon === '👁️';
      
      // Click the toggle button
      await toggleButton.click();
      
      // Wait for state change
      await page.waitForTimeout(500);
      
      // Check visibility icon changed
      const newVisibilityIcon = await firstLayer.locator('.visibility-icon').textContent();
      const nowVisible = newVisibilityIcon === '👁️';
      expect(nowVisible).toBe(!initiallyVisible);
      
      // Check console logs for layer visibility change
      const layerToggleLogs = consoleLogs.filter(log => 
        log.includes(`Layer "${layerName}" visibility set to:`) ||
        log.includes(`Layer ${layerName} visibility:`)
      );
      expect(layerToggleLogs.length).toBeGreaterThan(0);
      
      // Click toggle again to restore
      await toggleButton.click();
      await page.waitForTimeout(500);
      
      // Verify it toggles back
      const finalVisibilityIcon = await firstLayer.locator('.visibility-icon').textContent();
      const finallyVisible = finalVisibilityIcon === '👁️';
      expect(finallyVisible).toBe(initiallyVisible);
    }
    
    // Verify no console errors occurred during toggle operations
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors during toggle: ${consoleErrors.join(', ')}`);
    }
  });

  test('should display correct layer information from DXF file', async ({ page }) => {
    // Set up console monitoring
    const consoleErrors: string[] = [];
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.location().url}:${msg.location().lineNumber}: ${msg.text()}`);
      } else if (msg.type() === 'log' && (msg.text().includes('Detected') || msg.text().includes('layers'))) {
        consoleLogs.push(msg.text());
      }
    });

    await page.goto('/');
    await page.click('button:has-text("Import")');
    
    // Upload Tractor Seat Mount - Left.dxf which should have multiple layers with SPLINE entities
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(__dirname, '../../test/dxf/Tractor Seat Mount - Left.dxf');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(3000);
    await page.click('button:has-text("Modify")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors during loading: ${consoleErrors.join(', ')}`);
    }
    
    const layerMenu = page.locator('.layer-menu');
    await expect(layerMenu).toBeVisible();
    
    // Check that layer detection console log was emitted
    const layerDetectionLogs = consoleLogs.filter(log => log.includes('Detected') && log.includes('layers'));
    expect(layerDetectionLogs.length).toBeGreaterThan(0);
    
    // Verify layer items display correct information
    const layerItems = layerMenu.locator('.layer-item');
    const layerCount = await layerItems.count();
    
    if (layerCount > 0) {
      for (let i = 0; i < Math.min(layerCount, 3); i++) { // Check up to 3 layers
        const layerItem = layerItems.nth(i);
        
        // Verify layer name is not empty
        const layerNameText = await layerItem.locator('.name').textContent();
        expect(layerNameText?.trim()).toBeTruthy();
        
        // Verify entity count format
        const entityCountText = await layerItem.locator('.entity-count').textContent();
        expect(entityCountText).toMatch(/^\d+ entit(y|ies)$/);
        
        // Verify entity type badges exist
        const badges = layerItem.locator('.entity-type-badge');
        const badgeCount = await badges.count();
        expect(badgeCount).toBeGreaterThan(0);
        
        // Check that at least one badge contains expected DXF entity types
        const badgeTexts: string[] = [];
        for (let j = 0; j < badgeCount; j++) {
          const badgeText = await badges.nth(j).textContent();
          if (badgeText) badgeTexts.push(badgeText);
        }
        
        const validEntityTypes = ['LINE', 'ARC', 'CIRCLE', 'SPLINE', 'POLYLINE', 'INSERT'];
        const hasValidEntityType = badgeTexts.some(badge => 
          validEntityTypes.includes(badge.trim())
        );
        expect(hasValidEntityType).toBe(true);
      }
    }
    
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors after verification: ${consoleErrors.join(', ')}`);
    }
  });

  test('should handle empty layer state correctly', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.location().url}:${msg.location().lineNumber}: ${msg.text()}`);
      }
    });

    await page.goto('/');
    await page.click('button:has-text("Modify")'); // Navigate directly to modify without importing
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify layer menu shows empty state
    const layerMenu = page.locator('.layer-menu');
    await expect(layerMenu).toBeVisible();
    
    const emptyState = layerMenu.locator('.empty-state');
    await expect(emptyState).toBeVisible();
    
    const emptyMessage = emptyState.locator('p:has-text("No layers detected")');
    await expect(emptyMessage).toBeVisible();
    
    const emptyHint = emptyState.locator('small:has-text("Import a DXF file to see layers")');
    await expect(emptyHint).toBeVisible();
    
    // Verify layer count in header shows 0
    const layerHeader = layerMenu.locator('.layer-menu-header');
    const countDisplay = layerHeader.locator('small');
    const countDisplayExists = await countDisplay.count();
    
    if (countDisplayExists > 0) {
      // If count display exists, it should show 0 layers
      const countText = await countDisplay.textContent();
      expect(countText).toMatch(/^0 layers?$/);
    }
    
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors in empty state: ${consoleErrors.join(', ')}`);
    }
  });
});