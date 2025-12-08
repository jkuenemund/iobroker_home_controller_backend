/* eslint-disable jsdoc/require-param, jsdoc/require-jsdoc */

import { WebSocket } from "ws";
import type { BaseMessage, ConnectedClient, StateChangeMessage } from "./types";
import type { SnapshotService } from "../services/snapshot-service";
import type { SubscriptionRegistry } from "./subscriptions";
import { applySubscriptions } from "./handlers";

export interface StateChangeDeps {
	adapter: {
		log: {
			debug: (msg: string) => void;
			info: (msg: string) => void;
			warn: (msg: string) => void;
			error: (msg: string) => void;
		};
		subscribeForeignStates: (pattern: string) => void;
	};
	snapshotService: SnapshotService;
	clients: Map<WebSocket, ConnectedClient>;
	send: (ws: WebSocket, message: BaseMessage) => void;
}

export class StateChangeManager {
	private readonly deps: StateChangeDeps;
	private readonly stateMap: Map<string, Array<{ deviceId: string; capability: string }>> = new Map();
	private readonly subscriptions: SubscriptionRegistry;
	private readonly ctxForSubs: {
		subscriptions: SubscriptionRegistry;
		clients: Map<WebSocket, ConnectedClient>;
	};

	constructor(deps: StateChangeDeps, subscriptions: SubscriptionRegistry) {
		this.deps = deps;
		this.subscriptions = subscriptions;
		this.ctxForSubs = {
			subscriptions: this.subscriptions,
			clients: this.deps.clients,
		};
	}

	public async subscribeToAllStates(): Promise<void> {
		try {
			const devices = await this.deps.snapshotService.getDevices();

			this.stateMap.clear();
			const statesToSubscribe = new Set<string>();

			for (const [deviceId, config] of Object.entries(devices)) {
				if (config.capabilities) {
					for (const cap of config.capabilities) {
						if (cap.state) {
							statesToSubscribe.add(cap.state);
							const existing = this.stateMap.get(cap.state) || [];
							existing.push({ deviceId, capability: cap.type });
							this.stateMap.set(cap.state, existing);
						}
					}
				}
			}

			for (const oid of statesToSubscribe) {
				this.deps.adapter.subscribeForeignStates(oid);
			}

			this.deps.adapter.log.info(`Subscribed to ${statesToSubscribe.size} states for real-time updates`);
		} catch (error) {
			this.deps.adapter.log.error(`Failed to subscribe to states: ${(error as Error).message}`);
		}
	}

	public handleStateChange(id: string, state: ioBroker.State): void {
		const affected = this.stateMap.get(id);
		if (affected && affected.length > 0) {
			for (const item of affected) {
				this.broadcastStateChange(item.deviceId, item.capability, id, state.val, state.ts);
			}
		}
	}

	private broadcastStateChange(deviceId: string, capability: string, stateId: string, value: any, ts: number): void {
		const message: StateChangeMessage = {
			type: "stateChange",
			id: undefined,
			payload: {
				deviceId,
				capability,
				state: stateId,
				value,
				timestamp: new Date(ts).toISOString(),
			},
		};

		const deliveries = applySubscriptions(this.ctxForSubs as any, message);
		for (const [ws, msg] of deliveries) {
			this.deps.send(ws, msg);
		}
	}
}

