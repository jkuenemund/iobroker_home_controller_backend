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
var subscriptions_exports = {};
__export(subscriptions_exports, {
  SubscriptionRegistry: () => SubscriptionRegistry
});
module.exports = __toCommonJS(subscriptions_exports);
class SubscriptionRegistry {
  deps;
  filters = /* @__PURE__ */ new Map();
  constructor(deps) {
    this.deps = deps;
  }
  setDefault(ws) {
    if (this.deps.defaultSubscription === "all") {
      this.filters.set(ws, {});
    }
  }
  subscribe(ws, filters) {
    this.filters.set(ws, filters);
  }
  unsubscribe(ws, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      this.filters.delete(ws);
      return;
    }
    const existing = this.filters.get(ws);
    if (!existing) {
      return;
    }
    this.filters.set(ws, {
      deviceIds: this.diff(existing.deviceIds, filters.deviceIds),
      rooms: this.diff(existing.rooms, filters.rooms),
      capabilityTypes: this.diff(existing.capabilityTypes, filters.capabilityTypes)
    });
  }
  diff(current, remove) {
    if (!current) return void 0;
    if (!remove || remove.length === 0) return current;
    const set = new Set(current);
    for (const item of remove) {
      set.delete(item);
    }
    return Array.from(set);
  }
  shouldDeliver(ws, event, clients) {
    const filters = this.filters.get(ws);
    if (!filters && this.deps.defaultSubscription === "none") {
      return false;
    }
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }
    const { deviceIds, rooms, capabilityTypes } = filters;
    const payload = event.payload;
    if (deviceIds && deviceIds.length > 0 && !deviceIds.includes(payload.deviceId)) {
      return false;
    }
    if (capabilityTypes && capabilityTypes.length > 0 && !capabilityTypes.includes(payload.capability)) {
      return false;
    }
    if (rooms && rooms.length > 0) {
      const client = clients.get(ws);
      void client;
    }
    return true;
  }
  remove(ws) {
    this.filters.delete(ws);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SubscriptionRegistry
});
//# sourceMappingURL=subscriptions.js.map
