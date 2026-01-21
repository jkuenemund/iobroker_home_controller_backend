/**
 * Render scenes table from ioBroker states
 * Expects states from cron_scenes.0.jobs.*
 *
 * @param states - ioBroker states object containing scene data
 * @param basePath - Base path prefix for state IDs
 * @param columns - Array of column definitions to display
 * @param tableBody - DOM element (tbody) to render rows into
 */
function renderSceneRows(states, basePath, columns, tableBody) {
	// Parse scene states - filter out .status and .trigger states
	const sceneStates = {};
	const statusStates = {};

	for (const [oid, state] of Object.entries(states)) {
		const relativeId = oid.substring(basePath.length + 1);

		if (relativeId.endsWith(".status")) {
			// Status state
			const sceneId = relativeId.slice(0, -7); // Remove '.status'
			statusStates[sceneId] = state.val;
		} else if (relativeId.endsWith(".trigger")) {
			// Skip trigger states
			continue;
		} else if (!relativeId.includes(".")) {
			// Main scene configuration state
			sceneStates[relativeId] = state.val;
		}
	}

	// Build scene rows
	const sceneIds = Object.keys(sceneStates).sort();

	if (sceneIds.length === 0) {
		tableBody.innerHTML = `<tr><td colspan="${columns["scenes"].length}" style="text-align: center; color: #666;">No scenes found under ${basePath}</td></tr>`;
		return;
	}

	sceneIds.forEach(sceneId => {
		const configJson = sceneStates[sceneId];
		const statusJson = statusStates[sceneId];

		let config;
		try {
			config = typeof configJson === "string" ? JSON.parse(configJson) : configJson;
			// Normalize type to lowercase for consistent comparison
			if (config.type && typeof config.type === "string") {
				config.type = config.type.toLowerCase().trim();
			}
		} catch (e) {
			console.error(`Invalid JSON for scene ${sceneId}:`, e);
			config = { type: "unknown", active: false, targets: [] };
		}

		let status;
		try {
			status = typeof statusJson === "string" ? JSON.parse(statusJson) : statusJson;
		} catch (e) {
			console.error(`Invalid JSON for scene ${sceneId}:`, e);
			status = { status: "unknown" };
		}

		// Create main row
		const tr = document.createElement("tr");
		tr.dataset.sceneId = sceneId;

		columns["scenes"].forEach(col => {
			const td = document.createElement("td");

			switch (col.key) {
				case "expand":
					td.innerHTML = `<span class="expand-icon" onclick="toggleSceneDetails('${sceneId}')" style="cursor: pointer; user-select: none">▶</span>`;
					break;
				case "id":
					td.textContent = sceneId;
					break;
				case "name":
					td.textContent = config.name || sceneId;
					break;
				case "type": {
					// Use already normalized config.type, but ensure it's a string
					const jobType = String(config.type || "")
						.toLowerCase()
						.trim();
					const typeIconMap = {
						recurring: "🔄",
						once: "1️⃣",
						manual: "🎮",
						state: "🔔",
						timer: "⏱️",
					};
					const typeIcon = typeIconMap[jobType] || "❓";
					const displayType = config.type || "unknown";
					td.innerHTML = `${typeIcon} ${displayType}`;

					// Warn if icon not found
					if (!typeIconMap[jobType] && config.type) {
						console.warn(`Unknown scene type: "${config.type}" (normalized: "${jobType}")`);
					}
					break;
				}
				case "active":
					td.innerHTML = config.active
						? '<span style="color: green;">✓</span>'
						: '<span style="color: red;">✗</span>';
					break;
				case "lastRun":
					if (status && status.lastRun) {
						const date = new Date(status.lastRun);
						td.textContent = date.toLocaleString();
					} else {
						td.textContent = "-";
					}
					break;
				case "nextRun":
					if (status && status.nextRun) {
						const date = new Date(status.nextRun);
						td.textContent = date.toLocaleString();
					} else {
						td.textContent = "-";
					}
					break;
				case "error":
					if (status && status.error) {
						td.innerHTML = `<span style="color: red;" title="${status.error}">⚠️</span>`;
					} else {
						td.textContent = "-";
					}
					break;
				case "trigger":
					td.innerHTML = `<button class="btn-trigger" onclick="event.preventDefault(); triggerScene(event, '${basePath}.${sceneId}.trigger')" title="Trigger scene manually">▶️ Run</button>`;
					break;
			}

			tr.appendChild(td);
		});

		tableBody.appendChild(tr);

		// Create details row (initially hidden)
		const detailsTr = document.createElement("tr");
		detailsTr.id = `scene-details-${sceneId}`;
		detailsTr.className = "details-row";
		detailsTr.style.display = "none";

		const detailsTd = document.createElement("td");
		detailsTd.colSpan = columns["scenes"].length;

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

		// Delay (for TIMER jobs) - show for timer type or if delay is present
		const normalizedType = String(config.type || "")
			.toLowerCase()
			.trim();

		if (
			normalizedType === "timer" ||
			(config.delay !== undefined && config.delay !== null && config.delay !== "")
		) {
			const delaySeconds = Number(config.delay);
			if (!isNaN(delaySeconds) && delaySeconds > 0) {
				const delayMinutes = Math.floor(delaySeconds / 60);
				const delayHours = Math.floor(delayMinutes / 60);
				let delayText = "";
				if (delayHours > 0) {
					delayText = `${delayHours}h ${delayMinutes % 60}m`;
				} else if (delayMinutes > 0) {
					delayText = `${delayMinutes}m ${delaySeconds % 60}s`;
				} else {
					delayText = `${delaySeconds}s`;
				}
				detailsHtml += `<p><strong>Delay:</strong> ${delayText} (${delaySeconds} seconds)</p>`;
			} else if (normalizedType === "timer") {
				detailsHtml += `<p style="color: orange;"><strong>Delay:</strong> Missing or invalid (required for timer jobs)</p>`;
			}
		}

		// Targets
		detailsHtml += "<p><strong>Targets:</strong></p>";
		detailsHtml +=
			'<table class="targets-table" style="width: 100%; border-collapse: collapse; margin-top: 5px; background: white;">';
		detailsHtml +=
			'<thead><tr><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">State ID</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Value</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Type</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Description</th></tr></thead>';
		detailsHtml += "<tbody>";

		config.targets.forEach(target => {
			detailsHtml += "<tr>";
			detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;"><code>${target.id}</code></td>`;
			detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;"><code>${JSON.stringify(target.value)}</code></td>`;
			detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;">${target.type || "value"}</td>`;
			detailsHtml += `<td style="padding: 5px; border-bottom: 1px solid #eee;">${target.description || "-"}</td>`;
			detailsHtml += "</tr>";
		});

		detailsHtml += "</tbody></table>";

		// Status
		if (status) {
			detailsHtml += `<p style="margin-top: 10px;"><strong>Status:</strong> ${status.status || "unknown"}</p>`;
			if (status.error) {
				detailsHtml += `<p style="color: red;"><strong>Error:</strong> ${status.error}</p>`;
			}
		}

		detailsHtml += "</div>";

		detailsTd.innerHTML = detailsHtml;
		detailsTr.appendChild(detailsTd);
		tableBody.appendChild(detailsTr);
	});
}

