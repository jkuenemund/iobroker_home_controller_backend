/**
 * Render scenes table from ioBroker states
 * Expects states from cron_scenes.0.jobs.*
 */
function renderSceneRows(states, basePath, columns, tableBody) {
    // Parse scene states - filter out .status and .trigger states
    const sceneStates = {};
    const statusStates = {};

    for (const [oid, state] of Object.entries(states)) {
        const relativeId = oid.substring(basePath.length + 1);

        if (relativeId.endsWith('.status')) {
            // Status state
            const sceneId = relativeId.slice(0, -7); // Remove '.status'
            statusStates[sceneId] = state.val;
        } else if (relativeId.endsWith('.trigger')) {
            // Skip trigger states
            continue;
        } else if (!relativeId.includes('.')) {
            // Main scene configuration state
            sceneStates[relativeId] = state.val;
        }
    }

    // Build scene rows
    const sceneIds = Object.keys(sceneStates).sort();

    if (sceneIds.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${columns['scenes'].length}" style="text-align: center; color: #666;">No scenes found under ${basePath}</td></tr>`;
        return;
    }

    sceneIds.forEach(sceneId => {
        const configJson = sceneStates[sceneId];
        const statusJson = statusStates[sceneId];

        let config;
        try {
            config = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
        } catch (e) {
            console.error(`Invalid JSON for scene ${sceneId}:`, e);
            config = { type: 'unknown', active: false, targets: [] };
        }

        let status;
        try {
            status = typeof statusJson === 'string' ? JSON.parse(statusJson) : statusJson;
        } catch (e) {
            status = { status: 'unknown' };
        }

        // Create main row
        const tr = document.createElement('tr');
        tr.dataset.sceneId = sceneId;

        columns['scenes'].forEach(col => {
            const td = document.createElement('td');

            switch (col.key) {
                case 'expand':
                    td.innerHTML = `<span class="expand-icon" onclick="toggleSceneDetails('${sceneId}')" style="cursor: pointer; user-select: none">▶</span>`;
                    break;
                case 'id':
                    td.textContent = sceneId;
                    break;
                case 'name':
                    td.textContent = config.name || sceneId;
                    break;
                case 'type':
                    const typeIcon = {
                        recurring: '🔄',
                        once: '1️⃣',
                        manual: '🎮',
                        state: '🔔'
                    }[config.type] || '❓';
                    td.innerHTML = `${typeIcon} ${config.type || 'unknown'}`;
                    break;
                case 'active':
                    td.innerHTML = config.active ? '<span style="color: green;">✓</span>' : '<span style="color: red;">✗</span>';
                    break;
                case 'lastRun':
                    if (status && status.lastRun) {
                        const date = new Date(status.lastRun);
                        td.textContent = date.toLocaleString();
                    } else {
                        td.textContent = '-';
                    }
                    break;
                case 'nextRun':
                    if (status && status.nextRun) {
                        const date = new Date(status.nextRun);
                        td.textContent = date.toLocaleString();
                    } else {
                        td.textContent = '-';
                    }
                    break;
                case 'error':
                    if (status && status.error) {
                        td.innerHTML = `<span style="color: red;" title="${status.error}">⚠️</span>`;
                    } else {
                        td.textContent = '-';
                    }
                    break;
                case 'trigger':
                    td.innerHTML = `<button class="btn-trigger" onclick="event.preventDefault(); triggerScene(event, '${basePath}.${sceneId}.trigger')" title="Trigger scene manually">▶️ Run</button>`;
                    break;
            }

            tr.appendChild(td);
        });

        tableBody.appendChild(tr);

        // Create details row (initially hidden)
        const detailsTr = document.createElement('tr');
        detailsTr.id = `scene-details-${sceneId}`;
        detailsTr.className = 'details-row';
        detailsTr.style.display = 'none';

        const detailsTd = document.createElement('td');
        detailsTd.colSpan = columns['scenes'].length;

        // Build details content
        let detailsHtml = '<div class="details-container" style="padding: 15px; background: #f9f9f9;">';

        // Cron expression
        if (config.cron) {
            detailsHtml += `<p><strong>Cron:</strong> <code>${config.cron}</code></p>`;
        }

        // Trigger state (for STATE jobs)
        if (config.triggerState) {
            detailsHtml += `<p><strong>Trigger State:</strong> <code>${config.triggerState}</code>`;
            if (config.triggerValue !== undefined) {
                detailsHtml += ` = ${JSON.stringify(config.triggerValue)}`;
            }
            detailsHtml += `</p>`;
            if (config.debounce) {
                detailsHtml += `<p><strong>Debounce:</strong> ${config.debounce}ms</p>`;
            }
        }

        // Targets
        detailsHtml += '<p><strong>Targets:</strong></p>';
        detailsHtml += '<table class="targets-table" style="width: 100%; border-collapse: collapse; margin-top: 5px; background: white;">';
        detailsHtml += '<thead><tr><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">State ID</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Value</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Type</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Description</th></tr></thead>';
        detailsHtml += '<tbody>';

        config.targets.forEach(target => {
            detailsHtml += '<tr>';
            detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;"><code>${target.id}</code></td>`;
            detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;"><code>${JSON.stringify(target.value)}</code></td>`;
            detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;">${target.type || 'value'}</td>`;
            detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;">${target.description || '-'}</td>`;
            detailsHtml += '</tr>';
        });

        detailsHtml += '</tbody></table>';

        // Status
        if (status) {
            detailsHtml += '<p style="margin-top: 10px;"><strong>Status:</strong> ' + (status.status || 'unknown') + '</p>';
            if (status.error) {
                detailsHtml += `<p style="color: red;"><strong>Error:</strong> ${status.error}</p>`;
            }
        }

        detailsHtml += '</div>';

        detailsTd.innerHTML = detailsHtml;
        detailsTr.appendChild(detailsTd);
        tableBody.appendChild(detailsTr);
    });
}

/**
 * Toggle scene details visibility
 */
function toggleSceneDetails(sceneId) {
    const detailsRow = document.getElementById(`scene-details-${sceneId}`);
    const expandIcon = document.querySelector(`tr[data-scene-id="${sceneId}"] .expand-icon`);

    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        expandIcon.textContent = '▼';
    } else {
        detailsRow.style.display = 'none';
        expandIcon.textContent = '▶';
    }
}

/**
 * Trigger a scene manually
 */
function triggerScene(event, triggerStateId) {
    if (!window.socket) {
        console.error('Socket not available');
        alert('Connection error: Socket not available');
        return;
    }

    console.log('Triggering scene:', triggerStateId);

    // Set trigger state to true
    window.socket.emit('setState', triggerStateId, { val: true, ack: false }, (err) => {
        if (err) {
            console.error('Error triggering scene:', err);
            alert(`Failed to trigger scene: ${err}`);
        } else {
            console.log('Scene triggered successfully');
            // Optional: Visual feedback
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = '✓ Triggered';
            button.disabled = true;
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
        }
    });
}
