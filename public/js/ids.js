// ID Lookup view rendering
// Handles: citizen and item ID lists with filtering
export const IdsUI = {
    // Render ID list (citizens or items)
    renderIdList(type, items, citizensData) {
        const list = document.getElementById('ids-list');
        if (!list)
            return;
        let html = '<table class="ids-table"><thead><tr><th>Name</th><th>ID</th></tr></thead><tbody>';
        if (type === 'citizens') {
            const citizens = citizensData?.citizens || [];
            if (citizens.length === 0) {
                list.innerHTML = '<p class="empty-state">Load a claim first to see citizens.</p>';
                return;
            }
            const sorted = [...citizens].sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
            for (const c of sorted) {
                html += `<tr data-name="${(c.userName || '').toLowerCase()}">
        <td>${c.userName || 'Unknown'}</td>
        <td><button class="copy-btn" data-id="${c.entityId}">${c.entityId}</button></td>
        </tr>`;
            }
        }
        else if (type === 'items') {
            if (!items || items.length === 0) {
                list.innerHTML = '<p class="empty-state">Loading items...</p>';
                return;
            }
            const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
            for (const item of sorted) {
                const tierBadge = item.tier > 0 ? `<span class="tier-badge">T${item.tier}</span> ` : '';
                html += `<tr data-name="${item.name.toLowerCase()}">
        <td>${tierBadge}${item.name}</td>
        <td><button class="copy-btn" data-id="${item.id}">${item.id}</button></td>
        </tr>`;
            }
        }
        html += '</tbody></table>';
        list.innerHTML = html;
        // Add copy handlers
        list.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => this.copyToClipboard(btn.dataset.id || '', btn));
        });
    },
    // Filter ID list by name
    filterIdList(filter, type) {
        const rows = document.querySelectorAll('#ids-list tbody tr');
        const lowerFilter = filter.toLowerCase();
        rows.forEach(row => {
            const name = row.dataset.name || '';
            if (name.includes(lowerFilter)) {
                row.style.display = '';
            }
            else {
                row.style.display = 'none';
            }
        });
    },
    // Copy text to clipboard with visual feedback
    copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.textContent;
            btn.textContent = '✔';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove('copied');
            }, 1500);
        });
    }
};
//# sourceMappingURL=ids.js.map