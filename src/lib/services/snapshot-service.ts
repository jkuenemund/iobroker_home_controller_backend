/* eslint-disable jsdoc/require-param, jsdoc/require-jsdoc */

import type { DeviceConfig, RoomConfig, SnapshotPayload } from "../websocket/types";

/**
 * Minimal adapter interface needed for snapshot building.
 */
export interface SnapshotAdapterDeps {
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
	};
	config: {
		basePath: string;
	};
	getForeignStatesAsync: (pattern: string) => Promise<Record<string, ioBroker.State | null | undefined>>;
	getForeignStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	subscribeForeignStates: (pattern: string) => void;
}

export class SnapshotService {
	private readonly adapter: SnapshotAdapterDeps;

	constructor(adapter: SnapshotAdapterDeps) {
		this.adapter = adapter;
	}

	/**
	 * Build snapshot (devices + rooms) with provided seq reference
	 */
	public async buildSnapshot(seq: number): Promise<SnapshotPayload> {
		const [devices, rooms] = await Promise.all([this.getDevices(), this.getRooms()]);
		return { devices, rooms, seq };
	}

	public async getDevices(): Promise<Record<string, DeviceConfig>> {
		return this.fetchDevices();
	}

	public async getRooms(): Promise<Record<string, RoomConfig>> {
		return this.fetchRooms();
	}

	public async validateSetState(
		deviceId: string,
		capability: string,
		stateId: string,
	): Promise<{ ok: boolean; reason?: string }> {
		const devices = await this.fetchDevices();
		const device = devices[deviceId];
		if (!device) {
			return { ok: false, reason: "UNKNOWN_DEVICE" };
		}
		const cap = device.capabilities?.find(c => c.type === capability && c.state === stateId);
		if (!cap) {
			return { ok: false, reason: "UNKNOWN_STATE_OR_CAPABILITY" };
		}
		return { ok: true };
	}

	/**
	 * Fetch all devices from ioBroker states
	 */
	private async fetchDevices(): Promise<Record<string, DeviceConfig>> {
		const basePath = this.adapter.config.basePath;
		const pattern = `${basePath}.devices.*`;

		const states = await this.adapter.getForeignStatesAsync(pattern);
		const devices: Record<string, DeviceConfig> = {};

		// Parse configs first
		for (const [id, state] of Object.entries(states)) {
			if (!state?.val) {
				continue;
			}

			const deviceId = id.substring(`${basePath}.devices.`.length);

			try {
				const config = JSON.parse(state.val as string) as DeviceConfig;
				devices[deviceId] = config;
			} catch {
				this.adapter.log.warn(`Failed to parse device config for ${deviceId}`);
			}
		}

		// Collect all state IDs to fetch
		const stateIds = new Set<string>();
		for (const device of Object.values(devices)) {
			if (device.capabilities) {
				for (const cap of device.capabilities) {
					if (cap.state) {
						stateIds.add(cap.state);
					}
				}
			}
		}

		// Fetch current values for all states
		if (stateIds.size > 0) {
			const idArray = Array.from(stateIds);

			// Fetch in parallel
			await Promise.all(
				idArray.map(async oid => {
					try {
						const state = await this.adapter.getForeignStateAsync(oid);
						if (state && state.val !== undefined && state.val !== null) {
							for (const device of Object.values(devices)) {
								if (device.capabilities) {
									for (const cap of device.capabilities) {
										if (cap.state === oid) {
											cap.value = state.val;
										}
									}
								}
							}
						}
					} catch (error) {
						this.adapter.log.warn(`Failed to fetch state ${oid}: ${(error as Error).message}`);
					}
				}),
			);
		}

		return devices;
	}

	/**
	 * Fetch all rooms from ioBroker states
	 */
	private async fetchRooms(): Promise<Record<string, RoomConfig>> {
		const basePath = this.adapter.config.basePath;
		const pattern = `${basePath}.rooms.*`;

		const states = await this.adapter.getForeignStatesAsync(pattern);
		const rooms: Record<string, RoomConfig> = {};
		const metricStateIds = new Set<string>();

		for (const [id, state] of Object.entries(states)) {
			if (!state?.val) {
				continue;
			}

			const roomId = id.substring(`${basePath}.rooms.`.length);

			try {
				const config = JSON.parse(state.val as string) as RoomConfig;
				// normalize metrics ids
				if (config.metrics && Array.isArray(config.metrics)) {
					config.metrics = config.metrics.map(m => {
						const metric = { ...m };
						if (!metric.id) {
							metric.id = metric.state || metric.type;
						}
						if (!metric.label) {
							metric.label = metric.type || metric.id;
						}
						if (metric.state) {
							metricStateIds.add(metric.state);
						}
						return metric;
					});
				}
				rooms[roomId] = config;
			} catch (error) {
				this.adapter.log.warn(`Failed to parse room config for ${roomId}: ${(error as Error).message}`);
			}
		}

		// fetch metric values
		if (metricStateIds.size > 0) {
			const idArray = Array.from(metricStateIds);
			await Promise.all(
				idArray.map(async oid => {
					try {
						const state = await this.adapter.getForeignStateAsync(oid);
						if (state) {
							for (const room of Object.values(rooms)) {
								if (room.metrics) {
									for (const metric of room.metrics) {
										if (metric.state === oid) {
											metric.value = state.val;
											metric.ts = state.ts ? new Date(state.ts).toISOString() : undefined;
											metric.status =
												state.val === undefined || state.val === null ? "nodata" : metric.status || "ok";
										}
									}
								}
							}
						}
					} catch (error) {
						this.adapter.log.warn(`Failed to fetch metric state ${oid}: ${(error as Error).message}`);
					}
				}),
			);
		}

		return rooms;
	}
}
