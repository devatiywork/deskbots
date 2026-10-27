// Рамка с «пиксельными» углами в полном разрешении экрана: облачки, подписи, панель.
// u — размер пикселя рамки на экране.

export function pixelBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, fill: string, edge: string) {
  ctx.fillStyle = edge; ctx.fillRect(x + u, y, w - 2 * u, h); ctx.fillRect(x, y + u, w, h - 2 * u);
  ctx.fillStyle = fill; ctx.fillRect(x + 2 * u, y + u, w - 4 * u, h - 2 * u); ctx.fillRect(x + u, y + 2 * u, w - 2 * u, h - 4 * u);
}
