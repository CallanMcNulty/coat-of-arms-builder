import paperCore from 'paper/dist/paper-core';
import { PaperOffset } from 'paperjs-offset';

declare global {
	export type paper = typeof paperCore;
	export class paperOffset extends PaperOffset {}
}