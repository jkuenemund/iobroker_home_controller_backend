function renderDeviceRows(states, targetPath, columns, tableBody) {
	Object.keys(states)
		.sort()
		.forEach(id => {
			const relativeId = id.startsWith(`${targetPath}.`) ? id.substring(targetPath.length + 1) : id;
			const val = states[id] ? states[id].val : null;

			let data = {};
			try {
				data = val ? JSON.parse(val) : {};
			} catch (e) {
				console.warn("Failed to parse JSON for", id, val, e);
				data = { name: "Invalid JSON" };
			}

			data.id = relativeId;

			const row = document.createElement("tr");
			row.dataset.deviceId = relativeId;

			columns.devices.forEach(col => {
				const td = document.createElement("td");

				if (col.key === "expand") {
					td.innerHTML = '<span class="expand-icon" onclick="toggleCapabilities(this)">▶</span>';
					td.style.width = "30px";
					td.style.textAlign = "center";
				} else {
					let cellValue = data[col.key] || "-";
					if (col.key === "icon") {
						td.style.fontSize = "1.5em";
						td.style.textAlign = "center";
					}
					if (col.key === "id") {
						td.style.fontFamily = "monospace";
					}
					td.textContent = cellValue;
				}

				row.appendChild(td);
			});

			tableBody.appendChild(row);

			if (data.capabilities) {
				const capRow = document.createElement("tr");
				capRow.className = "capabilities-row";
				capRow.dataset.deviceId = relativeId;

				const capTd = document.createElement("td");
				capTd.colSpan = columns.devices.length;

				const capPanel = document.createElement("div");
				capPanel.className = "capabilities-panel";

				if (Array.isArray(data.capabilities) && data.capabilities.length > 0) {
					data.capabilities.forEach(cap => {
						const capItem = document.createElement("div");
						capItem.className = "capability-item";

						const typeSpan = document.createElement("div");
						typeSpan.className = "capability-type";
						typeSpan.textContent = cap.type || "-";

						const stateSpan = document.createElement("div");
						stateSpan.className = "capability-state";
						stateSpan.textContent = cap.state || "-";
						stateSpan.title = cap.state || "";

						const valueSpan = document.createElement("div");
						valueSpan.className = "capability-value";
						valueSpan.textContent = "...";
						if (cap.state) {
							valueSpan.dataset.oid = cap.state;
							valueSpan.classList.add("live-val");
						}

						const propsSpan = document.createElement("div");
						propsSpan.className = "capability-props";
						const props = [];
						if (cap.description) {
							props.push(cap.description);
						}
						if (cap.min_value !== undefined) {
							props.push(`min: ${cap.min_value}`);
						}
						if (cap.max_value !== undefined) {
							props.push(`max: ${cap.max_value}`);
						}
						if (cap.unit) {
							props.push(`unit: ${cap.unit}`);
						}
						if (cap.inverted) {
							props.push("inverted");
						}
						propsSpan.textContent = props.length > 0 ? props.join(", ") : "-";

						capItem.appendChild(typeSpan);
						capItem.appendChild(stateSpan);
						capItem.appendChild(valueSpan);
						capItem.appendChild(propsSpan);
						capItem.appendChild(propsSpan);
						capPanel.appendChild(capItem);
					});
				} else {
					const noCap = document.createElement("div");
					noCap.className = "no-capabilities";
					noCap.textContent = "No capabilities defined";
					capPanel.appendChild(noCap);
				}

				capTd.appendChild(capPanel);
				capRow.appendChild(capTd);
				tableBody.appendChild(capRow);
			}
		});
}

function toggleCapabilities(iconElement) {
	const row = iconElement.closest("tr");
	const deviceId = row.dataset.deviceId;

	const capRow = row.nextElementSibling;
	if (capRow && capRow.classList.contains("capabilities-row") && capRow.dataset.deviceId === deviceId) {
		const isExpanded = !capRow.classList.contains("visible");
		capRow.classList.toggle("visible");
		iconElement.classList.toggle("expanded");

		const valueElements = capRow.querySelectorAll(".live-val");
		valueElements.forEach(el => {
			const oid = el.dataset.oid;
			if (oid) {
				if (isExpanded) {
					window.socket.emit("subscribe", oid);
					window.socket.emit("getState", oid, (err, state) => {
						if (!err && state) {
							updateValueDisplay(el, state.val);
						}
					});
				} else {
					window.socket.emit("unsubscribe", oid);
				}
			}
		});
	}
}
