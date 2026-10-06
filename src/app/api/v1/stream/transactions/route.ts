import { NextRequest } from 'next/server';
import { requireUser, getClientIp } from '@/lib/auth-helper';
import { realtimeStreamManager } from '@/lib/realtime';
import { logAuditEvent } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const userId = auth.session.userId;
  const ip = getClientIp(req);

  // Audit stream connection
  logAuditEvent({
    userId,
    action: 'STREAM_CONNECTED',
    entityType: 'realtime_stream',
    details: { protocol: 'SSE', channel: `user:${userId}` },
    ipAddress: ip,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection ACK
      const initMessage = `event: connected\ndata: ${JSON.stringify({ status: 'connected', userId, timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));

      // 2. Subscribe to user-specific realtime pub/sub
      const unsubscribe = realtimeStreamManager.subscribe(userId, (eventObj) => {
        try {
          const chunk = `event: ${eventObj.event || 'message'}\ndata: ${JSON.stringify(eventObj.data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch (err) {
          console.error('Error writing to SSE controller:', err);
        }
      });

      // 3. Heartbeat every 30s to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Clean up on disconnect / abort
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeatInterval);
        logAuditEvent({
          userId,
          action: 'STREAM_DISCONNECTED',
          entityType: 'realtime_stream',
          details: { reason: 'client_aborted' },
          ipAddress: ip,
        });
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
