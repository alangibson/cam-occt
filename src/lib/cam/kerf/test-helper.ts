/**
 * Test helper for creating sample kerfs for debugging
 */

import type { Kerf } from './interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

/**
 * Create a simple rectangular kerf for testing
 *
 * This creates a kerf with:
 * - Inner rectangle: 90x40 at (5, 5)
 * - Outer rectangle: 110x60 at (-5, -5)
 * - Total kerf width: 10 units
 *
 * @param centerX - Center X coordinate (default 50)
 * @param centerY - Center Y coordinate (default 50)
 * @param size - Base size (default 100)
 * @param kerfWidth - Kerf width (default 10)
 * @returns A test kerf with inner and outer chains
 */
export function createTestKerf(
    centerX: number = 50,
    centerY: number = 50,
    size: number = 100,
    kerfWidth: number = 10
): Kerf {
    const halfKerf = kerfWidth / 2;
    const halfSize = size / 2;

    // Inner chain (offset inward by halfKerf)
    const innerChain: Chain = {
        id: crypto.randomUUID(),
        shapes: [
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX - halfSize + halfKerf,
                        y: centerY - halfSize + halfKerf,
                    },
                    end: {
                        x: centerX + halfSize - halfKerf,
                        y: centerY - halfSize + halfKerf,
                    },
                } as Line,
            },
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX + halfSize - halfKerf,
                        y: centerY - halfSize + halfKerf,
                    },
                    end: {
                        x: centerX + halfSize - halfKerf,
                        y: centerY + halfSize - halfKerf,
                    },
                } as Line,
            },
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX + halfSize - halfKerf,
                        y: centerY + halfSize - halfKerf,
                    },
                    end: {
                        x: centerX - halfSize + halfKerf,
                        y: centerY + halfSize - halfKerf,
                    },
                } as Line,
            },
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX - halfSize + halfKerf,
                        y: centerY + halfSize - halfKerf,
                    },
                    end: {
                        x: centerX - halfSize + halfKerf,
                        y: centerY - halfSize + halfKerf,
                    },
                } as Line,
            },
        ],
        clockwise: true,
    };

    // Outer chain (offset outward by halfKerf)
    const outerChain: Chain = {
        id: crypto.randomUUID(),
        shapes: [
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX - halfSize - halfKerf,
                        y: centerY - halfSize - halfKerf,
                    },
                    end: {
                        x: centerX + halfSize + halfKerf,
                        y: centerY - halfSize - halfKerf,
                    },
                } as Line,
            },
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX + halfSize + halfKerf,
                        y: centerY - halfSize - halfKerf,
                    },
                    end: {
                        x: centerX + halfSize + halfKerf,
                        y: centerY + halfSize + halfKerf,
                    },
                } as Line,
            },
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX + halfSize + halfKerf,
                        y: centerY + halfSize + halfKerf,
                    },
                    end: {
                        x: centerX - halfSize - halfKerf,
                        y: centerY + halfSize + halfKerf,
                    },
                } as Line,
            },
            {
                id: crypto.randomUUID(),
                type: GeometryType.LINE,
                geometry: {
                    start: {
                        x: centerX - halfSize - halfKerf,
                        y: centerY + halfSize + halfKerf,
                    },
                    end: {
                        x: centerX - halfSize - halfKerf,
                        y: centerY - halfSize - halfKerf,
                    },
                } as Line,
            },
        ],
        clockwise: true,
    };

    return {
        id: crypto.randomUUID(),
        name: 'Test Kerf',
        enabled: true,
        cutId: 'test-cut-id',
        kerfWidth,
        innerChain,
        outerChain,
        isClosed: true,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
    };
}
