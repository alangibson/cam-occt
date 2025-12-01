let counter: number = 0;

export function generateId(): string {
    return `${Date.now()}_${counter++}`;
}
