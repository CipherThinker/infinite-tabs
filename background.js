// Initialize storage and context menu
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage
  chrome.storage.local.get(['tabs', 'proStatus'], function(result) {
    if (!result.tabs) {
      chrome.storage.local.set({ tabs: [] });
    }
    if (result.proStatus === undefined) {
      chrome.storage.local.set({ proStatus: false });
    }
  });

  // Create context menu
  chrome.contextMenus.create({
    id: 'storeTab',
    title: 'Save to Infinite Tabs',
    contexts: ['page', 'link']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'storeTab') {
    if (info.linkUrl) {
      storeNewTab(info.linkUrl);
    } else {
      storeTab(tab);
    }
  }
});

// Listen for commands (keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'store-current-tab') {
    storeCurrentTab();
  }
});

// Function to store current tab
async function storeCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // For YouTube URLs, fetch the video title first
    let title = tab.title;
    const youtubeMatch = tab.url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
    if (youtubeMatch) {
      try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeMatch[1]}`);
        const data = await response.json();
        if (data.title) {
          title = data.title;
        }
      } catch (error) {
        console.error('Error fetching YouTube title:', error);
      }
    }

    const tabData = {
      id: Date.now(),
      title: title,
      url: tab.url,
      favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}`,
      timestamp: new Date().toISOString()
    };

    // Get existing stored tabs
    const result = await chrome.storage.local.get(['tabs']);
    const tabs = result.tabs || [];
    
    // Check free version limit (11 tabs)
    const isPro = await checkProStatus();
    if (!isPro && tabs.length >= 11) {
      chrome.runtime.sendMessage({
        type: 'ERROR',
        message: 'Free version limit reached. Upgrade to Pro for unlimited tabs.'
      });
      return;
    }

    // Add new tab to beginning of list
    tabs.unshift(tabData);
    await chrome.storage.local.set({ tabs });

    // Send success message
    chrome.tabs.sendMessage(tab.id, { type: 'showSuccess' });
    
    // Notify all tabs about the update
    chrome.runtime.sendMessage({ type: 'REFRESH_TABS' });
  } catch (error) {
    console.error('Error storing tab:', error);
    chrome.runtime.sendMessage({
      type: 'ERROR',
      message: 'Failed to save tab. Please try again.'
    });
  }
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'storeTab') {
    storeCurrentTab();
  }
  return true;
});

// Store a new tab from URL
async function storeNewTab(url) {
  try {
    const tabData = {
      id: Date.now(),
      title: url.split('/').pop() || url,
      url: url,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`,
      timestamp: Date.now()
    };

    // Get existing stored tabs
    const result = await chrome.storage.local.get('tabs');
    const tabs = result.tabs || [];
    
    // Check free version limit (11 tabs)
    const isPro = await checkProStatus();
    if (!isPro && tabs.length >= 11) {
      chrome.runtime.sendMessage({
        type: 'ERROR',
        message: 'Free version limit reached. Upgrade to Pro for unlimited tabs.'
      });
      return;
    }

    // Add new tab to beginning of list
    tabs.unshift(tabData);
    await chrome.storage.local.set({ tabs });
    
    // Notify about the update
    chrome.runtime.sendMessage({ type: 'REFRESH_TABS' });
  } catch (error) {
    console.error('Store New Tab Error:', error);
    chrome.runtime.sendMessage({
      type: 'ERROR',
      message: 'Failed to save tab. Please try again.'
    });
  }
}

// Store existing tab
async function storeTab(tab) {
  try {
    const tabData = {
      id: Date.now(),
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}`,
      timestamp: Date.now()
    };

    // Get existing stored tabs
    const result = await chrome.storage.local.get('tabs');
    const tabs = result.tabs || [];
    
    // Check free version limit (11 tabs)
    const isPro = await checkProStatus();
    if (!isPro && tabs.length >= 11) {
      chrome.runtime.sendMessage({
        type: 'ERROR',
        message: 'Free version limit reached. Upgrade to Pro for unlimited tabs.'
      });
      return;
    }

    // Add new tab to beginning of list
    tabs.unshift(tabData);
    await chrome.storage.local.set({ tabs });
    
    // Notify about the update
    chrome.runtime.sendMessage({ type: 'REFRESH_TABS' });
  } catch (error) {
    console.error('Store Tab Error:', error);
    chrome.runtime.sendMessage({
      type: 'ERROR',
      message: 'Failed to save tab. Please try again.'
    });
  }
}

// Check Pro status
async function checkProStatus() {
  try {
    const result = await chrome.storage.local.get('proStatus');
    return result.proStatus || false;
  } catch (error) {
    console.error('Pro Status Check Error:', error);
    return false;
  }
}
