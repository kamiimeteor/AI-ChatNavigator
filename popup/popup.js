(function () {
  var status = document.getElementById('status-text');
  function safeSendMessage(tabId, message, callback) {
    chrome.tabs.sendMessage(tabId, message, function (response) {
      var error = chrome.runtime.lastError;
      callback(error ? null : response);
    });
  }
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (chrome.runtime.lastError || !tabs[0]) { status.textContent = 'No active tab'; return; }
    var tabId = tabs[0].id;
    safeSendMessage(tabId, { type: 'ACN_STATUS' }, function (response) {
      if (!response) {
        status.textContent = 'Open a supported chat, or refresh this tab';
        return;
      }
      var descriptions = {
        READY: 'Ready · loaded prompts only', LOADING: 'Chat is loading',
        EMPTY: 'No prompts yet', ERROR: 'Unable to read chat · use Retry',
        UNSUPPORTED: 'This page is not supported'
      };
      status.textContent = descriptions[response.state] || 'Refresh this tab';
      document.getElementById('status-dot').classList.toggle('active', response.state === 'READY');
      document.getElementById('status-dot').classList.toggle('inactive', response.state !== 'READY');
      document.getElementById('platform').textContent = response.platform || '—';
      document.getElementById('messages').textContent = String(response.messageCount || 0);
      if (response.platform) safeSendMessage(tabId, { type: 'ACN_SHOW_SIDEBAR' }, function () {});
    });
  });
})();
