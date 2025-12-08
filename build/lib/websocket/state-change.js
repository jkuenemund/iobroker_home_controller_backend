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
class StateChangeManager {
  deps;
  stateMap = /* @__PURE__ */ new Map();
  subscriptions;
  deviceRooms = /* @__PURE__ */ new Map();
  ctxForSubs;
  queue = [];
  flushTimer = null;
  batchIntervalMs = 200;
  eventsThisSecond = 0;
  windowStart = Date.now();
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
      this.deviceRooms.clear();
      const statesToSubscribe = /* @__PURE__ */ new Set();
      for (const [deviceId, config] of Object.entries(devices)) {
        if (config.capabilities) {
          if (config.room) {
            this.deviceRooms.set(deviceId, config.room);
          }
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
      this.subscriptions.setDeviceRooms(this.deviceRooms);
      this.deps.adapter.log.info(`Subscribed to ${statesToSubscribe.size} states for real-time updates`);
    } catch (error) {
      this.deps.adapter.log.error(`Failed to subscribe to states: ${error.message}`);
    }
  }
  handleStateChange(id, state) {
    const affected = this.stateMap.get(id);
    if (affected && affected.length > 0) {
      for (const item of affected) {
        this.enqueueStateChange(item.deviceId, item.capability, id, state.val, state.ts);
      }
    }
  }
  enqueueStateChange(deviceId, capability, stateId, value, ts) {
    this.countEvent();
    this.queue.push({
      deviceId,
      capability,
      state: stateId,
      value,
      timestamp: new Date(ts).toISOString()
    });
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushQueue(), this.batchIntervalMs);
    }
  }
  flushQueue() {
    this.flushTimer = null;
    if (this.queue.length === 0) {
      return;
    }
    for (const ws of this.deps.clients.keys()) {
      const clientEvents = [];
      for (const payload of this.queue) {
        const message = { type: "stateChange", payload };
        if (this.subscriptions.shouldDeliver(ws, message, this.deps.clients)) {
          clientEvents.push(payload);
        }
      }
      if (clientEvents.length === 0) {
        continue;
      }
      if (clientEvents.length === 1) {
        const single = { type: "stateChange", payload: clientEvents[0] };
        this.deps.send(ws, single);
      } else {
        const batch = {
          type: "stateChangeBatch",
          payload: { events: clientEvents }
        };
        this.deps.send(ws, batch);
      }
    }
    this.queue.length = 0;
  }
  countEvent() {
    var _a;
    const now = Date.now();
    if (now - this.windowStart >= 1e3) {
      this.windowStart = now;
      this.eventsThisSecond = 0;
    }
    this.eventsThisSecond += 1;
    const limit = (_a = this.deps.adapter.config.maxEventsPerSecond) != null ? _a : 50;
    if (this.eventsThisSecond > limit) {
      this.sendThrottleHint();
    }
  }
  sendThrottleHint() {
    const hint = {
      type: "throttleHint",
      payload: {
        reason: "rate_limit",
        retryAfterMs: this.batchIntervalMs
      }
    };
    for (const ws of this.deps.clients.keys()) {
      this.deps.send(ws, hint);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StateChangeManager
});
//# sourceMappingURL=state-change.js.map
