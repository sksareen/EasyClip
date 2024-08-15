// Debounce function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  // Create and inject clipboard drawer and overlay
  function createClipboardElements() {
    const drawer = document.createElement('div');
    drawer.id = 'easyclip-drawer';
    drawer.innerHTML = `
      <div id="easyclip-handle">
        <span>EasyClip</span>
        <button id="easyclip-close">×</button>
      </div>
      <div id="easyclip-content">
        <input type="text" id="easyclip-search" placeholder="Search clipboard items...">
        <div class="easyclip-filter">
          <button data-type="all" class="active">All</button>
          <button data-type="text">Text</button>
          <button data-type="image">Images</button>
          <button data-type="link">Links</button>
          <button data-type="file">Files</button>
        </div>
        <button id="easyclip-clear-all">Clear All</button>
        <div id="easyclip-items"></div>
      </div>
    `;
    document.body.appendChild(drawer);
  
    const overlay = document.createElement('div');
    overlay.id = 'easyclip-overlay';
    overlay.innerHTML = '<div>Drop here to add to EasyClip</div>';
    document.body.appendChild(overlay);
    
    // Add external CSS file
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('styles.css');
    document.head.appendChild(link);
  
    setupEventListeners();
    console.log('EasyClip: Clipboard elements created');
  }
  
  function setupEventListeners() {
    const drawer = document.getElementById('easyclip-drawer');
    const handle = drawer.querySelector('#easyclip-handle');
    let isDragging = false;
    let startY, startTop;

    document.addEventListener('keydown', (e) => {
        // Check for Ctrl+Shift+L (Windows/Linux) or Cmd+Shift+L (Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
          e.preventDefault(); // Prevent default browser behavior
          toggleClipboardDrawer();
        }
      });
  
    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      startTop = parseInt(window.getComputedStyle(drawer).top);
    });
  
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const newTop = startTop + e.clientY - startY;
        drawer.style.top = `${Math.max(0, Math.min(newTop, window.innerHeight - drawer.offsetHeight))}px`;
      }
    });
  
    document.addEventListener('mouseup', () => isDragging = false);
  
    document.addEventListener('click', (e) => {
      if (drawer.classList.contains('open') && !drawer.contains(e.target)) {
        toggleClipboardDrawer();
      }
    });
  
    document.getElementById('easyclip-close').addEventListener('click', toggleClipboardDrawer);
  
    const searchInput = document.getElementById('easyclip-search');
    searchInput.addEventListener('input', debounce(updateClipboardContent, 300));
  
    const filterButtons = drawer.querySelectorAll('.easyclip-filter button');
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        updateClipboardContent();
      });
    });
  
    document.getElementById('easyclip-clear-all').addEventListener('click', () => {
      chrome.runtime.sendMessage({action: "clearClipboard"}, updateClipboardContent);
    });
  
    // Handle copy events
    document.addEventListener('copy', () => {
      chrome.runtime.sendMessage({action: "copyDetected"});
      console.log('EasyClip: Copy event detected');
    });
  
    // Handle drag and drop
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', handleDrop);
  
    // Handle mouse hover for drawer opening
    document.addEventListener('mousemove', handleMouseMove);
    
  }
  
  let updateInterval;
  
  function startRealtimeUpdates() {
    updateInterval = setInterval(updateClipboardContent, 2000);
  }
  
  function stopRealtimeUpdates() {
    clearInterval(updateInterval);
  }
  
  function toggleClipboardDrawer() {
    const drawer = document.getElementById('easyclip-drawer');
    const overlay = document.getElementById('easyclip-overlay');
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) {
      updateClipboardContent();
      overlay.style.display = 'none';
      startRealtimeUpdates();
    } else {
      overlay.style.display = 'block';
      stopRealtimeUpdates();
    }
    console.log('EasyClip: Clipboard drawer toggled');
  }
  
  async function updateClipboardContent() {
    const content = document.getElementById('easyclip-items');
    content.innerHTML = 'Loading...';
    
    try {
      const items = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({action: "getClipboardItems"}, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
  
      const searchTerm = document.getElementById('easyclip-search').value.toLowerCase();
      const activeFilter = document.querySelector('.easyclip-filter button.active').dataset.type;
  
      const filteredItems = items.filter(item => {
        const matchesSearch = item.content.toLowerCase().includes(searchTerm);
        const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
        return matchesSearch && matchesFilter;
      });
  
      content.innerHTML = filteredItems.map(item => `
        <div class="easyclip-item" draggable="true" data-content="${encodeURIComponent(JSON.stringify(item))}">
          ${item.type === 'image' ? `<img src="${item.content}" alt="Clipboard image">` : ''}
          <div class="easyclip-item-content">
            ${getItemDisplayContent(item)}
            <div class="easyclip-item-date">${getRelativeDate(item.timestamp)}</div>
          </div>
          <button class="easyclip-remove-item" data-timestamp="${item.timestamp}">×</button>
        </div>
      `).join('');
  
      attachItemListeners();
    } catch (error) {
      console.error('Error updating clipboard content:', error);
      content.innerHTML = 'Error loading clipboard items';
    }
  }
  
  function getItemDisplayContent(item) {
    switch (item.type) {
      case 'text':
        return item.content.substring(0, 50) + (item.content.length > 50 ? '...' : '');
      case 'link':
        return `<a href="${item.content}" target="_blank">${item.content}</a>`;
      case 'image':
        return 'Image';
      case 'file':
        return 'File: ' + (item.name || 'Unknown');
      default:
        return item.type;
    }
  }
  
  function getRelativeDate(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    if (diffDays <= 1) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays <= 3) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  function attachItemListeners() {
    document.querySelectorAll('.easyclip-item').forEach((item, index, items) => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('easyclip-remove-item')) {
          const itemData = JSON.parse(decodeURIComponent(item.dataset.content));
          copyToClipboard(itemData);
        }
      });
  
      item.addEventListener('dragstart', (e) => {
        const itemData = JSON.parse(decodeURIComponent(item.dataset.content));
        e.dataTransfer.setData('text/plain', JSON.stringify(itemData));
      });
  
      item.querySelector('.easyclip-remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        const timestamp = parseInt(e.target.dataset.timestamp);
        chrome.runtime.sendMessage({action: "removeClipboardItem", timestamp}, updateClipboardContent);
      });
  
      // Keyboard navigation
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const itemData = JSON.parse(decodeURIComponent(item.dataset.content));
          copyToClipboard(itemData);
        } else if (e.key === 'ArrowDown' && index < items.length - 1) {
          items[index + 1].focus();
        } else if (e.key === 'ArrowUp' && index > 0) {
          items[index - 1].focus();
        }
      });
    });
  }
  
  async function copyToClipboard(itemData) {
    try {
      if (itemData.type === 'text' || itemData.type === 'link') {
        await navigator.clipboard.writeText(itemData.content);
      } else if (itemData.type === 'image') {
        const response = await fetch(itemData.content);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      }
      showNotification('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      showNotification('Failed to copy', true);
    }
  }
  
  function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: ${isError ? '#f44336' : '#4CAF50'};
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease';
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
  
  function handleDrop(e) {
    e.preventDefault();
    const drawer = document.getElementById('easyclip-drawer');
    const overlay = document.getElementById('easyclip-overlay');
  
    if (!drawer.contains(e.target) && !overlay.contains(e.target)) {
      const data = e.dataTransfer.getData('text/plain');
      if (data) {
        try {
          const itemData = JSON.parse(data);
          chrome.runtime.sendMessage({action: "addToClipboard", ...itemData});
        } catch (error) {
          // If parsing fails, treat as plain text
          chrome.runtime.sendMessage({action: "addToClipboard", content: data, type: 'text'});
        }
      } else {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              chrome.runtime.sendMessage({
                action: "addToClipboard",
                content: event.target.result,
                type: file.type.startsWith('image/') ? 'image' : 'file',
                name: file.name
              });
            };
            reader.readAsDataURL(file);
          });
        }
      }
    }
  }
  
  let hoverTimer;
  function handleMouseMove(e) {
    const drawer = document.getElementById('easyclip-drawer');
    const overlay = document.getElementById('easyclip-overlay');
    
    if (e.clientX >= window.innerWidth - 50) { // 50px wide hover area
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (e.clientX >= window.innerWidth - 50) {
          if (!drawer.classList.contains('open')) {
            toggleClipboardDrawer();
          }
        }
      }, 500);  // 0.5 second delay
      overlay.style.opacity = '1';
    } else {
      clearTimeout(hoverTimer);
      if (!drawer.classList.contains('open')) {
        overlay.style.opacity = '0';
      }
    }
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleClipboard") {
      toggleClipboardDrawer();
    } else if (request.action === "refreshClipboard") {
      updateClipboardContent();
    } else if (request.action === "itemAdded" || request.action === "itemRemoved") {
      updateClipboardContent();
      showNotification(request.action === "itemAdded" ? "Item added to clipboard" : "Item removed from clipboard");
    } else if (request.action === "getSelectedContent") {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const div = document.createElement('div');
        div.appendChild(fragment);
        
        const img = div.querySelector('img');
        if (img) {
          sendResponse({ content: img.src, type: 'image' });
        } else {
          const link = div.querySelector('a');
          if (link) {
            sendResponse({ content: link.href, type: 'link' });
          } else {
            sendResponse({ content: div.innerText, type: 'text' });
          }
        }
      }
      return true; // Indicates that the response is sent asynchronously
    }
  });
  
  // Initialize
  createClipboardElements();