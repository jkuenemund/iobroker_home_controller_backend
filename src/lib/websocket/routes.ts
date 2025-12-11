/* eslint-disable jsdoc/require-jsdoc */

import type { WebSocket } from "ws";
import type { BaseMessage, GetRoomsRequest, GetSnapshotRequest, HelpRequest, TriggerSceneRequest } from "./types";
import { ErrorCodes } from "./types";
import {
	handleGetDevices,
	handleGetRooms,
	handleGetSnapshot,
	handleHelp,
	handleRegister,
	handleSubscribe,
	handleSetState,
	handleTriggerScene,
	handleSaveScene,
	handleDeleteScene,
} from "./handlers";
import type { HandlerContext } from "./handlers";

export function routeMessage(ctx: HandlerContext, ws: WebSocket, message: BaseMessage): void {
	switch (message.type) {
		case "register":
			handleRegister(ctx, ws, message);
			return;
		case "getDevices":
			void handleGetDevices(ctx, ws, message);
			return;
		case "getRooms":
			void handleGetRooms(ctx, ws, message as GetRoomsRequest);
			return;
		case "getSnapshot":
			void handleGetSnapshot(ctx, ws, message as GetSnapshotRequest);
			return;
		case "help":
			handleHelp(ctx, ws, message as HelpRequest);
			return;
		case "subscribe":
			handleSubscribe(ctx, ws, message as any);
			return;
		case "unsubscribe":
			handleSubscribe(ctx, ws, message as any);
			return;
		case "setState":
			void handleSetState(ctx, ws, message as any);
			return;
		case "triggerScene":
			void handleTriggerScene(ctx, ws, message as TriggerSceneRequest);
			return;
		case "saveScene":
			void handleSaveScene(ctx, ws, message as any);
			return;
		case "deleteScene":
			void handleDeleteScene(ctx, ws, message as any);
			return;
		default:
			ctx.sendError(ws, message.id, ErrorCodes.UNKNOWN_TYPE, `Unknown message type: ${message.type}`);
	}
}
