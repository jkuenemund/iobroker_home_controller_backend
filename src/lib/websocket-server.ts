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
    RegisterRequest,
    RegisteredResponse,
    DevicesResponse,
    GetDevicesRequest,
    GetRoomsRequest,
    RoomConfig,
    RoomsResponse,
    HelpRequest,
    HelpResponse,
    StateChangeMessage,
    ErrorCodes,
    ErrorMessage,
} from "./websocket/types";

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
    private onClientChangeCallback: ((clients: ConnectedClient[]) => void) | null = null;

    // Map stateId -> list of capabilities that use it
    private stateMap: Map<string, Array<{ deviceId: string; capability: string }>> = new Map();

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
        this.wss = new WSServer({ port: this.adapter.config.wsPort });

        this.wss.on("connection", (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        // Initial subscription to all known states
        this.subscribeToAllStates();

        this.wss.on("error", (error: Error) => {
            this.adapter.log.error(`WebSocket server error: ${error.message}`);
        });

        this.adapter.log.info(`WebSocket server started on port ${this.adapter.config.wsPort}`);
    }

    /**
     * Subscribe to all states defined in devices
     */
    public async subscribeToAllStates(): Promise<void> {
        try {
            // Re-fetch devices to get fresh config
            const devices = await this.fetchDevices();

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
                timestamp: new Date(ts).toISOString()
            }
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
                this.handleGetRooms(ws, message as GetRoomsRequest);
                break;
            case "help":
                this.handleHelp(ws, message as HelpRequest);
                break;
            case "subscribe":
            case "unsubscribe":
                // Handle subscriptions (implemented but not fully utilized yet)
                break;
            default:
                this.sendError(ws, message.id, "UNKNOWN_TYPE", `Unknown message type: ${message.type}`);
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
                                clientType: "mobile"
                            }
                        }
                    },
                    {
                        command: "getDevices",
                        description: "Get all available devices",
                        example: {
                            type: "getDevices",
                            id: "req-2"
                        }
                    },
                    {
                        command: "getRooms",
                        description: "Get all available rooms",
                        example: {
                            type: "getRooms",
                            id: "req-3"
                        }
                    },
                    {
                        command: "help",
                        description: "Get available commands",
                        example: {
                            type: "help",
                            id: "req-4"
                        }
                    }
                ]
            }
        };

        this.send(ws, response);
    }

    private updateTimeout: NodeJS.Timeout | null = null;

    /**
     * Trigger a throttled update for logs
     */
    private triggerLogUpdate(): void {
        if (this.updateTimeout) return;

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
                id: id
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

        // Parse configs first
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

        // Collect all state IDs to fetch
        const stateIds = new Set<string>();
        for (const device of Object.values(devices)) {
            if (device.capabilities) {
                for (const cap of device.capabilities) {
                    if (cap.state) {
                        stateIds.add(cap.state);
                    }
                }
            }
        }

        // Fetch current values for all states
        if (stateIds.size > 0) {
            const idArray = Array.from(stateIds);

            // Fetch in parallel
            await Promise.all(idArray.map(async (oid) => {
                try {
                    const state = await this.adapter.getForeignStateAsync(oid);
                    if (state && state.val !== undefined && state.val !== null) {
                        // Update matching capabilities
                        // Note: A state ID might be used by multiple devices/capabilities
                        for (const device of Object.values(devices)) {
                            if (device.capabilities) {
                                for (const cap of device.capabilities) {
                                    if (cap.state === oid) {
                                        cap.value = state.val;
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    this.adapter.log.warn(`Failed to fetch state ${oid}: ${(error as Error).message}`);
                }
            }));
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
