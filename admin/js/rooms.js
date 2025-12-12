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
		if (!metric.id) {
			metric.id = metric.state || metric.type;
		}
		if (!metric.name) {
			metric.name = metric.type || metric.id;
		}
		return metric;
	});

	data.__metrics = metricsArray;
	data.__metricsCount = metricsArray.length || (typeof data.metrics === "number" ? data.metrics : 0);

	// cache and indexes for updates/subscriptions
	if (!window.roomMetricsCache) {
		// @ts-expect-error - window properties for room metrics cache
		window.roomMetricsCache = {};
	}
	if (!window.metricOids) {
		// @ts-expect-error - window properties for metric OIDs
		window.metricOids = new Set();
	}
	if (!window.metricStateIndex) {
		// @ts-expect-error - window properties for metric state index
		window.metricStateIndex = new Map();
	}
	// store a shallow copy to keep unit/label/type
	window.roomMetricsCache[relativeId] = metricsArray.map(m => ({ ...m }));
	metricsArray.forEach(m => {
		if (m.state) {
			window.metricOids.add(m.state);
			const key = m.state;
			window.metricStateIndex.set(key, { roomId: relativeId, metricId: m.id || m.state || m.type });
		}
	});

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
		const metricId = metric.id || metric.state || metric.type || "";
		if (metricId) {
			item.dataset.metricId = metricId;
		}

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

			// Sync fetched value into the cache so later updates keep sibling metrics intact
			const roomId = data.id;
			const metricKey = item.metric.id || item.metric.state || item.metric.type;
			if (metricKey) {
				const cache = window.roomMetricsCache[roomId] || [];
				const byId = new Map(cache.map(m => [m.id || m.state || m.type, m]));
				const existing = byId.get(metricKey) || {};
				byId.set(metricKey, {
					...existing,
					...item.metric,
					id: metricKey,
					value: val,
					ts,
					status,
				});
				window.roomMetricsCache[roomId] = Array.from(byId.values());
			}

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

function mergeRoomMetrics(roomId, updates) {
	if (!window.roomMetricsCache) {
		return;
	}
	const cache = window.roomMetricsCache[roomId] || [];
	const byId = new Map(cache.map(m => [m.id || m.state || m.type, m]));
	updates.forEach(up => {
		const key = up.id || up.state || up.type;
		if (!key) {
			return;
		}
		const existing = byId.get(key) || {};
		const nextValue = up.value !== undefined ? up.value : existing.value;
		const nextStatus =
			up.status ||
			existing.status ||
			(nextValue !== undefined && nextValue !== null ? "ok" : up.state || existing.state ? "ok" : "nodata");
		byId.set(key, {
			...existing,
			...up,
			id: key,
			value: nextValue,
			status: nextStatus,
			label: up.label || existing.label || existing.name,
			name: up.label || existing.name,
		});
	});
	const merged = Array.from(byId.values());
	window.roomMetricsCache[roomId] = merged;
	return merged;
}

function updateRoomMetricsDom(roomId, metrics) {
	const row = document.querySelector(`tr[data-device-id="${roomId}"]`);
	if (!row) {
		return;
	}
	// update summary cell (metrics column is index 4)
	const metricsCell = row.children[4];
	if (metricsCell) {
		metricsCell.innerHTML = renderMetricSummary(metrics, metrics.length);
	}
	// update details row if present
	const metricsRow = row.nextElementSibling;
	if (!metricsRow || !metricsRow.classList.contains("metrics-row")) {
		return;
	}
	const items = metricsRow.querySelectorAll(".metric-item");
	items.forEach(item => {
		const key = item.dataset.metricId;
		if (!key) {
			return;
		}
		const metric = metrics.find(m => (m.id || m.state || m.type) === key);
		if (!metric) {
			return;
		}
		const valueDiv = item.querySelector(".metric-value");
		const badge = item.querySelector(".metric-badge");
		const tsDiv = item.querySelector(".metric-ts");
		const unit = metric.unit ? ` ${metric.unit}` : "";
		const val = metric.value !== undefined && metric.value !== null ? metric.value : "-";
		if (valueDiv) {
			valueDiv.textContent = `${val}${unit}`;
		}
		const status = (
			metric.status || (metric.value !== undefined && metric.value !== null ? "ok" : "nodata")
		).toLowerCase();
		if (badge) {
			badge.className = `metric-badge ${status}`;
			badge.textContent = status.toUpperCase();
		}
		if (tsDiv) {
			tsDiv.textContent = metric.ts ? relativeTime(new Date(metric.ts).getTime()) : "–";
		}
	});
}

