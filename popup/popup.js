// Function to load and display tabs
async function loadTabs() {
  try {
    const { tabs } = await chrome.storage.local.get(['tabs']);
    const tabList = document.getElementById('tabList');
    tabList.innerHTML = ''; // Clear existing content

    if (!tabs || tabs.length === 0) {
      tabList.innerHTML = `
        <div class="empty-state">
          <p>No tabs saved yet</p>
          <p class="empty-hint">Use Ctrl+Shift+S or right-click to save tabs</p>
        </div>
      `;
      return;
    }

    tabs.forEach(tab => {
      const tabElement = createTabElement(tab);
      tabList.appendChild(tabElement);
    });

    // Add mouse move effect for the glow
    const cards = document.querySelectorAll('.tab-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / card.offsetWidth) * 100;
        const y = ((e.clientY - rect.top) / card.offsetHeight) * 100;
        
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      });
    });
  } catch (error) {
    console.error('Error loading tabs:', error);
  }
}

// Function to clean up title
function cleanupTitle(url, title) {
  if (!title) return url;

  // Handle Zillow listings
  if (url.includes('zillow.com')) {
    // Try to extract address from URL for property pages
    if (url.includes('/homedetails/')) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const addressIndex = pathParts.indexOf('homedetails') + 1;
        
        if (addressIndex > 0 && addressIndex < pathParts.length) {
          // Extract address parts before the zpid
          let address = pathParts[addressIndex].split('_zpid')[0];
          
          // Replace dashes with spaces and handle state codes
          address = address
            .split('-')
            .map(word => {
              // Keep state codes and directionals uppercase
              if (word.length === 2 && /^[A-Z]{2}$/i.test(word)) {
                return word.toUpperCase();
              }
              if (['NW', 'SW', 'NE', 'SE'].includes(word.toUpperCase())) {
                return word.toUpperCase();
              }
              // Capitalize first letter of other words
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');

          // Try to extract price and details from title
          let details = '';
          if (title) {
            const priceMatch = title.match(/\$[\d,]+/);
            const bedBathMatch = title.match(/(\d+)\s*bed(?:room)?s?\s*(\d+(?:\.5)?)\s*bath/i);
            
            if (priceMatch) details += priceMatch[0] + ' - ';
            if (bedBathMatch) {
              details += `${bedBathMatch[1]} bed ${bedBathMatch[2]} bath - `;
            }
          }

          return details + address;
        }
      } catch (error) {
        console.error('Error parsing Zillow URL:', error);
      }
    }

    // For search results pages
    if (url.includes('/homes/') || title.includes('Real Estate')) {
      const zipMatch = title.match(/\b\d{5}\b/);
      if (zipMatch) {
        return `Homes for Sale in ${zipMatch[0]}`;
      }
    }
  }

  // Handle LinkedIn
  if (url.includes('linkedin.com')) {
    let cleanTitle = title.replace(' | LinkedIn', '').trim();
    
    // Profile pages
    if (url.includes('/in/')) {
      // Keep just the name and title/company
      cleanTitle = cleanTitle.split(' - ').slice(0, 2).join(' - ');
    }
    
    // Job postings
    if (url.includes('/jobs/')) {
      if (!cleanTitle.includes('Job')) {
        cleanTitle += ' - Job Posting';
      }
    }

    return cleanTitle;
  }

  // Handle Medium and other blog platforms
  if (url.includes('medium.com') || title.includes(' | by ')) {
    return title
      .replace(/\s*\|\s*by\s+[^|]+$/, '') // Remove author
      .replace(/\s*\|\s*Medium$/, '')      // Remove Medium suffix
      .trim();
  }

  // Handle Facebook
  if (url.includes('facebook.com')) {
    let cleanTitle = title
      .replace(' | Facebook', '')
      .replace(/\([0-9]+\)/, '')     // Remove notification numbers
      .replace(/Facebook -/, '')
      .replace(/- Facebook$/, '')
      .replace(/\?__cft__\[.*$/, '') // Remove tracking parameters
      .trim();

    // Handle different Facebook page types
    if (url.includes('/groups/')) {
      if (!cleanTitle.includes('Group')) {
        cleanTitle = 'Post in ' + cleanTitle;
      }
    } else if (url.includes('/watch/')) {
      if (!cleanTitle.includes('Video')) {
        cleanTitle = 'Video: ' + cleanTitle;
      }
    }

    return cleanTitle;
  }

  // Handle YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return title.replace(/ - YouTube$/, '').trim();
  }

  // Handle Google Docs/Sheets/Slides
  if (url.includes('docs.google.com')) {
    let type = '';
    if (url.includes('/document/')) type = 'Doc';
    else if (url.includes('/spreadsheets/')) type = 'Sheet';
    else if (url.includes('/presentation/')) type = 'Slides';
    
    let cleanTitle = title.replace(/\s*-\s*Google (Docs|Sheets|Slides)$/, '').trim();
    return type ? `${cleanTitle} (Google ${type})` : cleanTitle;
  }

  // Handle GitHub
  if (url.includes('github.com')) {
    return title
      .replace(' · GitHub', '')
      .replace(' · Pull Request #', ' PR #')
      .replace(' · Issue #', ' Issue #')
      .trim();
  }

  // Handle Stack Overflow
  if (url.includes('stackoverflow.com')) {
    return title.replace(' - Stack Overflow', '').trim();
  }

  // For other websites, remove common suffixes but keep site name for context
  let cleanTitle = title.replace(/\s*[-|]\s*.*$/, '').trim();
  
  // If title became too short, keep original without common suffixes
  if (cleanTitle.length < 10) {
    cleanTitle = title
      .replace(/ \| .*$/, '')
      .replace(/ - .*$/, '')
      .replace(/\s*[-|]\s*.*$/, '')
      .trim();
  }

  return cleanTitle;
}

