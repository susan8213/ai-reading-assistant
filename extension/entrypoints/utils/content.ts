export const extractArticleContent = (): string => {
  const element =
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.body

  const text = element?.innerText ?? element?.textContent ?? ''
  return text.trim()
}

type TextNodeRange = {
  node: Text
  start: number
  end: number
}

const IGNORED_PARENT_TAGS = new Set(['script', 'style', 'noscript'])

const shouldIgnoreTextNode = (node: Text): boolean => {
  const parent = node.parentElement
  if (!parent) {
    return true
  }

  if (parent.closest('mark.ai-highlight')) {
    return true
  }

  return IGNORED_PARENT_TAGS.has(parent.tagName.toLowerCase())
}

const collectSearchableTextNodeRanges = (): TextNodeRange[] => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const ranges: TextNodeRange[] = []

  let cursor = 0
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    const value = node.nodeValue

    if (!shouldIgnoreTextNode(node) && value) {
      const start = cursor
      const end = cursor + value.length
      ranges.push({ node, start, end })
      cursor = end
    }

    current = walker.nextNode()
  }

  return ranges
}

const findRangeInfoAt = (ranges: TextNodeRange[], position: number): TextNodeRange | undefined => {
  return ranges.find((item) => position >= item.start && position < item.end)
}

const findFirstMatchRange = (query: string): Range | null => {
  const textNodes = collectSearchableTextNodeRanges()

  if (textNodes.length === 0) {
    return null
  }

  const wholeText = textNodes.map((item) => item.node.nodeValue ?? '').join('')
  const index = wholeText.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  if (index === -1) {
    return null
  }

  const matchStart = index
  const matchEnd = index + query.length

  const startInfo = findRangeInfoAt(textNodes, matchStart)
  const endInfo = textNodes.find((item) => matchEnd > item.start && matchEnd <= item.end)
  if (!startInfo || !endInfo) {
    return null
  }

  const range = document.createRange()
  range.setStart(startInfo.node, matchStart - startInfo.start)
  range.setEnd(endInfo.node, matchEnd - endInfo.start)
  return range
}

export const highlightText = (text: string): number => {
  const query = text.trim()
  if (!query) {
    return 0
  }

  let count = 0
  while (true) {
    const range = findFirstMatchRange(query)
    if (!range) {
      break
    }

    const mark = document.createElement('mark')
    mark.className = 'ai-highlight'
    const fragment = range.extractContents()
    mark.appendChild(fragment)
    range.insertNode(mark)

    count += 1
  }

  return count
}
