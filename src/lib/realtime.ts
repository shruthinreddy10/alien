type SSEListener = (data: any) => void;

class RealtimeStreamManager {
  private userListeners: Map<string, Set<SSEListener>> = new Map();

  subscribe(userId: string, listener: SSEListener): () => void {
    if (!this.userListeners.has(userId)) {
      this.userListeners.set(userId, new Set());
    }
    const listeners = this.userListeners.get(userId)!;
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.userListeners.delete(userId);
      }
    };
  }

  publish(userId: string, event: string, payload: any) {
    const listeners = this.userListeners.get(userId);
    if (!listeners || listeners.size === 0) return;

    for (const listener of listeners) {
      try {
        listener({ event, data: payload, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('Error dispatching SSE event:', err);
      }
    }
  }

  getActiveListenerCount(userId: string): number {
    return this.userListeners.get(userId)?.size || 0;
  }
}

// Global singleton across serverless invocations within the same Node process
const globalForStream = globalThis as unknown as {
  realtimeStreamManager?: RealtimeStreamManager;
};

export const realtimeStreamManager =
  globalForStream.realtimeStreamManager ?? new RealtimeStreamManager();

if (process.env.NODE_ENV !== 'production') {
  globalForStream.realtimeStreamManager = realtimeStreamManager;
}
