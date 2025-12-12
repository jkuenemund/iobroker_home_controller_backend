/* eslint-disable jsdoc/require-jsdoc */

import Ajv, { type ValidateFunction } from "ajv";
import type { BaseMessage } from "./types";

const ajv = new Ajv({ removeAdditional: true, allErrors: true });

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
				acceptCompression: { type: "boolean" },
			},
			additionalProperties: false,
		},
	},
	additionalProperties: false,
} as const;

const simpleTypeSchema = (typeValue: string): ValidateFunction =>
	ajv.compile({
		type: "object",
		required: ["type"],
		properties: {
			type: { const: typeValue },
			id: { type: "string", nullable: true },
		},
		additionalProperties: false,
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
				capabilityTypes: { type: "array", items: { type: "string" } },
			},
			additionalProperties: false,
		},
	},
	additionalProperties: false,
} as const;

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
				ack: { type: "boolean" },
			},
			additionalProperties: false,
		},
	},
	additionalProperties: false,
} as const;

const validators: Record<string, ValidateFunction> = {
	register: ajv.compile(registerSchema),
	getDevices: simpleTypeSchema("getDevices"),
	getRooms: simpleTypeSchema("getRooms"),
	getSnapshot: simpleTypeSchema("getSnapshot"),
	help: simpleTypeSchema("help"),
	subscribe: ajv.compile(subscribeSchema),
	unsubscribe: ajv.compile(subscribeSchema),
	setState: ajv.compile(setStateSchema),
};

export function validateIncoming(message: unknown): { ok: boolean; errors?: string[]; parsed?: BaseMessage } {
	if (typeof message !== "object" || message === null) {
		return { ok: false, errors: ["Message must be an object"] };
	}
	const typed = message as BaseMessage;
	if (!typed.type || typeof typed.type !== "string") {
		return { ok: false, errors: ["Missing or invalid type"] };
	}
	const validator = validators[typed.type];
	if (!validator) {
		// unknown types handled elsewhere
		return { ok: true, parsed: typed };
	}
	const valid = validator(typed);
	if (!valid) {
		const errs = (validator.errors || []).map((e: any) => {
			const path = e.instancePath || e.dataPath || "/";
			return `${path} ${e.message ?? ""}`.trim();
		});
		return { ok: false, errors: errs };
	}
	return { ok: true, parsed: typed };
}
