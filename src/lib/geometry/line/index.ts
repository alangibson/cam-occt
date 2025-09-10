// Re-export interfaces
export type { Line } from './interfaces';

// Re-export constants
export { MIN_VERTICES_FOR_LINE } from './constants';

// Re-export functions
export {
    getLineStartPoint,
    getLineEndPoint,
    reverseLine,
    getLinePointAt,
    isLine,
    calculateLineDirectionAndLength,
} from './functions';
