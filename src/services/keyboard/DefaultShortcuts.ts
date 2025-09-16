/**
 * Default keyboard shortcuts configuration
 * Platform-aware shortcuts (Cmd on Mac, Ctrl on Windows/Linux)
 */

export interface KeyboardShortcut {
  id: string;
  keys: string[]; // e.g., ['Ctrl', 'B'] or ['Cmd', 'B']
  command: string; // e.g., 'toggleBold'
  description: string; // User-facing description
  category: "formatting" | "navigation" | "editing";
  enabled: boolean;
  isDefault: boolean;
  platform?: "mac" | "windows" | "all";
}

export interface ShortcutConfiguration {
  id: string;
  shortcuts: Record<string, KeyboardShortcut>;
  lastModified: Date;
  version: string;
}

// Platform detection utility
const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? 'Cmd' : 'Ctrl';

export const DEFAULT_SHORTCUTS: Record<string, KeyboardShortcut> = {
  // Standard text formatting
  toggleBold: {
    id: 'toggleBold',
    keys: [modKey, 'b'],
    command: 'toggleBold',
    description: 'Toggle bold formatting',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  toggleItalic: {
    id: 'toggleItalic',
    keys: [modKey, 'i'],
    command: 'toggleItalic',
    description: 'Toggle italic formatting',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  toggleUnderline: {
    id: 'toggleUnderline',
    keys: [modKey, 'u'],
    command: 'toggleUnderline',
    description: 'Toggle underline formatting',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },

  // Heading shortcuts
  heading1: {
    id: 'heading1',
    keys: [modKey, 'Shift', '1'],
    command: 'setHeading1',
    description: 'Set heading level 1',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  heading2: {
    id: 'heading2',
    keys: [modKey, 'Shift', '2'],
    command: 'setHeading2',
    description: 'Set heading level 2',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  heading3: {
    id: 'heading3',
    keys: [modKey, 'Shift', '3'],
    command: 'setHeading3',
    description: 'Set heading level 3',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  heading4: {
    id: 'heading4',
    keys: [modKey, 'Shift', '4'],
    command: 'setHeading4',
    description: 'Set heading level 4',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  heading5: {
    id: 'heading5',
    keys: [modKey, 'Shift', '5'],
    command: 'setHeading5',
    description: 'Set heading level 5',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  heading6: {
    id: 'heading6',
    keys: [modKey, 'Shift', '6'],
    command: 'setHeading6',
    description: 'Set heading level 6',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },

  // List shortcuts
  bulletList: {
    id: 'bulletList',
    keys: [modKey, 'Shift', '8'],
    command: 'toggleBulletList',
    description: 'Toggle bullet list',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  orderedList: {
    id: 'orderedList',
    keys: [modKey, 'Shift', '7'],
    command: 'toggleOrderedList',
    description: 'Toggle numbered list',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },

  // Code formatting
  inlineCode: {
    id: 'inlineCode',
    keys: [modKey, 'Shift', 'c'],
    command: 'toggleInlineCode',
    description: 'Toggle inline code',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  codeBlock: {
    id: 'codeBlock',
    keys: [modKey, 'Shift', '`'],
    command: 'toggleCodeBlock',
    description: 'Toggle code block',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },

  // Link insertion
  insertLink: {
    id: 'insertLink',
    keys: [modKey, 'k'],
    command: 'insertLink',
    description: 'Insert or edit link',
    category: 'formatting',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },

  // Standard editing shortcuts (already implemented)
  undo: {
    id: 'undo',
    keys: [modKey, 'z'],
    command: 'undo',
    description: 'Undo last action',
    category: 'editing',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  redo: {
    id: 'redo',
    keys: [modKey, 'y'],
    command: 'redo',
    description: 'Redo last action',
    category: 'editing',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  redoAlt: {
    id: 'redoAlt',
    keys: [modKey, 'Shift', 'z'],
    command: 'redo',
    description: 'Redo last action (alternative)',
    category: 'editing',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },

  // Help shortcut
  showHelp: {
    id: 'showHelp',
    keys: [modKey, '/'],
    command: 'showHelp',
    description: 'Show keyboard shortcuts help',
    category: 'navigation',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
  showHelpAlt: {
    id: 'showHelpAlt',
    keys: ['F1'],
    command: 'showHelp',
    description: 'Show keyboard shortcuts help (F1)',
    category: 'navigation',
    enabled: true,
    isDefault: true,
    platform: 'all',
  },
};

export const createDefaultConfiguration = (): ShortcutConfiguration => ({
  id: 'default',
  shortcuts: DEFAULT_SHORTCUTS,
  lastModified: new Date(),
  version: '1.0.0',
});