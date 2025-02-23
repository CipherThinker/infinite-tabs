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

// Function to create tab element
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab-card';
  
  // For YouTube URLs, fetch the video title
  const youtubeMatch = tab.url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
  let displayTitle = tab.title;

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

  // Add click handler to open the tab and remove it from the list
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
