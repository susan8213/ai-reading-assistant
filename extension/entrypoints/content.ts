export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const extractArticleContent = () => {
      const element =
        document.querySelector('article') ??
        document.querySelector('main') ??
        document.body

      return element?.innerText?.trim() ?? ''
    }

    const highlightText = (text: string) => {
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

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === 'get_content') {
        sendResponse({ content: extractArticleContent() })
        return
      }

      if (message?.action === 'highlight') {
        highlightText(String(message?.text ?? ''))
        sendResponse({ ok: true })
      }
    })
  },
});
