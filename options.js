// Saves options to chrome.storage
function saveOptions() {
    const maxItems = document.getElementById('maxItems').value;
    const defaultFilter = document.getElementById('defaultFilter').value;
    const drawerPosition = document.getElementById('drawerPosition').value;
    
    chrome.storage.sync.set({
        maxItems: maxItems,
        defaultFilter: defaultFilter,
        drawerPosition: drawerPosition
    }, function() {
        // Update status to let user know options were saved.
        const status = document.createElement('div');
        status.textContent = 'Options saved.';
        status.style.marginTop = '15px';
        status.style.color = 'green';
        document.body.appendChild(status);
        setTimeout(function() {
            status.remove();
        }, 750);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get({
        maxItems: 50,
        defaultFilter: 'all',
        drawerPosition: 'right'
    }, function(items) {
        document.getElementById('maxItems').value = items.maxItems;
        document.getElementById('defaultFilter').value = items.defaultFilter;
        document.getElementById('drawerPosition').value = items.drawerPosition;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);

document.getElementById('export').addEventListener('click', exportClipboardData);
document.getElementById('importTrigger').addEventListener('click', () => {
    document.getElementById('import').click();
});
document.getElementById('import').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        importClipboardData(file);
    }
});
