'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('start');
  const statusEl = document.getElementById('status');

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const setLoading = (isLoading) => {
    startButton.disabled = isLoading;
    startButton.textContent = isLoading ? 'Running…' : 'Run Auto-Connect';
  };

  const updateFromResult = (result) => {
    if (!result) {
      setStatus('No response from the page. Make sure you are on LinkedIn.');
      return;
    }

    if (result.status === 'already_running') {
      setStatus('Auto-connect is already running on this page.');
    } else if (result.status === 'completed') {
      const summary = `Invitations sent: ${result.sent}. Log file: ${result.filename}. Logged entries: ${result.totalLogged}.`;
      setStatus(`Done! ${summary}`);
    } else if (result.status === 'error') {
      setStatus(`Error: ${result.message}`);
    } else {
      setStatus('Started! Check the page console for live progress.');
    }
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'AUTO_CONNECT_RESULT') {
      setLoading(false);
      updateFromResult(message.result || { status: 'error', message: message.error });
    }
  });

  startButton.addEventListener('click', () => {
    setLoading(true);
    setStatus('Checking the active tab…');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const [tab] = tabs || [];
      if (!tab?.id) {
        setLoading(false);
        setStatus('No active tab found.');
        return;
      }

      if (!/^https?:\/\/([a-zA-Z0-9-]+\.)*linkedin\.com\//.test(tab.url || '')) {
        setLoading(false);
        setStatus('Please open a linkedin.com page with Connect buttons and try again.');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'RUN_AUTO_CONNECT' }, (response) => {
        if (chrome.runtime.lastError) {
          setLoading(false);
          setStatus('Could not inject into this page. Please open LinkedIn and try again.');
          return;
        }

        setStatus('Starting… Watch the page console for updates.');

        if (response?.result) {
          updateFromResult(response.result);
          if (response.result.status !== 'started') {
            setLoading(false);
          }
        } else {
          setLoading(false);
          setStatus('No response from the page. Make sure you are on LinkedIn.');
        }
      });
    });
  });
});
