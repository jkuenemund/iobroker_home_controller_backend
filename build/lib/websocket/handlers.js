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
  handleGetDevices: () => handleGetDevices,
  handleGetRooms: () => handleGetRooms,
  handleGetSnapshot: () => handleGetSnapshot,
  handleHelp: () => handleHelp,
  handleRegister: () => handleRegister,
  handleSetState: () => handleSetState,
  handleSubscribe: () => handleSubscribe
});
module.exports = __toCommonJS(handlers_exports);
var import_uuid = require("uuid");
var import_types = require("./types");
function handleRegister(ctx, ws, message) {
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
  ctx.clients.set(ws, client);
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
  var _a;
  const client = ctx.clients.get(ws);
  if (!(client == null ? void 0 : client.isRegistered)) {
    ctx.sendError(ws, message.id, import_types.ErrorCodes.NOT_REGISTERED, "Client must register first");
    return;
  }
  try {
    await ctx.adapter.setForeignStateAsync(message.payload.state, message.payload.value, (_a = message.payload.ack) != null ? _a : false);
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
  handleGetDevices,
  handleGetRooms,
  handleGetSnapshot,
  handleHelp,
  handleRegister,
  handleSetState,
  handleSubscribe
});
//# sourceMappingURL=handlers.js.map
