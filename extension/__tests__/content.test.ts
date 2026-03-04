import { beforeEach, describe, expect, it } from 'vitest'
import { extractArticleContent, highlightText } from '../entrypoints/utils/content'

describe('extractArticleContent', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('prefers article content', () => {
    document.body.innerHTML = '<article>Article body</article><main>Main body</main>'
    expect(extractArticleContent()).toBe('Article body')
  })

  it('falls back to main and then body', () => {
    document.body.innerHTML = '<main>Main body</main>'
    expect(extractArticleContent()).toBe('Main body')

    document.body.innerHTML = '<div>Body fallback</div>'
    expect(extractArticleContent()).toContain('Body fallback')
  })
})

describe('highlightText', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('wraps matched text with mark element', () => {
    document.body.innerHTML = '<p>This is important text here.</p>'
    highlightText('important text')

    expect(document.body.innerHTML).toContain('<mark class="ai-highlight">important text</mark>')
  })

  it('leaves DOM unchanged when text is empty or not found', () => {
    document.body.innerHTML = '<p>Some content</p>'
    const before = document.body.innerHTML

    highlightText('')
    highlightText('nonexistent')

    expect(document.body.innerHTML).toBe(before)
  })

  it('highlights text even when sentence spans nested HTML tags', () => {
    document.body.innerHTML = '<p>This is <strong>important</strong> text in article.</p>'

    const count = highlightText('important text')

    expect(count).toBe(1)
    expect(document.querySelectorAll('mark.ai-highlight')).toHaveLength(1)
    expect(document.body.textContent).toContain('important text')
  })

  it('highlights text containing special symbols', () => {
    document.body.innerHTML = '<p>Attention (Q&A) [v2.0] is critical.</p>'

    const count = highlightText('Attention (Q&A) [v2.0]')

    expect(count).toBe(1)
    expect(document.querySelector('mark.ai-highlight')?.textContent).toBe('Attention (Q&A) [v2.0]')
  })
})
