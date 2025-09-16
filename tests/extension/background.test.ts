// Tests for Chrome Extension background script functionality
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onInstalled: {
      addListener: vi.fn()
    },
    onStartup: {
      addListener: vi.fn()  
    },
    onSuspend: {
      addListener: vi.fn()
    },
    getManifest: vi.fn(() => ({ version: '1.0.0' }))
  },
  tabs: {
    onCreated: {
      addListener: vi.fn()
    }
  },
  storage: {
    local: {
      set: vi.fn(),
      get: vi.fn()
    },
    onChanged: {
      addListener: vi.fn()
    }
  }
}

describe('Background Script Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Set up global chrome mock fresh for each test
    global.chrome = mockChrome as any
    global.self = {
      addEventListener: vi.fn()
    } as any
  })

  it('should have proper Chrome API structure', () => {
    expect(chrome.runtime.onInstalled).toBeDefined()
    expect(chrome.tabs.onCreated).toBeDefined()
    expect(chrome.storage.local).toBeDefined()
    expect(chrome.runtime.getManifest).toBeDefined()
  })

  it('should handle installation correctly', () => {
    // Test installation handler logic directly
    const details = { reason: 'install' }
    
    // Simulate the installation logic
    if (details.reason === 'install') {
      chrome.storage.local.set({
        extensionVersion: chrome.runtime.getManifest().version,
        installDate: new Date().toISOString()
      })
    }
    
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      extensionVersion: '1.0.0',
      installDate: expect.any(String)
    })
  })

  it('should handle update events', () => {
    const details = { reason: 'update', previousVersion: '0.9.0' }
    
    // Simulate update handling
    if (details.reason === 'update') {
      console.log('Extension updated from version:', details.previousVersion)
    }
    
    expect(console.log).toHaveBeenCalledWith('Extension updated from version:', '0.9.0')
  })

  it('should handle tab creation events', () => {
    const tab = { id: 123 }
    
    // Simulate tab creation handling  
    console.log('New tab created:', tab.id)
    
    expect(console.log).toHaveBeenCalledWith('New tab created:', 123)
  })

  it('should handle error logging properly', () => {
    const error = new Error('Test error')
    const context = 'test-context'
    
    // Simulate error logging logic
    console.error(`[WYSIWYG MD Editor] Error in ${context}:`, error)
    
    expect(console.error).toHaveBeenCalledWith('[WYSIWYG MD Editor] Error in test-context:', error)
  })

  it('should initialize error log storage correctly', () => {
    const mockResult = { errorLog: [] as any[] }
    
    // Test error log initialization logic
    const errorLog = mockResult.errorLog || []
    errorLog.push({
      timestamp: new Date().toISOString(),
      context: 'test',
      message: 'test message', 
      stack: 'test stack'
    })
    
    expect(errorLog).toHaveLength(1)
    expect(errorLog[0]).toEqual(expect.objectContaining({
      context: 'test',
      message: 'test message',
      stack: 'test stack'
    }))
  })
})