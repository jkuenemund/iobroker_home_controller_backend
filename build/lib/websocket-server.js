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
  ErrorCodes: () => import_types2.ErrorCodes,
  HomeControllerWebSocketServer: () => HomeControllerWebSocketServer
});
module.exports = __toCommonJS(websocket_server_exports);
var import_ws = require("ws");
var import_uuid = require("uuid");
var import_snapshot_service = require("./services/snapshot-service");
var import_types = require("./websocket/types");
var import_types2 = require("./websocket/types");
class HomeControllerWebSocketServer {
  wss = null;
  clients = /* @__PURE__ */ new Map();
  adapter;
  serverVersion = "0.0.1";
  protocolVersion = "1.0";
  schemaVersion = "1.0";
  seqCounter = 0;
  snapshotService;
  heartbeatInterval = null;
  pingIntervalMs = 28e3;
  pingTimeoutMs = 1e4;
  socketMeta = /* @__PURE__ */ new WeakMap();
  onClientChangeCallback = null;
  // Map stateId -> list of capabilities that use it
  stateMap = /* @__PURE__ */ new Map();
  constructor(adapter) {
    this.adapter = adapter;
    this.snapshotService = new import_snapshot_service.SnapshotService(adapter);
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
    this.wss = new import_ws.WebSocketServer({
      port: this.adapter.config.wsPort,
      perMessageDeflate: true
    });
    this.wss.on("connection", (ws, req) => {
      var _a, _b, _c;
      const auth = this.authenticate(req);
      if (!auth.ok) {
        this.adapter.log.warn(`Rejected connection: ${(_a = auth.reason) != null ? _a : "auth failed"}`);
        ws.close((_b = auth.closeCode) != null ? _b : 4001, (_c = auth.reason) != null ? _c : "AUTH_FAILED");
        return;
      }
      this.handleConnection(ws, req);
    });
    this.subscribeToAllStates();
    this.wss.on("error", (error) => {
      this.adapter.log.error(`WebSocket server error: ${error.message}`);
    });
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), this.pingIntervalMs);
    this.adapter.log.info(`WebSocket server started on port ${this.adapter.config.wsPort}`);
  }
  /**
   * Subscribe to all states defined in devices
   */
  async subscribeToAllStates() {
    try {
      const devices = await this.snapshotService.getDevices();
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
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
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
  handleConnection(ws, _req) {
    this.adapter.log.debug("New WebSocket connection");
    this.socketMeta.set(ws, { isAlive: true });
    ws.on("pong", () => {
      const meta = this.socketMeta.get(ws);
      if (meta) {
        meta.isAlive = true;
      }
    });
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
      const meta = this.socketMeta.get(ws);
      if (meta == null ? void 0 : meta.idleTimer) {
        clearTimeout(meta.idleTimer);
      }
      this.socketMeta.delete(ws);
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
      this.sendError(ws, void 0, import_types.ErrorCodes.INVALID_MESSAGE, "Invalid JSON");
      return;
    }
    if (!message.type) {
      this.sendError(ws, message.id, import_types.ErrorCodes.INVALID_MESSAGE, "Missing message type");
      return;
    }
    this.adapter.log.debug(`Received message: ${message.type}`);
    this.logRequest(ws, message.type, message.id);
    switch (message.type) {
      case "register":
        this.handleRegister(ws, message);
        break;
      case "getDevices":
        void this.handleGetDevices(ws, message);
        break;
      case "getRooms":
        void this.handleGetRooms(ws, message);
        break;
      case "getSnapshot":
        void this.handleGetSnapshot(ws, message);
        break;
      case "help":
        this.handleHelp(ws, message);
        break;
      case "subscribe":
      case "unsubscribe":
        break;
      default:
        this.sendError(ws, message.id, import_types.ErrorCodes.UNKNOWN_TYPE, `Unknown message type: ${message.type}`);
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
    if (this.updateTimeout) {
      return;
    }
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
    var _a, _b;
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
        protocolVersion: this.protocolVersion,
        schemaVersion: this.schemaVersion,
        capabilities: ["devices", "rooms", "stateChange", "subscribe", "setState", "batch", "compression"],
        limits: {
          maxMsgBytes: 131072,
          maxEventsPerSecond: (_a = this.adapter.config.maxEventsPerSecond) != null ? _a : 50,
          supportsBatch: true,
          supportsCompression: true,
          defaultSubscription: (_b = this.adapter.config.defaultSubscription) != null ? _b : "all"
        }
      }
    };
    this.send(ws, response);
    void this.sendInitialSnapshot(ws);
    this.notifyClientChange();
  }
  /**
   * Handle getDevices request
   */
  async handleGetDevices(ws, message) {
    const client = this.clients.get(ws);
    if (!(client == null ? void 0 : client.isRegistered)) {
      this.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
      return;
    }
    try {
      const devices = await this.snapshotService.getDevices();
      const response = {
        type: "devices",
        id: message.id,
        payload: { devices }
      };
      this.send(ws, response);
      this.adapter.log.debug(`Sent ${Object.keys(devices).length} devices to ${client.name}`);
    } catch (error) {
      this.sendError(
        ws,
        message.id,
        import_types.ErrorCodes.INTERNAL_ERROR,
        `Failed to fetch devices: ${error.message}`
      );
    }
  }
  /**
   * Handle getRooms request
   */
  async handleGetRooms(ws, message) {
    const client = this.clients.get(ws);
    if (!(client == null ? void 0 : client.isRegistered)) {
      this.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
      return;
    }
    try {
      const rooms = await this.snapshotService.getRooms();
      const response = {
        type: "rooms",
        id: message.id,
        payload: { rooms }
      };
      this.send(ws, response);
      this.adapter.log.debug(`Sent ${Object.keys(rooms).length} rooms to ${client.name}`);
    } catch (error) {
      this.sendError(
        ws,
        message.id,
        import_types.ErrorCodes.INTERNAL_ERROR,
        `Failed to fetch rooms: ${error.message}`
      );
    }
  }
  /**
   * Handle getSnapshot request
   */
  async handleGetSnapshot(ws, message) {
    const client = this.clients.get(ws);
    if (!(client == null ? void 0 : client.isRegistered)) {
      this.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
      return;
    }
    try {
      const seq = this.nextSeq();
      const snapshot = await this.snapshotService.buildSnapshot(seq);
      const response = {
        type: "snapshot",
        id: message.id,
        payload: {
          ...snapshot
        },
        seq
      };
      this.send(ws, response);
    } catch (error) {
      this.sendError(
        ws,
        message.id,
        import_types.ErrorCodes.INTERNAL_ERROR,
        `Failed to fetch snapshot: ${error.message}`
      );
    }
  }
  /**
   * Send message to client
   */
  send(ws, message) {
    var _a, _b, _c;
    if (ws.readyState === import_ws.WebSocket.OPEN) {
      const enriched = {
        ...message,
        seq: (_a = message.seq) != null ? _a : this.nextSeq(),
        ts: (_b = message.ts) != null ? _b : (/* @__PURE__ */ new Date()).toISOString(),
        version: (_c = message.version) != null ? _c : this.schemaVersion
      };
      ws.send(JSON.stringify(enriched));
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
  /**
   * Send initial snapshot after registration
   */
  async sendInitialSnapshot(ws) {
    const client = this.clients.get(ws);
    if (!(client == null ? void 0 : client.isRegistered)) {
      return;
    }
    try {
      const seq = this.nextSeq();
      const snapshot = await this.snapshotService.buildSnapshot(seq);
      const response = {
        type: "initialSnapshot",
        payload: { ...snapshot },
        seq
      };
      this.send(ws, response);
    } catch (error) {
      this.adapter.log.warn(`Failed to send initialSnapshot: ${error.message}`);
    }
  }
  /**
   * Authenticate incoming connection (Basic or none)
   */
  authenticate(req) {
    var _a;
    const mode = (_a = this.adapter.config.authMode) != null ? _a : "none";
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
      if (!user || pass === void 0) {
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
      this.adapter.log.warn(
        "Auth mode 'basic' is enabled but no credentials are configured; allowing connection."
      );
      return { ok: true };
    }
    return { ok: false, closeCode: 4004, reason: "PROTOCOL_VERSION_UNSUPPORTED" };
  }
  /**
   * Heartbeat loop: ping and close idle sockets
   */
  checkHeartbeats() {
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
      if (ws.readyState === import_ws.WebSocket.OPEN) {
        ws.ping();
        if (meta.idleTimer) {
          clearTimeout(meta.idleTimer);
        }
        meta.idleTimer = setTimeout(() => {
          const stillMeta = this.socketMeta.get(ws);
          if (stillMeta && !stillMeta.isAlive && ws.readyState === import_ws.WebSocket.OPEN) {
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
  nextSeq() {
    this.seqCounter += 1;
    return this.seqCounter;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ErrorCodes,
  HomeControllerWebSocketServer
});
//# sourceMappingURL=websocket-server.js.map
