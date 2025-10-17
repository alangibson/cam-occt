import { describe, expect, it } from 'vitest';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape';
import type { Circle } from '$lib/geometry/circle';
import type { Arc } from '$lib/geometry/arc';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import { calculateCutNormal } from '$lib/cam/cut/calculate-cut-normal';
import { getArcStartPoint, getArcEndPoint } from '$lib/geometry/arc/functions';

describe('Lead Sweep Direction Analysis', () => {
    /**
     * THE ISSUE: When you look at a circle being cut, and you change from CW to CCW:
     * - The lead-in arc should sweep in the OPPOSITE direction
     * - For CW cut: lead should sweep CW (with the cut direction)
     * - For CCW cut: lead should sweep CCW (with the cut direction)
     *
     * Currently, both CW and CCW leads have the SAME visual sweep pattern.
     */

    it('should demonstrate the sweep direction issue', () => {
        // Simple circle at origin
        const chain: Chain = {
            id: 'test-circle',
            shapes: [
                {
                    id: 'circle1',
                    type: GeometryType.CIRCLE,
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 100,
                    } as Circle,
                },
            ],
            clockwise: true,
        };

        const leadConfig = {
            type: LeadType.ARC,
            length: 20,
            flipSide: false,
            fit: false,
        };

        // Test CW cut
        const cwNormal = calculateCutNormal(
            chain,
            CutDirection.CLOCKWISE,
            undefined
        );
        const cwResult = calculateLeads(
            chain,
            leadConfig,
            leadConfig,
            CutDirection.CLOCKWISE,
            undefined,
            cwNormal.normal
        );

        // Test CCW cut
        const ccwNormal = calculateCutNormal(
            chain,
            CutDirection.COUNTERCLOCKWISE,
            undefined
        );
        const ccwResult = calculateLeads(
            chain,
            leadConfig,
            leadConfig,
            CutDirection.COUNTERCLOCKWISE,
            undefined,
            ccwNormal.normal
        );

        expect(cwResult.leadIn).toBeDefined();
        expect(ccwResult.leadIn).toBeDefined();

        const cwArc = cwResult.leadIn!.geometry as Arc;
        const ccwArc = ccwResult.leadIn!.geometry as Arc;

        // Get arc start/end points
        const cwStart = getArcStartPoint(cwArc);
        const cwEnd = getArcEndPoint(cwArc);
        const ccwStart = getArcStartPoint(ccwArc);
        const ccwEnd = getArcEndPoint(ccwArc);

        console.log('\n=== LEAD SWEEP ANALYSIS ===');
        console.log('\nCW Lead-in:');
        console.log('  Arc center:', cwArc.center);
        console.log('  Arc start:', cwStart);
        console.log('  Arc end (connection):', cwEnd);
        console.log('  Arc clockwise property:', cwArc.clockwise);
        console.log('  Start angle:', cwArc.startAngle);
        console.log('  End angle:', cwArc.endAngle);

        console.log('\nCCW Lead-in:');
        console.log('  Arc center:', ccwArc.center);
        console.log('  Arc start:', ccwStart);
        console.log('  Arc end (connection):', ccwEnd);
        console.log('  Arc clockwise property:', ccwArc.clockwise);
        console.log('  Start angle:', ccwArc.startAngle);
        console.log('  End angle:', ccwArc.endAngle);

        // The KEY ISSUE:
        // For a circle at (0,0) with radius 100, starting at top (0, 100):
        // - CW cut goes: top -> right -> bottom -> left -> top (angles decrease)
        // - CCW cut goes: top -> left -> bottom -> right -> top (angles increase)
        //
        // The lead-in should sweep IN THE SAME DIRECTION as the cut:
        // - CW cut needs CW lead (clockwise=true)
        // - CCW cut needs CCW lead (clockwise=false)

        console.log('\n=== EXPECTED BEHAVIOR ===');
        console.log('For CW cut: lead arc should have clockwise=true');
        console.log('For CCW cut: lead arc should have clockwise=false');

        console.log('\n=== ACTUAL BEHAVIOR ===');
        console.log('CW lead clockwise:', cwArc.clockwise);
        console.log('CCW lead clockwise:', ccwArc.clockwise);

        // HYPOTHESIS: The desiredClockwise logic is inverted
        // It should be:
        // - CW cut -> CW lead (clockwise=true)
        // - CCW cut -> CCW lead (clockwise=false)
        // But currently it might be doing the opposite

        // For CW cut, lead should have clockwise=true
        const cwLeadMatchesCutDirection = cwArc.clockwise === true;

        // For CCW cut, lead should have clockwise=false
        const ccwLeadMatchesCutDirection = ccwArc.clockwise === false;

        console.log('\n=== VALIDATION ===');
        console.log(
            'CW lead matches CW cut direction:',
            cwLeadMatchesCutDirection
        );
        console.log(
            'CCW lead matches CCW cut direction:',
            ccwLeadMatchesCutDirection
        );

        if (!cwLeadMatchesCutDirection || !ccwLeadMatchesCutDirection) {
            console.log(
                '\n❌ BUG CONFIRMED: Lead sweep direction does not match cut direction!'
            );
            console.log(
                'The desiredClockwise logic in lead-calculation.ts needs to be inverted.'
            );
        } else {
            console.log('\n✓ Lead sweep directions match cut directions');
        }
    });
});
