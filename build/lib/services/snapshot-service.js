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
var snapshot_service_exports = {};
__export(snapshot_service_exports, {
  SnapshotService: () => SnapshotService
});
module.exports = __toCommonJS(snapshot_service_exports);
class SnapshotService {
  adapter;
  constructor(adapter) {
    this.adapter = adapter;
  }
  /**
   * Build snapshot (devices + rooms) with provided seq reference
   */
  async buildSnapshot(seq) {
    const [devices, rooms] = await Promise.all([this.getDevices(), this.getRooms()]);
    return { devices, rooms, seq };
  }
  async getDevices() {
    return this.fetchDevices();
  }
  async getRooms() {
    return this.fetchRooms();
  }
  async validateSetState(deviceId, capability, stateId) {
    var _a;
    const devices = await this.fetchDevices();
    const device = devices[deviceId];
    if (!device) {
      return { ok: false, reason: "UNKNOWN_DEVICE" };
    }
    const cap = (_a = device.capabilities) == null ? void 0 : _a.find((c) => c.type === capability && c.state === stateId);
    if (!cap) {
      return { ok: false, reason: "UNKNOWN_STATE_OR_CAPABILITY" };
    }
    return { ok: true };
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
      if (!(state == null ? void 0 : state.val)) {
        continue;
      }
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
      await Promise.all(
        idArray.map(async (oid) => {
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
        })
      );
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
    const metricStateIds = /* @__PURE__ */ new Set();
    for (const [id, state] of Object.entries(states)) {
      if (!(state == null ? void 0 : state.val)) {
        continue;
      }
      const roomId = id.substring(`${basePath}.rooms.`.length);
      try {
        const config = JSON.parse(state.val);
        if (config.metrics && Array.isArray(config.metrics)) {
          config.metrics = config.metrics.map((m) => {
            const metric = { ...m };
            if (!metric.id) {
              metric.id = metric.state || metric.type;
            }
            if (!metric.label) {
              metric.label = metric.type || metric.id;
            }
            if (metric.state) {
              metricStateIds.add(metric.state);
            }
            return metric;
          });
        }
        rooms[roomId] = config;
      } catch (error) {
        this.adapter.log.warn(`Failed to parse room config for ${roomId}: ${error.message}`);
      }
    }
    if (metricStateIds.size > 0) {
      const idArray = Array.from(metricStateIds);
      await Promise.all(
        idArray.map(async (oid) => {
          try {
            const state = await this.adapter.getForeignStateAsync(oid);
            if (state) {
              for (const room of Object.values(rooms)) {
                if (room.metrics) {
                  for (const metric of room.metrics) {
                    if (metric.state === oid) {
                      metric.value = state.val;
                      metric.ts = state.ts ? new Date(state.ts).toISOString() : void 0;
                      metric.status = state.val === void 0 || state.val === null ? "nodata" : metric.status || "ok";
                    }
                  }
                }
              }
            }
          } catch (error) {
            this.adapter.log.warn(`Failed to fetch metric state ${oid}: ${error.message}`);
          }
        })
      );
    }
    return rooms;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SnapshotService
});
//# sourceMappingURL=snapshot-service.js.map