/**
 * Toggle scene details visibility
 *
 * @param sceneId - ID of the scene to toggle details for
 */
function toggleSceneDetails(sceneId) {
	const detailsRow = document.getElementById(`scene-details-${sceneId}`);
	const expandIcon = document.querySelector(`tr[data-scene-id="${sceneId}"] .expand-icon`);

	if (detailsRow.style.display === "none") {
		detailsRow.style.display = "table-row";
		expandIcon.textContent = "▼";
	} else {
		detailsRow.style.display = "none";
		expandIcon.textContent = "▶";
	}
}

/**
 * Trigger a scene manually
 *
 * @param event - Click event object
 * @param triggerStateId - State ID to trigger the scene
 */
function triggerScene(event, triggerStateId) {
	if (!window.socket) {
		console.error("Socket not available");
		alert("Connection error: Socket not available");
		return;
	}

	console.log("Triggering scene:", triggerStateId);

	// Set trigger state to true
	window.socket.emit("setState", triggerStateId, { val: true, ack: false }, err => {
		if (err) {
			console.error("Error triggering scene:", err);
			alert(`Failed to trigger scene: ${err}`);
		} else {
			console.log("Scene triggered successfully");
			// Optional: Visual feedback
			const button = event.target;
			const originalText = button.textContent;
			button.textContent = "✓ Triggered";
			button.disabled = true;
			setTimeout(() => {
				button.textContent = originalText;
				button.disabled = false;
			}, 2000);
		}
	});
}
