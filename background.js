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

// Function to fetch page title
async function fetchPageTitle(url) {
  try {
    // For YouTube videos
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
    if (youtubeMatch) {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeMatch[1]}`);
      const data = await response.json();
      return data.title || null;
    }
    
    // For Facebook
    if (url.includes('facebook.com')) {
      const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (data.title) {
        // Clean up Facebook title (remove " | Facebook" suffix)
        return data.title.replace(/ \| Facebook$/, '');
      }
    }
    
    // For other websites, try to fetch the title using noembed
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    return data.title || null;
  } catch (error) {
    console.error('Error fetching page title:', error);
    return null;
  }
}

// Function to clean up title
function cleanupTitle(url, title) {
  if (!title) return url;

  // Handle Zillow listings
  if (url.includes('zillow.com')) {
    // Try to extract address from title first
    let displayTitle = title
      .replace(' | ZillowÂ®', '')
      .replace(' | Zillow', '')
      .replace(' For Sale', '')
      .replace(' Recently Sold', '')
      .replace(' | Home Details', '')
      .trim();

    // If title is just a zipcode, contains just numbers, or is too short
    if (/^\d{5}/.test(displayTitle) || /^\d+$/.test(displayTitle) || displayTitle.length < 10) {
      // For search results pages, show "Homes for Sale in {zipcode}"
      if (url.includes('/homes/') || url.includes('/_pagination/')) {
        const zipMatch = title.match(/\b\d{5}\b/);
        if (zipMatch) {
          return `Homes for Sale in ${zipMatch[0]}`;
        }
      }

      // For property detail pages, try to get full address
      if (url.includes('/homedetails/')) {
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/');
          const addressIndex = pathParts.indexOf('homedetails') + 1;
          
          if (addressIndex > 0 && addressIndex < pathParts.length) {
            // Get the address part and clean it up
            let address = pathParts[addressIndex];
            
            // Remove any trailing IDs or zpid
            address = address.replace(/_zpid.*$/, '').replace(/\d+$/, '');
            
            // Convert dashes to spaces and capitalize
            address = address
              .split('-')
              .map(word => {
                // Keep abbreviations like "NW", "SE" uppercase
                if (word.length <= 2) return word.toUpperCase();
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
              })
              .join(' ');

            // Only use if it looks like a real address
            if (address.length > 5 && /\d+.*[A-Za-z]/.test(address)) {
              return address;
            }
          }
        } catch (error) {
          console.error('Error parsing Zillow URL:', error);
        }
      }
    }

    // If we couldn't get a better title, use the cleaned original title
    // but make sure it's not just a URL
    if (!displayTitle.includes('zillow.com') && displayTitle.length > 5) {
      return displayTitle;
    }

    // Fallback for search pages
    if (url.includes('/homes/')) {
      return 'Zillow Home Search';
    }

    // Final fallback
    return 'Zillow Property';
  }

  if (url.includes('facebook.com')) {
    // For Facebook URLs, try to use the original title first
    let cleanTitle = title
      .replace(/ \| Facebook$/, '')
      .replace(/\([0-9]+\)/, '')
      .replace(/Facebook -/, '')
      .replace(/- Facebook$/, '')
      .replace(/\?__cft__\[.*$/, '')
      .trim();

    // If the title looks like a number or is too short, try to extract from URL
    if (/^\d+$/.test(cleanTitle) || cleanTitle.length < 3) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        
        // Skip numeric IDs and common Facebook paths
        const validParts = pathParts.filter(part => 
          !/^\d+$/.test(part) && // Skip numeric IDs
          !['watch', 'posts', 'photos', 'videos'].includes(part) // Skip common Facebook paths
        );

        if (validParts.length > 0) {
          let name = validParts[validParts.length - 1];
          // Remove any query parameters or trailing parts
          name = name.split('?')[0].split('&')[0];
          // Convert dots and dashes to spaces
          name = name.replace(/[.-]/g, ' ');
          // Handle camelCase
          name = name.replace(/([A-Z])/g, ' $1').trim();
          // Capitalize words
          name = name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          return name;
        }
      } catch (error) {
        console.error('Error parsing Facebook URL:', error);
      }
    }

    return cleanTitle;
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return title.replace(/ - YouTube$/, '').trim();
  }

  // For other websites, remove common suffixes
  return title
    .replace(/\s*[-|]\s*(.*?)$/, '')
    .trim();
}

// Function to store current tab
async function storeCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // For YouTube videos, fetch title
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
    } else {
      // For non-YouTube URLs, clean up the title
      title = cleanupTitle(tab.url, tab.title);
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
