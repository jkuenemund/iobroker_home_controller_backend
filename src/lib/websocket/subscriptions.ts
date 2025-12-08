/* eslint-disable jsdoc/require-param, jsdoc/require-jsdoc */

import { WebSocket } from "ws";
import type { ConnectedClient, StateChangeMessage } from "./types";

export interface SubscriptionFilters {
	deviceIds?: string[];
	rooms?: string[];
	capabilityTypes?: string[];
}

export interface SubscriptionRegistryDeps {
	defaultSubscription: "all" | "none";
}

export class SubscriptionRegistry {
	private readonly deps: SubscriptionRegistryDeps;
	private readonly filters: Map<WebSocket, SubscriptionFilters> = new Map();

	constructor(deps: SubscriptionRegistryDeps) {
		this.deps = deps;
	}

	public setDefault(ws: WebSocket): void {
		if (this.deps.defaultSubscription === "all") {
			this.filters.set(ws, {});
		}
	}

	public subscribe(ws: WebSocket, filters: SubscriptionFilters): void {
		this.filters.set(ws, filters);
	}

	public unsubscribe(ws: WebSocket, filters?: SubscriptionFilters): void {
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
			capabilityTypes: this.diff(existing.capabilityTypes, filters.capabilityTypes),
		});
	}

	private diff(current?: string[], remove?: string[]): string[] | undefined {
		if (!current) return undefined;
		if (!remove || remove.length === 0) return current;
		const set = new Set(current);
		for (const item of remove) {
			set.delete(item);
		}
		return Array.from(set);
	}

	public shouldDeliver(ws: WebSocket, event: StateChangeMessage, clients: Map<WebSocket, ConnectedClient>): boolean {
		const filters = this.filters.get(ws);
		// defaultSubscription=none and no filters => deliver nothing
		if (!filters && this.deps.defaultSubscription === "none") {
			return false;
		}
		// no filters or default all
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
			// Room filtering requires device->room mapping (not available here).
			// For now, if rooms filter is set, we do not block; implement when room map is available.
			void client;
		}
		return true;
	}

	public remove(ws: WebSocket): void {
		this.filters.delete(ws);
	}
}

