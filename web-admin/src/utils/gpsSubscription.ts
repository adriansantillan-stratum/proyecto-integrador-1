/** Subscribe without replacing the service's authentication onopen callback. */
export function watchGpsConnection(ws: WebSocket, poll: () => void, setConnected: (connected: boolean) => void, period = 5000): () => void {
  let connected = false;
  let stopped = false;
  const open = () => { connected = true; setConnected(true); };
  const fallback = () => { connected = false; setConnected(false); };
  ws.addEventListener('open', open);
  ws.addEventListener('error', fallback);
  ws.addEventListener('close', fallback);
  // Starts before open, so a connection that never opens still polls.
  const interval = setInterval(() => { if (!stopped && !connected) poll(); }, period);
  return () => {
    stopped = true;
    clearInterval(interval);
    ws.removeEventListener('open', open);
    ws.removeEventListener('error', fallback);
    ws.removeEventListener('close', fallback);
    ws.close();
  };
}
