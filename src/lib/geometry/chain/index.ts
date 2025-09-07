import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import { reverseShape } from '$lib/geometry';

/**
 * Reverses a chain's direction by reversing both the order of shapes
 * and the internal geometry of each shape.
 * This is used when applying cut direction that differs from the chain's natural direction.
 * 
 * @param chain - The chain to reverse
 * @returns A new chain with reversed direction
 */
export function reverseChain(chain: Chain): Chain {
  return {
    ...chain,
    shapes: chain.shapes.slice().reverse().map(shape => reverseShape(shape))
  };
}