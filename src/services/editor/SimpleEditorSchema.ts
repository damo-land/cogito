import { Schema } from 'prosemirror-model';
import { nodes, marks } from 'prosemirror-schema-basic';
import { listItem, bulletList, orderedList } from 'prosemirror-schema-list';

export const simpleEditorSchema = new Schema({
  nodes: {
    doc: nodes.doc,
    paragraph: nodes.paragraph,
    text: nodes.text,
    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM: (node) => [`h${node.attrs.level}`, 0],
    },
    blockquote: nodes.blockquote,
    code_block: {
      ...nodes.code_block,
      attrs: { 
        ...nodes.code_block.attrs,
        language: { default: null }
      },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (node) => ({
            language: (node as Element).getAttribute('data-language') || null
          })
        }
      ],
      toDOM: (node) => [
        'pre',
        node.attrs.language ? { 'data-language': node.attrs.language } : {},
        ['code', 0]
      ],
    },
    hard_break: nodes.hard_break,
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: () => ['hr'],
    },
    
    // List nodes from prosemirror-schema-list
    bullet_list: {
      ...bulletList,
      content: 'list_item+',
      group: 'block',
    },
    ordered_list: {
      ...orderedList,
      content: 'list_item+',
      group: 'block',
    },
    list_item: {
      ...listItem,
      content: 'paragraph block*',
    },
    task_list: {
      content: 'task_list_item+',
      group: 'block',
      parseDOM: [{ 
        tag: 'ul[data-type="taskList"]',
        priority: 60  // Higher priority than regular bullet_list
      }],
      toDOM: () => ['ul', { 'data-type': 'taskList' }, 0],
    },
    task_list_item: {
      content: 'paragraph block*',
      attrs: { checked: { default: false } },
      defining: true,
      parseDOM: [
        {
          tag: 'li[data-type="taskItem"]',
          priority: 60,  // Higher priority than regular list_item
          getAttrs: (node) => ({
            checked: (node as Element).getAttribute('data-checked') === 'true',
          }),
        },
      ],
      toDOM: (node) => [
        'li',
        { 
          'data-type': 'taskItem',
          'data-checked': node.attrs.checked ? 'true' : 'false',
          class: node.attrs.checked ? 'task-item-checked' : 'task-item-unchecked'
        },
        0,
      ],
    },
  },
  marks: {
    strong: marks.strong,
    em: marks.em,
    code: marks.code,
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (node) => ({
            href: (node as Element).getAttribute('href'),
            title: (node as Element).getAttribute('title'),
          }),
        },
      ],
      toDOM: (node) => [
        'a',
        {
          ...node.attrs,
          rel: 'noopener noreferrer nofollow',
        },
        0,
      ],
    },
  },
});

export default simpleEditorSchema;