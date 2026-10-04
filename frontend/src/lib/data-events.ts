export const DATA_CHANGED = "grove:data-changed";
export function notifyDataChanged() { window.dispatchEvent(new Event(DATA_CHANGED)); }
