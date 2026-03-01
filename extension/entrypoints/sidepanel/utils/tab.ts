export const sendMessageToTab = async (tabId: number, message: unknown) => {
  return new Promise<any>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(response)
    })
  })
}

export const getActiveTab = async (): Promise<{ id: number; url?: string }> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id) {
    throw new Error('No active tab found')
  }

  return { id: tab.id, url: tab.url }
}
