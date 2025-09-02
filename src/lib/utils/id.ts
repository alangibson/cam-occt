let counter: number = 0;

export function generateId(): string {
  return `shape_${Date.now()}_${counter++}`;
}