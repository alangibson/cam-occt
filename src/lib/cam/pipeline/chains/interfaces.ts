/**
 * Pipeline Chains Interfaces
 *
 * Type definitions for the CAM pipeline chain preparation module.
 */

import type { Chain } from '$lib/geometry/chain/interfaces';

/**
 * Result of creating a cut chain with execution ordering
 */
export interface CutChainResult {
    /** The cut chain with shapes ordered for execution */
    cutChain: Chain;
    /** The execution winding direction (true=clockwise, false=counterclockwise, null=none) */
    executionClockwise: boolean | null;
}
