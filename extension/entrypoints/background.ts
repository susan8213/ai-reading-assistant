export default defineBackground(() => {
  // 每次 service worker 啟動都執行，確保全域預設為停用
  void chrome.sidePanel.setOptions({ enabled: false });
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    const tabId = tab.id;
    // 只為這個 tab 啟用 panel，其他 tab 維持停用
    await chrome.sidePanel.setOptions({ tabId, enabled: true, path: 'sidepanel.html' });
    await chrome.sidePanel.open({ tabId });
  });
});
