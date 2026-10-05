import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  const db = getDb();

  // Failed logins 24h & 7d
  const fail24h = db.prepare(`
    SELECT COUNT(*) as count FROM login_attempts 
    WHERE status != 'SUCCESS' AND created_at >= datetime('now', '-1 day')
  `).get() as { count: number };

  const fail7d = db.prepare(`
    SELECT COUNT(*) as count FROM login_attempts 
    WHERE status != 'SUCCESS' AND created_at >= datetime('now', '-7 days')
  `).get() as { count: number };

  // Login outcomes breakdown (donut data)
  const outcomes = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM login_attempts 
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  // Recent failed attempts (last 20)
  const recentAttempts = db.prepare(`
    SELECT * FROM login_attempts 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all();

  // Blocked IPs
  const blockedIps = db.prepare(`
    SELECT * FROM ip_blocklist ORDER BY added_at DESC
  `).all();

  // Active Suspicious Events
  const suspiciousEvents = [
    {
      id: 'susp_1',
      type: 'RAPID_FAILED_LOGINS',
      severity: 'high',
      actor: '192.168.1.104 (admin@demo.com)',
      details: '3 consecutive password failures within 2 minutes',
      timestamp: '2026-10-04T18:23:15Z',
    },
    {
      id: 'susp_2',
      type: 'CREDENTIAL_STUFFING_BLOCKED',
      severity: 'high',
      actor: '45.33.32.156 (unknown@attacker.xyz)',
      details: 'Automated attempt against non-existent account; IP auto-blocked',
      timestamp: '2026-10-05T02:11:00Z',
    },
    {
      id: 'susp_3',
      type: 'ANOMALOUS_TRANSACTION_VALUE',
      severity: 'medium',
      actor: 'usr_demo_user_76',
      details: 'Single transaction $850.00 is 3.4x category 30-day average',
      timestamp: '2026-10-05T08:15:00Z',
    }
  ];

  // Global 2FA flag status
  const flag2fa = db.prepare("SELECT enabled FROM feature_flags WHERE key = 'enforce_2fa_global'").get() as { enabled: number } | undefined;

  return NextResponse.json({
    metrics: {
      failedLogins24h: fail24h.count,
      failedLogins7d: fail7d.count,
      activeSuspiciousEvents: suspiciousEvents.length,
      blockedIpsCount: blockedIps.length,
      global2faEnforced: flag2fa ? flag2fa.enabled === 1 : false,
    },
    outcomes,
    recentAttempts,
    blockedIps,
    suspiciousEvents,
  });
}

// Block / Unblock IP or Toggle Global 2FA
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const adminId = auth.session.userId;

  try {
    const body = await req.json();
    const { action, ip, reason, enable2fa } = body;
    const db = getDb();
    const now = new Date().toISOString();
    const clientIp = getClientIp(req);

    if (action === 'BLOCK_IP') {
      if (!ip) return NextResponse.json({ error: 'IP is required' }, { status: 400 });
      const id = `blk_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT OR REPLACE INTO ip_blocklist (id, ip, reason, added_by, added_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, ip, reason || 'Manually added by administrator', auth.session.email, now);

      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_BLOCK_IP',
        entityType: 'ip_blocklist',
        entityId: ip,
        details: { reason, actor_role: 'ADMIN' },
        ipAddress: clientIp,
      });
      return NextResponse.json({ message: `IP ${ip} blocked successfully` });
    }

    if (action === 'UNBLOCK_IP') {
      if (!ip) return NextResponse.json({ error: 'IP is required' }, { status: 400 });
      db.prepare('DELETE FROM ip_blocklist WHERE ip = ?').run(ip);
      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_UNBLOCK_IP',
        entityType: 'ip_blocklist',
        entityId: ip,
        details: { actor_role: 'ADMIN' },
        ipAddress: clientIp,
      });
      return NextResponse.json({ message: `IP ${ip} removed from blocklist` });
    }

    if (action === 'TOGGLE_GLOBAL_2FA') {
      const isEnabled = enable2fa ? 1 : 0;
      db.prepare("UPDATE feature_flags SET enabled = ?, updated_at = ?, last_modified_by = ? WHERE key = 'enforce_2fa_global'")
        .run(isEnabled, now, auth.session.email);

      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_TOGGLE_GLOBAL_2FA',
        entityType: 'feature_flags',
        entityId: 'enforce_2fa_global',
        details: { enabled: isEnabled === 1, actor_role: 'ADMIN' },
        ipAddress: clientIp,
      });
      return NextResponse.json({ message: `Global 2FA is now ${isEnabled === 1 ? 'ENFORCED' : 'OPTIONAL'}` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error processing request' }, { status: 500 });
  }
}
