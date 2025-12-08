/**
 * WebSocket Server for Home Controller Adapter
 *
 * Provides a WebSocket API for clients to:
 * - Register with the adapter
 * - Fetch devices and rooms
 * - (Future) Subscribe to state changes
 */

import { WebSocket, WebSocketServer as WSServer } from "ws";
import type { IncomingMessage } from "http";
import { v4 as uuidv4 } from "uuid";
import type {
	BaseMessage,
	ClientMessage,
	ConnectedClient,
	RegisteredResponse,
	DevicesResponse,
	GetRoomsRequest,
	GetSnapshotRequest,
	RoomsResponse,
	HelpRequest,
	HelpResponse,
	SnapshotResponse,
	InitialSnapshotResponse,
	StateChangeMessage,
	ErrorMessage,
	ErrorCode,
} from "./websocket/types";
import { SnapshotService } from "./services/snapshot-service";
import { ErrorCodes } from "./websocket/types";

// Re-export for convenience
export { ErrorCodes } from "./websocket/types";

/**
 * Adapter interface - subset of ioBroker adapter methods we need
 */
interface AdapterInterface {
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
	};
	config: {
		basePath: string;
		wsPort: number;
		authMode?: "none" | "basic";
		authUser?: string;
		authPassword?: string;
		defaultSubscription?: "all" | "none";
		maxEventsPerSecond?: number;
	};
	getForeignStatesAsync: (pattern: string) => Promise<Record<string, ioBroker.State | null | undefined>>;
	getForeignStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	subscribeForeignStates: (pattern: string) => void;
}

/**
 * WebSocket Server class for Home Controller
 */
export class HomeControllerWebSocketServer {
	private wss: WSServer | null = null;
	private clients: Map<WebSocket, ConnectedClient> = new Map();
	private adapter: AdapterInterface;
	private serverVersion = "0.0.1";
	private protocolVersion = "1.0";
	private schemaVersion = "1.0";
	private seqCounter = 0;
	private snapshotService: SnapshotService;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private readonly pingIntervalMs = 28000;
	private readonly pingTimeoutMs = 10000;
	private socketMeta: WeakMap<WebSocket, { isAlive: boolean; idleTimer?: NodeJS.Timeout }> = new WeakMap();
	private onClientChangeCallback: ((clients: ConnectedClient[]) => void) | null = null;

	// Map stateId -> list of capabilities that use it
	private stateMap: Map<string, Array<{ deviceId: string; capability: string }>> = new Map();

	constructor(adapter: AdapterInterface) {
		this.adapter = adapter;
		this.snapshotService = new SnapshotService(adapter);
	}

	/**
	 * Set callback for when clients connect/disconnect
	 */
	public onClientChange(callback: (clients: ConnectedClient[]) => void): void {
		this.onClientChangeCallback = callback;
	}

	/**
	 * Notify about client changes
	 */
	private notifyClientChange(): void {
		if (this.onClientChangeCallback) {
			this.onClientChangeCallback(this.getConnectedClients());
		}
	}

