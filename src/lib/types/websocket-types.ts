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
}

/**
 * Error information included in error responses
 */
export interface ErrorInfo {
    code: string;
    message: string;
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
        capabilities: string[];
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
    min_value?: number;
    max_value?: number;
    unit?: string;
    inverted?: boolean;
    stop?: string;
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
export type ClientMessage = RegisterRequest | GetDevicesRequest | GetRoomsRequest;

/**
 * All possible server → client message types
 */
export type ServerMessage = RegisteredResponse | DevicesResponse | RoomsResponse | ErrorMessage;

// =============================================================================
// Error Codes
// =============================================================================

export const ErrorCodes = {
    NOT_REGISTERED: "NOT_REGISTERED",
    INVALID_MESSAGE: "INVALID_MESSAGE",
    UNKNOWN_TYPE: "UNKNOWN_TYPE",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
