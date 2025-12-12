/**
 * Narrow adapter surface required by the WebSocket layer.
 * Uses only the methods we actually need to keep types minimal and compatible.
 */
export type AdapterInterface = {
	/** Logger interface */
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
	};
	/** Adapter configuration */
	config: {
		basePath: string;
		wsPort: number;
		scenesPath: string;
		authMode?: "none" | "basic" | "token";
		authUser?: string;
		authPassword?: string;
		tokenTtlSeconds?: number;
		staticToken?: string;
		wsUseTls?: boolean;
		wsTlsCertPath?: string;
		wsTlsKeyPath?: string;
		defaultSubscription?: "all" | "none";
		maxEventsPerSecond?: number;
	};
	/** Get foreign states */
	getForeignStatesAsync: ioBroker.Adapter["getForeignStatesAsync"];
	/** Get single foreign state */
	getForeignStateAsync: ioBroker.Adapter["getForeignStateAsync"];
	/** Get foreign object */
	getForeignObjectAsync?: ioBroker.Adapter["getForeignObjectAsync"];
	/** Subscribe to foreign states */
	subscribeForeignStates: ioBroker.Adapter["subscribeForeignStates"];
	/** Delete foreign object */
	delForeignObjectAsync: ioBroker.Adapter["delForeignObjectAsync"];
	/** Extend foreign object */
	extendForeignObjectAsync: ioBroker.Adapter["extendForeignObjectAsync"];
	/** Set foreign state */
	setForeignStateAsync: (
		id: string,
		state: ioBroker.SettableState | ioBroker.State | ioBroker.StateValue,
		ack?: boolean,
	) => ioBroker.SetStatePromise;
	/** Check user password */
	checkPasswordAsync: ioBroker.Adapter["checkPasswordAsync"];
};
