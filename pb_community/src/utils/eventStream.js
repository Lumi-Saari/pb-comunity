// utils/eventStream.js
const streams = new Map(); // roomId -> Set(stream)

function addStream(roomId, stream) {
  if (!streams.has(roomId)) streams.set(roomId, new Set());
  streams.get(roomId).add(stream);
  console.log(`[SSE] addStream: room=${roomId} total=${streams.get(roomId).size}`);
}

function removeStream(roomId, stream) {
  if (!streams.has(roomId)) return;
  streams.get(roomId).delete(stream);
  console.log(`[SSE] removeStream: room=${roomId} total=${streams.get(roomId).size}`);
  if (streams.get(roomId).size === 0) streams.delete(roomId);
}

async function broadcast(roomId, event, payload) {
  const set = streams.get(roomId);
  if (!set) {
    console.log(`[SSE] broadcast: no streams for room=${roomId} event=${event}`);
    return;
  }
  const data = JSON.stringify(payload);
  console.log(`[SSE] broadcast: room=${roomId} event=${event} payload=${data}`);
  for (const s of Array.from(set)) {
    try {
      // Hono stream object supports writeSSE({ event, data })
      s.writeSSE({ event, data });
    } catch (err) {
      console.error('[SSE] write failed, removing stream', err);
      removeStream(roomId, s);
    }
  }
}

module.exports = { addStream, removeStream, broadcast };