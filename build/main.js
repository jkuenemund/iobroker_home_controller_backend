"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_websocket_server = require("./lib/websocket-server");
class HomeControllerBackend extends utils.Adapter {
  wsServer = null;
  constructor(options = {}) {
    super({
      ...options,
      name: "home_controller_backend"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.log.info("Home Controller Backend starting...");
    this.log.debug(`Config: basePath=${this.config.basePath}, wsPort=${this.config.wsPort}`);
    await this.setObjectNotExistsAsync("info.connectedClients", {
      type: "state",
      common: {
        name: "Connected WebSocket clients",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateAsync("info.connectedClients", JSON.stringify([]), true);
    try {
      this.wsServer = new import_websocket_server.HomeControllerWebSocketServer(this);
      this.wsServer.onClientChange((clients) => {
        const clientInfo = clients.map((c) => ({
          id: c.id,
          name: c.name,
          version: c.version,
          clientType: c.clientType,
          connectedAt: c.connectedAt.toISOString(),
          recentRequests: c.recentRequests.map((r) => ({
            timestamp: r.timestamp.toISOString(),
            type: r.type,
            id: r.id
          }))
        }));
        this.setStateAsync("info.connectedClients", JSON.stringify(clientInfo), true);
      });
      this.wsServer.start();
      this.log.info("Home Controller Backend ready");
    } catch (error) {
      this.log.error(`Failed to start WebSocket server: ${error.message}`);
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      this.log.info("Home Controller Backend shutting down...");
      if (this.wsServer) {
        this.wsServer.stop();
        this.wsServer = null;
      }
      this.log.info("Home Controller Backend stopped");
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
  /**
   * Is called if a subscribed state changes
   */
  onStateChange(id, state) {
    var _a;
    if (state) {
      this.log.debug(`State ${id} changed: ${state.val} (ack = ${state.ack})`);
      (_a = this.wsServer) == null ? void 0 : _a.handleStateChange(id, state);
    } else {
      this.log.debug(`State ${id} deleted`);
    }
  }
  /**
   * Handle messages from admin UI
   */
  onMessage(obj) {
    var _a, _b;
    if (typeof obj === "object" && obj.message) {
      if (obj.command === "disconnectClient") {
        const clientId = obj.message;
        this.log.info(`Admin request to disconnect client: ${clientId}`);
        const success = (_b = (_a = this.wsServer) == null ? void 0 : _a.disconnectClient(clientId)) != null ? _b : false;
        if (obj.callback) {
          this.sendTo(obj.from, obj.command, { success }, obj.callback);
        }
      }
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new HomeControllerBackend(options);
} else {
  (() => new HomeControllerBackend())();
}
//# sourceMappingURL=main.js.map
