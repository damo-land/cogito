/**
 * Utility functions for keyboard shortcut handling
 */

import { KeyboardShortcut } from './DefaultShortcuts';

// Platform detection
export const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
export const isWindows = typeof window !== 'undefined' && /Win/.test(navigator.platform);

/**
 * Get the modifier key for the current platform
 */
export const getModifierKey = (): string => {
  return isMac ? 'Cmd' : 'Ctrl';
};

/**
 * Convert key array to display string
 * Example: ['Ctrl', 'Shift', 'B'] -> "Ctrl+Shift+B"
 */
export const keysToDisplayString = (keys: string[]): string => {
  return keys.map(key => {
    // Normalize key display for better UX
    switch (key) {
      case 'Cmd': return isMac ? '⌘' : 'Cmd';
      case 'Ctrl': return isMac ? 'Ctrl' : 'Ctrl';
      case 'Shift': return isMac ? '⇧' : 'Shift';
      case 'Alt': return isMac ? '⌥' : 'Alt';
      case 'Meta': return isMac ? '⌘' : 'Win';
      default: return key;
    }
  }).join(isMac ? '' : '+');
};

/**
 * Convert key array to ProseMirror keymap string
 * Example: ['Ctrl', 'b'] -> "Ctrl-b" or ['Cmd', 'Shift', '1'] -> "Cmd-Shift-1"
 */
export const keysToProseMirrorString = (keys: string[]): string => {
  return keys.map(key => {
    // Normalize for ProseMirror
    switch (key) {
      case 'Cmd': return 'Mod';
      case 'Ctrl': return 'Mod';
      default: return key;
    }
  }).join('-');
};

/**
 * Parse keyboard event to key combination array
 */
export const eventToKeys = (event: KeyboardEvent): string[] => {
  const keys: string[] = [];
  
  // Add modifiers in consistent order
  if (event.ctrlKey || event.metaKey) {
    keys.push(getModifierKey());
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
};

/**
 * Check if two key combinations match
 */
export const keysMatch = (keys1: string[], keys2: string[]): boolean => {
  if (keys1.length !== keys2.length) return false;
  
  // Normalize both arrays
  const normalize = (keys: string[]): string[] => {
    return keys.map(key => {
      switch (key) {
        case 'Cmd':
        case 'Ctrl': return 'Mod';
        default: return key.toLowerCase();
      }
    }).sort();
  };
  
  const normalized1 = normalize(keys1);
  const normalized2 = normalize(keys2);
  
  return normalized1.every((key, index) => key === normalized2[index]);
};

/**
 * Check if shortcut is valid for current platform
 */
export const isShortcutValidForPlatform = (shortcut: KeyboardShortcut): boolean => {
  if (!shortcut.platform || shortcut.platform === 'all') {
    return true;
  }
  
  if (shortcut.platform === 'mac' && !isMac) {
    return false;
  }
  
  if (shortcut.platform === 'windows' && isMac) {
    return false;
  }
  
  return true;
};

/**
 * Detect conflicts between shortcuts
 */
export const findShortcutConflicts = (shortcuts: Record<string, KeyboardShortcut>): Array<{
  shortcut1: KeyboardShortcut;
  shortcut2: KeyboardShortcut;
}> => {
  const conflicts: Array<{ shortcut1: KeyboardShortcut; shortcut2: KeyboardShortcut }> = [];
  const shortcutList = Object.values(shortcuts).filter(s => s.enabled);
  
  for (let i = 0; i < shortcutList.length; i++) {
    for (let j = i + 1; j < shortcutList.length; j++) {
      const shortcut1 = shortcutList[i];
      const shortcut2 = shortcutList[j];
      
      if (keysMatch(shortcut1.keys, shortcut2.keys) &&
          isShortcutValidForPlatform(shortcut1) &&
          isShortcutValidForPlatform(shortcut2)) {
        conflicts.push({ shortcut1, shortcut2 });
      }
    }
  }
  
  return conflicts;
};

/**
 * Generate a unique shortcut suggestion that doesn't conflict
 */
export const suggestAlternativeShortcut = (
  baseKeys: string[], 
  existingShortcuts: Record<string, KeyboardShortcut>
): string[] => {
  const modifiers = [
    [getModifierKey()],
    [getModifierKey(), 'Shift'],
    [getModifierKey(), 'Alt'],
    [getModifierKey(), 'Shift', 'Alt'],
  ];
  
  const lastKey = baseKeys[baseKeys.length - 1];
  
  for (const modifierSet of modifiers) {
    const candidateKeys = [...modifierSet, lastKey];
    const hasConflict = Object.values(existingShortcuts).some(shortcut =>
      keysMatch(candidateKeys, shortcut.keys) && shortcut.enabled
    );
    
    if (!hasConflict) {
      return candidateKeys;
    }
  }
  
  // If no alternatives found, return original
  return baseKeys;
};