import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type {
	BaseMessage,
	ConnectedClient,
	DevicesResponse,
	GetRoomsRequest,
	GetSnapshotRequest,
	HelpRequest,
	HelpResponse,
	InitialSnapshotResponse,
	RegisteredResponse,
	RoomsResponse,
	SnapshotResponse,
	SubscribeRequest,
	UnsubscribeRequest,
	StateChangeMessage,
	SetStateRequest,
	TriggerSceneRequest,
	SaveSceneRequest,
	DeleteSceneRequest,
} from "./types";
import { ErrorCodes } from "./types";
import type { SnapshotService } from "../services/snapshot-service";
import type { SubscriptionRegistry } from "./subscriptions";
import type { AdapterInterface } from "./adapter-interface";

export interface HandlerContext {
	adapter: Pick<AdapterInterface, "log" | "config" | "setForeignStateAsync" | "delForeignObjectAsync" | "extendForeignObjectAsync">;
	clients: Map<WebSocket, ConnectedClient>;
	snapshotService: SnapshotService;
	nextSeq: () => number;
	getSeq: () => number;
	serverVersion: string;
	protocolVersion: string;
	schemaVersion: string;
	subscriptions: SubscriptionRegistry;
	send: (ws: WebSocket, message: BaseMessage) => void;
	sendError: (ws: WebSocket, id: string | undefined, code: string, message: string) => void;
	notifyClientChange: () => void;
}

export function handleRegister(ctx: HandlerContext, ws: WebSocket, message: BaseMessage): void {
	const regMsg = message as BaseMessage & { payload: any };
	const { clientName, clientVersion, clientType, lastSeqSeen } = regMsg.payload;
	const currentSeq = ctx.getSeq();
	if (lastSeqSeen !== undefined && lastSeqSeen < currentSeq) {
		ctx.sendError(ws, message.id, ErrorCodes.RESYNC_REQUIRED, "Snapshot required; lastSeqSeen stale");
	}
	const clientId = uuidv4();

	const client: ConnectedClient = {
		id: clientId,
		name: clientName || "Unknown",
		version: clientVersion || "0.0.0",
		clientType: clientType || "other",
		connectedAt: new Date(),
		isRegistered: true,
		recentRequests: [],
	};
	ctx.clients.set(ws, client);
	// apply default subscription strategy (all/none)
	ctx.subscriptions.setDefault(ws);

	ctx.adapter.log.info(`Client registered: ${client.name} v${client.version} (${clientId})`);

	const response: RegisteredResponse = {
		type: "registered",
		id: message.id,
		payload: {
			clientId,
			serverVersion: ctx.serverVersion,
			protocolVersion: ctx.protocolVersion,
			schemaVersion: ctx.schemaVersion,
			capabilities: ["devices", "rooms", "stateChange", "subscribe", "setState", "batch", "compression"],
			limits: {
				maxMsgBytes: 131072,
				maxEventsPerSecond: ctx.adapter.config.maxEventsPerSecond ?? 50,
				supportsBatch: true,
				supportsCompression: true,
				defaultSubscription: ctx.adapter.config.defaultSubscription ?? "all",
			},
		},
	};

	ctx.send(ws, response);
	void sendInitialSnapshot(ctx, ws);
	ctx.notifyClientChange();
}

export async function handleGetDevices(
	ctx: HandlerContext,
	ws: WebSocket,
	message: BaseMessage,
): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	try {
		const devices = await ctx.snapshotService.getDevices();
		const response: DevicesResponse = {
			type: "devices",
			id: message.id,
			payload: { devices },
		};
		ctx.send(ws, response);
		ctx.adapter.log.debug(`Sent ${Object.keys(devices).length} devices to ${client.name}`);
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to fetch devices: ${(error as Error).message}`,
		);
	}
}

export async function handleGetRooms(
	ctx: HandlerContext,
	ws: WebSocket,
	message: GetRoomsRequest,
): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	try {
		const rooms = await ctx.snapshotService.getRooms();
		const response: RoomsResponse = {
			type: "rooms",
			id: message.id,
			payload: { rooms },
		};
		ctx.send(ws, response);
		ctx.adapter.log.debug(`Sent ${Object.keys(rooms).length} rooms to ${client.name}`);
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to fetch rooms: ${(error as Error).message}`,
		);
	}
}

