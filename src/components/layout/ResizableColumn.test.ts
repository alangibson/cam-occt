// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ResizableColumn from './ResizableColumn.svelte';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

describe('ResizableColumn Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without errors', () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column' },
        });
        expect(container).toBeDefined();
    });

    it('should use default width when no localStorage value exists', () => {
        localStorageMock.getItem.mockReturnValue(null);

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 300 },
        });

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(column.style.width).toBe('300px');
    });

    it('should load width from localStorage on mount', () => {
        localStorageMock.getItem.mockReturnValue('350');

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'saved-column' },
        });

        expect(localStorageMock.getItem).toHaveBeenCalledWith('saved-column');
        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(column.style.width).toBe('350px');
    });

    it('should save width to localStorage when resizing ends', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 280 },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Start resize
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        // Move mouse
        await fireEvent.mouseMove(document, { clientX: 150 });

        // End resize
        await fireEvent.mouseUp(document);

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'test-column',
            expect.any(String)
        );
    });

    it('should resize with left position (normal direction)', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 280, position: 'left' },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Start resize
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        // Move mouse right (+50px)
        await fireEvent.mouseMove(document, { clientX: 150 });

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(parseInt(column.style.width)).toBeGreaterThan(280);
    });

    it('should resize with right position (reversed direction)', async () => {
        localStorageMock.getItem.mockReturnValue(null); // Fresh start

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'right-test', width: 280, position: 'right' },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Start resize
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        // Move mouse right (+50px, but should decrease width for right position)
        await fireEvent.mouseMove(document, { clientX: 150 });

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        const newWidth = parseInt(column.style.width);
        expect(newWidth).toBeLessThan(280);
    });

    it('should respect minimum width constraint', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 220, minWidth: 200 },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Try to resize below minimum
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });
        await fireEvent.mouseMove(document, { clientX: 0 }); // Move far left

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(parseInt(column.style.width)).toBeGreaterThanOrEqual(200);
    });

    it('should respect maximum width constraint', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 500, maxWidth: 600 },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Try to resize above maximum
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });
        await fireEvent.mouseMove(document, { clientX: 300 }); // Move far right

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(parseInt(column.style.width)).toBeLessThanOrEqual(600);
    });

    it('should support keyboard resize with arrow keys', async () => {
        localStorageMock.getItem.mockReturnValue(null); // Fresh start

        const { container } = render(ResizableColumn, {
            props: {
                storageKey: 'keyboard-test',
                width: 280,
                position: 'left',
            },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Press right arrow (should increase width by 10px for left position)
        await fireEvent.keyDown(resizeHandle!, { key: 'ArrowRight' });

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(column.style.width).toBe('290px');

        // Verify localStorage was updated
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'keyboard-test',
            '290'
        );
    });

    it('should handle keyboard resize for right position', async () => {
        localStorageMock.getItem.mockReturnValue(null); // Fresh start

        const { container } = render(ResizableColumn, {
            props: {
                storageKey: 'keyboard-right-test',
                width: 280,
                position: 'right',
            },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Press right arrow (for right position, should decrease width by 10px)
        await fireEvent.keyDown(resizeHandle!, { key: 'ArrowRight' });

        const column = container.querySelector(
            '.resizable-column'
        ) as HTMLElement;
        expect(column.style.width).toBe('270px');
    });

    it('should apply correct CSS classes for position', () => {
        const { container: leftContainer } = render(ResizableColumn, {
            props: { storageKey: 'test-column', position: 'left' },
        });

        const { container: rightContainer } = render(ResizableColumn, {
            props: { storageKey: 'test-column', position: 'right' },
        });

        const leftHandle = leftContainer.querySelector('.resize-handle');
        const rightHandle = rightContainer.querySelector('.resize-handle');

        expect(leftHandle?.classList.contains('resize-handle-left')).toBe(true);
        expect(rightHandle?.classList.contains('resize-handle-right')).toBe(
            true
        );
    });

    it('should apply dragging class during resize', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column' },
        });

        const resizeHandle = container.querySelector('.resize-handle');
        const column = container.querySelector('.resizable-column');

        // Start dragging
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        expect(resizeHandle?.classList.contains('dragging')).toBe(true);
        expect(column?.classList.contains('no-select')).toBe(true);

        // End dragging
        await fireEvent.mouseUp(document);

        expect(resizeHandle?.classList.contains('dragging')).toBe(false);
    });
});
