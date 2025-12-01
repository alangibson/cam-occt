/**
 * Creates a deterministic hash of an object by:
 * 1. Recursively sorting object properties alphabetically by key
 * 2. Stringifying to JSON
 * 3. Hashing the JSON string with SHA-256
 *
 * @param obj - The object to hash
 * @returns A hex string hash
 */
export async function hashObject(obj: unknown): Promise<string> {
    const sortedJson = JSON.stringify(obj, sortKeys);
    const encoder = new TextEncoder();
    const data = encoder.encode(sortedJson);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Replacer function for JSON.stringify that sorts object keys alphabetically
 */
function sortKeys(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
            .sort()
            .reduce(
                (sorted, key) => {
                    sorted[key] = (value as Record<string, unknown>)[key];
                    return sorted;
                },
                {} as Record<string, unknown>
            );
    }
    return value;
}
