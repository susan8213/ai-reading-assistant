import { extractArticleContent, highlightText } from './utils/content';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
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
