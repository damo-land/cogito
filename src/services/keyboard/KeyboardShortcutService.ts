/**
 * Central keyboard shortcut management service
 * Handles shortcut registration, execution, and conflict detection
 */

import { EditorView } from 'prosemirror-view';
import { EditorState, Transaction } from 'prosemirror-state';
import { toggleMark, setBlockType } from 'prosemirror-commands';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { KeyboardShortcut, ShortcutConfiguration, createDefaultConfiguration } from './DefaultShortcuts';
import { keysToProseMirrorString, findShortcutConflicts, keysMatch, eventToKeys } from './ShortcutUtils';
import { simpleEditorSchema } from '../editor/SimpleEditorSchema';

export type ShortcutCommand = (view: EditorView) => boolean;
export type ShortcutEventCallback = (shortcutId: string, success: boolean) => void;

export class KeyboardShortcutService {
  private shortcuts: Record<string, KeyboardShortcut> = {};
  private commands: Record<string, ShortcutCommand> = {};
  private eventCallbacks: ShortcutEventCallback[] = [];
  private linkDialogCallback?: () => void;

  constructor() {
    this.loadDefaultShortcuts();
    this.registerDefaultCommands();
  }

  /**
   * Load default shortcuts configuration
   */
  private loadDefaultShortcuts(): void {
    const defaultConfig = createDefaultConfiguration();
    this.shortcuts = { ...defaultConfig.shortcuts };
  }

  /**
   * Register default ProseMirror commands for shortcuts
   */
  private registerDefaultCommands(): void {
    const { nodes, marks } = simpleEditorSchema;

    // Text formatting commands
    this.commands.toggleBold = (view: EditorView): boolean => {
      const command = toggleMark(marks.strong);
      return command(view.state, view.dispatch);
    };

    this.commands.toggleItalic = (view: EditorView): boolean => {
      const command = toggleMark(marks.em);
      return command(view.state, view.dispatch);
    };

    this.commands.toggleInlineCode = (view: EditorView): boolean => {
      const command = toggleMark(marks.code);
      return command(view.state, view.dispatch);
    };

    // Heading commands
    for (let level = 1; level <= 6; level++) {
      this.commands[`setHeading${level}`] = (view: EditorView): boolean => {
        const command = setBlockType(nodes.heading, { level });
        return command(view.state, view.dispatch);
      };
    }

    // List commands
    this.commands.toggleBulletList = (view: EditorView): boolean => {
      const command = wrapInList(nodes.bullet_list);
      return command(view.state, view.dispatch);
    };

    this.commands.toggleOrderedList = (view: EditorView): boolean => {
      const command = wrapInList(nodes.ordered_list);
      return command(view.state, view.dispatch);
    };

    // Code block command
    this.commands.toggleCodeBlock = (view: EditorView): boolean => {
      const command = setBlockType(nodes.code_block);
      return command(view.state, view.dispatch);
    };

    // Link command (requires external dialog)
    this.commands.insertLink = (view: EditorView): boolean => {
      if (this.linkDialogCallback) {
        this.linkDialogCallback();
        return true;
      }
      return false;
    };

    // Help command
    this.commands.showHelp = (view: EditorView): boolean => {
      // This will be handled by components
      this.notifyEventListeners('showHelp', true);
      return true;
    };

    // Note: undo/redo are handled by ProseMirror's history plugin
  }

  /**
   * Register a custom command
   */
  public registerCommand(commandId: string, command: ShortcutCommand): void {
    this.commands[commandId] = command;
  }

  /**
   * Register link dialog callback
   */
  public registerLinkDialog(callback: () => void): void {
    this.linkDialogCallback = callback;
  }

  /**
   * Get all shortcuts
   */
  public getShortcuts(): Record<string, KeyboardShortcut> {
    return { ...this.shortcuts };
  }

  /**
   * Get shortcuts by category
   */
  public getShortcutsByCategory(category: KeyboardShortcut['category']): KeyboardShortcut[] {
    return Object.values(this.shortcuts).filter(shortcut => shortcut.category === category);
  }

