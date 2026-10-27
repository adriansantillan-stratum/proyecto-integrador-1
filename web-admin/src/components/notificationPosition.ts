/** Position the notification surface in viewport coordinates, not sidebar coordinates. */
export function notificationPosition(anchor: { left: number; right: number; top: number; bottom: number }, viewport: { width: number; height: number }, collapsed: boolean) {
  const gap = 8;
  const width = Math.max(0, Math.min(320, viewport.width - 2 * gap));
  const preferredLeft = collapsed ? anchor.left : anchor.right - width;
  const left = Math.max(gap, Math.min(preferredLeft, viewport.width - width - gap));
  const below = Math.max(0, viewport.height - anchor.bottom - 2 * gap);
  const above = Math.max(0, anchor.top - 2 * gap);
  const openBelow = below >= Math.min(200, 400) || below >= above;
  const maxHeight = Math.min(400, openBelow ? below : above);
  const top = openBelow ? anchor.bottom + gap : anchor.top - maxHeight - gap;
  return { left, top: Math.max(gap, top), width, maxHeight };
}