export async function handleGetSnapshot(
	ctx: HandlerContext,
	ws: WebSocket,
	message: GetSnapshotRequest,
): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	try {
		const seq = ctx.nextSeq();
		const snapshot = await ctx.snapshotService.buildSnapshot(seq);
		const response: SnapshotResponse = {
			type: "snapshot",
			id: message.id,
			payload: { ...snapshot },
			seq,
		};
		ctx.send(ws, response);
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to fetch snapshot: ${(error as Error).message}`,
		);
	}
}

export function handleHelp(ctx: HandlerContext, ws: WebSocket, message: HelpRequest): void {
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
					command: "getSnapshot",
					description: "Get devices and rooms snapshot",
					example: {
						type: "getSnapshot",
						id: "req-4",
					},
				},
				{
					command: "help",
					description: "Get available commands",
					example: {
						type: "help",
						id: "req-5",
					},
				},
				{
					command: "subscribe",
					description: "Subscribe with filters",
					example: {
						type: "subscribe",
						id: "req-sub-1",
						payload: {
							deviceIds: ["livingroom_light"],
							capabilityTypes: ["toggle"],
						},
					},
				},
				{
					command: "unsubscribe",
					description: "Unsubscribe filters (empty to clear all)",
					example: {
						type: "unsubscribe",
						id: "req-unsub-1",
						payload: {},
					},
				},
			],
		},
	};
	ctx.send(ws, response);
}

export function handleSubscribe(
	ctx: HandlerContext,
	ws: WebSocket,
	message: SubscribeRequest | UnsubscribeRequest,
): void {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}
	const filters = message.payload ?? {};
	if (message.type === "subscribe") {
		ctx.subscriptions.subscribe(ws, filters);
		ctx.send(ws, { type: "subscribed", id: message.id });
	} else {
		ctx.subscriptions.unsubscribe(ws, filters);
		ctx.send(ws, { type: "unsubscribed", id: message.id });
	}
}

export function applySubscriptions(
	ctx: HandlerContext,
	event: StateChangeMessage,
): Array<[WebSocket, StateChangeMessage]> {
	const deliveries: Array<[WebSocket, StateChangeMessage]> = [];
	for (const ws of ctx.clients.keys()) {
		if (ctx.subscriptions.shouldDeliver(ws, event, ctx.clients)) {
			deliveries.push([ws, event]);
		}
	}
	return deliveries;
}

export async function handleSetState(ctx: HandlerContext, ws: WebSocket, message: SetStateRequest): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	try {
		const validation = await ctx.snapshotService.validateSetState(
			message.payload.deviceId,
			message.payload.capability,
			message.payload.state,
		);
		if (!validation.ok) {
			ctx.sendError(ws, message.id, ErrorCodes.PERMISSION_DENIED, validation.reason ?? "Not allowed");
			return;
		}

		const value = message.payload.value as ioBroker.SettableState | ioBroker.StateValue | ioBroker.State;
		await ctx.adapter.setForeignStateAsync(message.payload.state, value, message.payload.ack ?? false);
		// respond with ack message (could be a stateChange later)
		ctx.send(ws, { type: "ack", id: message.id });
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to set state: ${(error as Error).message}`,
		);
	}
}

export async function handleTriggerScene(
	ctx: HandlerContext,
	ws: WebSocket,
	message: TriggerSceneRequest,
): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	const { sceneId } = message.payload;
	if (!sceneId || typeof sceneId !== "string") {
		ctx.sendError(ws, message.id, ErrorCodes.INVALID_PAYLOAD, "Invalid sceneId");
		return;
	}

	try {
		// Set trigger state to true
		const triggerPath = `cron_scenes.0.jobs.${sceneId}.trigger`;
		// ack=false because the adapter will ack it
		await ctx.adapter.setForeignStateAsync(triggerPath, true, false);

		// Send acknowledgment
		ctx.send(ws, { type: "ack", id: message.id });
		ctx.adapter.log.info(`Triggered scene ${sceneId} via WebSocket from ${client.name}`);
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to trigger scene: ${(error as Error).message}`,
		);
	}
}



export async function handleSaveScene(
	ctx: HandlerContext,
	ws: WebSocket,
	message: SaveSceneRequest,
): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	const { sceneId, config } = message.payload;
	if (!sceneId || !config) {
		ctx.sendError(ws, message.id, ErrorCodes.INVALID_PAYLOAD, "Missing sceneId or config");
		return;
	}

	try {
		const statePath = `cron_scenes.0.jobs.${message.payload.sceneId}`;

		// Ensure the object exists using extendForeignObjectAsync (creates if not exists, updates if exists)
		await ctx.adapter.extendForeignObjectAsync(statePath, {
			type: "state",
			common: {
				name: message.payload.sceneId, // Using ID as name initially
				type: "string", // JSON content is stored as string
				role: "json", // Role for JSON content
				read: true,
				write: true,
				desc: "Created by home_controller",
			},
			native: {},
		});

		// Save as JSON string
		await ctx.adapter.setForeignStateAsync(statePath, JSON.stringify(config), true);

		ctx.send(ws, { type: "ack", id: message.id });
		ctx.adapter.log.info(`Saved scene ${sceneId} via WebSocket from ${client.name}`);
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to save scene: ${(error as Error).message}`,
		);
	}
}

export async function handleDeleteScene(
	ctx: HandlerContext,
	ws: WebSocket,
	message: DeleteSceneRequest,
): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		ctx.sendError(ws, message.id, ErrorCodes.NOT_REGISTERED, "Client must register first");
		return;
	}

	const { sceneId } = message.payload;
	if (!sceneId) {
		ctx.sendError(ws, message.id, ErrorCodes.INVALID_PAYLOAD, "Missing sceneId");
		return;
	}

	try {
		const objectPath = `cron_scenes.0.jobs.${sceneId}`;
		await ctx.adapter.delForeignObjectAsync(objectPath);

		ctx.send(ws, { type: "ack", id: message.id });
		ctx.adapter.log.info(`Deleted scene ${sceneId} via WebSocket from ${client.name}`);
	} catch (error) {
		ctx.sendError(
			ws,
			message.id,
			ErrorCodes.INTERNAL_ERROR,
			`Failed to delete scene: ${(error as Error).message}`,
		);
	}
}

async function sendInitialSnapshot(ctx: HandlerContext, ws: WebSocket): Promise<void> {
	const client = ctx.clients.get(ws);
	if (!client?.isRegistered) {
		return;
	}
	try {
		const seq = ctx.nextSeq();
		const snapshot = await ctx.snapshotService.buildSnapshot(seq);
		const response: InitialSnapshotResponse = {
			type: "initialSnapshot",
			payload: { ...snapshot },
			seq,
		};
		ctx.send(ws, response);
	} catch (error) {
		ctx.adapter.log.warn(`Failed to send initialSnapshot: ${(error as Error).message}`);
	}
}

