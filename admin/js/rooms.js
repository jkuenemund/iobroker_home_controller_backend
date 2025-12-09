function normalizeRoomData(relativeId, data, currentTab) {
	data.__metricsSource = data.metrics;
	let metricsArray = [];
	if (Array.isArray(data.metrics)) {
		metricsArray = data.metrics;
	} else if (data.metrics && typeof data.metrics === "object") {
		metricsArray = Object.values(data.metrics);
	}

	// Derive ids/names for metrics if missing
	metricsArray = metricsArray.map(m => {
		const metric = { ...m };
		if (!metric.id) metric.id = metric.state || metric.type;
		if (!metric.name) metric.name = metric.type || metric.id;
		return metric;
	});

	data.__metrics = metricsArray;
	data.__metricsCount = metricsArray.length || (typeof data.metrics === "number" ? data.metrics : 0);

	if (currentTab === "rooms") {
		console.debug("[Rooms] parsed room", relativeId, {
			metricsType: typeof data.metrics,
			metricsKeys: data.metrics && typeof data.metrics === "object" ? Object.keys(data.metrics) : undefined,
			metricsCount: data.__metricsCount,
			sample: data.__metrics?.slice(0, 3),
		});
	}
	return data;
}

function buildRoomRow(data, columns, tableBody) {
	const row = document.createElement("tr");
	row.dataset.deviceId = data.id;

	columns.rooms.forEach(col => {
		const td = document.createElement("td");

		if (col.key === "expand") {
			const hasMetrics = data.__metrics && data.__metrics.length > 0;
			td.innerHTML = hasMetrics ? '<span class="expand-icon" onclick="toggleMetrics(this)">▶</span>' : "";
			td.style.width = "30px";
			td.style.textAlign = "center";
		} else {
			let cellValue = data[col.key] || "-";
			if (col.key === "metrics") {
				td.innerHTML = renderMetricSummary(data.__metrics, data.__metricsCount);
			} else {
				if (col.key === "icon") {
					td.style.fontSize = "1.5em";
					td.style.textAlign = "center";
				}
				if (col.key === "id") {
					td.style.fontFamily = "monospace";
				}
				td.textContent = cellValue;
			}
		}

		row.appendChild(td);
	});

	tableBody.appendChild(row);
}

function addMetricsRow(data, columns, tableBody) {
	if (!Array.isArray(data.__metrics) || data.__metrics.length === 0) {
		return;
	}

	const metricsRow = document.createElement("tr");
	metricsRow.className = "metrics-row";
	metricsRow.dataset.roomId = data.id;

	const metricsTd = document.createElement("td");
	metricsTd.colSpan = columns.rooms.length;

	const metricsPanel = document.createElement("div");
	metricsPanel.className = "metrics-panel";

	const list = document.createElement("div");
	list.className = "metrics-list";

	const fetchQueue = [];

	data.__metrics.forEach(metric => {
		const item = document.createElement("div");
		item.className = "metric-item";

		const nameDiv = document.createElement("div");
		nameDiv.className = "metric-name";
		nameDiv.textContent = metric.name || metric.id || "-";

		const valueDiv = document.createElement("div");
		valueDiv.className = "metric-value";
		const unit = metric.unit ? ` ${metric.unit}` : "";
		const val = metric.value !== undefined && metric.value !== null ? metric.value : "-";
		valueDiv.textContent = `${val}${unit}`;
		if (metric.state) {
			valueDiv.dataset.oid = metric.state;
		}

		const statusDiv = document.createElement("div");
		const status = (
			metric.status ||
			(metric.value !== undefined && metric.value !== null ? "ok" : metric.state ? "ok" : "nodata")
		).toLowerCase();
		const badge = document.createElement("span");
		badge.className = `metric-badge ${status}`;
		badge.textContent = status.toUpperCase();
		statusDiv.appendChild(badge);

		const tsDiv = document.createElement("div");
		tsDiv.className = "metric-ts";
		tsDiv.textContent = metric.ts ? relativeTime(metric.ts) : "–";

		item.appendChild(nameDiv);
		item.appendChild(valueDiv);
		item.appendChild(statusDiv);
		item.appendChild(tsDiv);
		list.appendChild(item);

		if (metric.state) {
			fetchQueue.push({ metric, valueDiv, badge, tsDiv, unit });
		} else if (status === "nodata") {
			console.debug("[Rooms] metric nodata status (no state)", {
				roomId: data.id,
				metricId: metric.id,
				value: metric.value,
				statusField: metric.status,
			});
		}
	});

	metricsPanel.appendChild(list);
	metricsTd.appendChild(metricsPanel);
	metricsRow.appendChild(metricsTd);
	tableBody.appendChild(metricsRow);

	// Fetch current values for metrics with a state id
	fetchQueue.forEach(item => {
		window.socket.emit("getState", item.metric.state, (err, state) => {
			const val = !err && state ? state.val : undefined;
			const ts = !err && state ? state.ts : undefined;
			if (err) {
				console.debug("[Rooms] metric getState error", {
					roomId: data.id,
					metricId: item.metric.id,
					stateId: item.metric.state,
					error: err,
				});
			}
			const status = (item.metric.status || (val !== undefined && val !== null ? "ok" : "nodata")).toLowerCase();
			item.badge.className = `metric-badge ${status}`;
			item.badge.textContent = status.toUpperCase();
			const displayVal = val !== undefined && val !== null ? val : "-";
			item.valueDiv.textContent = `${displayVal}${item.unit}`;
			item.tsDiv.textContent = ts ? relativeTime(ts) : "–";

			if (status === "nodata") {
				console.debug("[Rooms] metric nodata status (after getState)", {
					roomId: data.id,
					metricId: item.metric.id,
					value: val,
					statusField: item.metric.status,
					stateId: item.metric.state,
				});
			}
		});
	});
}

function renderRoomRows(states, targetPath, columns, tableBody, currentTab) {
	Object.keys(states)
		.sort()
		.forEach(id => {
			const relativeId = id.startsWith(targetPath + ".") ? id.substring(targetPath.length + 1) : id;
			const val = states[id] ? states[id].val : null;

			let data = {};
			try {
				data = val ? JSON.parse(val) : {};
			} catch (e) {
				console.warn("Failed to parse JSON for", id, val);
				data = { name: "Invalid JSON" };
			}

			data.id = relativeId;
			data = normalizeRoomData(relativeId, data, currentTab);

			buildRoomRow(data, columns, tableBody);
			addMetricsRow(data, columns, tableBody);
		});
}

function toggleMetrics(iconElement) {
	const row = iconElement.closest("tr");
	const roomId = row.dataset.deviceId;

	const metricsRow = row.nextElementSibling;
	if (metricsRow && metricsRow.classList.contains("metrics-row") && metricsRow.dataset.roomId === roomId) {
		metricsRow.classList.toggle("visible");
		iconElement.classList.toggle("expanded");
	}
}

