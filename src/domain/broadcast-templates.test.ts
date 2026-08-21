import { describe, expect, it } from 'vitest'
import {
  BROADCAST_LANGUAGES,
  BROADCAST_TEMPLATES,
  renderAllLanguages,
  renderTemplate,
  templatesFor,
} from './broadcast-templates'

describe('the template catalogue', () => {
  it('carries every template in every supported language', () => {
    for (const template of BROADCAST_TEMPLATES) {
      for (const language of BROADCAST_LANGUAGES) {
        const text = template.text[language.code]
        expect(text, `${template.id} is missing ${language.code}`).toBeTruthy()
        expect(text.length).toBeGreaterThan(10)
      }
    }
  })

  it('gives every template a place slot to fill in every language', () => {
    // A translation that dropped the slot would broadcast a location-less alert.
    for (const template of BROADCAST_TEMPLATES) {
      for (const language of BROADCAST_LANGUAGES) {
        expect(template.text[language.code], `${template.id}/${language.code}`).toContain('{place}')
      }
    }
  })

  it('uses unique ids', () => {
    const ids = BROADCAST_TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('renderTemplate', () => {
  it('fills the place slot', () => {
    const fire = BROADCAST_TEMPLATES.find((template) => template.id === 'fire-evacuate')!
    expect(renderTemplate(fire, 'en', 'Block C')).toBe(
      'FIRE at Block C. Evacuate immediately by the nearest stairwell. Do not use lifts.',
    )
  })

  it('leaves no unfilled placeholder in any language', () => {
    for (const template of BROADCAST_TEMPLATES) {
      for (const language of BROADCAST_LANGUAGES) {
        expect(renderTemplate(template, language.code, 'Block C')).not.toContain('{place}')
      }
    }
  })

  it('renders non-Latin scripts intact', () => {
    const fire = BROADCAST_TEMPLATES.find((template) => template.id === 'fire-evacuate')!
    expect(renderTemplate(fire, 'hi', 'Block C')).toContain('आग')
    expect(renderTemplate(fire, 'or', 'Block C')).toContain('ନିଆଁ')
  })
})

describe('renderAllLanguages', () => {
  it('joins one message covering every language', () => {
    const fire = BROADCAST_TEMPLATES.find((template) => template.id === 'fire-evacuate')!
    const combined = renderAllLanguages(fire, 'Block C')

    expect(combined).toContain('FIRE at Block C')
    expect(combined).toContain('आग')
    expect(combined).toContain('ନିଆଁ')
    expect(combined).not.toContain('{place}')
  })
})

describe('templatesFor', () => {
  it('puts the matching category first', () => {
    expect(templatesFor('fire')[0].id).toBe('fire-evacuate')
    expect(templatesFor('medical')[0].id).toBe('medical-clear-route')
  })

  it('never hides a template, because the dispatcher may know better', () => {
    expect(templatesFor('other')).toHaveLength(BROADCAST_TEMPLATES.length)
  })

  it('ranks general-purpose templates above unrelated ones', () => {
    const ranked = templatesFor('fire').map((template) => template.category)
    expect(ranked.indexOf('general')).toBeLessThan(ranked.lastIndexOf('medical'))
  })
})
