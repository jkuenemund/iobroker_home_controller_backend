/*
 * Created with @iobroker/create-adapter v3.1.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import { HomeControllerWebSocketServer } from "./lib/websocket-server";

class HomeControllerBackend extends utils.Adapter {
	private wsServer: HomeControllerWebSocketServer | null = null;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "home_controller_backend",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		this.log.info("Home Controller Backend starting...");
		this.log.debug(`Config: basePath=${this.config.basePath}, wsPort=${this.config.wsPort}`);

		// Create state for connected clients
		await this.setObjectNotExistsAsync("info.connectedClients", {
			type: "state",
			common: {
				name: "Connected WebSocket clients",
				type: "string",
				role: "json",
				read: true,
				write: false,
			},
			native: {},
		});

		// Initialize with empty array
		await this.setStateAsync("info.connectedClients", JSON.stringify([]), true);

		// Start WebSocket server
		try {
			this.wsServer = new HomeControllerWebSocketServer(this);

			// Register callback for client changes
			this.wsServer.onClientChange(clients => {
				const clientInfo = clients.map(c => ({
					id: c.id,
					name: c.name,
					authUser: c.authUser,
					version: c.version,
					clientType: c.clientType,
					connectedAt: c.connectedAt.toISOString(),
					recentRequests: c.recentRequests.map(r => ({
						timestamp: r.timestamp.toISOString(),
						type: r.type,
						id: r.id,
					})),
				}));
				void this.setStateAsync("info.connectedClients", JSON.stringify(clientInfo), true);
			});

			await this.wsServer.start();
			this.log.info("Home Controller Backend ready");
		} catch (error) {
			this.log.error(`Failed to start WebSocket server: ${(error as Error).message}`);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param callback - Callback to signal completion
	 */
	private onUnload(callback: () => void): void {
		try {
			this.log.info("Home Controller Backend shutting down...");

			// Stop WebSocket server
			if (this.wsServer) {
				this.wsServer.stop();
				this.wsServer = null;
			}

			this.log.info("Home Controller Backend stopped");
			callback();
		} catch (error) {
			this.log.error(`Error during unloading: ${(error as Error).message}`);
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 *
	 * @param id - State ID that changed
	 * @param state - New state value or null if deleted
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			this.log.debug(`State ${id} changed: ${state.val} (ack = ${state.ack})`);
			this.wsServer?.handleStateChange(id, state);
		} else {
			this.log.debug(`State ${id} deleted`);
		}
	}

	/**
	 * Handle messages from admin UI
	 *
	 * @param obj - Message object from admin UI
	 */
	private onMessage(obj: ioBroker.Message): void {
		if (typeof obj === "object" && obj.message) {
			if (obj.command === "disconnectClient") {
				const clientId = obj.message as string;
				this.log.info(`Admin request to disconnect client: ${clientId}`);

				const success = this.wsServer?.disconnectClient(clientId) ?? false;

				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { success }, obj.callback);
				}
			}
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new HomeControllerBackend(options);
} else {
	// otherwise start the instance directly
	(() => new HomeControllerBackend())();
}
