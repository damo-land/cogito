// Test setup file
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock Chrome extension APIs globally
global.chrome = {
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    onSuspend: { addListener: vi.fn() },
    getManifest: vi.fn(() => ({ version: '1.0.0' })),
    id: 'test-extension-id'
  },
  tabs: {
    onCreated: { addListener: vi.fn() },
    create: vi.fn()
  },
  storage: {
    local: {
      set: vi.fn(),
      get: vi.fn()
    },
    onChanged: { addListener: vi.fn() }
  },
  management: {
    getAll: vi.fn(() => Promise.resolve([]))
  }
} as any

// Mock global self for service worker context
global.self = {
  addEventListener: vi.fn()
} as any

// Mock performance API for jsdom
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    memory: {
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 15000000,
      jsHeapSizeLimit: 50000000
    }
  }
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));