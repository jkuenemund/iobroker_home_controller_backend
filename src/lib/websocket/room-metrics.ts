import { WebSocket } from "ws";
import type { BaseMessage, ConnectedClient, RoomMetric } from "./types";
import type { SnapshotService } from "../services/snapshot-service";
import type { SubscriptionRegistry } from "./subscriptions";

interface RoomMetricsDeps {
	adapter: {
		log: {
			debug: (msg: string) => void;
			info: (msg: string) => void;
			warn: (msg: string) => void;
			error: (msg: string) => void;
		};
		subscribeForeignStates: (pattern: string) => void;
		getForeignStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
		config: {
			roomMetricsBatchIntervalSec?: number;
		};
	};
	snapshotService: SnapshotService;
	clients: Map<WebSocket, ConnectedClient>;
	send: (ws: WebSocket, msg: BaseMessage) => void;
	subscriptions: SubscriptionRegistry;
}

interface MetricRef {
	roomId: string;
	metricId: string;
	unit?: string;
	label?: string;
	type?: string;
}

export class RoomMetricsManager {
	private readonly deps: RoomMetricsDeps;
	private readonly stateToMetric: Map<string, MetricRef> = new Map();
	private readonly buffer: Map<string, Map<string, { value: unknown; ts: string; status?: string; unit?: string; label?: string; type?: string }>> =
		new Map();
	private flushTimer: NodeJS.Timeout | null = null;
	private readonly batchIntervalMs: number;

	constructor(deps: RoomMetricsDeps) {
		this.deps = deps;
		const cfgSec = deps.adapter.config.roomMetricsBatchIntervalSec;
		this.batchIntervalMs = cfgSec && cfgSec > 0 ? cfgSec * 1000 : 60_000;
	}

	public async subscribeToAllMetrics(): Promise<void> {
		try {
			const rooms = await this.deps.snapshotService.getRooms();
			this.stateToMetric.clear();
			const stateIds = new Set<string>();

			for (const [roomId, room] of Object.entries(rooms)) {
				if (!room.metrics) continue;
				for (const metricRaw of room.metrics) {
					const metric = metricRaw as RoomMetric & { id?: string };
					if (!metric.state) continue;
					const metricId = metric.id || metric.state || metric.type || `${roomId}_${Math.random()}`;
					this.stateToMetric.set(metric.state, {
						roomId,
						metricId,
						unit: metric.unit,
						label: metric.label,
						type: metric.type,
					});
					stateIds.add(metric.state);
				}
			}

			for (const oid of stateIds) {
				this.deps.adapter.subscribeForeignStates(oid);
			}

			this.deps.adapter.log.info(`Subscribed to ${stateIds.size} room metric states`);
		} catch (error) {
			this.deps.adapter.log.error(`Failed to subscribe to room metrics: ${(error as Error).message}`);
		}
	}

	public handleStateChange(id: string, state: ioBroker.State): void {
		const ref = this.stateToMetric.get(id);
		if (!ref) return;
		const ts = state.ts ? new Date(state.ts).toISOString() : new Date().toISOString();
		const status = state.val === undefined || state.val === null ? "nodata" : "ok";

		let roomEntry = this.buffer.get(ref.roomId);
		if (!roomEntry) {
			roomEntry = new Map();
			this.buffer.set(ref.roomId, roomEntry);
		}
		roomEntry.set(ref.metricId, {
			value: state.val,
			ts,
			status,
			unit: ref.unit,
			label: ref.label,
			type: ref.type,
		});

		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => this.flush(), this.batchIntervalMs);
		}
	}

	private flush(): void {
		this.flushTimer = null;
		if (this.buffer.size === 0) {
			return;
		}

		const roomsPayload: Array<{
			roomId: string;
			metrics: Array<{
				id: string;
				value: unknown;
				ts: string;
				status?: string;
				unit?: string;
				label?: string;
				type?: string;
			}>;
		}> = [];
		for (const [roomId, metricsMap] of this.buffer.entries()) {
			const metrics: Array<{
				id: string;
				value: unknown;
				ts: string;
				status?: string;
				unit?: string;
				label?: string;
				type?: string;
			}> = [];
			for (const [metricId, data] of metricsMap.entries()) {
				metrics.push({
					id: metricId,
					value: data.value,
					ts: data.ts,
					status: data.status as any,
					unit: data.unit,
					label: data.label,
					type: data.type,
				});
			}
			if (metrics.length > 0) {
				roomsPayload.push({ roomId, metrics });
			}
		}

		if (roomsPayload.length === 0) {
			this.buffer.clear();
			return;
		}

		const message: BaseMessage & {
			type: "roomMetricsUpdateBatch";
			payload: { rooms: typeof roomsPayload };
		} = {
			type: "roomMetricsUpdateBatch",
			payload: { rooms: roomsPayload },
		};

		for (const ws of this.deps.clients.keys()) {
			if (this.deps.subscriptions.shouldDeliverRoom(ws, roomsPayload)) {
				this.deps.send(ws, message);
			}
		}

		this.buffer.clear();
	}
}

