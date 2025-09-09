import { test, expect } from '@playwright/test';
import path from 'path';
import { STANDARD_TIMEOUT_MS } from '../../src/lib/constants/index.js';

test.describe('Ellipse Chain Detection', () => {
    test('should detect chains containing ellipses', async ({ page }) => {
        // Navigate to the app
        await page.goto('/');

        // Already on import stage by default, no need to click

        // Import a DXF file with ellipses
        const testFilePath = path.join(
            process.cwd(),
            'tests/dxf/ellipse-test.dxf'
        );

        // Create a simple DXF with an ellipse
        const dxfContent = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
ELLIPSE
5
30
100
AcDbEntity
8
0
6
Continuous
100
AcDbEllipse
10
100.0
20
200.0
30
0.0
11
50.0
21
0.0
31
0.0
210
0.0
220
0.0
230
1.0
40
0.5
0
ELLIPSE
5
31
100
AcDbEntity
8
0
6
Continuous
100
AcDbEllipse
10
200.0
20
200.0
30
0.0
11
50.0
21
0.0
31
0.0
40
0.6
41
0.0
42
1.570796327
0
ENDSEC
0
EOF`;

        // Write the test file
        const fs = await import('fs').then((m) => m.promises);
        await fs.writeFile(testFilePath, dxfContent);

        // Upload the file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Wait for file to be processed
        await page.waitForTimeout(STANDARD_TIMEOUT_MS);

        // Go to Edit stage
        await page.getByRole('button', { name: '2 Edit' }).click();
        await page.waitForTimeout(500);

        // Go to Program stage
        await page.getByRole('button', { name: '3 Program' }).click();
        await page.waitForTimeout(500);

        // Click Detect Chains button
        await page.getByRole('button', { name: 'Detect Chains' }).click();

        // Wait for chain detection to complete
        await page.waitForTimeout(500);

        // Check that chains are detected (this should fail with current implementation)
        const chainSummary = page.locator('.chain-summary-inline');
        await expect(chainSummary).toBeVisible();

        // Should detect at least 1 chain with ellipses
        const chainText = await chainSummary.textContent();
        console.log('Chain detection result:', chainText);

        // With the fix, both ellipses form chains (ALL shapes form chains, open or closed)
        // One full ellipse + one ellipse arc = 2 single-shape chains
        expect(chainText).toContain('2 chains');
        expect(chainText).toContain('2 connected shapes');

        // The chain detection correctly identifies all shapes as chains
        expect(chainText).toMatch(/2 chains? with 2 connected shapes?/);

        // Clean up test file
        await fs.unlink(testFilePath).catch(() => {});
    });

    test('should handle ellipse arcs in chain detection', async ({ page }) => {
        // Navigate to the app
        await page.goto('/');

        // Already on import stage by default, no need to click

        // Import a DXF file with ellipse arc connected to a line
        const testFilePath = path.join(
            process.cwd(),
            'tests/dxf/ellipse-arc-chain.dxf'
        );

        // Create DXF with ellipse arc and connecting line
        const dxfContent = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
ELLIPSE
5
30
100
AcDbEntity
8
0
100
AcDbEllipse
10
0.0
20
0.0
30
0.0
11
30.0
21
0.0
31
0.0
40
0.6
41
0.0
42
1.570796327
0
LINE
5
31
100
AcDbEntity
8
0
100
AcDbLine
10
0.0
20
18.0
30
0.0
11
50.0
21
50.0
31
0.0
0
ENDSEC
0
EOF`;

        // Write the test file
        const fs = await import('fs').then((m) => m.promises);
        await fs.writeFile(testFilePath, dxfContent);

        // Upload the file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Wait for file to be processed
        await page.waitForTimeout(STANDARD_TIMEOUT_MS);

        // Go to Edit stage
        await page.getByRole('button', { name: '2 Edit' }).click();
        await page.waitForTimeout(500);

        // Go to Program stage
        await page.getByRole('button', { name: '3 Program' }).click();
        await page.waitForTimeout(500);

        // Set a larger tolerance to ensure connection
        const toleranceInput = page.locator('input[type="number"]');
        await toleranceInput.fill('1.0');

        // Click Detect Chains button
        await page.getByRole('button', { name: 'Detect Chains' }).click();

        // Wait for chain detection to complete
        await page.waitForTimeout(500);

        // Check that chains are detected
        const chainSummary = page.locator('.chain-summary-inline');
        await expect(chainSummary).toBeVisible();

        // Should detect 1 chain with 2 shapes (ellipse arc + line)
        const chainText = await chainSummary.textContent();
        expect(chainText).toContain('1 chain');
        expect(chainText).toContain('2 connected shapes');

        // Clean up test file
        await fs.unlink(testFilePath).catch(() => {});
    });
});
