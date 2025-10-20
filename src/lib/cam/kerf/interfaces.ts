import type { Chain } from '$lib/geometry/chain/interfaces';
import type { CacheableLead } from '$lib/cam/lead/interfaces';

/**
 * Kerf represents the material removed by a cutting tool
 *
 * A Kerf is a bi-directional offset of a Cut path, where:
 * - The offset distance is half the tool's kerf width in each direction
 * - Total kerf width equals the tool's kerf width
 * - Both inner and outer offset chains represent the material removal zone
 * - All fills and ends use round geometry for smooth transitions
 * - Lead-in/out geometry is included for complete visualization
 */
export interface Kerf {
    /** Unique identifier */
    id: string;

    /** Human-readable name */
    name: string;

    /** Whether this kerf is enabled for visualization/processing */
    enabled: boolean;

    /** Reference to the source Cut */
    cutId: string;

    /** Kerf width used for offset calculation (from Tool) */
    kerfWidth: number;

    /**
     * Inner offset chain (offset inward by kerfWidth/2)
     * For closed cuts, this is the inner boundary of the kerf
     * For open cuts, this is the left side offset
     */
    innerChain: Chain;

    /**
     * Outer offset chain (offset outward by kerfWidth/2)
     * For closed cuts, this is the outer boundary of the kerf
     * For open cuts, this is the right side offset
     */
    outerChain: Chain;

    /** Whether the source cut was closed */
    isClosed: boolean;

    /** Lead-in geometry from the source Cut */
    leadIn?: CacheableLead;

    /** Lead-out geometry from the source Cut */
    leadOut?: CacheableLead;

    /** ISO timestamp when kerf was generated */
    generatedAt: string;

    /** Algorithm version for invalidation */
    version: string;
}