// Function to create tab element
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab-card';
  
  // For YouTube URLs, fetch the video title
  const youtubeMatch = tab.url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
  let displayTitle = cleanupTitle(tab.url, tab.title);

  // For Facebook watch URLs, try to get a better title
  if (tab.url.includes('facebook.com/watch')) {
    displayTitle = 'Facebook Video';
    // Try to get the video title from the page title
    if (tab.title && !tab.title.includes('watch') && !tab.title.includes('facebook.com')) {
      displayTitle = cleanupTitle(tab.url, tab.title);
    }
  }

  if (youtubeMatch) {
    // Show loading state
    displayTitle = 'Loading...';
    // Fetch YouTube title
    fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeMatch[1]}`)
      .then(response => response.json())
      .then(data => {
        if (data.title) {
          const titleElement = tabElement.querySelector('.tab-title');
          titleElement.textContent = data.title;
        }
      })
      .catch(error => {
        console.error('Error fetching YouTube title:', error);
        const titleElement = tabElement.querySelector('.tab-title');
        titleElement.textContent = displayTitle;
      });
  }

  tabElement.innerHTML = `
    <div class="favicon-container">
      <img src="${tab.favicon || 'https://www.google.com/s2/favicons?domain=' + new URL(tab.url).hostname}" 
           class="favicon" 
           alt="favicon"
           onerror="this.src='https://www.google.com/s2/favicons?domain=' + new URL('${tab.url}').hostname">
    </div>
    <div class="tab-title">
      ${displayTitle}
      <span class="domain-text">${new URL(tab.url).hostname}</span>
    </div>
  `;

  // Add click handler to open the tab and remove it
  tabElement.addEventListener('click', async () => {
    // First create the new tab
    await chrome.tabs.create({ url: tab.url });
    
    // Then remove the item from storage
    const { tabs } = await chrome.storage.local.get(['tabs']);
    const updatedTabs = tabs.filter(t => t.id !== tab.id);
    await chrome.storage.local.set({ tabs: updatedTabs });
    
    // Refresh the list
    loadTabs();
  });

  // Add right-click handler to remove the tab
  tabElement.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const { tabs } = await chrome.storage.local.get(['tabs']);
    const updatedTabs = tabs.filter(t => t.id !== tab.id);
    await chrome.storage.local.set({ tabs: updatedTabs });
    loadTabs(); // Refresh the list
  });

  return tabElement;
}

// Function to check Pro status
async function checkProStatus() {
  const { proStatus } = await chrome.storage.local.get(['proStatus']);
  return proStatus || false;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load initial tabs
  loadTabs();

  // Set up Pro button
  const proButton = document.getElementById('proButton');
  const isPro = await checkProStatus();
  
  if (isPro) {
    proButton.textContent = '✨ Pro';
    proButton.classList.add('pro-active');
  } else {
    proButton.textContent = '✨ Upgrade to Pro';
  }

  proButton.addEventListener('click', () => {
    // Open Pro upgrade page
    chrome.tabs.create({ url: 'https://infinite-tabs.com/pro' });
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.tabs) {
      loadTabs();
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REFRESH_TABS') {
      loadTabs();
    }
    if (message.type === 'ERROR') {
      showError(message.message);
    }
    sendResponse({ received: true });
    return true;
  });
});

// Function to show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #666;
  }
  
  .empty-hint {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 8px;
  }

  .pro-active {
    background: linear-gradient(45deg, #FFD700, #FFA500) !important;
  }

  .error-message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: linear-gradient(45deg, #FF1B6B, #45CAFF);
    color: white;
    border-radius: 8px;
    font-size: 14px;
    animation: fadeInOut 3s ease-in-out;
    z-index: 9999;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-20px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);
