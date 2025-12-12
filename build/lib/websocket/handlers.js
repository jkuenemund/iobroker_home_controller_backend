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
var handlers_exports = {};
__export(handlers_exports, {
  applySubscriptions: () => applySubscriptions,
  handleDeleteScene: () => handleDeleteScene,
  handleGetDevices: () => handleGetDevices,
  handleGetRooms: () => handleGetRooms,
  handleGetSnapshot: () => handleGetSnapshot,
  handleHelp: () => handleHelp,
  handleRegister: () => handleRegister,
  handleSaveScene: () => handleSaveScene,
  handleSetState: () => handleSetState,
  handleSubscribe: () => handleSubscribe,
  handleTriggerScene: () => handleTriggerScene
});
module.exports = __toCommonJS(handlers_exports);
var import_uuid = require("uuid");
var import_types = require("./types");
function handleRegister(ctx, ws, message) {
  var _a, _b;
  const regMsg = message;
  const { clientName, clientVersion, clientType, lastSeqSeen } = regMsg.payload;
  const currentSeq = ctx.getSeq();
  if (lastSeqSeen !== void 0 && lastSeqSeen < currentSeq) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.RESYNC_REQUIRED, "Snapshot required; lastSeqSeen stale");
  }
  const clientId = (0, import_uuid.v4)();
  const existing = ctx.clients.get(ws);
  const client = {
    id: clientId,
    name: clientName || "Unknown",
    version: clientVersion || "0.0.0",
    clientType: clientType || "other",
    connectedAt: /* @__PURE__ */ new Date(),
    isRegistered: true,
    recentRequests: [],
    authUser: existing == null ? void 0 : existing.authUser
  };
  ctx.clients.set(ws, client);
  ctx.subscriptions.setDefault(ws);
  ctx.adapter.log.info(`Client registered: ${client.name} v${client.version} (${clientId})`);
  const response = {
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
        maxEventsPerSecond: (_a = ctx.adapter.config.maxEventsPerSecond) != null ? _a : 50,
        supportsBatch: true,
        supportsCompression: true,
        defaultSubscription: (_b = ctx.adapter.config.defaultSubscription) != null ? _b : "all"
      }
    }
  };
  ctx.send(ws, response);
  void sendInitialSnapshot(ctx, ws);
  ctx.notifyClientChange();
}
async function handleGetDevices(ctx, ws, message) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  try {
    const devices = await ctx.snapshotService.getDevices();
    const response = {
      type: "devices",
      id: message.id,
      payload: { devices }
    };
    ctx.send(ws, response);
    ctx.adapter.log.debug(`Sent ${Object.keys(devices).length} devices to ${client.name}`);
  } catch (error) {
    ctx.sendError(
      ws,
      message.id,
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to fetch devices: ${error.message}`
    );
  }
}
async function handleGetRooms(ctx, ws, message) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  try {
    const rooms = await ctx.snapshotService.getRooms();
    const response = {
      type: "rooms",
      id: message.id,
      payload: { rooms }
    };
    ctx.send(ws, response);
    ctx.adapter.log.debug(`Sent ${Object.keys(rooms).length} rooms to ${client.name}`);
  } catch (error) {
    ctx.sendError(
      ws,
      message.id,
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to fetch rooms: ${error.message}`
    );
  }
}
async function handleGetSnapshot(ctx, ws, message) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  try {
    const seq = ctx.nextSeq();
    const snapshot = await ctx.snapshotService.buildSnapshot(seq);
    const response = {
      type: "snapshot",
      id: message.id,
      payload: { ...snapshot },
      seq
    };
    ctx.send(ws, response);
  } catch (error) {
    ctx.sendError(
      ws,
      message.id,
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to fetch snapshot: ${error.message}`
    );
  }
}
function handleHelp(ctx, ws, message) {
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
          command: "getSnapshot",
          description: "Get devices and rooms snapshot",
          example: {
            type: "getSnapshot",
            id: "req-4"
          }
        },
        {
          command: "help",
          description: "Get available commands",
          example: {
            type: "help",
            id: "req-5"
          }
        },
        {
          command: "subscribe",
          description: "Subscribe with filters",
          example: {
            type: "subscribe",
            id: "req-sub-1",
            payload: {
              deviceIds: ["livingroom_light"],
              capabilityTypes: ["toggle"]
            }
          }
        },
        {
          command: "unsubscribe",
          description: "Unsubscribe filters (empty to clear all)",
          example: {
            type: "unsubscribe",
            id: "req-unsub-1",
            payload: {}
          }
        }
      ]
    }
  };
  ctx.send(ws, response);
}
function handleSubscribe(ctx, ws, message) {
  var _a;
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  const filters = (_a = message.payload) != null ? _a : {};
  if (message.type === "subscribe") {
    ctx.subscriptions.subscribe(ws, filters);
    ctx.send(ws, { type: "subscribed", id: message.id });
  } else {
    ctx.subscriptions.unsubscribe(ws, filters);
    ctx.send(ws, { type: "unsubscribed", id: message.id });
  }
}
function applySubscriptions(ctx, event) {
  const deliveries = [];
  for (const ws of ctx.clients.keys()) {
    if (ctx.subscriptions.shouldDeliver(ws, event, ctx.clients)) {
      deliveries.push([ws, event]);
    }
  }
  return deliveries;
}
async function handleSetState(ctx, ws, message) {
  var _a, _b;
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  try {
    const validation = await ctx.snapshotService.validateSetState(
      message.payload.deviceId,
      message.payload.capability,
      message.payload.state
    );
    if (!validation.ok) {
      ctx.sendError(ws, message.id, import_types.ErrorCodes.PERMISSION_DENIED, (_a = validation.reason) != null ? _a : "Not allowed");
      return;
    }
    const value = message.payload.value;
    await ctx.adapter.setForeignStateAsync(message.payload.state, value, (_b = message.payload.ack) != null ? _b : false);
    ctx.send(ws, { type: "ack", id: message.id });
  } catch (error) {
    ctx.sendError(
      ws,
      message.id,
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to set state: ${error.message}`
    );
  }
}
async function handleTriggerScene(ctx, ws, message) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  const { sceneId } = message.payload;
  if (!sceneId || typeof sceneId !== "string") {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.INVALID_PAYLOAD, "Invalid sceneId");
    return;
  }
  try {
    const triggerPath = `cron_scenes.0.jobs.${sceneId}.trigger`;
    await ctx.adapter.setForeignStateAsync(triggerPath, true, false);
    ctx.send(ws, { type: "ack", id: message.id });
    ctx.adapter.log.info(`Triggered scene ${sceneId} via WebSocket from ${client.name}`);
  } catch (error) {
    ctx.sendError(
      ws,
      message.id,
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to trigger scene: ${error.message}`
    );
  }
}
async function handleSaveScene(ctx, ws, message) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  const { sceneId, config } = message.payload;
  if (!sceneId || !config) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.INVALID_PAYLOAD, "Missing sceneId or config");
    return;
  }
  try {
    const statePath = `cron_scenes.0.jobs.${message.payload.sceneId}`;
    await ctx.adapter.extendForeignObjectAsync(statePath, {
      type: "state",
      common: {
        name: message.payload.sceneId,
        // Using ID as name initially
        type: "string",
        // JSON content is stored as string
        role: "json",
        // Role for JSON content
        read: true,
        write: true,
        desc: "Created by home_controller"
      },
      native: {}
    });
    await ctx.adapter.setForeignStateAsync(statePath, JSON.stringify(config), true);
    ctx.send(ws, { type: "ack", id: message.id });
    ctx.adapter.log.info(`Saved scene ${sceneId} via WebSocket from ${client.name}`);
  } catch (error) {
    ctx.sendError(
      ws,
      message.id,
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to save scene: ${error.message}`
    );
  }
}
async function handleDeleteScene(ctx, ws, message) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  const { sceneId } = message.payload;
  if (!sceneId) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.INVALID_PAYLOAD, "Missing sceneId");
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
      import_types.ErrorCodes.INTERNAL_ERROR,
      `Failed to delete scene: ${error.message}`
    );
  }
}
async function sendInitialSnapshot(ctx, ws) {
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    return;
  }
  try {
    const seq = ctx.nextSeq();
    const snapshot = await ctx.snapshotService.buildSnapshot(seq);
    const response = {
      type: "initialSnapshot",
      payload: { ...snapshot },
      seq
    };
    ctx.send(ws, response);
  } catch (error) {
    ctx.adapter.log.warn(`Failed to send initialSnapshot: ${error.message}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applySubscriptions,
  handleDeleteScene,
  handleGetDevices,
  handleGetRooms,
  handleGetSnapshot,
  handleHelp,
  handleRegister,
  handleSaveScene,
  handleSetState,
  handleSubscribe,
  handleTriggerScene
});
//# sourceMappingURL=handlers.js.map
