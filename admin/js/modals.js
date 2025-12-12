function openAddDialog() {
	const modal = document.getElementById("addModal");
	const title = document.getElementById("modalTitle");
	const idInput = document.getElementById("itemId");
	const configInput = document.getElementById("itemConfig");
	const errorEl = document.getElementById("errorMessage");

	title.textContent = currentTab === "devices" ? "Add New Device" : "Add New Room";
	idInput.value = "";
	configInput.value = JSON.stringify(templates[currentTab], null, 2);
	errorEl.classList.remove("visible");
	errorEl.textContent = "";

	modal.classList.add("active");
}

function closeAddDialog() {
	document.getElementById("addModal").classList.remove("active");
}

function saveNewItem() {
	const idInput = document.getElementById("itemId");
	const configInput = document.getElementById("itemConfig");
	const errorEl = document.getElementById("errorMessage");

	const itemId = idInput.value.trim();
	const configText = configInput.value;

	if (!itemId) {
		errorEl.textContent = "ID is required";
		errorEl.classList.add("visible");
		return;
	}

	if (!/^[a-z0-9_]+$/.test(itemId)) {
		errorEl.textContent = "ID must contain only lowercase letters, numbers, and underscores";
		errorEl.classList.add("visible");
		return;
	}

	let config;
	try {
		config = JSON.parse(configText);
	} catch (e) {
		errorEl.textContent = "Invalid JSON: " + e.message;
		errorEl.classList.add("visible");
		return;
	}

	const validationErrors = validateConfig(currentTab, config);
	if (validationErrors.length > 0) {
		errorEl.innerHTML = "Validation errors:<br>• " + validationErrors.join("<br>• ");
		errorEl.classList.add("visible");
		return;
	}

	const stateId = `${currentBasePath}.${currentTab}.${itemId}`;
	const stateValue = JSON.stringify(config);

	console.log("Creating object:", stateId);

	window.socket.emit(
		"setObject",
		stateId,
		{
			type: "state",
			common: {
				name: config.name || itemId,
				type: "string",
				role: "json",
				read: true,
				write: true,
				desc: "Created by Home Controller",
			},
			native: {},
		},
		err => {
			if (err) {
				errorEl.textContent = "Error creating object: " + err;
				errorEl.classList.add("visible");
				return;
			}

			console.log("Object created, setting value:", stateValue);

			window.socket.emit("setState", stateId, { val: stateValue, ack: true }, err2 => {
				if (err2) {
					errorEl.textContent = "Error setting state value: " + err2;
					errorEl.classList.add("visible");
					return;
				}

				console.log("State set successfully:", stateId);
				closeAddDialog();
				setTimeout(loadData, 500);
			});
		},
	);
}

