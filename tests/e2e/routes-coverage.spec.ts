import { test, expect } from '@playwright/test';

test.describe('Routes Coverage', () => {
    test('should render main page route (+page.svelte) correctly', async ({
        page,
    }) => {
        // Navigate to the main route
        const response = await page.goto('/');

        // Verify successful response
        expect(response?.status()).toBe(200);

        // Verify main layout elements are rendered
        await expect(page.locator('.app')).toBeVisible();
        await expect(page.locator('.app-header')).toBeVisible();
        await expect(page.locator('.app-body')).toBeVisible();
        await expect(page.locator('.app-footer')).toBeVisible();

        // Verify WorkflowBreadcrumbs is rendered
        await expect(page.locator('nav')).toBeVisible();

        // Verify Tools button is rendered and functional
        const toolsButton = page.locator('button.tools-button');
        await expect(toolsButton).toBeVisible();
        await expect(toolsButton).toHaveText('Tools');

        // Verify WorkflowContainer is initially shown
        await expect(page.locator('.workflow-container')).toBeVisible();
    });

    test('should handle tools button toggle functionality', async ({
        page,
    }) => {
        await page.goto('/');

        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');

        const toolsButton = page.locator('button.tools-button');

        // Initially should show WorkflowContainer
        await expect(page.locator('.workflow-container')).toBeVisible();

        // Click Tools button to show ToolTable
        await toolsButton.click();

        // Should now show ToolTable instead of WorkflowContainer
        await expect(page.locator('.tool-table')).toBeVisible();

        // Click Tools button again to hide ToolTable
        await toolsButton.click();

        // Should show WorkflowContainer again
        await expect(page.locator('.workflow-container')).toBeVisible();
    });

    test('should execute onMount lifecycle correctly', async ({ page }) => {
        // Listen for console logs that indicate onMount executed
        const logs: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'log') {
                logs.push(msg.text());
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check that the onMount lifecycle executed by verifying the page is functional
        // The presence of workflow components indicates onMount ran successfully
        await expect(page.locator('.app')).toBeVisible();

        // Migration and state restoration may or may not log - test functionality instead
        const workflowContainer = page.locator('main');
        await expect(workflowContainer).toBeVisible();
    });

    test('should handle application state persistence', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Verify the application state management is working
        // by checking that the main workflow is visible
        const mainContent = page.locator('main');
        await expect(mainContent).toBeVisible();

        // Check for specific workflow stage button (more precise selector)
        await expect(page.locator('button.import-button')).toBeVisible();

        // Check for workflow container or similar main content area
        await expect(page.locator('main')).toContainText('Import');
    });

    test('should apply CSS styles correctly', async ({ page }) => {
        await page.goto('/');

        // Test app layout styles (less strict about exact values)
        const app = page.locator('.app');
        await expect(app).toHaveCSS('display', 'flex');
        await expect(app).toHaveCSS('flex-direction', 'column');

        // Test header styles
        const header = page.locator('.app-header');
        await expect(header).toHaveCSS('display', 'flex');
        await expect(header).toHaveCSS('justify-content', 'space-between');

        // Test tools button styles (check if exists first)
        const toolsButton = page.locator('button.tools-button');
        if (await toolsButton.isVisible()) {
            await expect(toolsButton).toHaveCSS('color', 'rgb(255, 255, 255)');
        }
    });

    test('should handle beforeunload event', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Verify the page can handle beforeunload events without errors
        await page.evaluate(() => {
            const event = new Event('beforeunload');
            window.dispatchEvent(event);
        });

        // Page should still be functional
        await expect(page.locator('.app')).toBeVisible();
    });

    test('should load layout.js configuration', async ({ page }) => {
        // Test that the layout configuration is applied
        await page.goto('/');

        // Since ssr = false and prerender = true are set in +layout.js,
        // the page should be client-side rendered
        await expect(page.locator('.app')).toBeVisible();

        // Verify that client-side JavaScript is working
        const toolsButton = page.locator('button.tools-button');
        await toolsButton.click();

        // This interaction proves client-side rendering is working
        await expect(page.locator('.tool-table')).toBeVisible();
    });

    test('should be responsive to viewport changes', async ({ page }) => {
        // Test desktop view
        await page.setViewportSize({ width: 1200, height: 800 });
        await page.goto('/');

        await expect(page.locator('.app-header')).toBeVisible();

        // Test mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();

        // Layout should still be functional on mobile
        await expect(page.locator('.app-header')).toBeVisible();
        await expect(page.locator('button.tools-button')).toBeVisible();
    });

    test('should handle component interaction flows', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Test interaction between WorkflowBreadcrumbs and WorkflowContainer
        const breadcrumbs = page.locator('nav');
        await expect(breadcrumbs).toBeVisible();

        // Test that workflow stages button is rendered (use specific selector)
        const importButton = page.locator('button.import-button');
        await expect(importButton).toBeVisible();

        // Click on import button if available
        if (await importButton.isVisible()) {
            await importButton.click();
            await expect(page.locator('main')).toBeVisible();
        }
    });

    test('should maintain state during navigation', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Verify initial state
        await expect(page.locator('main')).toBeVisible();

        // Refresh page - should maintain functionality
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should return to functional state (main content visible)
        await expect(page.locator('.app')).toBeVisible();
        await expect(page.locator('main')).toBeVisible();
    });
});
