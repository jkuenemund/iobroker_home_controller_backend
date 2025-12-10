function relativeTime(ts) {
	const now = Date.now();
	const diffMs = now - ts;
	if (Number.isNaN(diffMs)) return "–";
	const minutes = Math.floor(diffMs / 60000);
	if (minutes < 1) return "vor wenigen Sekunden";
	if (minutes === 1) return "vor 1 Minute";
	if (minutes < 60) return `vor ${minutes} Minuten`;
	const hours = Math.floor(minutes / 60);
	if (hours === 1) return "vor 1 Stunde";
	if (hours < 24) return `vor ${hours} Stunden`;
	const days = Math.floor(hours / 24);
	return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}

function renderMetricSummary(metrics, count) {
	const total = count ?? (Array.isArray(metrics) ? metrics.length : 0);
	if (!Array.isArray(metrics) || metrics.length === 0) {
		const label = total > 0 ? `${total} metrics` : "No metrics";
		return `<span style="color:#94a3b8;">${label}</span>`;
	}
	const badges = metrics.slice(0, 3).map(m => {
		const derivedStatus = (
			m.status ||
			(m.value !== undefined && m.value !== null
				? "ok"
				: m.state
					? "ok"
					: "nodata")
		).toLowerCase();
		const name = m.name || m.id || "Metric";
		return `<span class="metric-badge ${derivedStatus}">${name}</span>`;
	});
	const moreCount = total - Math.min(total, 3);
	const more = moreCount > 0 ? ` +${moreCount} more` : "";
	return `<div class="metric-summary-badges">${badges.join("")}${more ? `<span style="color:#64748b;">${more}</span>` : ""}</div>`;
}

function updateValueDisplay(element, value) {
	if (value === null || value === undefined) {
		element.textContent = "-";
		element.classList.remove("active");
	} else {
		element.textContent = value.toString();
		if (typeof value === "boolean") {
			if (value) {
				element.textContent = "TRUE";
				element.classList.add("active");
			} else {
				element.textContent = "FALSE";
				element.classList.remove("active");
			}
		}
	}
}

// Shared cache for room metrics values
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.roomMetricsCache = window.roomMetricsCache || {};

// Metrics timer helpers
function formatCountdown(ms) {
	if (ms <= 0) return "bald";
	const totalSec = Math.floor(ms / 1000);
	if (totalSec < 60) return `${totalSec}s`;
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return `${min}m ${sec}s`;
}

const templates = {
	devices: {
		name: "New Device",
		type: "light",
		room: "livingroom",
		icon: "💡",
		capabilities: [
			{
				type: "toggle",
				state: "adapter.0.device.state",
				description: "On/Off control",
			},
		],
		manufacturer: "Unknown",
		model: "Unknown",
		description: "Device description",
	},
	rooms: {
		name: "New Room",
		icon: "🏠",
		metrics: [],
	},
};

function validateConfig(type, config) {
	const errors = [];

	if (type === "devices") {
		if (!config.name || typeof config.name !== "string") {
			errors.push('"name" is required and must be a string');
		}
		if (!config.type || typeof config.type !== "string") {
			errors.push('"type" is required and must be a string (e.g., light, window, socket)');
		}
		if (!config.room || typeof config.room !== "string") {
			errors.push('"room" is required and must be a string');
		}
		if (!config.icon || typeof config.icon !== "string") {
			errors.push('"icon" is required and must be a string (emoji)');
		}
		if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
			errors.push('"capabilities" is required and must be a non-empty array');
		} else {
			config.capabilities.forEach((cap, i) => {
				if (!cap.type) errors.push(`Capability ${i + 1}: "type" is required`);
				if (!cap.state) errors.push(`Capability ${i + 1}: "state" is required`);
			});
		}
	} else if (type === "rooms") {
		if (!config.name || typeof config.name !== "string") {
			errors.push('"name" is required and must be a string');
		}
		if (!config.icon || typeof config.icon !== "string") {
			errors.push('"icon" is required and must be a string (emoji)');
		}
		if (config.metrics !== undefined && !Array.isArray(config.metrics)) {
			errors.push('"metrics" must be an array if provided');
		}
	}

	return errors;
}

