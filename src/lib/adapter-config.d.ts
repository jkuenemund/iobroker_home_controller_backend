// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
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
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export { };