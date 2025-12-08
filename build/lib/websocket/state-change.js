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
var state_change_exports = {};
__export(state_change_exports, {
  StateChangeManager: () => StateChangeManager
});
module.exports = __toCommonJS(state_change_exports);
var import_handlers = require("./handlers");
class StateChangeManager {
  deps;
  stateMap = /* @__PURE__ */ new Map();
  subscriptions;
  ctxForSubs;
  constructor(deps, subscriptions) {
    this.deps = deps;
    this.subscriptions = subscriptions;
    this.ctxForSubs = {
      subscriptions: this.subscriptions,
      clients: this.deps.clients
    };
  }
  async subscribeToAllStates() {
    try {
      const devices = await this.deps.snapshotService.getDevices();
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
        this.deps.adapter.subscribeForeignStates(oid);
      }
      this.deps.adapter.log.info(`Subscribed to ${statesToSubscribe.size} states for real-time updates`);
    } catch (error) {
      this.deps.adapter.log.error(`Failed to subscribe to states: ${error.message}`);
    }
  }
  handleStateChange(id, state) {
    const affected = this.stateMap.get(id);
    if (affected && affected.length > 0) {
      for (const item of affected) {
        this.broadcastStateChange(item.deviceId, item.capability, id, state.val, state.ts);
      }
    }
  }
  broadcastStateChange(deviceId, capability, stateId, value, ts) {
    const message = {
      type: "stateChange",
      id: void 0,
      payload: {
        deviceId,
        capability,
        state: stateId,
        value,
        timestamp: new Date(ts).toISOString()
      }
    };
    const deliveries = (0, import_handlers.applySubscriptions)(this.ctxForSubs, message);
    for (const [ws, msg] of deliveries) {
      this.deps.send(ws, msg);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StateChangeManager
});
//# sourceMappingURL=state-change.js.map
