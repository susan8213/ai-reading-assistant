import { extractArticleContent, highlightText } from './utils/content';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === 'get_content') {
        const content = extractArticleContent()
        console.debug('[content] get_content', { contentLength: content.length })
        sendResponse({ content })
        return
      }

      if (message?.action === 'highlight') {
        const text = String(message?.text ?? '')
        const count = highlightText(text)
        console.debug('[content] highlight', {
          textLength: text.length,
          textPreview: text.slice(0, 80),
          matchedCount: count,
        })
        sendResponse({ ok: true, matchedCount: count })
      }
    })
  },
});
