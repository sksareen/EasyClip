// Maximum number of items to store in the clipboard
const MAX_CLIPBOARD_ITEMS = 50;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "addToClipboard") {
    addToClipboard(request.content, request.type, request.name)
      .then(() => sendResponse({success: true}))
      .catch((error) => sendResponse({success: false, error: error.message}));
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "getClipboardItems") {
    getClipboardItems()
      .then(sendResponse)
      .catch((error) => sendResponse({error: error.message}));
    return true;
  } else if (request.action === "clearClipboard") {
    clearClipboard()
      .then(() => sendResponse({success: true}))
      .catch((error) => sendResponse({success: false, error: error.message}));
    return true;
  } else if (request.action === "removeClipboardItem") {
    removeClipboardItem(request.timestamp)
      .then(() => sendResponse({success: true}))
      .catch((error) => sendResponse({success: false, error: error.message}));
    return true;
  } else if (request.action === "copyDetected") {
    handleCopyEvent(sender.tab.id);
    return false; // No need for an asynchronous response
  }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-clipboard") {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "toggleClipboard"});
        }
      });
    }
  });
  

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToEasyClip",
    title: "Add to EasyClip",
    contexts: ["image", "link", "selection"]
  });
});

// Add item to clipboard
async function addToClipboard(content, type, name) {
  let items = await getClipboardItems();
  items.unshift({ content, type, name, timestamp: Date.now() });
  items = items.slice(0, MAX_CLIPBOARD_ITEMS);
  await chrome.storage.local.set({ clipboardItems: items });
  notifyContentScripts("itemAdded");
  console.log('EasyClip: Item added to clipboard', { type, name });
}

// Get clipboard items
async function getClipboardItems() {
  const result = await chrome.storage.local.get("clipboardItems");
  return result.clipboardItems || [];
}

// Clear all clipboard items
async function clearClipboard() {
  await chrome.storage.local.set({ clipboardItems: [] });
  notifyContentScripts("clipboardCleared");
  console.log('EasyClip: Clipboard cleared');
}

// Remove a specific clipboard item
async function removeClipboardItem(timestamp) {
  let items = await getClipboardItems();
  items = items.filter(item => item.timestamp !== timestamp);
  await chrome.storage.local.set({ clipboardItems: items });
  notifyContentScripts("itemRemoved");
  console.log('EasyClip: Item removed from clipboard', { timestamp });
}

// Handle copy event
function handleCopyEvent(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "getSelectedContent" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting selected content:', chrome.runtime.lastError);
      return;
    }
    if (response && response.content) {
      addToClipboard(response.content, response.type);
    }
  });
}

// Notify all content scripts about changes
function notifyContentScripts(action) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action }).catch(() => {
        // Ignore errors from inactive tabs
      });
    });
  });
}

// Listen for browser action click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "toggleClipboard" })
    .catch(error => console.error('Error sending toggle message:', error));
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addToEasyClip") {
    if (info.mediaType === "image") {
      addToClipboard(info.srcUrl, 'image');
    } else if (info.linkUrl) {
      addToClipboard(info.linkUrl, 'link');
    } else if (info.selectionText) {
      addToClipboard(info.selectionText, 'text');
    }
  }
});

console.log('EasyClip: Background script initialized');