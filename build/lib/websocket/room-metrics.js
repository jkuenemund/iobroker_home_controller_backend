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
var room_metrics_exports = {};
__export(room_metrics_exports, {
  RoomMetricsManager: () => RoomMetricsManager
});
module.exports = __toCommonJS(room_metrics_exports);
class RoomMetricsManager {
  deps;
  stateToMetric = /* @__PURE__ */ new Map();
  buffer = /* @__PURE__ */ new Map();
  flushTimer = null;
  batchIntervalMs;
  constructor(deps) {
    this.deps = deps;
    const cfgSec = deps.adapter.config.roomMetricsBatchIntervalSec;
    this.batchIntervalMs = cfgSec && cfgSec > 0 ? cfgSec * 1e3 : 6e4;
  }
  async subscribeToAllMetrics() {
    try {
      const rooms = await this.deps.snapshotService.getRooms();
      this.stateToMetric.clear();
      const stateIds = /* @__PURE__ */ new Set();
      for (const [roomId, room] of Object.entries(rooms)) {
        if (!room.metrics) continue;
        for (const metricRaw of room.metrics) {
          const metric = metricRaw;
          if (!metric.state) continue;
          const metricId = metric.id || metric.state || metric.type || `${roomId}_${Math.random()}`;
          this.stateToMetric.set(metric.state, {
            roomId,
            metricId,
            unit: metric.unit,
            label: metric.label,
            type: metric.type
          });
          stateIds.add(metric.state);
        }
      }
      for (const oid of stateIds) {
        this.deps.adapter.subscribeForeignStates(oid);
      }
      this.deps.adapter.log.info(`Subscribed to ${stateIds.size} room metric states`);
    } catch (error) {
      this.deps.adapter.log.error(`Failed to subscribe to room metrics: ${error.message}`);
    }
  }
  handleStateChange(id, state) {
    const ref = this.stateToMetric.get(id);
    if (!ref) return;
    const ts = state.ts ? new Date(state.ts).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const status = state.val === void 0 || state.val === null ? "nodata" : "ok";
    let roomEntry = this.buffer.get(ref.roomId);
    if (!roomEntry) {
      roomEntry = /* @__PURE__ */ new Map();
      this.buffer.set(ref.roomId, roomEntry);
    }
    roomEntry.set(ref.metricId, {
      value: state.val,
      ts,
      status,
      unit: ref.unit,
      label: ref.label,
      type: ref.type
    });
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchIntervalMs);
    }
  }
  flush() {
    this.flushTimer = null;
    if (this.buffer.size === 0) {
      return;
    }
    const roomsPayload = [];
    for (const [roomId, metricsMap] of this.buffer.entries()) {
      const metrics = [];
      for (const [metricId, data] of metricsMap.entries()) {
        metrics.push({
          id: metricId,
          value: data.value,
          ts: data.ts,
          status: data.status,
          unit: data.unit,
          label: data.label,
          type: data.type
        });
      }
      if (metrics.length > 0) {
        roomsPayload.push({ roomId, metrics });
      }
    }
    if (roomsPayload.length === 0) {
      this.buffer.clear();
      return;
    }
    const message = {
      type: "roomMetricsUpdateBatch",
      payload: { rooms: roomsPayload }
    };
    for (const ws of this.deps.clients.keys()) {
      if (this.deps.subscriptions.shouldDeliverRoom(ws, roomsPayload)) {
        this.deps.send(ws, message);
      }
    }
    this.buffer.clear();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RoomMetricsManager
});
//# sourceMappingURL=room-metrics.js.map
