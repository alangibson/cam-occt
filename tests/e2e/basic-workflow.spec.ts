import { test, expect } from '@playwright/test';

test.describe('Basic CAM Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the main interface', async ({ page }) => {
        await expect(
            page.locator('button:has-text("Import DXF")')
        ).toBeVisible();
        await expect(
            page.locator('h3:has-text("Cutting Parameters")')
        ).toBeVisible();
        await expect(
            page.locator('button:has-text("Generate G-Code")')
        ).toBeVisible();
        await expect(page.locator('footer')).toBeVisible();
    });

    test('should show file import area', async ({ page }) => {
        const importArea = page.locator('.file-import');
        await expect(importArea).toBeVisible();
        await expect(importArea).toContainText('or drag and drop a file here');
    });

    test('should have disabled tools when no drawing is loaded', async ({
        page,
    }) => {
        await expect(page.locator('button:has-text("Delete")')).toBeDisabled();
        await expect(page.locator('button:has-text("Scale")')).toBeDisabled();
        await expect(page.locator('button:has-text("Rotate")')).toBeDisabled();
        await expect(
            page.locator('button:has-text("Generate G-Code")')
        ).toBeDisabled();
    });

    test('should show cutting parameters', async ({ page }) => {
        await expect(page.locator('label:has-text("Feed Rate")')).toBeVisible();
        await expect(
            page.locator('label:has-text("Pierce Height")')
        ).toBeVisible();
        await expect(
            page.locator('label:has-text("Cut Height")')
        ).toBeVisible();
        await expect(
            page.locator('label:has-text("Kerf Width")')
        ).toBeVisible();
    });
});
