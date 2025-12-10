let socket;
const statusEl = document.getElementById("status");
const basePathEl = document.getElementById("basePath");
const tableBody = document.querySelector("#deviceTable tbody");
const metricsTimerEl = document.getElementById("metricsTimer");

let currentBasePath = "";
let currentTab = "devices";
let roomMetricsIntervalSec = 60;
let nextMetricsAt = 0;
let metricsTimerHandle = null;

const columns = {
	devices: [
		{ key: "expand", label: "" },
		{ key: "id", label: "ID" },
		{ key: "icon", label: "Icon" },
		{ key: "name", label: "Name" },
		{ key: "type", label: "Type" },
		{ key: "room", label: "Room" },
		{ key: "manufacturer", label: "Manufacturer" },
		{ key: "description", label: "Description" },
	],
	rooms: [
		{ key: "expand", label: "" },
		{ key: "id", label: "ID" },
		{ key: "icon", label: "Icon" },
		{ key: "name", label: "Name" },
		{ key: "metrics", label: "Metrics" },
		{ key: "details", label: "Details" },
	],
};

function switchTab(tabName) {
	currentTab = tabName;

	document.querySelectorAll(".tab-button").forEach(btn => {
		btn.classList.remove("active");
		if (btn.textContent.toLowerCase() === tabName) {
			btn.classList.add("active");
		}
	});

	if (currentBasePath) {
		loadData();
	}
}

function startMetricsCountdown() {
	if (!metricsTimerEl) return;
	if (metricsTimerHandle) {
		clearInterval(metricsTimerHandle);
	}
	const tick = () => {
		if (!nextMetricsAt || nextMetricsAt <= Date.now()) {
			metricsTimerEl.textContent = `Metrics batch ~ alle ${roomMetricsIntervalSec}s`;
			return;
		}
		const remaining = nextMetricsAt - Date.now();
		metricsTimerEl.textContent = `Nächster Metrics-Batch in ${formatCountdown(remaining)} (Intervall ${roomMetricsIntervalSec}s)`;
	};
	tick();
	metricsTimerHandle = setInterval(tick, 1000);
}

function buildHeader() {
	const tableHead = document.querySelector("#deviceTable thead tr");
	tableHead.innerHTML = "";
	columns[currentTab].forEach(col => {
		const th = document.createElement("th");
		th.textContent = col.label;
		tableHead.appendChild(th);
	});
}

function loadData() {
	const targetPath = `${currentBasePath}.${currentTab}`;
	console.log("Loading data from:", targetPath);

	buildHeader();
	tableBody.innerHTML = `<tr><td colspan="${columns[currentTab].length}" style="text-align: center; color: #666;">Loading ${currentTab}...</td></tr>`;

	socket.emit("getStates", targetPath + ".*", (err, states) => {
		if (err) {
			console.error("Error fetching states:", err);
			tableBody.innerHTML = `<tr><td colspan="${columns[currentTab].length}" style="color: red;">Error: ${err}</td></tr>`;
			return;
		}

		console.log("States received:", states);
		tableBody.innerHTML = "";

		if (!states || Object.keys(states).length === 0) {
			tableBody.innerHTML = `<tr><td colspan="${columns[currentTab].length}" style="text-align: center;">No ${currentTab} found under ${targetPath}</td></tr>`;
			return;
		}

		if (currentTab === "devices") {
			renderDeviceRows(states, targetPath, columns, tableBody);
		} else {
			renderRoomRows(states, targetPath, columns, tableBody, currentTab);
			if (window.subscribeMetricStates) {
				window.subscribeMetricStates();
			}
		}
	});
}

function initSocket() {
	socket = io.connect();
	window.socket = socket;

	socket.on("connect", () => {
		console.log("Connected to ioBroker");
		statusEl.textContent = "Connected";
		statusEl.style.background = "#10b981";

		socket.emit("getObject", "system.adapter.home_controller_backend.0", (err, obj) => {
			if (!err && obj && obj.native) {
				currentBasePath = obj.native.basePath;
				if (obj.native.roomMetricsBatchIntervalSec && obj.native.roomMetricsBatchIntervalSec > 0) {
					roomMetricsIntervalSec = obj.native.roomMetricsBatchIntervalSec;
				}
				console.log("Adapter config loaded:", obj.native);
				basePathEl.textContent = currentBasePath || "Not set";
				nextMetricsAt = Date.now() + roomMetricsIntervalSec * 1000;
				startMetricsCountdown();

				if (currentBasePath) {
					loadData();
				}

				loadConnectedClients();
				socket.emit("subscribe", "home_controller_backend.0.info.connectedClients");

				// Subscribe to metric states for live updates
				if (window.subscribeMetricStates) {
					window.subscribeMetricStates();
				}
			} else {
				basePathEl.textContent = "Error loading config";
				console.error("Error loading adapter config:", err);
			}
		});
	});

	socket.on("disconnect", () => {
		console.log("Disconnected from ioBroker");
		statusEl.textContent = "Disconnected";
		statusEl.style.background = "#ef4444";
	});

	socket.on("stateChange", (id, state) => {
		if (id === "home_controller_backend.0.info.connectedClients" && state) {
			updateClientsDisplay(state.val);
		}

		if (state) {
			try {
				const valEls = document.querySelectorAll(`.live-val[data-oid="${id}"]`);
				valEls.forEach(el => updateValueDisplay(el, state.val));
				if (window.handleMetricStateChange) {
					window.handleMetricStateChange(id, state);
				}
			} catch (e) {
				console.error("Error updating value display:", e);
			}
		}
	});

	socket.on("roomMetricsUpdateBatch", message => {
		if (message?.payload?.rooms) {
			applyRoomMetricsUpdateBatch(message.payload);
			nextMetricsAt = Date.now() + roomMetricsIntervalSec * 1000;
			startMetricsCountdown();
		}
	});
}

document.addEventListener("DOMContentLoaded", () => {
	initSocket();
	console.log("Home Controller Tab loaded");

	const modalOverlay = document.getElementById("addModal");
	if (modalOverlay) {
		modalOverlay.addEventListener("click", e => {
			if (e.target.id === "addModal") {
				closeAddDialog();
			}
		});
	}
});

