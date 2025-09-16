// Background script for Cogito Chrome Extension

// Extension installation and update handling
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Cogito installed:', details.reason);
  
  if (details.reason === 'install') {
    console.log('Extension installed for the first time');
    // Initialize default settings if needed
    chrome.storage.local.set({
      extensionVersion: chrome.runtime.getManifest().version,
      installDate: new Date().toISOString()
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated from version:', details.previousVersion);
  }
});

// Tab management for new tab override
chrome.tabs.onCreated.addListener((tab) => {
  console.log('New tab created:', tab.id);
  // Additional tab initialization logic can be added here
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome startup - Cogito ready');
});

// Error handling
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending');
});

// Storage change monitoring
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', namespace, changes);
});

// Basic error logging
const logError = (error: Error, context: string) => {
  console.error(`[Cogito] Error in ${context}:`, error);
  // Store error info for debugging
  chrome.storage.local.get(['errorLog'], (result) => {
    const errorLog = result.errorLog || [];
    errorLog.push({
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack
    });
    // Keep only last 50 errors
    if (errorLog.length > 50) {
      errorLog.splice(0, errorLog.length - 50);
    }
    chrome.storage.local.set({ errorLog });
  });
};

// Global error handler
self.addEventListener('error', (event) => {
  logError(new Error(event.message), 'global');
});

self.addEventListener('unhandledrejection', (event) => {
  logError(new Error(event.reason), 'unhandled-promise');
});

console.log('Cogito background script loaded');