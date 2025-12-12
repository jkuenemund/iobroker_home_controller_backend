/**
 * Narrow adapter surface required by the WebSocket layer.
 * Uses only the methods we actually need to keep types minimal and compatible.
 */
export type AdapterInterface = {
	/**
	 *
	 */
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
	};
	/**
	 *
	 */
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
	/**
	 *
	 */
	getForeignStatesAsync: ioBroker.Adapter["getForeignStatesAsync"];
	/**
	 *
	 */
	getForeignStateAsync: ioBroker.Adapter["getForeignStateAsync"];
	/**
	 *
	 */
	getForeignObjectAsync?: ioBroker.Adapter["getForeignObjectAsync"];
	/**
	 *
	 */
	subscribeForeignStates: ioBroker.Adapter["subscribeForeignStates"];
	/**
	 *
	 */
	delForeignObjectAsync: ioBroker.Adapter["delForeignObjectAsync"];
	/**
	 *
	 */
	extendForeignObjectAsync: ioBroker.Adapter["extendForeignObjectAsync"];
	/**
	 *
	 */
	setForeignStateAsync: (
		id: string,
		state: ioBroker.SettableState | ioBroker.State | ioBroker.StateValue,
		ack?: boolean,
	) => ioBroker.SetStatePromise;
	/**
	 *
	 */
	checkPasswordAsync: ioBroker.Adapter["checkPasswordAsync"];
};
