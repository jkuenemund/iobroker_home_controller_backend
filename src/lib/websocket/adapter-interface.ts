/**
 * Narrow adapter surface required by the WebSocket layer.
 * Uses only the methods we actually need to keep types minimal and compatible.
 */
export type AdapterInterface = {
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
	};
	config: {
		basePath: string;
		wsPort: number;
		authMode?: "none" | "basic";
		authUser?: string;
		authPassword?: string;
		defaultSubscription?: "all" | "none";
		maxEventsPerSecond?: number;
	};
	getForeignStatesAsync: ioBroker.Adapter["getForeignStatesAsync"];
	getForeignStateAsync: ioBroker.Adapter["getForeignStateAsync"];
	subscribeForeignStates: ioBroker.Adapter["subscribeForeignStates"];
	setForeignStateAsync: (
		id: string,
		state: ioBroker.SettableState | ioBroker.State | ioBroker.StateValue,
		ack?: boolean,
	) => ioBroker.SetStatePromise;
};

