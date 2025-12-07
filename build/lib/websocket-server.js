"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var websocket_server_exports = {};
__export(websocket_server_exports, {
  ErrorCodes: () => import_types.ErrorCodes,
  HomeControllerWebSocketServer: () => HomeControllerWebSocketServer
});
module.exports = __toCommonJS(websocket_server_exports);
var import_ws = require("ws");
var import_uuid = require("uuid");
var import_types = require("./websocket/types");
class HomeControllerWebSocketServer {
  wss = null;
  clients = /* @__PURE__ */ new Map();
  adapter;
  serverVersion = "0.0.1";
  onClientChangeCallback = null;
  // Map stateId -> list of capabilities that use it
  stateMap = /* @__PURE__ */ new Map();
  constructor(adapter) {
    this.adapter = adapter;
  }
  /**
   * Set callback for when clients connect/disconnect
   */
  onClientChange(callback) {
    this.onClientChangeCallback = callback;
  }
  /**
   * Notify about client changes
   */
  notifyClientChange() {
    if (this.onClientChangeCallback) {
      this.onClientChangeCallback(this.getConnectedClients());
    }
  }
  /**
   * Start the WebSocket server
   */
  start() {
    this.wss = new import_ws.WebSocketServer({ port: this.adapter.config.wsPort });
    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });
    this.subscribeToAllStates();
    this.wss.on("error", (error) => {
      this.adapter.log.error(`WebSocket server error: ${error.message}`);
    });
    this.adapter.log.info(`WebSocket server started on port ${this.adapter.config.wsPort}`);
  }
  /**
   * Subscribe to all states defined in devices
   */
  async subscribeToAllStates() {
    try {
      const devices = await this.fetchDevices();
      this.stateMap.clear();
      const statesToSubscribe = /* @__PURE__ */ new Set();
      for (const [deviceId, config] of Object.entries(devices)) {
        if (config.capabilities) {
          for (const cap of config.capabilities) {
            if (cap.state) {
              statesToSubscribe.add(cap.state);
              const existing = this.stateMap.get(cap.state) || [];
              existing.push({ deviceId, capability: cap.type });
              this.stateMap.set(cap.state, existing);
            }
          }
        }
      }
      for (const oid of statesToSubscribe) {
        this.adapter.subscribeForeignStates(oid);
      }
      this.adapter.log.info(`Subscribed to ${statesToSubscribe.size} states for real-time updates`);
    } catch (error) {
      this.adapter.log.error(`Failed to subscribe to states: ${error.message}`);
    }
  }
  /**
   * Handle state change from adapter
   */
  handleStateChange(id, state) {
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
  broadcastStateChange(deviceId, capability, stateId, value, ts) {
    const message = {
      type: "stateChange",
      id: void 0,
      // Notification has no request ID
      payload: {
        deviceId,
        capability,
        state: stateId,
        value,
        timestamp: new Date(ts).toISOString()
      }
    };
    for (const ws of this.clients.keys()) {
      this.send(ws, message);
    }
  }
  /**
   * Stop the WebSocket server
   */
  stop() {
    if (this.wss) {
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
  getClientCount() {
    return this.clients.size;
  }
  /**
   * Get list of connected clients (for admin UI)
   */
  getConnectedClients() {
    return Array.from(this.clients.values()).filter((c) => c.isRegistered);
  }
  /**
   * Disconnect a client by ID
   */
  disconnectClient(clientId) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.id === clientId) {
        this.adapter.log.info(`Disconnecting client ${client.name} (${clientId}) by admin request`);
        ws.close(1e3, "Disconnected by administrator");
        return true;
      }
    }
    return false;
  }
  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws) {
    this.adapter.log.debug("New WebSocket connection");
    this.clients.set(ws, {
      id: "",
      name: "",
      version: "",
      clientType: "",
      connectedAt: /* @__PURE__ */ new Date(),
      isRegistered: false,
      recentRequests: []
    });
    ws.on("message", (data) => {
      this.handleMessage(ws, data);
    });
    ws.on("close", () => {
      const client = this.clients.get(ws);
      if (client == null ? void 0 : client.isRegistered) {
        this.adapter.log.info(`Client disconnected: ${client.name} (${client.id})`);
      } else {
        this.adapter.log.debug("Unregistered client disconnected");
      }
      this.clients.delete(ws);
      this.notifyClientChange();
    });
    ws.on("error", (error) => {
      this.adapter.log.warn(`WebSocket client error: ${error.message}`);
    });
  }
  /**
   * Handle incoming message from client
   */
  handleMessage(ws, data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      this.sendError(ws, void 0, "INVALID_MESSAGE", "Invalid JSON");
      return;
    }
    if (!message.type) {
      this.sendError(ws, message.id, "INVALID_MESSAGE", "Missing message type");
      return;
    }
    this.adapter.log.debug(`Received message: ${message.type}`);
    this.logRequest(ws, message.type, message.id);
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
      case "help":
        this.handleHelp(ws, message);
        break;
      case "subscribe":
      case "unsubscribe":
        break;
      default:
        this.sendError(ws, message.id, "UNKNOWN_TYPE", `Unknown message type: ${message.type}`);
    }
  }
  /**
   * Handle help request
   */
  handleHelp(ws, message) {
    const response = {
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
  updateTimeout = null;
  /**
   * Trigger a throttled update for logs
   */
  triggerLogUpdate() {
    if (this.updateTimeout) return;
    this.updateTimeout = setTimeout(() => {
      this.updateTimeout = null;
      this.notifyClientChange();
    }, 2e3);
  }
  /**
   * Log a request from a client
   */
  logRequest(ws, type, id) {
    const client = this.clients.get(ws);
    if (client) {
      client.recentRequests.unshift({
        timestamp: /* @__PURE__ */ new Date(),
        type,
        id
      });
      if (client.recentRequests.length > 10) {
        client.recentRequests.pop();
      }
      this.triggerLogUpdate();
    }
  }
  /**
   * Handle client registration
   */
  handleRegister(ws, message) {
    const regMsg = message;
    const { clientName, clientVersion, clientType } = regMsg.payload;
    const clientId = (0, import_uuid.v4)();
    const client = {
      id: clientId,
      name: clientName || "Unknown",
      version: clientVersion || "0.0.0",
      clientType: clientType || "other",
      connectedAt: /* @__PURE__ */ new Date(),
      isRegistered: true,
      recentRequests: []
    };
    this.clients.set(ws, client);
    this.adapter.log.info(`Client registered: ${client.name} v${client.version} (${clientId})`);
    const response = {
      type: "registered",
      id: message.id,
      payload: {
        clientId,
        serverVersion: this.serverVersion,
        capabilities: ["devices", "rooms"]
      }
    };
    this.send(ws, response);
    this.notifyClientChange();
  }
  /**
   * Handle getDevices request
   */
  async handleGetDevices(ws, message) {
    const client = this.clients.get(ws);
    if (!(client == null ? void 0 : client.isRegistered)) {
      this.sendError(ws, message.id, "NOT_REGISTERED", "Client must register first");
      return;
    }
    try {
      const devices = await this.fetchDevices();
      const response = {
        type: "devices",
        id: message.id,
        payload: { devices }
      };
      this.send(ws, response);
      this.adapter.log.debug(`Sent ${Object.keys(devices).length} devices to ${client.name}`);
    } catch (error) {
      this.sendError(ws, message.id, "INTERNAL_ERROR", `Failed to fetch devices: ${error.message}`);
    }
  }
  /**
   * Handle getRooms request
   */
  async handleGetRooms(ws, message) {
    const client = this.clients.get(ws);
    if (!(client == null ? void 0 : client.isRegistered)) {
      this.sendError(ws, message.id, "NOT_REGISTERED", "Client must register first");
      return;
    }
    try {
      const rooms = await this.fetchRooms();
      const response = {
        type: "rooms",
        id: message.id,
        payload: { rooms }
      };
      this.send(ws, response);
      this.adapter.log.debug(`Sent ${Object.keys(rooms).length} rooms to ${client.name}`);
    } catch (error) {
      this.sendError(ws, message.id, "INTERNAL_ERROR", `Failed to fetch rooms: ${error.message}`);
    }
  }
  /**
   * Fetch all devices from ioBroker states
   */
  async fetchDevices() {
    const basePath = this.adapter.config.basePath;
    const pattern = `${basePath}.devices.*`;
    const states = await this.adapter.getForeignStatesAsync(pattern);
    const devices = {};
    for (const [id, state] of Object.entries(states)) {
      if (!(state == null ? void 0 : state.val)) continue;
      const deviceId = id.substring(`${basePath}.devices.`.length);
      try {
        const config = JSON.parse(state.val);
        devices[deviceId] = config;
      } catch {
        this.adapter.log.warn(`Failed to parse device config for ${deviceId}`);
      }
    }
    const stateIds = /* @__PURE__ */ new Set();
    for (const device of Object.values(devices)) {
      if (device.capabilities) {
        for (const cap of device.capabilities) {
          if (cap.state) {
            stateIds.add(cap.state);
          }
        }
      }
    }
    if (stateIds.size > 0) {
      const idArray = Array.from(stateIds);
      await Promise.all(idArray.map(async (oid) => {
        try {
          const state = await this.adapter.getForeignStateAsync(oid);
          if (state && state.val !== void 0 && state.val !== null) {
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
          this.adapter.log.warn(`Failed to fetch state ${oid}: ${error.message}`);
        }
      }));
    }
    return devices;
  }
  /**
   * Fetch all rooms from ioBroker states
   */
  async fetchRooms() {
    const basePath = this.adapter.config.basePath;
    const pattern = `${basePath}.rooms.*`;
    const states = await this.adapter.getForeignStatesAsync(pattern);
    const rooms = {};
    for (const [id, state] of Object.entries(states)) {
      if (!(state == null ? void 0 : state.val)) continue;
      const roomId = id.substring(`${basePath}.rooms.`.length);
      try {
        const config = JSON.parse(state.val);
        rooms[roomId] = config;
      } catch (error) {
        this.adapter.log.warn(`Failed to parse room config for ${roomId}: ${error.message}`);
      }
    }
    return rooms;
  }
  /**
   * Send message to client
   */
  send(ws, message) {
    if (ws.readyState === import_ws.WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  /**
   * Send error message to client
   */
  sendError(ws, id, code, message) {
    const errorMsg = {
      type: "error",
      id,
      error: { code, message }
    };
    this.send(ws, errorMsg);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ErrorCodes,
  HomeControllerWebSocketServer
});
//# sourceMappingURL=websocket-server.js.map
