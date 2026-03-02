(function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { type: 'ACN_STATUS' }, function (response) {
      if (chrome.runtime.lastError || !response) {
        return;
      }

      document.getElementById('status-dot').classList.remove('inactive');
      document.getElementById('status-dot').classList.add('active');
      document.getElementById('status-text').textContent = response.state || 'Active';
      document.getElementById('platform').textContent = response.platform || '\u2014';
      document.getElementById('messages').textContent =
        response.messageCount != null ? String(response.messageCount) : '\u2014';
    });
  });
})();
