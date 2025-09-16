/**
 * React hook for keyboard shortcut integration
 */

import { useEffect, useMemo, useCallback } from 'react';
import { keyboardShortcutService, ShortcutEventCallback } from '../services/keyboard/KeyboardShortcutService';
import { KeyboardShortcut } from '../services/keyboard/DefaultShortcuts';

interface UseKeyboardShortcutsOptions {
  onShortcutExecuted?: ShortcutEventCallback;
  enableGlobalListening?: boolean;
}

interface UseKeyboardShortcutsReturn {
  shortcuts: Record<string, KeyboardShortcut>;
  shortcutsByCategory: (category: KeyboardShortcut['category']) => KeyboardShortcut[];
  executeShortcut: (shortcutId: string, view?: any) => boolean;
  findShortcutByKeys: (keys: string[]) => KeyboardShortcut | null;
  conflicts: Array<{ shortcut1: KeyboardShortcut; shortcut2: KeyboardShortcut }>;
  updateShortcut: (shortcutId: string, updates: Partial<KeyboardShortcut>) => boolean;
  resetToDefaults: () => void;
}

/**
 * Hook for integrating keyboard shortcuts in components
 */
export const useKeyboardShortcuts = (
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn => {
  const { onShortcutExecuted, enableGlobalListening = false } = options;

  // Get current shortcuts (this will be static for now, but could be made reactive)
  const shortcuts = useMemo(() => {
    return keyboardShortcutService.getShortcuts();
  }, []);

  // Get conflicts
  const conflicts = useMemo(() => {
    return keyboardShortcutService.getConflicts();
  }, [shortcuts]);

  // Register event listener
  useEffect(() => {
    if (onShortcutExecuted) {
      const cleanup = keyboardShortcutService.addEventListener(onShortcutExecuted);
      return cleanup;
    }
  }, [onShortcutExecuted]);

  // Global keyboard listener (optional)
  useEffect(() => {
    if (!enableGlobalListening) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not in an input field (unless it's our editor)
      const target = event.target as HTMLElement;
      const isEditorContent = target.closest('.editor-content') !== null;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

      if (isInputField && !isEditorContent) {
        return;
      }

      // Handle global shortcuts (like help)
      const keys = eventToKeys(event);
      const shortcut = keyboardShortcutService.findShortcutByKeys(keys);

      if (shortcut && ['showHelp'].includes(shortcut.command)) {
        event.preventDefault();
        keyboardShortcutService.executeShortcut(shortcut.id, null as any);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableGlobalListening]);

  // Helper functions
  const shortcutsByCategory = useCallback((category: KeyboardShortcut['category']) => {
    return keyboardShortcutService.getShortcutsByCategory(category);
  }, []);

  const executeShortcut = useCallback((shortcutId: string, view?: any) => {
    return keyboardShortcutService.executeShortcut(shortcutId, view);
  }, []);

  const findShortcutByKeys = useCallback((keys: string[]) => {
    return keyboardShortcutService.findShortcutByKeys(keys);
  }, []);

  const updateShortcut = useCallback((shortcutId: string, updates: Partial<KeyboardShortcut>) => {
    return keyboardShortcutService.updateShortcut(shortcutId, updates);
  }, []);

  const resetToDefaults = useCallback(() => {
    keyboardShortcutService.resetToDefaults();
  }, []);

  return {
    shortcuts,
    shortcutsByCategory,
    executeShortcut,
    findShortcutByKeys,
    conflicts,
    updateShortcut,
    resetToDefaults,
  };
};

// Helper function to convert keyboard event to key array (duplicated here for hook use)
function eventToKeys(event: KeyboardEvent): string[] {
  const keys: string[] = [];
  
  // Detect platform
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? 'Cmd' : 'Ctrl';
  
  // Add modifiers in consistent order
  if (event.ctrlKey || event.metaKey) {
    keys.push(modKey);
  }
  
  if (event.shiftKey) {
    keys.push('Shift');
  }
  
  if (event.altKey) {
    keys.push('Alt');
  }
  
  // Add the main key
  if (event.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    keys.push(event.key);
  }
  
  return keys;
}