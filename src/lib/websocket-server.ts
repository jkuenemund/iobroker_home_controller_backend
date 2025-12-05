/**
 * WebSocket Server for Home Controller Adapter
 *
 * Provides a WebSocket API for clients to:
 * - Register with the adapter
 * - Fetch devices and rooms
 * - (Future) Subscribe to state changes
 */

import { WebSocket, WebSocketServer as WSServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import type {
    BaseMessage,
    ClientMessage,
    ConnectedClient,
    DeviceConfig,
    DevicesResponse,
    ErrorCodes,
    ErrorMessage,
    RegisteredResponse,
    RoomConfig,
    RoomsResponse,
} from "./types/websocket-types";

// Re-export for convenience
export { ErrorCodes } from "./types/websocket-types";

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
    };
    getForeignStatesAsync: (pattern: string) => Promise<Record<string, ioBroker.State | null | undefined>>;
}

/**
 * WebSocket Server class for Home Controller
 */
export class HomeControllerWebSocketServer {
    private wss: WSServer | null = null;
    private clients: Map<WebSocket, ConnectedClient> = new Map();
    private adapter: AdapterInterface;
    private serverVersion = "0.0.1";
    private onClientChangeCallback: ((clients: ConnectedClient[]) => void) | null = null;

    constructor(adapter: AdapterInterface) {
        this.adapter = adapter;
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
        const port = this.adapter.config.wsPort || 8082;

        this.wss = new WSServer({ port });

        this.wss.on("connection", (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        this.wss.on("error", (error: Error) => {
            this.adapter.log.error(`WebSocket server error: ${error.message}`);
        });

        this.adapter.log.info(`WebSocket server started on port ${port}`);
    }

    /**
     * Stop the WebSocket server
     */
    public stop(): void {
        if (this.wss) {
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
    private handleConnection(ws: WebSocket): void {
        this.adapter.log.debug("New WebSocket connection");

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
            this.sendError(ws, undefined, "INVALID_MESSAGE", "Invalid JSON");
            return;
        }

        if (!message.type) {
            this.sendError(ws, message.id, "INVALID_MESSAGE", "Missing message type");
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
                this.handleGetDevices(ws, message);
                break;
            case "getRooms":
                this.handleGetRooms(ws, message);
                break;
            default: {
                // Handle unknown message types
                const unknownMsg = message as BaseMessage;
                this.sendError(ws, unknownMsg.id, "UNKNOWN_TYPE", `Unknown message type: ${unknownMsg.type}`);
            }
        }
    }

    /**
     * Log a request from a client
     */
    private logRequest(ws: WebSocket, type: string, id?: string): void {
        const client = this.clients.get(ws);
        if (!client) return;

        // Add to recent requests (keep last 10)
        client.recentRequests.unshift({
            timestamp: new Date(),
            type,
            id,
        });

        // Keep only last 10 requests
        if (client.recentRequests.length > 10) {
            client.recentRequests = client.recentRequests.slice(0, 10);
        }

        // Notify about client change to update UI
        this.notifyClientChange();
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
                capabilities: ["devices", "rooms"],
            },
        };

        this.send(ws, response);
        this.notifyClientChange();
    }

    /**
     * Handle getDevices request
     */
    private async handleGetDevices(ws: WebSocket, message: BaseMessage): Promise<void> {
        const client = this.clients.get(ws);
        if (!client?.isRegistered) {
            this.sendError(ws, message.id, "NOT_REGISTERED", "Client must register first");
            return;
        }

        try {
            const devices = await this.fetchDevices();

            const response: DevicesResponse = {
                type: "devices",
                id: message.id,
                payload: { devices },
            };

            this.send(ws, response);
            this.adapter.log.debug(`Sent ${Object.keys(devices).length} devices to ${client.name}`);
        } catch (error) {
            this.sendError(ws, message.id, "INTERNAL_ERROR", `Failed to fetch devices: ${(error as Error).message}`);
        }
    }

    /**
     * Handle getRooms request
     */
    private async handleGetRooms(ws: WebSocket, message: BaseMessage): Promise<void> {
        const client = this.clients.get(ws);
        if (!client?.isRegistered) {
            this.sendError(ws, message.id, "NOT_REGISTERED", "Client must register first");
            return;
        }

        try {
            const rooms = await this.fetchRooms();

            const response: RoomsResponse = {
                type: "rooms",
                id: message.id,
                payload: { rooms },
            };

            this.send(ws, response);
            this.adapter.log.debug(`Sent ${Object.keys(rooms).length} rooms to ${client.name}`);
        } catch (error) {
            this.sendError(ws, message.id, "INTERNAL_ERROR", `Failed to fetch rooms: ${(error as Error).message}`);
        }
    }

    /**
     * Fetch all devices from ioBroker states
     */
    private async fetchDevices(): Promise<Record<string, DeviceConfig>> {
        const basePath = this.adapter.config.basePath;
        const pattern = `${basePath}.devices.*`;

        const states = await this.adapter.getForeignStatesAsync(pattern);
        const devices: Record<string, DeviceConfig> = {};

        for (const [id, state] of Object.entries(states)) {
            if (!state?.val) continue;

            const deviceId = id.substring(`${basePath}.devices.`.length);

            try {
                const config = JSON.parse(state.val as string) as DeviceConfig;
                devices[deviceId] = config;
            } catch {
                this.adapter.log.warn(`Failed to parse device config for ${deviceId}`);
            }
        }

        return devices;
    }

    /**
     * Fetch all rooms from ioBroker states
     */
    private async fetchRooms(): Promise<Record<string, RoomConfig>> {
        const basePath = this.adapter.config.basePath;
        const pattern = `${basePath}.rooms.*`;

        const states = await this.adapter.getForeignStatesAsync(pattern);
        const rooms: Record<string, RoomConfig> = {};

        for (const [id, state] of Object.entries(states)) {
            if (!state?.val) continue;

            const roomId = id.substring(`${basePath}.rooms.`.length);

            try {
                const config = JSON.parse(state.val as string) as RoomConfig;
                rooms[roomId] = config;
            } catch (error) {
                this.adapter.log.warn(`Failed to parse room config for ${roomId}: ${(error as Error).message}`);
            }
        }

        return rooms;
    }

    /**
     * Send message to client
     */
    private send(ws: WebSocket, message: BaseMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send error message to client
     */
    private sendError(
        ws: WebSocket,
        id: string | undefined,
        code: keyof typeof ErrorCodes,
        message: string,
    ): void {
        const errorMsg: ErrorMessage = {
            type: "error",
            id,
            error: { code, message },
        };
        this.send(ws, errorMsg);
    }
}
