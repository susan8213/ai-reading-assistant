export const extractArticleContent = (): string => {
  const element =
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.body

  const text = element?.innerText ?? element?.textContent ?? ''
  return text.trim()
}

export const highlightText = (text: string): void => {
  if (!text.trim()) {
    return
  }

  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(escaped, 'gi')

  document.body.innerHTML = document.body.innerHTML.replace(
    pattern,
    '<mark class="ai-highlight">$&</mark>',
  )
}
