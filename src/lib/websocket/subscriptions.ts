/* eslint-disable jsdoc/require-jsdoc */

import type { WebSocket } from "ws";
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
	private readonly deviceRooms: Map<string, string> = new Map();

	constructor(deps: SubscriptionRegistryDeps) {
		this.deps = deps;
	}

	public setDeviceRooms(map: Map<string, string>): void {
		this.deviceRooms.clear();
		for (const [k, v] of map.entries()) {
			this.deviceRooms.set(k, v);
		}
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
		if (!current) {
			return undefined;
		}
		if (!remove || remove.length === 0) {
			return current;
		}
		const set = new Set(current);
		for (const item of remove) {
			set.delete(item);
		}
		return Array.from(set);
	}

	public shouldDeliver(ws: WebSocket, event: StateChangeMessage, _clients: Map<WebSocket, ConnectedClient>): boolean {
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
			const room = this.deviceRooms.get(payload.deviceId);
			if (!room || !rooms.includes(room)) {
				return false;
			}
		}
		return true;
	}

	public shouldDeliverRoom(ws: WebSocket, roomsPayload: { roomId: string }[]): boolean {
		const filters = this.filters.get(ws);
		if (!filters && this.deps.defaultSubscription === "none") {
			return false;
		}
		if (!filters || Object.keys(filters).length === 0) {
			return true;
		}
		const roomFilter = filters.rooms;
		if (!roomFilter || roomFilter.length === 0) {
			// no room filter means deliver
			return true;
		}
		// deliver if any room matches
		return roomsPayload.some(r => roomFilter.includes(r.roomId));
	}

	public remove(ws: WebSocket): void {
		this.filters.delete(ws);
	}
}
