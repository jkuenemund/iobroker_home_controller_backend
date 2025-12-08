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
var routes_exports = {};
__export(routes_exports, {
  routeMessage: () => routeMessage
});
module.exports = __toCommonJS(routes_exports);
var import_types = require("./types");
var import_handlers = require("./handlers");
function routeMessage(ctx, ws, message) {
  switch (message.type) {
    case "register":
      (0, import_handlers.handleRegister)(ctx, ws, message);
      return;
    case "getDevices":
      void (0, import_handlers.handleGetDevices)(ctx, ws, message);
      return;
    case "getRooms":
      void (0, import_handlers.handleGetRooms)(ctx, ws, message);
      return;
    case "getSnapshot":
      void (0, import_handlers.handleGetSnapshot)(ctx, ws, message);
      return;
    case "help":
      (0, import_handlers.handleHelp)(ctx, ws, message);
      return;
    case "subscribe":
      (0, import_handlers.handleSubscribe)(ctx, ws, message);
      return;
    case "unsubscribe":
      (0, import_handlers.handleSubscribe)(ctx, ws, message);
      return;
    case "setState":
      void (0, import_handlers.handleSetState)(ctx, ws, message);
      return;
    default:
      ctx.sendError(ws, message.id, import_types.ErrorCodes.UNKNOWN_TYPE, `Unknown message type: ${message.type}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  routeMessage
});
//# sourceMappingURL=routes.js.map
