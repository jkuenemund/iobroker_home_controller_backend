"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var codec_exports = {};
__export(codec_exports, {
  validateIncoming: () => validateIncoming
});
module.exports = __toCommonJS(codec_exports);
var import_ajv = __toESM(require("ajv"));
const ajv = new import_ajv.default({ removeAdditional: true, allErrors: true });
const registerSchema = {
  type: "object",
  required: ["type", "payload"],
  properties: {
    type: { const: "register" },
    id: { type: "string", nullable: true },
    payload: {
      type: "object",
      required: ["clientName", "clientVersion", "clientType"],
      properties: {
        clientName: { type: "string", minLength: 1 },
        clientVersion: { type: "string", minLength: 1 },
        clientType: { enum: ["mobile", "web", "desktop", "other"] },
        lastSeqSeen: { type: "number" },
        acceptCompression: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};
const simpleTypeSchema = (typeValue) => ajv.compile({
  type: "object",
  required: ["type"],
  properties: {
    type: { const: typeValue },
    id: { type: "string", nullable: true }
  },
  additionalProperties: false
});
const subscribeSchema = {
  type: "object",
  required: ["type"],
  properties: {
    type: { enum: ["subscribe", "unsubscribe"] },
    id: { type: "string", nullable: true },
    payload: {
      type: "object",
      properties: {
        deviceIds: { type: "array", items: { type: "string" } },
        rooms: { type: "array", items: { type: "string" } },
        capabilityTypes: { type: "array", items: { type: "string" } }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};
const setStateSchema = {
  type: "object",
  required: ["type", "payload"],
  properties: {
    type: { const: "setState" },
    id: { type: "string", nullable: true },
    payload: {
      type: "object",
      required: ["deviceId", "capability", "state", "value"],
      properties: {
        deviceId: { type: "string", minLength: 1 },
        capability: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 1 },
        value: {},
        ack: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};
const validators = {
  register: ajv.compile(registerSchema),
  getDevices: simpleTypeSchema("getDevices"),
  getRooms: simpleTypeSchema("getRooms"),
  getSnapshot: simpleTypeSchema("getSnapshot"),
  help: simpleTypeSchema("help"),
  subscribe: ajv.compile(subscribeSchema),
  unsubscribe: ajv.compile(subscribeSchema),
  setState: ajv.compile(setStateSchema)
};
function validateIncoming(message) {
  if (typeof message !== "object" || message === null) {
    return { ok: false, errors: ["Message must be an object"] };
  }
  const typed = message;
  if (!typed.type || typeof typed.type !== "string") {
    return { ok: false, errors: ["Missing or invalid type"] };
  }
  const validator = validators[typed.type];
  if (!validator) {
    return { ok: true, parsed: typed };
  }
  const valid = validator(typed);
  if (!valid) {
    const errs = (validator.errors || []).map((e) => {
      var _a;
      const path = e.instancePath || e.dataPath || "/";
      return `${path} ${(_a = e.message) != null ? _a : ""}`.trim();
    });
    return { ok: false, errors: errs };
  }
  return { ok: true, parsed: typed };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  validateIncoming
});
//# sourceMappingURL=codec.js.map
