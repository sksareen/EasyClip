function exportClipboardData() {
    chrome.storage.local.get(["clipboardItems", "clipboardHistory"], (data) => {
      const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: "easyclip_data.json"
      });
    });
  }
  
  function importClipboardData(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        chrome.storage.local.set(data, () => {
          console.log('EasyClip: Data imported successfully');
          // Notify content script to refresh the clipboard drawer
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: "refreshClipboard"});
          });
        });
      } catch (error) {
        console.error('EasyClip: Error importing data', error);
      }
    };
    reader.readAsText(file);
  }