/**
 * Test helper for creating sample kerfs for debugging
 */

import type { Kerf } from './interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

// Default test kerf parameters
const DEFAULT_CENTER_X = 50;
const DEFAULT_CENTER_Y = 50;
const DEFAULT_SIZE = 100;
const DEFAULT_KERF_WIDTH = 10;

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
    centerX: number = DEFAULT_CENTER_X,
    centerY: number = DEFAULT_CENTER_Y,
    size: number = DEFAULT_SIZE,
    kerfWidth: number = DEFAULT_KERF_WIDTH
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
