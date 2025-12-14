import { type Page, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

interface WorkflowOptions {
    /** Path to the DXF file relative to project root */
    dxfFilePath: string;
    /** Display unit to use (e.g., 'Metric' or 'Imperial') */
    displayUnit: string;
    /** Path where performance trace will be saved relative to project root */
    performanceReportPath: string;
    /** Simulation speed (e.g., '1x', '10x') */
    simulationSpeed?: string;
    /** How long to run simulation in milliseconds */
    simulationDuration?: number;
}

/**
 * Executes the complete CAM workflow: import DXF, create operation, simulate, and export G-code
 */
export async function executeWorkflowHappyPath(
    page: Page,
    options: WorkflowOptions
): Promise<void> {
    const {
        dxfFilePath,
        displayUnit,
        performanceReportPath,
        simulationSpeed = '10x',
        simulationDuration = 3000,
    } = options;

    // Collect console messages
    const consoleMessages: Array<{ type: string; text: string }> = [];

    page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        consoleMessages.push({ type, text });
    });

    // Start Chrome DevTools Protocol performance tracing
    const client = await page.context().newCDPSession(page);
    await client.send('Tracing.start', {
        traceConfig: {
            includedCategories: [
                'devtools.timeline',
                'disabled-by-default-devtools.timeline',
            ],
        },
    });

    // Navigate to the application
    await page.goto('/');

    // 1. Open DXF file
    const filePath = path.join(process.cwd(), dxfFilePath);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // 2. Set units
    const unitSelect = page.locator('select#import-unit-setting');
    await unitSelect.selectOption({ label: displayUnit });

    // 3. Click Import button
    const importButton = page
        .getByLabel('File import area')
        .getByRole('button', { name: /import/i });
    await importButton.click();

    // Wait for import to complete and navigate to Program page
    await page.waitForTimeout(1000);

    // Navigate to Program page via breadcrumb
    const programBreadcrumb = page
        .getByRole('button', { name: /program/i })
        .first();
    await programBreadcrumb.click();
    await page.waitForTimeout(500);

    // 4. Add operation
    const addOperationButton = page.getByRole('button', { name: 'Add' });
    await addOperationButton.click();

    // Wait for operation to be created and cuts to be generated
    await page.waitForTimeout(500);

    // 5. Click Simulate breadcrumb button
    const simulateBreadcrumb = page.getByRole('button', {
        name: 'Simulate',
        exact: true,
    });
    await simulateBreadcrumb.click();

    // Wait for simulation page to load
    await page.waitForTimeout(1000);

    // 6. Set simulation speed
    const speedSelect = page
        .locator('select')
        .filter({ hasText: /1x|10x/ })
        .or(page.locator('select[id*="speed"]'));
    await speedSelect.selectOption({ label: simulationSpeed });

    // 7. Click play on simulation and wait
    const playButton = page.getByRole('button', { name: /play/i });
    await playButton.click();
    await page.waitForTimeout(simulationDuration);

    // 8. Click Export breadcrumb button
    const exportBreadcrumb = page.getByRole('button', {
        name: 'Export',
        exact: true,
    });
    await exportBreadcrumb.click();

    // Wait for export page to load
    await page.waitForTimeout(1000);

    // 9. Click download and assert that download starts
    const downloadPromise = page.waitForEvent('download');
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();

    const download = await downloadPromise;

    // Assert download was triggered
    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.nc$|\.gcode$|\.ngc$/);

    // Stop tracing - don't wait for completion
    const chunks: unknown[] = [];
    let traceData = JSON.stringify({ traceEvents: [] });

    const collectTracingData = () => {
        return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                resolve();
            }, 3000);

            client.on(
                'Tracing.dataCollected',
                (event: { value: unknown[] }) => {
                    chunks.push(...event.value);
                }
            );
            client.on('Tracing.tracingComplete', () => {
                clearTimeout(timeout);
                resolve();
            });
            client.send('Tracing.end').catch(() => resolve());
        });
    };

    await collectTracingData();
    traceData = JSON.stringify({ traceEvents: chunks });

    // Save the performance trace to file
    const reportPath = path.join(process.cwd(), performanceReportPath);
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, traceData);

    // Check for console errors and warnings
    const errors = consoleMessages.filter((msg) => msg.type === 'error');
    const warnings = consoleMessages.filter((msg) => msg.type === 'warning');

    // Fail test if there are errors or warnings
    expect(errors.length, `Found ${errors.length} console errors`).toBe(0);
    expect(warnings.length, `Found ${warnings.length} console warnings`).toBe(
        0
    );
}
