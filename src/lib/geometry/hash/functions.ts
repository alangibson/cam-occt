const HASH_LENGTH = 16;

/**
 * Creates a deterministic hash of an object by:
 * 1. Recursively sorting object properties alphabetically by key
 * 2. Stringifying to JSON
 * 3. Hashing the JSON string with SHA-256
 *
 * @param obj - The object to hash
 * @returns A hex string hash
 */
export async function hashObject(obj: object): Promise<string> {
    const sortedJson = JSON.stringify(obj, sortKeys);
    const encoder = new TextEncoder();
    const data = encoder.encode(sortedJson);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
        .map((b) => b.toString(HASH_LENGTH).padStart(2, '0'))
        .join('');
}

/**
 * Replacer function for JSON.stringify that sorts object keys alphabetically
 */
// eslint-disable-next-line @typescript-eslint/no-restricted-types
function sortKeys(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
            .sort()
            .reduce(
                (sorted, key) => {
                    // eslint-disable-next-line @typescript-eslint/no-restricted-types
                    sorted[key] = (value as Record<string, unknown>)[key];
                    return sorted;
                },
                // eslint-disable-next-line @typescript-eslint/no-restricted-types
                {} as Record<string, unknown>
            );
    }
    return value;
}
