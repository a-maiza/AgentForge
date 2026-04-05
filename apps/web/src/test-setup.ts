// Polyfill browser APIs not available in jsdom

// ResizeObserver — required by @xyflow/react
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// DOMMatrix — required by @xyflow/react canvas transforms
if (typeof global.DOMMatrix === 'undefined') {
  // @ts-expect-error minimal stub
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }
  };
}

// SVGElement.getBBox — required by some @xyflow/react internals
if (typeof SVGElement !== 'undefined') {
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
}

// window.matchMedia — required by some UI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// IntersectionObserver stub
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;
