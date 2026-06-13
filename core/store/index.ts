export { loadChronicle } from "./loadChronicle";
export { saveChronicle } from "./saveChronicle";
export { appendEvents } from "./appendEvents";
export { loadMergeState, saveMergeState, recordNewEvents, resetMergeCounter } from "./mergeState";
export type { MergeState } from "./mergeState";

// Phase 2: 事件合并（从 core/merge 透出）
export { mergeEvents, applyInstructions } from "../merge";
