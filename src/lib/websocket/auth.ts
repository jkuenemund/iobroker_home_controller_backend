/* eslint-disable jsdoc/require-jsdoc */
import crypto from "crypto";
import type { IncomingMessage } from "http";
import { URL } from "url";
import type { AdapterInterface } from "./adapter-interface";

type TokenPayload = {
	user: string;
	exp: number;
	iat: number;
	scope?: string[];
	kind?: "access";
};

export type AuthResult = { ok: true; user: string } | { ok: false; reason: string };

export class AuthService {
	private secret: string | null = null;
	private staticToken: string | undefined;

	public constructor(private readonly adapter: AdapterInterface) {}

	public async init(): Promise<void> {
		this.secret = await this.loadSecret();
		this.staticToken = this.adapter.config.staticToken?.trim() || undefined;
	}

	public getDefaultTtlSeconds(): number {
		const ttl = this.adapter.config.tokenTtlSeconds ?? 3600;
		return ttl < 60 ? 60 : ttl;
	}

	public async issueTokenForUser(
		username: string,
		password: string,
		ttlSeconds?: number,
	): Promise<{ ok: true; token: string; expiresAt: number } | { ok: false; reason: string }> {
		if (!username || !password) {
			return { ok: false, reason: "INVALID_CREDENTIALS" };
		}

		const userObj = await this.adapter.getForeignObjectAsync?.(`system.user.${username}`).catch(error => {
			this.adapter.log.warn(`User lookup failed for ${username}: ${(error as Error).message}`);
			return null;
		});

		if (!userObj || userObj.type !== "user") {
			this.adapter.log.warn(`Token request rejected: user ${username} not found`);
			return { ok: false, reason: "USER_NOT_FOUND" };
		}

		if (userObj.common?.enabled === false) {
			this.adapter.log.warn(`Token request rejected: user ${username} is disabled`);
			return { ok: false, reason: "USER_NOT_FOUND" };
		}

		const storedHash = userObj.common?.password as string | undefined;
		if (!storedHash || storedHash.trim().length === 0) {
			this.adapter.log.warn(`Token request rejected: user ${username} has no password set`);
			return { ok: false, reason: "NO_PASSWORD_SET" };
		}

		const userId = userObj._id ?? `system.user.${username}`;

		try {
			const [passwordValid] = await this.adapter.checkPasswordAsync(userId, password);
			
			if (!passwordValid) {
				this.adapter.log.warn(`Token request rejected: invalid password for user ${username}`);
				return { ok: false, reason: "INVALID_CREDENTIALS" };
			}
		} catch (error) {
			this.adapter.log.error(`Password check failed for ${username}: ${(error as Error).message}`);
			return { ok: false, reason: "AUTH_ERROR" };
		}

		this.adapter.log.info(`Token issued successfully for user: ${username}`);

		const now = Math.floor(Date.now() / 1000);
		const exp = now + (ttlSeconds ?? this.getDefaultTtlSeconds());
		const payload: TokenPayload = {
			user: username,
			exp,
			iat: now,
			kind: "access",
		};

		return { ok: true, token: this.sign(payload), expiresAt: exp };
	}

	public authenticateUpgrade(req: IncomingMessage): AuthResult {
		const token = this.extractToken(req);
		if (!token) {
			return { ok: false, reason: "MISSING_TOKEN" };
		}
		return this.verifyToken(token);
	}

	public verifyToken(token: string): AuthResult {
		const secret = this.secret;
		if (!secret) {
			return { ok: false, reason: "NO_SECRET" };
		}

		const payload = this.decode(token, secret);
		if (!payload) {
			return { ok: false, reason: "INVALID_TOKEN" };
		}

		if (this.staticToken && token === this.staticToken) {
			// static token is still subject to exp check below
		}

		const now = Math.floor(Date.now() / 1000);
		if (payload.exp <= now) {
			return { ok: false, reason: "TOKEN_EXPIRED" };
		}

		return { ok: true, user: payload.user };
	}

	private sign(payload: TokenPayload): string {
		if (!this.secret) {
			throw new Error("AuthService not initialized");
		}
		const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
		const sig = crypto.createHmac("sha256", this.secret).update(payloadStr).digest("base64url");
		return `${payloadStr}.${sig}`;
	}

	private decode(token: string, secret: string): TokenPayload | null {
		const [payloadB64, sig] = token.split(".");
		if (!payloadB64 || !sig) {
			return null;
		}

		const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
		const provided = Buffer.from(sig);
		const expected = Buffer.from(expectedSig);
		if (provided.length !== expected.length) {
			return null;
		}
		if (!crypto.timingSafeEqual(provided, expected)) {
			return null;
		}

		try {
			const json = Buffer.from(payloadB64, "base64url").toString("utf8");
			return JSON.parse(json) as TokenPayload;
		} catch {
			return null;
		}
	}

	private extractToken(req: IncomingMessage): string | null {
		const authHeader = req.headers.authorization;
		if (authHeader?.startsWith("Bearer ")) {
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

	private parseUrl(req: IncomingMessage): URL | null {
		try {
			const host = req.headers.host ?? "localhost";
			return new URL(req.url ?? "/", `http://${host}`);
		} catch {
			return null;
		}
	}

	private async loadSecret(): Promise<string> {
		try {
			const systemConfig = await this.adapter.getForeignObjectAsync?.("system.config");
			const secret = systemConfig?.native?.secret as string | undefined;
			if (secret) {
				return secret;
			}
		} catch (error) {
			this.adapter.log.warn(`Could not read ioBroker secret: ${(error as Error).message}`);
		}
		const envSecret = process.env.IOB_SECRET || process.env.IOBROKER_SECRET;
		if (envSecret) {
			this.adapter.log.warn("Using IOB_SECRET/IOBROKER_SECRET from environment as fallback secret");
			return envSecret;
		}
		throw new Error("ioBroker secret not available");
	}
}

