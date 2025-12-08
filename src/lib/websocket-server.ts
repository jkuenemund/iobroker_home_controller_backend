/**
 * WebSocket Server for Home Controller Adapter
 *
 * Provides a WebSocket API for clients to:
 * - Register with the adapter
 * - Fetch devices and rooms
 * - (Future) Subscribe to state changes
 */

/* eslint-disable jsdoc/require-param, jsdoc/require-jsdoc */

import { WebSocket, WebSocketServer as WSServer } from "ws";
import type { IncomingMessage } from "http";
import type { BaseMessage, ConnectedClient, InitialSnapshotResponse, ErrorMessage, ErrorCode } from "./websocket/types";
import { SnapshotService } from "./services/snapshot-service";
import { ErrorCodes } from "./websocket/types";
import type { HandlerContext } from "./websocket/handlers";
import { routeMessage } from "./websocket/routes";
import { StateChangeManager } from "./websocket/state-change";
import { SubscriptionRegistry } from "./websocket/subscriptions";
import { validateIncoming } from "./websocket/codec";

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
	setForeignStateAsync: (id: string, value: unknown, ack?: boolean) => Promise<void>;
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
	private subscriptions: SubscriptionRegistry;
	private onClientChangeCallback: ((clients: ConnectedClient[]) => void) | null = null;

	// Map stateId -> list of capabilities that use it
	private stateChangeManager: StateChangeManager;

	constructor(adapter: AdapterInterface) {
		this.adapter = adapter;
		this.snapshotService = new SnapshotService(adapter);
		this.subscriptions = new SubscriptionRegistry({
			defaultSubscription: this.adapter.config.defaultSubscription ?? "all",
		});
		this.stateChangeManager = new StateChangeManager(
			{
				adapter: this.adapter,
				snapshotService: this.snapshotService,
				clients: this.clients,
				send: (ws: WebSocket, msg: BaseMessage) => this.send(ws, msg),
			},
			this.subscriptions,
		);
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
		void this.stateChangeManager.subscribeToAllStates();

		this.wss.on("error", (error: Error) => {
			this.adapter.log.error(`WebSocket server error: ${error.message}`);
		});

		this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), this.pingIntervalMs);

		this.adapter.log.info(`WebSocket server started on port ${this.adapter.config.wsPort}`);
	}

	/**
	 * Handle state change from adapter
	 */
	public handleStateChange(id: string, state: ioBroker.State): void {
		this.stateChangeManager.handleStateChange(id, state);
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

		const validation = validateIncoming(message);
		if (!validation.ok) {
			this.sendError(
				ws,
				message.id,
				ErrorCodes.INVALID_PAYLOAD,
				validation.errors?.join("; ") ?? "Invalid payload",
			);
			return;
		}

		this.adapter.log.debug(`Received message: ${message.type}`);

		// Log the request for debugging
		this.logRequest(ws, message.type, message.id);

		// Route message to handler
		routeMessage(this.buildHandlerContext(), ws, message);
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

	private buildHandlerContext(): HandlerContext {
		return {
			adapter: this.adapter,
			clients: this.clients,
			snapshotService: this.snapshotService,
			nextSeq: () => this.nextSeq(),
			serverVersion: this.serverVersion,
			protocolVersion: this.protocolVersion,
			schemaVersion: this.schemaVersion,
			subscriptions: this.subscriptions,
			send: (socket: WebSocket, msg: BaseMessage) => this.send(socket, msg),
			sendError: (socket: WebSocket, id: string | undefined, code: string, msg: string) =>
				this.sendError(socket, id, code as ErrorCode, msg),
			notifyClientChange: () => this.notifyClientChange(),
		};
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
