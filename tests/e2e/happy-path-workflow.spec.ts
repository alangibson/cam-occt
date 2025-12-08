import { test } from '@playwright/test';
import { executeWorkflowHappyPath } from './workflow-happy-path';

test.describe('Happy Workflow', () => {
    test('imports DXF, creates operation, simulates, and exports G-code', async ({
        page,
    }) => {
        await executeWorkflowHappyPath(page, {
            dxfFilePath: 'tests/dxf/Manometer_bracket.dxf',
            displayUnit: 'Metric',
            performanceReportPath:
                'report/performance/manometer-bracket-happy-workflow.json',
            simulationSpeed: '10x',
            simulationDuration: 3000,
        });
    });

    test('YOUCANMOVEMOUNTAINS happy workflow', async ({ page }) => {
        await executeWorkflowHappyPath(page, {
            dxfFilePath: 'tests/dxf/YOUCANMOVEMOUNTAINS.dxf',
            displayUnit: 'Imperial',
            performanceReportPath:
                'report/performance/youcanmovemountains-happy-workflow.json',
            simulationSpeed: '10x',
            simulationDuration: 3000,
        });
    });
});
