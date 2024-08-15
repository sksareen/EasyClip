document.addEventListener('DOMContentLoaded', () => {
    const clipboardItems = document.getElementById('clipboard-items');

    function updateClipboardItems() {
        chrome.runtime.sendMessage({action: "getClipboardItems"}, (items) => {
            clipboardItems.innerHTML = items.map(item => `
                <div class="item" data-content="${encodeURIComponent(item.content)}">
                    ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''}
                </div>
            `).join('');

            clipboardItems.querySelectorAll('.item').forEach(item => {
                item.addEventListener('click', () => {
                    const text = decodeURIComponent(item.dataset.content);
                    navigator.clipboard.writeText(text).then(() => {
                        item.style.backgroundColor = '#e6ffe6';
                        setTimeout(() => item.style.backgroundColor = '', 500);
                    });
                });
            });
        });
    }

    updateClipboardItems();

    // Refresh items every 5 seconds
    setInterval(updateClipboardItems, 5000);
});
</script>