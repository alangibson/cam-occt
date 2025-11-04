/**
 * Example service interface for demonstration purposes
 */
export interface CalculatorService {
	add(a: number, b: number): Promise<number>;
	subtract(a: number, b: number): Promise<number>;
	multiply(a: number, b: number): Promise<number>;
	divide(a: number, b: number): Promise<number>;
	factorial(n: number): Promise<number>;
	fibonacci(n: number): Promise<number>;
}
