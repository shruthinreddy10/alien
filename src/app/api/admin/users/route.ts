import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { logAuditEvent, hashPassword } from '@/lib/security';

// 1.1 USER MANAGEMENT: List, Filter, Search Users
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) {
    // Log unauthorized access attempt
    logAuditEvent({
      userId: null,
      action: 'ADMIN_ACCESS_DENIED',
      entityType: 'admin/users',
      details: { url: req.url },
      ipAddress: getClientIp(req),
    });
    return auth.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const role = searchParams.get('role')?.trim() || '';
  const status = searchParams.get('status')?.trim() || '';
  const from = searchParams.get('from')?.trim() || '';
  const to = searchParams.get('to')?.trim() || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const db = getDb();
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (search) {
    conditions.push('(u.email LIKE ? OR u.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role && (role === 'USER' || role === 'ADMIN')) {
    conditions.push('u.role = ?');
    params.push(role);
  }
  if (status && (status === 'ACTIVE' || status === 'SUSPENDED')) {
    conditions.push('u.status = ?');
    params.push(status);
  }
  if (from) {
    conditions.push('substr(u.created_at, 1, 10) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('substr(u.created_at, 1, 10) <= ?');
    params.push(to);
  }

  const whereClause = conditions.join(' AND ');

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM users u WHERE ${whereClause}`).get(...params) as { count: number };
  const total = countRow.count;

  // Notice: Admin can view metadata and transaction COUNT, but CANNOT view raw transaction rows
  const users = db.prepare(`
    SELECT 
      u.id, 
      u.email, 
      u.name, 
      u.role, 
      u.status, 
      u.created_at, 
      u.updated_at,
      (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL) as active_sessions_count,
      (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) as transaction_count,
      (SELECT last_seen FROM user_sessions s WHERE s.user_id = u.id ORDER BY s.last_seen DESC LIMIT 1) as last_login
    FROM users u
    WHERE ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return NextResponse.json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// User Actions: Role Change, Suspend/Reactivate, Password Reset, Force Logout, Delete
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const adminId = auth.session.userId;

  try {
    const body = await req.json();
    const { action, userId, targetEmail, reason, newRole } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    const db = getDb();
    const targetUser = db.prepare('SELECT id, email, role, status FROM users WHERE id = ?').get(userId) as any;
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ip = getClientIp(req);
    const now = new Date().toISOString();

    if (action === 'CHANGE_ROLE') {
      if (newRole !== 'USER' && newRole !== 'ADMIN') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(newRole, now, userId);
      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_USER_ROLE_CHANGE',
        entityType: 'users',
        entityId: userId,
        details: { oldRole: targetUser.role, newRole, reason: reason || 'Admin updated role', actor_role: 'ADMIN' },
        ipAddress: ip,
      });
      return NextResponse.json({ message: `Role updated to ${newRole}` });
    }

    if (action === 'TOGGLE_STATUS') {
      const newStatus = targetUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, userId);
      // Invalidate sessions if suspended
      if (newStatus === 'SUSPENDED') {
        db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ?').run(now, userId);
      }
      logAuditEvent({
        userId: adminId,
        action: newStatus === 'SUSPENDED' ? 'ADMIN_USER_SUSPEND' : 'ADMIN_USER_REACTIVATE',
        entityType: 'users',
        entityId: userId,
        details: { status: newStatus, reason: reason || 'Admin status toggle', actor_role: 'ADMIN' },
        ipAddress: ip,
      });
      return NextResponse.json({ message: `User status changed to ${newStatus}` });
    }

    if (action === 'FORCE_LOGOUT') {
      db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ?').run(now, userId);
      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_FORCE_LOGOUT',
        entityType: 'user_sessions',
        entityId: userId,
        details: { reason: reason || 'Admin forced session revocation', actor_role: 'ADMIN' },
        ipAddress: ip,
      });
      return NextResponse.json({ message: 'All user sessions revoked successfully' });
    }

    if (action === 'FORCE_RESET_PASSWORD') {
      const tempPass = 'Reset' + crypto.randomUUID().slice(0, 8) + '!';
      const newHash = hashPassword(tempPass);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, userId);
      db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ?').run(now, userId);
      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_FORCE_PASSWORD_RESET',
        entityType: 'users',
        entityId: userId,
        details: { actor_role: 'ADMIN', reason: reason || 'Admin triggered password reset' },
        ipAddress: ip,
      });
      return NextResponse.json({ message: 'Password reset and sessions revoked.', temporaryPassword: tempPass });
    }

    if (action === 'SOFT_DELETE') {
      // Require email typed confirmation
      if (targetEmail !== targetUser.email) {
        return NextResponse.json({ error: 'Typed email does not match user email' }, { status: 400 });
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      logAuditEvent({
        userId: adminId,
        action: 'ADMIN_USER_DELETE',
        entityType: 'users',
        entityId: userId,
        details: { deletedEmail: targetUser.email, reason: reason || 'Admin deletion', actor_role: 'ADMIN' },
        ipAddress: ip,
      });
      return NextResponse.json({ message: 'User deleted successfully' });
    }

    return NextResponse.json({ error: 'Unrecognized action' }, { status: 400 });
  } catch (e: any) {
    console.error('Admin user action error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
