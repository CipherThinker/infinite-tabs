// Track key states
let ctrlPressed = false;
let shiftPressed = false;

// Update key states
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') ctrlPressed = true;
  if (e.key === 'Shift') shiftPressed = true;
  updateLinkStyles();
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Control') ctrlPressed = false;
  if (e.key === 'Shift') shiftPressed = false;
  updateLinkStyles();
});

// Clear key states when window loses focus
window.addEventListener('blur', () => {
  ctrlPressed = false;
  shiftPressed = false;
  updateLinkStyles();
});

// Listen for Ctrl+Click
document.addEventListener('click', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'storeTab' });
  }
});

// Handle link clicks (Ctrl+Shift+Click)
document.addEventListener('click', async (e) => {
  const link = e.target.closest('a');
  if (link && ctrlPressed && shiftPressed) {
    e.preventDefault();
    e.stopPropagation();
    
    const url = link.href;
    if (!url || url.startsWith('javascript:')) return;

    createTransferAnimation(e.clientX, e.clientY);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'STORE_NEW_TAB',
        url: url,
        title: formatTabTitle(url, link.textContent)
      });

      if (response && response.success) {
        link.classList.add('infinite-tabs-success');
        setTimeout(() => {
          link.classList.remove('infinite-tabs-success');
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to store tab:', error);
    }
  }
});

// Format tab titles
function formatTabTitle(url, title) {
  if (!title || title.trim() === '') {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const pathSegment = urlObj.pathname.split('/')[1];
      return `${domain}${pathSegment ? ` / ${pathSegment}` : ''}`;
    } catch {
      return 'Untitled Tab';
    }
  }
  
  return title
    .replace(/\s*\|.*$/, '')
    .replace(/\s*-.*$/, '')
    .replace(/\s*•.*$/, '')
    .trim();
}

// Show success animation
function showSuccessAnimation() {
  const successElement = document.createElement('div');
  successElement.className = 'infinite-tabs-success';
  document.body.appendChild(successElement);

  setTimeout(() => {
    successElement.remove();
  }, 1000);
}

// Add visual feedback for tab transfer
function createTransferAnimation(x, y) {
  const element = document.createElement('div');
  element.className = 'infinite-tabs-transfer-effect';
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  document.body.appendChild(element);

  setTimeout(() => element.remove(), 1000);
}

// Update all link styles based on key states
function updateLinkStyles() {
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    if (ctrlPressed && shiftPressed) {
      link.style.cursor = 'grab';
      link.style.background = 'linear-gradient(45deg, rgba(255, 27, 107, 0.1), rgba(69, 202, 255, 0.1))';
    } else {
      link.style.cursor = '';
      link.style.background = '';
    }
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ERROR') {
    console.error(message.message);
  }
  if (message.type === 'showSuccess') {
    showSuccessAnimation();
  }
  sendResponse({ received: true });
  return true;
});
