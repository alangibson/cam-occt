import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Offset Implementation - WASM Loading', () => {
    test('should load Clipper2 WASM when switching to Polyline implementation', async ({
        page,
    }) => {
        // Track console errors
        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Track page errors
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        // Navigate to the main page
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Navigate to Settings
        const settingsButton = page.locator('button:has-text("Settings")');
        await settingsButton.click();

        // Wait for settings page to load
        await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

        // Find and click the Polyline radio button
        const polylineRadio = page.locator(
            'input[type="radio"][value="polyline"]'
        );
        await expect(polylineRadio).toBeVisible();
        await polylineRadio.click();

        // Wait a moment for the setting to be persisted
        await page.waitForTimeout(500);

        // Verify the radio button is checked
        await expect(polylineRadio).toBeChecked();

        // Now trigger an actual offset calculation to load the WASM module
        // Navigate to Program stage and create an operation with kerf compensation

        // First, we need to load a DXF file
        const dxfPath = path.join(
            process.cwd(),
            'tests',
            'dxf',
            '5inchknife.dxf'
        );

        // Navigate back to import
        const importButton = page.locator('button:has-text("Import")');
        await importButton.click();

        // Upload the DXF file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(dxfPath);

        // Wait for file to be processed
        await page.waitForTimeout(1000);

        // Navigate to Program stage
        const programButton = page.locator('button:has-text("Program")');
        await programButton.click();

        // Wait for Program stage to load
        await expect(
            page.locator('h3:has-text("Cutting Parameters")')
        ).toBeVisible();

        // Create a new operation - find and click the "Add Operation" or similar button
        const addOperationButton = page.locator(
            'button:has-text("Add Operation")'
        );
        if (await addOperationButton.isVisible()) {
            await addOperationButton.click();
        }

        // Wait for operations to be generated/updated
        await page.waitForTimeout(1000);

        // Check for WASM-related errors
        // Filter out common non-critical errors
        const wasmErrors = errors.filter(
            (error) =>
                !error.includes('favicon') &&
                !error.includes('sourcemap') &&
                (error.toLowerCase().includes('wasm') ||
                    error.toLowerCase().includes('clipper') ||
                    error.toLowerCase().includes('cannot find module') ||
                    error.toLowerCase().includes('failed to fetch'))
        );

        // No WASM loading errors should occur
        expect(wasmErrors).toHaveLength(0);

        // Verify the page is still functional
        await expect(
            page.locator('h3:has-text("Cutting Parameters")')
        ).toBeVisible();
    });

    test('should successfully use Exact implementation (default)', async ({
        page,
    }) => {
        // Track console errors
        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Track page errors
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        // Navigate to the main page
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Navigate to Settings
        const settingsButton = page.locator('button:has-text("Settings")');
        await settingsButton.click();

        // Wait for settings page to load
        await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

        // Verify Exact is selected by default
        const exactRadio = page.locator('input[type="radio"][value="exact"]');
        await expect(exactRadio).toBeVisible();
        await expect(exactRadio).toBeChecked();

        // Load a DXF file and process it
        const dxfPath = path.join(
            process.cwd(),
            'tests',
            'dxf',
            '5inchknife.dxf'
        );

        // Navigate back to import
        const importButton = page.locator('button:has-text("Import")');
        await importButton.click();

        // Upload the DXF file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(dxfPath);

        // Wait for file to be processed
        await page.waitForTimeout(1000);

        // Navigate to Program stage
        const programButton = page.locator('button:has-text("Program")');
        await programButton.click();

        // Wait for Program stage to load
        await expect(
            page.locator('h3:has-text("Cutting Parameters")')
        ).toBeVisible();

        // Check that no critical errors occurred
        const criticalErrors = errors.filter(
            (error) =>
                !error.includes('favicon') && !error.includes('sourcemap')
        );

        expect(criticalErrors).toHaveLength(0);
    });
});
