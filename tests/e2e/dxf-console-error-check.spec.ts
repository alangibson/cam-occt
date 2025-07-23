import { test, expect } from '@playwright/test';
import path from 'path';

test('Load Tractor Light Mount - Left.dxf and check for console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    if (type === 'error') {
      consoleErrors.push(`${text} (${location.url}:${location.lineNumber})`);
      console.log(`❌ Console Error: ${text}`);
      console.log(`   Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    } else if (type === 'warning') {
      consoleWarnings.push(`${text} (${location.url}:${location.lineNumber})`);
      console.log(`⚠️  Console Warning: ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
    console.log(`❌ Page Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  });

  try {
    console.log('🔍 Testing DXF file loading with console error detection...\n');
    
    // Navigate to the application
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1000);
    
    console.log('📂 Navigating to Import page...');
    await page.click('text=Import');
    await page.waitForTimeout(1000);
    
    // Look for the DXF file in test directory
    const dxfFilePath = path.resolve('./test/dxf/Tractor Light Mount - Left.dxf');
    console.log(`📄 Loading DXF file: ${dxfFilePath}`);
    
    // Upload the DXF file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(dxfFilePath);
    
    // Wait for file processing
    console.log('⏳ Waiting for file processing...');
    await page.waitForTimeout(5000);
    
    // Check if we can navigate to modify page (indicates successful load)
    console.log('📝 Navigating to Modify page to verify file loaded...');
    await page.click('text=Modify');
    await page.waitForTimeout(2000);
    
    console.log('\n=== DXF CONSOLE ERROR CHECK RESULTS ===');
    console.log(`❌ Console Errors: ${consoleErrors.length}`);
    console.log(`⚠️  Console Warnings: ${consoleWarnings.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n🚨 CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    if (consoleWarnings.length > 0) {
      console.log('\n⚠️  CONSOLE WARNINGS:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }
    
    if (consoleErrors.length === 0) {
      console.log('✅ DXF file loaded successfully with no console errors!');
    }
    
    // Fail the test if there are console errors
    expect(consoleErrors.length, `Found ${consoleErrors.length} console errors while loading DXF file`).toBe(0);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    throw error;
  }
});