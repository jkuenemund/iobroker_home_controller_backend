let socket;
const statusEl = document.getElementById("status");
const basePathEl = document.getElementById("basePath");
const tableBody = document.querySelector("#deviceTable tbody");

let currentBasePath = "";
let currentScenesPath = "";
let currentTab = "devices";

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
	scenes: [
		{ key: "expand", label: "" },
		{ key: "id", label: "ID" },
		{ key: "name", label: "Name" },
		{ key: "type", label: "Type" },
		{ key: "active", label: "Active" },
		{ key: "lastRun", label: "Last Run" },
		{ key: "nextRun", label: "Next Run" },
		{ key: "error", label: "Error" },
		{ key: "trigger", label: "Action" },
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

		// Subscribe/Unsubscribe based on tab
		if (tabName === "scenes" && window.socket && currentScenesPath) {
			console.log("Subscribing to scenes:", `${currentScenesPath}.*`);
			window.socket.emit("subscribe", `${currentScenesPath}.*`);
		}
	}
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
	// Use scenesPath for scenes tab, basePath for devices/rooms
	const targetPath = currentTab === "scenes" ? currentScenesPath : `${currentBasePath}.${currentTab}`;

	console.log("Loading data from:", targetPath);

	buildHeader();
	tableBody.innerHTML = `<tr><td colspan="${columns[currentTab].length}" style="text-align: center; color: #666;">Loading ${currentTab}...</td></tr>`;

	socket.emit("getStates", `${targetPath}.*`, (err, states) => {
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
		} else if (currentTab === "rooms") {
			renderRoomRows(states, targetPath, columns, tableBody, currentTab);
			if (window.subscribeMetricStates) {
				window.subscribeMetricStates();
			}
		} else if (currentTab === "scenes") {
			renderSceneRows(states, targetPath, columns, tableBody);
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
				currentScenesPath = obj.native.scenesPath || "cron_scenes.0.jobs";
				console.log("Adapter config loaded:", obj.native);
				basePathEl.textContent = currentBasePath || "Not set";

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

		// Handle live updates for current tab
		if (state) {
			// Check if update is for current scenes
			if (currentTab === "scenes" && currentScenesPath && id.startsWith(currentScenesPath)) {
				console.log("Scene update received:", id);
				// Debounce reload to prevent flickering
				if (window.sceneReloadTimeout) {
					clearTimeout(window.sceneReloadTimeout);
				}
				window.sceneReloadTimeout = setTimeout(() => {
					loadData();
				}, 500);
				return;
			}

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
