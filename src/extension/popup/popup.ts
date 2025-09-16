// Popup script for cogito Chrome Extension

document.addEventListener('DOMContentLoaded', () => {
  const openNewTabButton = document.getElementById('openNewTab');
  
  if (openNewTabButton) {
    openNewTabButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://newtab/' });
      window.close();
    });
  }
  
  // Display extension status
  chrome.storage.local.get(['extensionVersion'], (result) => {
    if (result.extensionVersion) {
      console.log('Extension version:', result.extensionVersion);
    }
  });
});