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
} from "./types";
import { ErrorCodes } from "./types";
import type { SnapshotService } from "../services/snapshot-service";
import type { SubscriptionRegistry } from "./subscriptions";

export interface HandlerContext {
	adapter: {
		log: {
			debug: (msg: string) => void;
			info: (msg: string) => void;
			warn: (msg: string) => void;
			error: (msg: string) => void;
		};
		config: {
			maxEventsPerSecond?: number;
			defaultSubscription?: "all" | "none";
		};
	};
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

		await ctx.adapter.setForeignStateAsync(message.payload.state, message.payload.value, message.payload.ack ?? false);
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

