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
var auth_exports = {};
__export(auth_exports, {
  AuthService: () => AuthService
});
module.exports = __toCommonJS(auth_exports);
var import_crypto = __toESM(require("crypto"));
var import_url = require("url");
class AuthService {
  constructor(adapter) {
    this.adapter = adapter;
  }
  secret = null;
  staticToken;
  async init() {
    var _a;
    this.secret = await this.loadSecret();
    this.staticToken = ((_a = this.adapter.config.staticToken) == null ? void 0 : _a.trim()) || void 0;
  }
  getDefaultTtlSeconds() {
    var _a;
    const ttl = (_a = this.adapter.config.tokenTtlSeconds) != null ? _a : 3600;
    return ttl < 60 ? 60 : ttl;
  }
  async issueTokenForUser(username, password, ttlSeconds) {
    var _a, _b, _c, _d;
    if (!username || !password) {
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }
    const userObj = await ((_b = (_a = this.adapter).getForeignObjectAsync) == null ? void 0 : _b.call(_a, `system.user.${username}`).catch((error) => {
      this.adapter.log.warn(`User lookup failed: ${error.message}`);
      return null;
    }));
    if (!userObj || userObj.type !== "user" || ((_c = userObj.common) == null ? void 0 : _c.enabled) === false) {
      return { ok: false, reason: "USER_NOT_FOUND" };
    }
    try {
      const userId = (_d = userObj._id) != null ? _d : `system.user.${username}`;
      const ok = await this.adapter.checkPasswordAsync(userId, password);
      if (!ok) {
        return { ok: false, reason: "INVALID_CREDENTIALS" };
      }
    } catch (error) {
      this.adapter.log.warn(`Password check failed: ${error.message}`);
      return { ok: false, reason: "AUTH_ERROR" };
    }
    const now = Math.floor(Date.now() / 1e3);
    const exp = now + (ttlSeconds != null ? ttlSeconds : this.getDefaultTtlSeconds());
    const payload = {
      user: username,
      exp,
      iat: now,
      kind: "access"
    };
    return { ok: true, token: this.sign(payload), expiresAt: exp };
  }
  authenticateUpgrade(req) {
    const token = this.extractToken(req);
    if (!token) {
      return { ok: false, reason: "MISSING_TOKEN" };
    }
    return this.verifyToken(token);
  }
  verifyToken(token) {
    const secret = this.secret;
    if (!secret) {
      return { ok: false, reason: "NO_SECRET" };
    }
    const payload = this.decode(token, secret);
    if (!payload) {
      return { ok: false, reason: "INVALID_TOKEN" };
    }
    if (this.staticToken && token === this.staticToken) {
    }
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp <= now) {
      return { ok: false, reason: "TOKEN_EXPIRED" };
    }
    return { ok: true, user: payload.user };
  }
  sign(payload) {
    if (!this.secret) {
      throw new Error("AuthService not initialized");
    }
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = import_crypto.default.createHmac("sha256", this.secret).update(payloadStr).digest("base64url");
    return `${payloadStr}.${sig}`;
  }
  decode(token, secret) {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) {
      return null;
    }
    const expectedSig = import_crypto.default.createHmac("sha256", secret).update(payloadB64).digest("base64url");
    const provided = Buffer.from(sig);
    const expected = Buffer.from(expectedSig);
    if (provided.length !== expected.length) {
      return null;
    }
    if (!import_crypto.default.timingSafeEqual(provided, expected)) {
      return null;
    }
    try {
      const json = Buffer.from(payloadB64, "base64url").toString("utf8");
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader == null ? void 0 : authHeader.startsWith("Bearer ")) {
      return authHeader.substring("Bearer ".length).trim();
    }
    const url = this.parseUrl(req);
    if (url) {
      const token = url.searchParams.get("token");
      if (token) {
        return token;
      }
    }
    return null;
  }
  parseUrl(req) {
    var _a, _b;
    try {
      const host = (_a = req.headers.host) != null ? _a : "localhost";
      return new import_url.URL((_b = req.url) != null ? _b : "/", `http://${host}`);
    } catch {
      return null;
    }
  }
  async loadSecret() {
    var _a, _b, _c;
    try {
      const systemConfig = await ((_b = (_a = this.adapter).getForeignObjectAsync) == null ? void 0 : _b.call(_a, "system.config"));
      const secret = (_c = systemConfig == null ? void 0 : systemConfig.native) == null ? void 0 : _c.secret;
      if (secret) {
        return secret;
      }
    } catch (error) {
      this.adapter.log.warn(`Could not read ioBroker secret: ${error.message}`);
    }
    const envSecret = process.env.IOB_SECRET || process.env.IOBROKER_SECRET;
    if (envSecret) {
      this.adapter.log.warn("Using IOB_SECRET/IOBROKER_SECRET from environment as fallback secret");
      return envSecret;
    }
    throw new Error("ioBroker secret not available");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthService
});
//# sourceMappingURL=auth.js.map
