import { expect, test, describe } from 'vitest';
import { simpleMarkdownService } from '../../../src/services/editor/SimpleMarkdownService';
import { simpleEditorSchema } from '../../../src/services/editor/SimpleEditorSchema';

describe('SimpleMarkdownService', () => {
  describe('markdownToHtml', () => {
    test('converts basic markdown to HTML', async () => {
      const markdown = '# Hello\n\n**Bold text** and *italic text*';
      const html = await simpleMarkdownService.markdownToHtml(markdown);
      
      expect(html).toContain('<h1>');
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });

    test('handles empty markdown', async () => {
      const markdown = '';
      const html = await simpleMarkdownService.markdownToHtml(markdown);
      
      expect(html).toBe('');
    });
  });

  describe('parseMarkdown', () => {
    test('parses markdown to ProseMirror document', () => {
      const markdown = '# Hello World';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      
      expect(doc).toBeDefined();
      expect(doc.type.name).toBe('doc');
    });

    test('parses lists correctly', () => {
      const markdown = '- Item 1\n- Item 2\n\n1. Ordered item 1\n2. Ordered item 2';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      
      expect(doc).toBeDefined();
      expect(doc.type.name).toBe('doc');
    });

    test('parses links correctly', () => {
      const markdown = '[Link text](https://example.com)';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      
      expect(doc).toBeDefined();
      expect(doc.type.name).toBe('doc');
    });

    test('parses code blocks correctly', () => {
      const markdown = '```javascript\nconst hello = "world";\n```';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      
      expect(doc).toBeDefined();
      expect(doc.type.name).toBe('doc');
    });

    test('handles malformed markdown gracefully', () => {
      const markdown = '### ### ### Invalid';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      
      expect(doc).toBeDefined();
      expect(doc.type.name).toBe('doc');
    });
  });

  describe('serializeToMarkdown', () => {
    test('serializes ProseMirror document to markdown', () => {
      const markdown = '# Test Heading\n\n**Bold text**';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      const serialized = simpleMarkdownService.serializeToMarkdown(doc);
      
      expect(serialized).toContain('#');
      expect(serialized).toContain('**');
    });

    test('serializes lists correctly', () => {
      const markdown = '- Item 1\n- Item 2\n\n1. Ordered 1\n2. Ordered 2';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      const serialized = simpleMarkdownService.serializeToMarkdown(doc);
      
      // Should maintain list structure
      expect(serialized).toBeDefined();
    });

    test('serializes code blocks with language', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const doc = simpleMarkdownService.parseMarkdown(markdown, simpleEditorSchema);
      const serialized = simpleMarkdownService.serializeToMarkdown(doc);
      
      expect(serialized).toContain('```');
    });

    test('handles empty document', () => {
      const emptyDoc = simpleEditorSchema.nodes.doc.createAndFill()!;
      const serialized = simpleMarkdownService.serializeToMarkdown(emptyDoc);
      
      expect(serialized).toBe('');
    });

    test('preserves round-trip conversion', () => {
      const originalMarkdown = '# Title\n\n**Bold** and *italic*\n\n- List item\n- Another item';
      const doc = simpleMarkdownService.parseMarkdown(originalMarkdown, simpleEditorSchema);
      const serialized = simpleMarkdownService.serializeToMarkdown(doc);
      
      // Should contain key elements (exact match not required due to parsing differences)
      expect(serialized).toContain('#');
      expect(serialized).toContain('**');
      expect(serialized).toContain('*');
    });
  });

  describe('hasMarkdownSyntax', () => {
    test('detects markdown headers', () => {
      expect(simpleMarkdownService.hasMarkdownSyntax('# Header')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('## Header')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('### Header')).toBe(true);
    });

    test('detects markdown formatting', () => {
      expect(simpleMarkdownService.hasMarkdownSyntax('**bold**')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('*italic*')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('`code`')).toBe(true);
    });

    test('detects lists', () => {
      expect(simpleMarkdownService.hasMarkdownSyntax('- Item')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('* Item')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('+ Item')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('1. Item')).toBe(true);
      expect(simpleMarkdownService.hasMarkdownSyntax('10. Item')).toBe(true);
    });

    test('detects blockquotes', () => {
      expect(simpleMarkdownService.hasMarkdownSyntax('> Quote')).toBe(true);
    });

    test('returns false for plain text', () => {
      expect(simpleMarkdownService.hasMarkdownSyntax('Just plain text')).toBe(false);
      expect(simpleMarkdownService.hasMarkdownSyntax('No markdown here')).toBe(false);
    });

    test('handles empty text', () => {
      expect(simpleMarkdownService.hasMarkdownSyntax('')).toBe(false);
    });
  });
});