// Tests for Chrome Extension manifest validation
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Chrome Extension Manifest', () => {
  let manifest: any
  
  beforeAll(() => {
    const manifestPath = resolve(__dirname, '../../src/extension/manifest.json')
    const manifestContent = readFileSync(manifestPath, 'utf-8')
    manifest = JSON.parse(manifestContent)
  })

  it('should be valid Manifest V3 format', () => {
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe('WYSIWYG Markdown Editor')
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(manifest.description).toBeTruthy()
  })

  it('should have required permissions', () => {
    expect(manifest.permissions).toContain('tabs')
    expect(manifest.permissions).toContain('storage')
    expect(manifest.permissions).toContain('activeTab')
  })

  it('should have new tab override configured', () => {
    expect(manifest.chrome_url_overrides).toBeDefined()
    expect(manifest.chrome_url_overrides.newtab).toBe('newtab.html')
  })

  it('should have background script configured', () => {
    expect(manifest.background).toBeDefined()
    expect(manifest.background.service_worker).toBe('background.js')
  })

  it('should have proper icons defined', () => {
    expect(manifest.icons).toBeDefined()
    expect(manifest.icons['16']).toBe('icons/icon16.png')
    expect(manifest.icons['48']).toBe('icons/icon48.png')
    expect(manifest.icons['128']).toBe('icons/icon128.png')
  })

  it('should have content security policy', () => {
    expect(manifest.content_security_policy).toBeDefined()
    expect(manifest.content_security_policy.extension_pages).toBeTruthy()
  })

  it('should have action popup configured', () => {
    expect(manifest.action).toBeDefined()
    expect(manifest.action.default_popup).toBe('popup/popup.html')
    expect(manifest.action.default_icon).toBeDefined()
  })
})