	/**
	 * Start the WebSocket server
	 */
	public start(): void {
		this.wss = new WSServer({
			port: this.adapter.config.wsPort,
			perMessageDeflate: true,
		});

		this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
			const auth = this.authenticate(req);
			if (!auth.ok) {
				this.adapter.log.warn(`Rejected connection: ${auth.reason ?? "auth failed"}`);
				ws.close(auth.closeCode ?? 4001, auth.reason ?? "AUTH_FAILED");
				return;
			}
			this.handleConnection(ws, req);
		});

		// Initial subscription to all known states
		this.subscribeToAllStates();

		this.wss.on("error", (error: Error) => {
			this.adapter.log.error(`WebSocket server error: ${error.message}`);
		});

		this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), this.pingIntervalMs);

		this.adapter.log.info(`WebSocket server started on port ${this.adapter.config.wsPort}`);
	}

	/**
	 * Subscribe to all states defined in devices
	 */
	public async subscribeToAllStates(): Promise<void> {
		try {
			// Re-fetch devices to get fresh config
			const devices = await this.snapshotService.getDevices();

			this.stateMap.clear();
			const statesToSubscribe = new Set<string>();

			for (const [deviceId, config] of Object.entries(devices)) {
				if (config.capabilities) {
					for (const cap of config.capabilities) {
						if (cap.state) {
							statesToSubscribe.add(cap.state);

							// Add to map
							const existing = this.stateMap.get(cap.state) || [];
							existing.push({ deviceId, capability: cap.type });
							this.stateMap.set(cap.state, existing);
						}
					}
				}
			}

			// Subscribe to each state
			for (const oid of statesToSubscribe) {
				this.adapter.subscribeForeignStates(oid);
			}

			this.adapter.log.info(`Subscribed to ${statesToSubscribe.size} states for real-time updates`);
		} catch (error) {
			this.adapter.log.error(`Failed to subscribe to states: ${(error as Error).message}`);
		}
	}

	/**
	 * Handle state change from adapter
	 */
	public handleStateChange(id: string, state: ioBroker.State): void {
		const affected = this.stateMap.get(id);
		if (affected && affected.length > 0) {
			for (const item of affected) {
				this.broadcastStateChange(item.deviceId, item.capability, id, state.val, state.ts);
			}
		}
	}

	/**
	 * Broadcast state change to all connected clients
	 */
	private broadcastStateChange(deviceId: string, capability: string, stateId: string, value: any, ts: number): void {
		const message: StateChangeMessage = {
			type: "stateChange",
			id: undefined, // Notification has no request ID
			payload: {
				deviceId,
				capability,
				state: stateId,
				value,
				timestamp: new Date(ts).toISOString(),
			},
		};

		// Send to all connected clients
		for (const ws of this.clients.keys()) {
			this.send(ws, message);
		}
	}

	/**
	 * Stop the WebSocket server
	 */
	public stop(): void {
		if (this.wss) {
			if (this.heartbeatInterval) {
				clearInterval(this.heartbeatInterval);
				this.heartbeatInterval = null;
			}
			// Close all client connections
			for (const ws of this.clients.keys()) {
				ws.close(1001, "Server shutting down");
			}
			this.clients.clear();

			this.wss.close();
			this.wss = null;
			this.adapter.log.info("WebSocket server stopped");
		}
	}

	/**
	 * Get number of connected clients
	 */
	public getClientCount(): number {
		return this.clients.size;
	}

	/**
	 * Get list of connected clients (for admin UI)
	 */
	public getConnectedClients(): ConnectedClient[] {
		return Array.from(this.clients.values()).filter(c => c.isRegistered);
	}

	/**
	 * Disconnect a client by ID
	 */
	public disconnectClient(clientId: string): boolean {
		for (const [ws, client] of this.clients.entries()) {
			if (client.id === clientId) {
				this.adapter.log.info(`Disconnecting client ${client.name} (${clientId}) by admin request`);
				ws.close(1000, "Disconnected by administrator");
				return true;
			}
		}
		return false;
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
		this.adapter.log.debug("New WebSocket connection");

		this.socketMeta.set(ws, { isAlive: true });
		ws.on("pong", () => {
			const meta = this.socketMeta.get(ws);
			if (meta) {
				meta.isAlive = true;
			}
		});

		// Store client as unregistered initially
		this.clients.set(ws, {
			id: "",
			name: "",
			version: "",
			clientType: "",
			connectedAt: new Date(),
			isRegistered: false,
			recentRequests: [],
		});

		ws.on("message", (data: Buffer) => {
			this.handleMessage(ws, data);
		});

		ws.on("close", () => {
			const client = this.clients.get(ws);
			if (client?.isRegistered) {
				this.adapter.log.info(`Client disconnected: ${client.name} (${client.id})`);
			} else {
				this.adapter.log.debug("Unregistered client disconnected");
			}
			this.clients.delete(ws);
			const meta = this.socketMeta.get(ws);
			if (meta?.idleTimer) {
				clearTimeout(meta.idleTimer);
			}
			this.socketMeta.delete(ws);
			this.notifyClientChange();
		});

		ws.on("error", (error: Error) => {
			this.adapter.log.warn(`WebSocket client error: ${error.message}`);
		});
	}

	/**
	 * Handle incoming message from client
	 */
	private handleMessage(ws: WebSocket, data: Buffer): void {
		let message: BaseMessage;

		try {
			message = JSON.parse(data.toString()) as BaseMessage;
		} catch {
			this.sendError(ws, undefined, ErrorCodes.INVALID_MESSAGE, "Invalid JSON");
			return;
		}

		if (!message.type) {
			this.sendError(ws, message.id, ErrorCodes.INVALID_MESSAGE, "Missing message type");
			return;
		}

		this.adapter.log.debug(`Received message: ${message.type}`);

		// Log the request for debugging
		this.logRequest(ws, message.type, message.id);

		// Route message to handler
		switch (message.type) {
			case "register":
				this.handleRegister(ws, message);
				break;
			case "getDevices":
				void this.handleGetDevices(ws, message);
				break;
			case "getRooms":
				void this.handleGetRooms(ws, message as GetRoomsRequest);
				break;
			case "getSnapshot":
				void this.handleGetSnapshot(ws, message as GetSnapshotRequest);
				break;
			case "help":
				this.handleHelp(ws, message as HelpRequest);
				break;
			case "subscribe":
			case "unsubscribe":
				// Handle subscriptions (implemented but not fully utilized yet)
				break;
			default:
				this.sendError(ws, message.id, ErrorCodes.UNKNOWN_TYPE, `Unknown message type: ${message.type}`);
		}
	}

	/**
	 * Handle help request
	 */
	private handleHelp(ws: WebSocket, message: HelpRequest): void {
		const response: HelpResponse = {
			type: "help",
			id: message.id,
			payload: {
				commands: [
					{
						command: "register",
						description: "Register a client with the server",
						example: {
							type: "register",
							id: "req-1",
							payload: {
								clientName: "My Client",
								clientVersion: "1.0.0",
								clientType: "mobile",
							},
						},
					},
					{
						command: "getDevices",
						description: "Get all available devices",
						example: {
							type: "getDevices",
							id: "req-2",
						},
					},
					{
						command: "getRooms",
						description: "Get all available rooms",
						example: {
							type: "getRooms",
							id: "req-3",
						},
					},
					{
						command: "help",
						description: "Get available commands",
						example: {
							type: "help",
							id: "req-4",
						},
					},
				],
			},
		};

		this.send(ws, response);
	}

	private updateTimeout: NodeJS.Timeout | null = null;

	/**
	 * Trigger a throttled update for logs
	 */
	private triggerLogUpdate(): void {
		if (this.updateTimeout) {
			return;
		}

		this.updateTimeout = setTimeout(() => {
			this.updateTimeout = null;
			this.notifyClientChange();
		}, 2000);
	}

	/**
	 * Log a request from a client
	 */
	private logRequest(ws: WebSocket, type: string, id?: string): void {
		const client = this.clients.get(ws);
		if (client) {
			client.recentRequests.unshift({
				timestamp: new Date(),
				type: type,
				id: id,
			});

			// Keep only last 10
			if (client.recentRequests.length > 10) {
				client.recentRequests.pop();
			}

			// Update state to show logs in Admin UI
			// Use throttled update to avoid flooding ioBroker with state changes
			this.triggerLogUpdate();
		}
	}

	/**
	 * Handle client registration
	 */
	private handleRegister(ws: WebSocket, message: BaseMessage): void {
		// Cast to RegisterRequest to access payload
		const regMsg = message as ClientMessage & { type: "register" };
		const { clientName, clientVersion, clientType } = regMsg.payload;
		const clientId = uuidv4();

		// Update client info
		const client: ConnectedClient = {
			id: clientId,
			name: clientName || "Unknown",
			version: clientVersion || "0.0.0",
			clientType: clientType || "other",
			connectedAt: new Date(),
			isRegistered: true,
			recentRequests: [],
		};
		this.clients.set(ws, client);

		this.adapter.log.info(`Client registered: ${client.name} v${client.version} (${clientId})`);

		const response: RegisteredResponse = {
			type: "registered",
			id: message.id,
			payload: {
				clientId,
				serverVersion: this.serverVersion,
				protocolVersion: this.protocolVersion,
				schemaVersion: this.schemaVersion,
				capabilities: ["devices", "rooms", "stateChange", "subscribe", "setState", "batch", "compression"],
				limits: {
					maxMsgBytes: 131072,
					maxEventsPerSecond: this.adapter.config.maxEventsPerSecond ?? 50,
					supportsBatch: true,
					supportsCompression: true,
					defaultSubscription: this.adapter.config.defaultSubscription ?? "all",
				},
			},
		};

		this.send(ws, response);
		void this.sendInitialSnapshot(ws);
		this.notifyClientChange();
	}

	/**
	 * Handle getDevices request
	 */
	private async handleGetDevices(ws: WebSocket, message: BaseMessage): Promise<void> {
		const client = this.clients.get(ws);
		if (!client?.isRegistered) {
			this.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
			return;
		}

		try {
			const devices = await this.snapshotService.getDevices();

			const response: DevicesResponse = {
				type: "devices",
				id: message.id,
				payload: { devices },
			};

			this.send(ws, response);
			this.adapter.log.debug(`Sent ${Object.keys(devices).length} devices to ${client.name}`);
		} catch (error) {
			this.sendError(
				ws,
				message.id,
				ErrorCodes.INTERNAL_ERROR,
				`Failed to fetch devices: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Handle getRooms request
	 */
	private async handleGetRooms(ws: WebSocket, message: BaseMessage): Promise<void> {
		const client = this.clients.get(ws);
		if (!client?.isRegistered) {
			this.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
			return;
		}

		try {
			const rooms = await this.snapshotService.getRooms();

			const response: RoomsResponse = {
				type: "rooms",
				id: message.id,
				payload: { rooms },
			};

			this.send(ws, response);
			this.adapter.log.debug(`Sent ${Object.keys(rooms).length} rooms to ${client.name}`);
		} catch (error) {
			this.sendError(
				ws,
				message.id,
				ErrorCodes.INTERNAL_ERROR,
				`Failed to fetch rooms: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Handle getSnapshot request
	 */
	private async handleGetSnapshot(ws: WebSocket, message: BaseMessage): Promise<void> {
		const client = this.clients.get(ws);
		if (!client?.isRegistered) {
			this.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
			return;
		}

		try {
			const seq = this.nextSeq();
			const snapshot = await this.snapshotService.buildSnapshot(seq);
			const response: SnapshotResponse = {
				type: "snapshot",
				id: message.id,
				payload: {
					...snapshot,
				},
				seq,
			};
			this.send(ws, response);
		} catch (error) {
			this.sendError(
				ws,
				message.id,
				ErrorCodes.INTERNAL_ERROR,
				`Failed to fetch snapshot: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Send message to client
	 */
	private send(ws: WebSocket, message: BaseMessage): void {
		if (ws.readyState === WebSocket.OPEN) {
			const enriched: BaseMessage = {
				...message,
				seq: message.seq ?? this.nextSeq(),
				ts: message.ts ?? new Date().toISOString(),
				version: message.version ?? this.schemaVersion,
			};
			ws.send(JSON.stringify(enriched));
		}
	}

	/**
	 * Send error message to client
	 */
	private sendError(ws: WebSocket, id: string | undefined, code: ErrorCode, message: string): void {
		const errorMsg: ErrorMessage = {
			type: "error",
			id,
			error: { code, message },
		};
		this.send(ws, errorMsg);
	}

	/**
	 * Send initial snapshot after registration
	 */
	private async sendInitialSnapshot(ws: WebSocket): Promise<void> {
		const client = this.clients.get(ws);
		if (!client?.isRegistered) {
			return;
		}

		try {
			const seq = this.nextSeq();
			const snapshot = await this.snapshotService.buildSnapshot(seq);
			const response: InitialSnapshotResponse = {
				type: "initialSnapshot",
				payload: { ...snapshot },
				seq,
			};
			this.send(ws, response);
		} catch (error) {
			this.adapter.log.warn(`Failed to send initialSnapshot: ${(error as Error).message}`);
		}
	}

	/**
	 * Authenticate incoming connection (Basic or none)
	 */
	private authenticate(req: IncomingMessage): { ok: boolean; closeCode?: number; reason?: string } {
		const mode = this.adapter.config.authMode ?? "none";
		if (mode === "none") {
			return { ok: true };
		}

		if (mode === "basic") {
			const header = req.headers.authorization;
			if (!header || !header.startsWith("Basic ")) {
				return { ok: false, closeCode: 4001, reason: "AUTH_FAILED" };
			}

			const token = header.substring("Basic ".length);
			const decoded = Buffer.from(token, "base64").toString("utf8");
			const [user, pass] = decoded.split(":");
			if (!user || pass === undefined) {
				return { ok: false, closeCode: 4001, reason: "AUTH_FAILED" };
			}

			const expectedUser = this.adapter.config.authUser;
			const expectedPass = this.adapter.config.authPassword;
			if (expectedUser && expectedPass) {
				if (user === expectedUser && pass === expectedPass) {
					return { ok: true };
				}
				return { ok: false, closeCode: 4001, reason: "AUTH_FAILED" };
			}

			// If no credentials configured, allow but warn
			this.adapter.log.warn(
				"Auth mode 'basic' is enabled but no credentials are configured; allowing connection.",
			);
			return { ok: true };
		}

		return { ok: false, closeCode: 4004, reason: "PROTOCOL_VERSION_UNSUPPORTED" };
	}

	/**
	 * Heartbeat loop: ping and close idle sockets
	 */
	private checkHeartbeats(): void {
		for (const ws of this.clients.keys()) {
			const meta = this.socketMeta.get(ws);
			if (!meta) {
				continue;
			}

			if (!meta.isAlive) {
				ws.close(4008, "IDLE_TIMEOUT");
				this.clients.delete(ws);
				if (meta.idleTimer) {
					clearTimeout(meta.idleTimer);
				}
				this.socketMeta.delete(ws);
				continue;
			}

			meta.isAlive = false;
			if (ws.readyState === WebSocket.OPEN) {
				ws.ping();
				if (meta.idleTimer) {
					clearTimeout(meta.idleTimer);
				}
				meta.idleTimer = setTimeout(() => {
					const stillMeta = this.socketMeta.get(ws);
					if (stillMeta && !stillMeta.isAlive && ws.readyState === WebSocket.OPEN) {
						ws.close(4008, "IDLE_TIMEOUT");
						this.clients.delete(ws);
						this.socketMeta.delete(ws);
					}
				}, this.pingTimeoutMs);
			}
		}
	}

	/**
	 * Generate next sequence number
	 */
	private nextSeq(): number {
		this.seqCounter += 1;
		return this.seqCounter;
	}
}
