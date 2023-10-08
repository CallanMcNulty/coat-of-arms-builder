import paperCore from "paper/dist/paper-core";

declare global {
	export type paper = typeof paperCore;
}