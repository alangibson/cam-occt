import type { Part, PartVoid } from './interfaces';

// Helper to get all chain IDs that belong to a specific part

export function getPartChainIds(partId: string, parts: Part[]): string[] {
    const part: Part | undefined = parts.find((p) => p.id === partId);
    if (!part) return [];

    const chainIds: string[] = [];

    // Add shell chain ID
    chainIds.push(part.shell.id);

    // Add all hole chain IDs
    function addHoleChainIds(holes: PartVoid[]): void {
        for (const hole of holes) {
            chainIds.push(hole.chain.id);
        }
    }

    addHoleChainIds(part.voids);

    return chainIds;
}
// Helper to get which part a chain belongs to

export function getChainPartId(chainId: string, parts: Part[]): string | null {
    for (const part of parts) {
        if (part.shell.id === chainId) {
            return part.id;
        }

        // Check holes recursively
        if (isChainInHoles(chainId, part.voids)) {
            return part.id;
        }
    }
    return null;
}
// Helper to get the type of a chain (shell or hole)

export function getChainPartType(
    chainId: string,
    parts: Part[]
): 'shell' | 'hole' | null {
    for (const part of parts) {
        if (part.shell.id === chainId) {
            return 'shell';
        }

        // Check holes recursively
        if (isChainInHoles(chainId, part.voids)) {
            return 'hole';
        }
    }
    return null;
}
function isChainInHoles(chainId: string, holes: PartVoid[]): boolean {
    for (const hole of holes) {
        if (hole.chain.id === chainId) {
            return true;
        }
    }
    return false;
}