function exportData() {
	const targetPath = `${currentBasePath}.${currentTab}`;
	console.log("Exporting data from:", targetPath);

	window.socket.emit("getStates", targetPath + ".*", (err, states) => {
		if (err) {
			alert("Error fetching data for export: " + err);
			return;
		}

		const items = {};
		Object.keys(states)
			.sort()
			.forEach(id => {
				const relativeId = id.startsWith(targetPath + ".") ? id.substring(targetPath.length + 1) : id;
				const val = states[id] ? states[id].val : null;

				try {
					items[relativeId] = val ? JSON.parse(val) : {};
				} catch (e) {
					console.warn("Failed to parse JSON for export:", id);
					items[relativeId] = { _rawValue: val };
				}
			});

		const exportDataObj = {
			type: currentTab,
			exportedAt: new Date().toISOString(),
			basePath: currentBasePath,
			items: items,
		};

		const blob = new Blob([JSON.stringify(exportDataObj, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `home_controller_${currentTab}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		console.log(`Exported ${Object.keys(items).length} ${currentTab}`);
	});
}

function handleImportFile(event) {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = e => {
		try {
			const importData = JSON.parse(e.target.result);

			if (!importData.type || !importData.items) {
				alert("Invalid file format. Expected { type, items }");
				return;
			}

			if (importData.type !== currentTab) {
				if (!confirm(`File contains ${importData.type}, but current tab is ${currentTab}. Switch tab and import?`)) {
					return;
				}
				switchTab(importData.type);
			}

			const items = importData.items;
			const itemIds = Object.keys(items);

			if (itemIds.length === 0) {
				alert("No items found in file");
				return;
			}

			const allErrors = [];
			itemIds.forEach(id => {
				if (!/^[a-z0-9_]+$/.test(id)) {
					allErrors.push(`ID "${id}" is invalid (only lowercase, numbers, underscores)`);
				}
				const validationErrors = validateConfig(currentTab, items[id]);
				validationErrors.forEach(err => {
					allErrors.push(`${id}: ${err}`);
				});
			});

			if (allErrors.length > 0) {
				alert(
					"Validation errors:\n• " +
						allErrors.slice(0, 10).join("\n• ") +
						(allErrors.length > 10 ? `\n... and ${allErrors.length - 10} more` : ""),
				);
				return;
			}

			if (
				!confirm(
					`Import ${itemIds.length} ${currentTab}?\n\nThis will create or update:\n• ${itemIds
						.slice(0, 5)
						.join("\n• ")}${itemIds.length > 5 ? "\n• ..." : ""}`,
				)
			) {
				return;
			}

			let completed = 0;
			let errors = 0;

			itemIds.forEach(id => {
				const stateId = `${currentBasePath}.${currentTab}.${id}`;
				const stateValue = JSON.stringify(items[id]);

				window.socket.emit("setState", stateId, stateValue, err => {
					if (err) {
						console.error("Error importing", id, err);
						errors++;
					} else {
						console.log("Imported:", id);
					}
					completed++;

					if (completed === itemIds.length) {
						alert(
							`Import complete!\n✅ ${completed - errors} items imported\n${
								errors > 0 ? `❌ ${errors} errors` : ""
							}`,
						);
						loadData();
					}
				});
			});
		} catch (e) {
			alert("Error parsing file: " + e.message);
		}
	};
	reader.readAsText(file);

	event.target.value = "";
}

function loadConnectedClients() {
	window.socket.emit("getState", "home_controller_backend.0.info.connectedClients", (err, state) => {
		if (err || !state) {
			console.log("No connected clients state found");
			return;
		}
		updateClientsDisplay(state.val);
	});
}

function updateClientsDisplay(clientsJson) {
	const clientsList = document.getElementById("clientsList");
	let clients = [];

	try {
		clients = JSON.parse(clientsJson) || [];
	} catch (e) {
		console.warn("Failed to parse clients JSON:", e);
		clients = [];
	}

	if (clients.length === 0) {
		clientsList.innerHTML = '<span class="no-clients">No clients connected</span>';
		return;
	}

	clientsList.innerHTML = clients
		.map((client, idx) => {
			const icon =
				client.clientType === "mobile" ? "📱" : client.clientType === "web" ? "🌐" : client.clientType === "desktop" ? "💻" : "🔌";

			const logCount = client.recentRequests?.length || 0;
			const authUser = client.authUser ? client.authUser : "n/a";
			const logsHtml =
				client.recentRequests && client.recentRequests.length > 0
					? client.recentRequests
							.map(req => {
								const time = new Date(req.timestamp).toLocaleTimeString("de-DE", {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								});
								return `
                            <div class="log-entry">
                                <span class="log-time">${time}</span>
                                <span class="log-type">${req.type}</span>
                                <span class="log-id">${req.id || "-"}</span>
                            </div>
                        `;
							})
							.join("")
					: '<div class="no-logs">No requests yet</div>';

			return `
                    <div class="client-wrapper">
                        <div class="client-badge">
                            <span class="client-icon">${icon}</span>
                            <span class="client-name">${client.name}</span>
                            <span class="client-auth">user: ${authUser}</span>
                            <span class="client-version">v${client.version}</span>
                            <span class="client-logs-toggle" onclick="toggleLogs(${idx})" title="Show request logs">
                                📋 Logs (${logCount})
                            </span>
                            <span class="client-close" onclick="disconnectClient('${client.id}')" title="Disconnect client">✕</span>
                        </div>
                        <div class="client-logs-panel" id="logs-${idx}">
                            ${logsHtml}
                        </div>
                    </div>
                `;
		})
		.join("");
}

function toggleLogs(clientIdx) {
	const panel = document.getElementById(`logs-${clientIdx}`);
	if (panel) {
		panel.classList.toggle("visible");
	}
}

function disconnectClient(clientId) {
	if (!confirm("Disconnect this client?")) return;

	console.log("Disconnecting client:", clientId);
	window.socket.emit("sendTo", "home_controller_backend.0", "disconnectClient", clientId, result => {
		if (result && result.success) {
			console.log("Client disconnected successfully");
		} else {
			console.error("Failed to disconnect client");
			alert("Failed to disconnect client");
		}
	});
}

