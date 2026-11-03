import type {Workout} from './store';
import { generateId } from "./utils";
export function copyProgram(original:Workout):Workout {const copy=structuredClone(original);copy.id=generateId();return copy;}