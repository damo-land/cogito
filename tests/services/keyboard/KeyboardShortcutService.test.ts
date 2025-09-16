/**
 * Tests for KeyboardShortcutService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcutService } from '../../../src/services/keyboard/KeyboardShortcutService';
import { DEFAULT_SHORTCUTS } from '../../../src/services/keyboard/DefaultShortcuts';

// Mock ProseMirror modules
vi.mock('prosemirror-view', () => ({
  EditorView: vi.fn(),
}));

vi.mock('prosemirror-state', () => ({
  EditorState: vi.fn(),
  Transaction: vi.fn(),
}));

vi.mock('prosemirror-commands', () => ({
  toggleMark: vi.fn(() => vi.fn()),
  setBlockType: vi.fn(() => vi.fn()),
}));

vi.mock('prosemirror-schema-list', () => ({
  wrapInList: vi.fn(() => vi.fn()),
}));

vi.mock('../../../src/services/editor/SimpleEditorSchema', () => ({
  simpleEditorSchema: {
    nodes: {
      heading: {},
      bullet_list: {},
      ordered_list: {},
      code_block: {},
    },
    marks: {
      strong: {},
      em: {},
      code: {},
    },
  },
}));

describe('KeyboardShortcutService', () => {
  let service: KeyboardShortcutService;
  let mockView: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh service instance
    service = new KeyboardShortcutService();
    
    // Mock EditorView
    mockView = {
      state: {
        doc: {},
        selection: { from: 0, to: 0 },
      },
      dispatch: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should load default shortcuts on creation', () => {
      const shortcuts = service.getShortcuts();
      
      expect(Object.keys(shortcuts)).toHaveLength(Object.keys(DEFAULT_SHORTCUTS).length);
      expect(shortcuts.toggleBold).toBeDefined();
      expect(shortcuts.toggleItalic).toBeDefined();
      expect(shortcuts.heading1).toBeDefined();
    });

    it('should register default commands', () => {
      const shortcuts = service.getShortcuts();
      
      // Verify essential shortcuts exist
      expect(shortcuts.toggleBold.command).toBe('toggleBold');
      expect(shortcuts.toggleItalic.command).toBe('toggleItalic');
      expect(shortcuts.insertLink.command).toBe('insertLink');
    });
  });

  describe('shortcut management', () => {
    it('should get shortcuts by category', () => {
      const formattingShortcuts = service.getShortcutsByCategory('formatting');
      const editingShortcuts = service.getShortcutsByCategory('editing');
      
      expect(formattingShortcuts.length).toBeGreaterThan(0);
      expect(editingShortcuts.length).toBeGreaterThan(0);
      
      // Check that shortcuts are properly categorized
      const boldShortcut = formattingShortcuts.find(s => s.id === 'toggleBold');
      expect(boldShortcut).toBeDefined();
      expect(boldShortcut?.category).toBe('formatting');
    });

    it('should find shortcuts by key combination', () => {
      const boldShortcut = service.findShortcutByKeys(['Ctrl', 'b']);
      const macBoldShortcut = service.findShortcutByKeys(['Cmd', 'b']);
      
      expect(boldShortcut?.command).toBe('toggleBold');
      expect(macBoldShortcut?.command).toBe('toggleBold');
    });

    it('should update existing shortcuts', () => {
      const success = service.updateShortcut('toggleBold', { enabled: false });
      
      expect(success).toBe(true);
      
      const updatedShortcut = service.getShortcuts().toggleBold;
      expect(updatedShortcut.enabled).toBe(false);
    });

    it('should not update non-existent shortcuts', () => {
      const success = service.updateShortcut('nonExistent', { enabled: false });
      
      expect(success).toBe(false);
    });

    it('should add custom shortcuts', () => {
      const customShortcut = {
        id: 'customCommand',
        keys: ['Ctrl', 'Shift', 'X'],
        command: 'customAction',
        description: 'Custom action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };

      const success = service.addShortcut(customShortcut);
      
      expect(success).toBe(true);
      expect(service.getShortcuts().customCommand).toEqual(customShortcut);
    });

    it('should not add shortcuts with duplicate IDs', () => {
      const duplicateShortcut = {
        id: 'toggleBold', // Existing ID
        keys: ['Ctrl', 'X'],
        command: 'customAction',
        description: 'Custom action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };

      const success = service.addShortcut(duplicateShortcut);
      
      expect(success).toBe(false);
    });

    it('should remove non-default shortcuts', () => {
      // First add a custom shortcut
      const customShortcut = {
        id: 'customCommand',
        keys: ['Ctrl', 'Shift', 'X'],
        command: 'customAction',
        description: 'Custom action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };

      service.addShortcut(customShortcut);
      
      const removeSuccess = service.removeShortcut('customCommand');
      expect(removeSuccess).toBe(true);
      expect(service.getShortcuts().customCommand).toBeUndefined();
    });

    it('should not remove default shortcuts', () => {
      const success = service.removeShortcut('toggleBold');
      
      expect(success).toBe(false);
      expect(service.getShortcuts().toggleBold).toBeDefined();
    });
  });

  describe('conflict detection', () => {
    it('should detect shortcut conflicts', () => {
      // Add a conflicting shortcut
      const conflictingShortcut = {
        id: 'conflictTest',
        keys: ['Ctrl', 'b'], // Same as toggleBold
        command: 'conflictAction',
        description: 'Conflicting action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };

      service.addShortcut(conflictingShortcut);
      
      const conflicts = service.getConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
      
      const boldConflict = conflicts.find(
        c => c.shortcut1.id === 'toggleBold' || c.shortcut2.id === 'toggleBold'
      );
      expect(boldConflict).toBeDefined();
    });

    it('should not report conflicts for disabled shortcuts', () => {
      // Disable bold shortcut
      service.updateShortcut('toggleBold', { enabled: false });
      
      // Add potentially conflicting shortcut
      const shortcut = {
        id: 'noConflictTest',
        keys: ['Ctrl', 'b'],
        command: 'noConflictAction',
        description: 'No conflict action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };

      service.addShortcut(shortcut);
      
      const conflicts = service.getConflicts();
      const boldConflict = conflicts.find(
        c => (c.shortcut1.id === 'toggleBold' && c.shortcut2.id === 'noConflictTest') ||
             (c.shortcut1.id === 'noConflictTest' && c.shortcut2.id === 'toggleBold')
      );
      
      expect(boldConflict).toBeUndefined();
    });
  });

  describe('command execution', () => {
    it('should execute shortcuts successfully', () => {
      const mockCommand = vi.fn().mockReturnValue(true);
      service.registerCommand('testCommand', mockCommand);
      
      // Add test shortcut
      const testShortcut = {
        id: 'testShortcut',
        keys: ['Ctrl', 'T'],
        command: 'testCommand',
        description: 'Test action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };
      
      service.addShortcut(testShortcut);
      
      const success = service.executeShortcut('testShortcut', mockView);
      
      expect(success).toBe(true);
      expect(mockCommand).toHaveBeenCalledWith(mockView);
    });

    it('should not execute disabled shortcuts', () => {
      service.updateShortcut('toggleBold', { enabled: false });
      
      const success = service.executeShortcut('toggleBold', mockView);
      
      expect(success).toBe(false);
    });

    it('should not execute shortcuts without commands', () => {
      const testShortcut = {
        id: 'noCommandShortcut',
        keys: ['Ctrl', 'N'],
        command: 'nonExistentCommand',
        description: 'No command action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };
      
      service.addShortcut(testShortcut);
      
      const success = service.executeShortcut('noCommandShortcut', mockView);
      
      expect(success).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should handle keyboard events correctly', () => {
      const mockCommand = vi.fn().mockReturnValue(true);
      service.registerCommand('toggleBold', mockCommand);
      
      // Create mock keyboard event
      const mockEvent = {
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'b',
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;
      
      const handled = service.handleKeyboardEvent(mockEvent, mockView);
      
      expect(handled).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not handle unmatched keyboard events', () => {
      const mockEvent = {
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'x', // Not mapped to any shortcut
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;
      
      const handled = service.handleKeyboardEvent(mockEvent, mockView);
      
      expect(handled).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('prosemirror keymap generation', () => {
    it('should generate valid prosemirror keymap', () => {
      const keymap = service.generateProseMirrorKeymap();
      
      expect(keymap).toBeDefined();
      expect(typeof keymap).toBe('object');
      
      // Check for some expected keys
      expect(keymap['Mod-b']).toBeDefined(); // Bold
      expect(keymap['Mod-i']).toBeDefined(); // Italic
      expect(keymap['Mod-Shift-1']).toBeDefined(); // Heading 1
    });

    it('should not include disabled shortcuts in keymap', () => {
      service.updateShortcut('toggleBold', { enabled: false });
      
      const keymap = service.generateProseMirrorKeymap();
      
      expect(keymap['Mod-b']).toBeUndefined();
    });
  });

  describe('event listeners', () => {
    it('should notify event listeners on shortcut execution', () => {
      const mockListener = vi.fn();
      const cleanup = service.addEventListener(mockListener);
      
      const mockCommand = vi.fn().mockReturnValue(true);
      service.registerCommand('testCommand', mockCommand);
      
      const testShortcut = {
        id: 'eventTestShortcut',
        keys: ['Ctrl', 'E'],
        command: 'testCommand',
        description: 'Event test action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };
      
      service.addShortcut(testShortcut);
      service.executeShortcut('eventTestShortcut', mockView);
      
      expect(mockListener).toHaveBeenCalledWith('eventTestShortcut', true);
      
      // Test cleanup
      cleanup();
      service.executeShortcut('eventTestShortcut', mockView);
      
      // Should only be called once (before cleanup)
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration management', () => {
    it('should export configuration', () => {
      const config = service.exportConfiguration();
      
      expect(config.id).toBe('user');
      expect(config.shortcuts).toBeDefined();
      expect(config.lastModified).toBeInstanceOf(Date);
      expect(config.version).toBeDefined();
    });

    it('should import configuration', () => {
      const customConfig = {
        id: 'test',
        shortcuts: {
          customShortcut: {
            id: 'customShortcut',
            keys: ['Ctrl', 'Z'],
            command: 'customCommand',
            description: 'Custom command',
            category: 'editing' as const,
            enabled: true,
            isDefault: false,
          },
        },
        lastModified: new Date(),
        version: '1.0.0',
      };
      
      const success = service.importConfiguration(customConfig);
      
      expect(success).toBe(true);
      expect(service.getShortcuts().customShortcut).toBeDefined();
    });

    it('should reset to defaults', () => {
      // Add custom shortcut
      const customShortcut = {
        id: 'customCommand',
        keys: ['Ctrl', 'X'],
        command: 'customAction',
        description: 'Custom action',
        category: 'editing' as const,
        enabled: true,
        isDefault: false,
      };
      
      service.addShortcut(customShortcut);
      expect(service.getShortcuts().customCommand).toBeDefined();
      
      // Reset to defaults
      service.resetToDefaults();
      
      expect(service.getShortcuts().customCommand).toBeUndefined();
      expect(service.getShortcuts().toggleBold).toBeDefined();
    });
  });
});