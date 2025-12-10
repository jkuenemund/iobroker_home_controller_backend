/* eslint-disable jsdoc/require-jsdoc */

// WebSocket Message Types for Home Controller Adapter

// =============================================================================
// Base Message Types
// =============================================================================

/**
 * Base interface for all WebSocket messages
 */
export interface BaseMessage {
	/** Message type identifier */
	type: string;
	/** Optional request ID for request/response matching */
	id?: string;
	/** Sequence number (server-assigned on outbound messages) */
	seq?: number;
	/** Timestamp ISO-String (server-assigned on outbound messages) */
	ts?: string;
	/** Schema/Envelope version */
	version?: string;
}

/**
 * Error information included in error responses
 */
export interface ErrorInfo {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

/**
 * Base interface for error responses
 */
export interface ErrorMessage extends BaseMessage {
	type: "error";
	error: ErrorInfo;
}

// =============================================================================
// Client → Server Messages
// =============================================================================

/**
 * Client registration request
 */
export interface RegisterRequest extends BaseMessage {
	type: "register";
	payload: {
		clientName: string;
		clientVersion: string;
		clientType: "mobile" | "web" | "desktop" | "other";
		lastSeqSeen?: number;
		acceptCompression?: boolean;
	};
}

/**
 * Request to get all devices
 */
export interface GetDevicesRequest extends BaseMessage {
	type: "getDevices";
}

/**
 * Request to get all rooms
 */
export interface GetRoomsRequest extends BaseMessage {
	type: "getRooms";
}

/**
 * Request available commands
 */
export interface HelpRequest extends BaseMessage {
	type: "help";
}

/**
 * Request full snapshot (devices + rooms)
 */
export interface GetSnapshotRequest extends BaseMessage {
	type: "getSnapshot";
}

export interface SubscribeRequest extends BaseMessage {
	type: "subscribe";
	payload?: {
		deviceIds?: string[];
		rooms?: string[];
		capabilityTypes?: string[];
	};
}

export interface UnsubscribeRequest extends BaseMessage {
	type: "unsubscribe";
	payload?: {
		deviceIds?: string[];
		rooms?: string[];
		capabilityTypes?: string[];
	};
}

export interface SetStateRequest extends BaseMessage {
	type: "setState";
	payload: {
		deviceId: string;
		capability: string;
		state: string;
		value: unknown;
		ack?: boolean;
	};
}

// =============================================================================
// Server → Client Messages
// =============================================================================

/**
 * Server response to successful registration
 */
export interface RegisteredResponse extends BaseMessage {
	type: "registered";
	payload: {
		clientId: string;
		serverVersion: string;
		protocolVersion: string;
		schemaVersion: string;
		capabilities: string[];
		limits: {
			maxMsgBytes: number;
			maxEventsPerSecond: number;
			supportsBatch: boolean;
			supportsCompression: boolean;
			defaultSubscription: "all" | "none";
		};
	};
}

/**
 * Device configuration (matches the JSON stored in ioBroker states)
 */
export interface DeviceConfig {
	name: string;
	type: string;
	room: string;
	icon: string;
	capabilities: DeviceCapability[];
	manufacturer?: string;
	model?: string;
	description?: string;
}

/**
 * Device capability definition
 */
export interface DeviceCapability {
	type: string;
	state: string;
	description?: string;
	min?: number;
	max?: number;
	unit?: string;
	inverted?: boolean;
	stop?: string;
	/** Current value of the state (if available) */
	value?: unknown;
}

/**
 * Response containing all devices
 */
export interface DevicesResponse extends BaseMessage {
	type: "devices";
	payload: {
		devices: Record<string, DeviceConfig>;
	};
}

/**
 * Room configuration (matches the JSON stored in ioBroker states)
 */
export interface RoomConfig {
	name: string;
	icon: string;
	metrics?: RoomMetric[];
}

/**
 * Room metric definition
 */
export interface RoomMetric {
	type: string;
	state: string;
	label?: string;
	unit?: string;
	value?: unknown;
	ts?: string;
	status?: "ok" | "warn" | "alarm" | "nodata";
	id?: string;
}

/**
 * Response containing all rooms
 */
export interface RoomsResponse extends BaseMessage {
	type: "rooms";
	payload: {
		rooms: Record<string, RoomConfig>;
	};
}

export interface SnapshotPayload {
	devices: Record<string, DeviceConfig>;
	rooms: Record<string, RoomConfig>;
	seq: number;
}

export interface SnapshotResponse extends BaseMessage {
	type: "snapshot";
	payload: SnapshotPayload;
}

export interface InitialSnapshotResponse extends BaseMessage {
	type: "initialSnapshot";
	payload: SnapshotPayload;
}

/**
 * Command definition for help response
 */
export interface CommandDefinition {
	command: string;
	description: string;
	example: object;
}

/**
 * Response containing available commands
 */
export interface HelpResponse extends BaseMessage {
	type: "help";
	payload: {
		commands: CommandDefinition[];
	};
}

/**
 * State change notification
 */
export interface StateChangeMessage extends BaseMessage {
	type: "stateChange";
	payload: {
		deviceId: string;
		capability: string;
		state: string;
		value: unknown;
		timestamp: string;
		quality?: string;
	};
}

export interface StateChangeBatchMessage extends BaseMessage {
	type: "stateChangeBatch";
	payload: {
		events: Array<StateChangeMessage["payload"]>;
	};
}

export interface ThrottleHintMessage extends BaseMessage {
	type: "throttleHint";
	payload: {
		reason: "rate_limit" | "batching";
		retryAfterMs?: number;
	};
}

// =============================================================================
// Client State Management
// =============================================================================

/**
 * Request log entry for debugging
 */
export interface RequestLogEntry {
	/** Timestamp of the request */
	timestamp: Date;
	/** Message type */
	type: string;
	/** Request ID */
	id?: string;
}

/**
 * Connected client information
 */
export interface ConnectedClient {
	/** Unique client ID assigned by server */
	id: string;
	/** Client-provided name */
	name: string;
	/** Client version */
	version: string;
	/** Client type */
	clientType: string;
	/** Connection timestamp */
	connectedAt: Date;
	/** Whether client has completed registration */
	isRegistered: boolean;
	/** Recent requests for debugging (last 10) */
	recentRequests: RequestLogEntry[];
}

// =============================================================================
// Union Types for Message Routing
// =============================================================================

/**
 * All possible client → server message types
 */
export type ClientMessage =
	| RegisterRequest
	| GetDevicesRequest
	| GetRoomsRequest
	| GetSnapshotRequest
	| HelpRequest
	| SubscribeRequest
	| UnsubscribeRequest
	| SetStateRequest;

/**
 * All possible server → client message types
 */
export interface RoomMetricsUpdateBatchMessage extends BaseMessage {
	type: "roomMetricsUpdateBatch";
	payload: {
		rooms: Array<{
			roomId: string;
			metrics: Array<{
				id: string;
				value: unknown;
				ts: string;
				status?: "ok" | "warn" | "alarm" | "nodata";
				unit?: string;
				label?: string;
				type?: string;
			}>;
		}>;
	};
}

export type ServerMessage =
	| RegisteredResponse
	| DevicesResponse
	| RoomsResponse
	| SnapshotResponse
	| InitialSnapshotResponse
	| HelpResponse
	| StateChangeMessage
	| StateChangeBatchMessage
	| ThrottleHintMessage
	| RoomMetricsUpdateBatchMessage
	| ErrorMessage;

// =============================================================================
// Error Codes
// =============================================================================

export const ErrorCodes = {
	NOT_REGISTERED: "NOT_REGISTERED",
	INVALID_MESSAGE: "INVALID_MESSAGE",
	UNKNOWN_TYPE: "UNKNOWN_TYPE",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	AUTH_FAILED: "AUTH_FAILED",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	PERMISSION_DENIED: "PERMISSION_DENIED",
	UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
	INVALID_PAYLOAD: "INVALID_PAYLOAD",
	RATE_LIMIT: "RATE_LIMIT",
	CERT_ERROR: "CERT_ERROR",
	RESYNC_REQUIRED: "RESYNC_REQUIRED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
