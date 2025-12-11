/* eslint-disable jsdoc/require-param, jsdoc/require-jsdoc */

import { WebSocket } from "ws";
import type {
	BaseMessage,
	ConnectedClient,
	StateChangeMessage,
	StateChangeBatchMessage,
	ThrottleHintMessage,
} from "./types";
import type { SnapshotService } from "../services/snapshot-service";
import type { SubscriptionRegistry } from "./subscriptions";
import { applySubscriptions } from "./handlers";
import type { AdapterInterface } from "./adapter-interface";

export interface StateChangeDeps {
	adapter: Pick<AdapterInterface, "log" | "subscribeForeignStates" | "config">;
	snapshotService: SnapshotService;
	clients: Map<WebSocket, ConnectedClient>;
	send: (ws: WebSocket, message: BaseMessage) => void;
}

export class StateChangeManager {
	private readonly deps: StateChangeDeps;
	private readonly stateMap: Map<string, Array<{ deviceId: string; capability: string }>> = new Map();
	private readonly subscriptions: SubscriptionRegistry;
	private readonly deviceRooms: Map<string, string> = new Map();
	private readonly ctxForSubs: {
		subscriptions: SubscriptionRegistry;
		clients: Map<WebSocket, ConnectedClient>;
	};
	private readonly queue: StateChangeMessage["payload"][] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private sceneSnapshotTimer: NodeJS.Timeout | null = null;
	private readonly batchIntervalMs = 200;
	private eventsThisSecond = 0;
	private windowStart = Date.now();

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
			this.deviceRooms.clear();
			const statesToSubscribe = new Set<string>();

			for (const [deviceId, config] of Object.entries(devices)) {
				if (config.capabilities) {
					if (config.room) {
						this.deviceRooms.set(deviceId, config.room);
					}
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

			this.subscriptions.setDeviceRooms(this.deviceRooms);
			this.deps.adapter.log.info(`Subscribed to ${statesToSubscribe.size} device states for real-time updates`);

			// Subscribe to scene changes
			await this.subscribeToSceneChanges();
		} catch (error) {
			this.deps.adapter.log.error(`Failed to subscribe to states: ${(error as Error).message}`);
		}
	}

	private async subscribeToSceneChanges(): Promise<void> {
		try {
			const scenesPath = this.deps.adapter.config.scenesPath || 'cron_scenes.0.jobs';

			// Subscribe to all scene states with wildcard
			// This will catch: cron_scenes.0.jobs.*, cron_scenes.0.jobs.*.status, cron_scenes.0.jobs.*.trigger
			this.deps.adapter.subscribeForeignStates(`${scenesPath}.*`);

			this.deps.adapter.log.info(`Subscribed to scene changes at ${scenesPath}.*`);
		} catch (error) {
			this.deps.adapter.log.error(`Failed to subscribe to scene changes: ${(error as Error).message}`);
		}
	}

	public handleStateChange(id: string, state: ioBroker.State): void {
		// Check if it's a scene state change
		const scenesPath = this.deps.adapter.config.scenesPath || 'cron_scenes.0.jobs';
		if (id.startsWith(scenesPath)) {
			this.handleSceneStateChange(id, state);
			return;
		}

		// Handle device state changes
		const affected = this.stateMap.get(id);
		if (affected && affected.length > 0) {
			for (const item of affected) {
				this.enqueueStateChange(item.deviceId, item.capability, id, state.val, state.ts);
			}
		}
	}

	private handleSceneStateChange(id: string, state: ioBroker.State): void {
		// Ignore .trigger states (they're just momentary triggers)
		if (id.endsWith('.trigger')) {
			return;
		}

		this.deps.adapter.log.debug(`Scene state changed: ${id}`);

		// Send updated snapshot to all clients
		this.sendSceneSnapshot();
	}

	private sendSceneSnapshot(): void {
		// Debounce: only send snapshot once even if multiple scene states change
		if (this.sceneSnapshotTimer) {
			return; // Already scheduled
		}

		this.sceneSnapshotTimer = setTimeout(async () => {
			this.sceneSnapshotTimer = null;

			try {
				const scenes = await this.deps.snapshotService.getScenes();

				const message = {
					type: 'snapshot',
					payload: {
						scenes,
					},
				};

				for (const ws of this.deps.clients.keys()) {
					this.deps.send(ws, message);
				}

				this.deps.adapter.log.debug(`Sent scene snapshot to ${this.deps.clients.size} clients`);
			} catch (error) {
				this.deps.adapter.log.error(`Failed to send scene snapshot: ${(error as Error).message}`);
			}
		}, 500); // 500ms debounce
	}

	private enqueueStateChange(deviceId: string, capability: string, stateId: string, value: any, ts: number): void {
		this.countEvent();
		this.queue.push({
			deviceId,
			capability,
			state: stateId,
			value,
			timestamp: new Date(ts).toISOString(),
		});
		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => this.flushQueue(), this.batchIntervalMs);
		}
	}

	private flushQueue(): void {
		this.flushTimer = null;
		if (this.queue.length === 0) {
			return;
		}

		for (const ws of this.deps.clients.keys()) {
			const clientEvents: StateChangeMessage["payload"][] = [];
			for (const payload of this.queue) {
				const message: StateChangeMessage = { type: "stateChange", payload };
				if (this.subscriptions.shouldDeliver(ws, message, this.deps.clients)) {
					clientEvents.push(payload);
				}
			}
			if (clientEvents.length === 0) {
				continue;
			}
			if (clientEvents.length === 1) {
				const single: StateChangeMessage = { type: "stateChange", payload: clientEvents[0] };
				this.deps.send(ws, single);
			} else {
				const batch: StateChangeBatchMessage = {
					type: "stateChangeBatch",
					payload: { events: clientEvents },
				};
				this.deps.send(ws, batch);
			}
		}

		this.queue.length = 0;
	}

	private countEvent(): void {
		const now = Date.now();
		if (now - this.windowStart >= 1000) {
			this.windowStart = now;
			this.eventsThisSecond = 0;
		}
		this.eventsThisSecond += 1;
		const limit = this.deps.adapter.config.maxEventsPerSecond ?? 50;
		if (this.eventsThisSecond > limit) {
			this.sendThrottleHint();
		}
	}

	private sendThrottleHint(): void {
		const hint: ThrottleHintMessage = {
			type: "throttleHint",
			payload: {
				reason: "rate_limit",
				retryAfterMs: this.batchIntervalMs,
			},
		};
		for (const ws of this.deps.clients.keys()) {
			this.deps.send(ws, hint);
		}
	}
}

