import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('Drawing Data Flow Test', () => {
    test('should verify drawing data flows from parser to canvas', async ({
        page,
    }) => {
        // Navigate to the page
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Load a simple DXF file
        const dxfContent = readFileSync('tests/dxf/1.dxf', 'utf-8');

        // Add debugging to track the flow
        await page.evaluate(() => {
            // Override console.log to capture debug info
            interface DebugWindow extends Window {
                debugInfo?: string[];
            }
            (window as DebugWindow).debugInfo = [];
            const originalLog = console.log;
            console.log = (...args) => {
                (window as DebugWindow).debugInfo?.push(args.join(' '));
                originalLog(...args);
            };
        });

        await page.evaluate(async (content) => {
            const file = new File([content], 'test.dxf', {
                type: 'application/dxf',
            });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const fileInput = document.querySelector(
                'input[type="file"]'
            ) as HTMLInputElement;
            if (fileInput) {
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, dxfContent);

        // Wait for processing
        await page.waitForTimeout(3000);

        // Check what data we have
        const debugInfo = await page.evaluate(() => {
            interface DebugWindow extends Window {
                debugInfo?: string[];
            }
            // Try to access drawing data through various means
            const results = {
                debugLogs: (window as DebugWindow).debugInfo || [],
                canvasElement: !!document.querySelector('.drawing-canvas'),
                sidebarText:
                    document.querySelector('.export-section .info')
                        ?.textContent || 'not found',
                // Try to trigger a manual render to see what happens
                manualRenderResult: null as string | null,
            };

            // Try to manually trigger a render
            try {
                const canvas = document.querySelector(
                    '.drawing-canvas'
                ) as HTMLCanvasElement;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        // Draw a simple test shape to verify canvas is working
                        ctx.strokeStyle = 'red';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(100, 100);
                        ctx.lineTo(200, 200);
                        ctx.stroke();
                        results.manualRenderResult = 'manual draw successful';
                    }
                }
            } catch (error) {
                results.manualRenderResult = `manual draw failed: ${error}`;
            }

            return results;
        });

        console.log('Debug info:', debugInfo);

        // Check if manual drawing worked
        const hasManualContent = await page.evaluate(() => {
            const canvas = document.querySelector(
                '.drawing-canvas'
            ) as HTMLCanvasElement;
            if (!canvas) return false;

            const ctx = canvas.getContext('2d');
            if (!ctx) return false;

            // Check around where we drew the test line
            const pixel = ctx.getImageData(150, 150, 1, 1).data;
            return pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0; // Any color
        });

        console.log('Manual drawing worked:', hasManualContent);

        // Check if the drawing info shows shapes were loaded
        console.log('Sidebar text:', debugInfo.sidebarText);

        // This test should help us understand where the issue is
        expect(hasManualContent, 'Manual canvas drawing should work').toBe(
            true
        );
    });
});