  /**
   * Find shortcut by key combination
   */
  public findShortcutByKeys(keys: string[]): KeyboardShortcut | null {
    return Object.values(this.shortcuts).find(shortcut =>
      keysMatch(shortcut.keys, keys) && shortcut.enabled
    ) || null;
  }

  /**
   * Update shortcut configuration
   */
  public updateShortcut(shortcutId: string, updates: Partial<KeyboardShortcut>): boolean {
    if (!this.shortcuts[shortcutId]) {
      return false;
    }

    this.shortcuts[shortcutId] = { ...this.shortcuts[shortcutId], ...updates };
    return true;
  }

  /**
   * Add custom shortcut
   */
  public addShortcut(shortcut: KeyboardShortcut): boolean {
    if (this.shortcuts[shortcut.id]) {
      return false; // Already exists
    }

    this.shortcuts[shortcut.id] = shortcut;
    return true;
  }

  /**
   * Remove shortcut
   */
  public removeShortcut(shortcutId: string): boolean {
    if (!this.shortcuts[shortcutId] || this.shortcuts[shortcutId].isDefault) {
      return false; // Cannot remove default shortcuts
    }

    delete this.shortcuts[shortcutId];
    return true;
  }

  /**
   * Check for conflicts in current configuration
   */
  public getConflicts(): Array<{ shortcut1: KeyboardShortcut; shortcut2: KeyboardShortcut }> {
    return findShortcutConflicts(this.shortcuts);
  }

  /**
   * Execute shortcut command
   */
  public executeShortcut(shortcutId: string, view: EditorView): boolean {
    const shortcut = this.shortcuts[shortcutId];
    if (!shortcut || !shortcut.enabled) {
      return false;
    }

    const command = this.commands[shortcut.command];
    if (!command) {
      console.warn(`Command not found for shortcut: ${shortcutId}`);
      return false;
    }

    try {
      const success = command(view);
      this.notifyEventListeners(shortcutId, success);
      return success;
    } catch (error) {
      console.error(`Error executing shortcut ${shortcutId}:`, error);
      this.notifyEventListeners(shortcutId, false);
      return false;
    }
  }

  /**
   * Handle keyboard event
   */
  public handleKeyboardEvent(event: KeyboardEvent, view: EditorView): boolean {
    const keys = eventToKeys(event);
    const shortcut = this.findShortcutByKeys(keys);

    if (shortcut) {
      event.preventDefault();
      return this.executeShortcut(shortcut.id, view);
    }

    return false;
  }

  /**
   * Generate ProseMirror keymap object
   */
  public generateProseMirrorKeymap(): Record<string, (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView) => boolean> {
    const keymap: Record<string, any> = {};

    Object.values(this.shortcuts).forEach(shortcut => {
      if (!shortcut.enabled) return;

      const proseMirrorKey = keysToProseMirrorString(shortcut.keys);
      const command = this.commands[shortcut.command];

      if (command) {
        keymap[proseMirrorKey] = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView) => {
          if (!view || !dispatch) return false;
          return command(view);
        };
      }
    });

    return keymap;
  }

  /**
   * Add event listener for shortcut executions
   */
  public addEventListener(callback: ShortcutEventCallback): () => void {
    this.eventCallbacks.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify event listeners
   */
  private notifyEventListeners(shortcutId: string, success: boolean): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(shortcutId, success);
      } catch (error) {
        console.error('Error in shortcut event callback:', error);
      }
    });
  }

  /**
   * Export configuration
   */
  public exportConfiguration(): ShortcutConfiguration {
    return {
      id: 'user',
      shortcuts: { ...this.shortcuts },
      lastModified: new Date(),
      version: '1.0.0',
    };
  }

  /**
   * Import configuration
   */
  public importConfiguration(config: ShortcutConfiguration): boolean {
    try {
      this.shortcuts = { ...config.shortcuts };
      return true;
    } catch (error) {
      console.error('Error importing shortcut configuration:', error);
      return false;
    }
  }

  /**
   * Reset to defaults
   */
  public resetToDefaults(): void {
    this.loadDefaultShortcuts();
  }
}

// Singleton instance
export const keyboardShortcutService = new KeyboardShortcutService();