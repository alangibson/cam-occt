import type { DetectedPart, Part } from './interfaces';

// Helper to get all chain IDs that belong to a specific part

export function getPartChainIds(
    partId: string,
    parts: DetectedPart[]
): string[] {
    const part: DetectedPart | undefined = parts.find((p) => p.id === partId);
    if (!part) return [];

    const chainIds: string[] = [];

    // Add shell chain ID
    chainIds.push(part.shell.chain.id);

    // Add all hole chain IDs recursively
    function addHoleChainIds(holes: Part[]): void {
        for (const hole of holes) {
            chainIds.push(hole.chain.id);
            if (hole.holes) {
                addHoleChainIds(hole.holes);
            }
        }
    }

    addHoleChainIds(part.holes);

    return chainIds;
}
// Helper to get which part a chain belongs to

export function getChainPartId(
    chainId: string,
    parts: DetectedPart[]
): string | null {
    for (const part of parts) {
        if (part.shell.chain.id === chainId) {
            return part.id;
        }

        // Check holes recursively
        if (isChainInHoles(chainId, part.holes)) {
            return part.id;
        }
    }
    return null;
}
// Helper to get the type of a chain (shell or hole)

export function getChainPartType(
    chainId: string,
    parts: DetectedPart[]
): 'shell' | 'hole' | null {
    for (const part of parts) {
        if (part.shell.chain.id === chainId) {
            return 'shell';
        }

        // Check holes recursively
        if (isChainInHoles(chainId, part.holes)) {
            return 'hole';
        }
    }
    return null;
}
function isChainInHoles(chainId: string, holes: Part[]): boolean {
    for (const hole of holes) {
        if (hole.chain.id === chainId) {
            return true;
        }
        if (hole.holes && isChainInHoles(chainId, hole.holes)) {
            return true;
        }
    }
    return false;
}
