/**
 * Copies text, and says whether it worked. Browsers only offer the clipboard API to pages on
 * a secure origin, so one opened over plain HTTP by address copies a selection instead.
 */
export async function copyText(text: string) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Refused here; the selection may still be allowed.
    }
  }
  // A selection of plain text, rather than a field, so that whatever has the focus keeps it.
  const holder = document.createElement("span");
  holder.textContent = text;
  holder.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;white-space:pre;user-select:text";
  document.body.append(holder);
  const selection = getSelection();
  selection?.selectAllChildren(holder);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    selection?.removeAllRanges();
    holder.remove();
  }
}