function applyRoomMetricsUpdateBatch(payload) {
	if (!payload?.rooms) {
		return;
	}
	payload.rooms.forEach(room => {
		const merged = mergeRoomMetrics(room.roomId, room.metrics);
		if (merged) {
			updateRoomMetricsDom(room.roomId, merged);
		}
	});
}

function handleMetricStateChange(id, state) {
	if (!window.metricStateIndex) {
		return;
	}
	const ref = window.metricStateIndex.get(id);
	if (!ref) {
		return;
	}
	const updates = [
		{
			id: ref.metricId,
			state: id,
			value: state?.val,
			ts: state?.ts ? new Date(state.ts).toISOString() : new Date().toISOString(),
			status: state?.val === undefined || state?.val === null ? "nodata" : "ok",
		},
	];
	const merged = mergeRoomMetrics(ref.roomId, updates);
	if (merged) {
		updateRoomMetricsDom(ref.roomId, merged);
	} else {
		enqueuePendingMetricUpdate(ref.roomId, updates[0]);
	}
}

function subscribeMetricStates() {
	if (!window.metricOids || !window.socket) {
		return;
	}
	window.metricOids.forEach(oid => {
		window.socket.emit("subscribe", oid);
	});
}

// expose for app.js
// @ts-expect-error - exposing functions to window for app.js
window.applyRoomMetricsUpdateBatch = applyRoomMetricsUpdateBatch;
// @ts-expect-error - exposing functions to window for app.js
window.handleMetricStateChange = handleMetricStateChange;
// @ts-expect-error - exposing functions to window for app.js
window.subscribeMetricStates = subscribeMetricStates;

function resetRoomMetricsCaches() {
	// @ts-expect-error - resetting window cache properties
	window.roomMetricsCache = {};
	// @ts-expect-error - resetting window cache properties
	window.pendingRoomMetricUpdates = new Map();
	// @ts-expect-error - resetting window cache properties
	window.metricOids = new Set();
	// @ts-expect-error - resetting window cache properties
	window.metricStateIndex = new Map();
}

// expose for app.js
// @ts-expect-error - exposing function to window for app.js
window.resetRoomMetricsCaches = resetRoomMetricsCaches;

function renderRoomRows(states, targetPath, columns, tableBody, currentTab) {
	resetRoomMetricsCaches();

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
			data = normalizeRoomData(relativeId, data, currentTab);

			buildRoomRow(data, columns, tableBody);
			addMetricsRow(data, columns, tableBody);

			// apply pending updates if any
			if (window.pendingRoomMetricUpdates && window.pendingRoomMetricUpdates.has(relativeId)) {
				const updates = window.pendingRoomMetricUpdates.get(relativeId);
				if (updates && updates.length > 0) {
					const merged = mergeRoomMetrics(relativeId, updates);
					if (merged) {
						updateRoomMetricsDom(relativeId, merged);
					}
				}
				window.pendingRoomMetricUpdates.delete(relativeId);
			}
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

function enqueuePendingMetricUpdate(roomId, update) {
	if (!window.pendingRoomMetricUpdates) {
		// @ts-expect-error - window properties for pending metric updates
		window.pendingRoomMetricUpdates = new Map();
	}
	const arr = window.pendingRoomMetricUpdates.get(roomId) || [];
	arr.push(update);
	window.pendingRoomMetricUpdates.set(roomId, arr);
}
