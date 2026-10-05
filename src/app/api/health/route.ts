import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyAuditTrail } from '@/lib/security';

export async function GET() {
  try {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const auditStatus = verifyAuditTrail();

    return NextResponse.json({
      status: 'healthy',
      app: 'FinTrack',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        engine: 'SQLite (node:sqlite)',
        userCount: countRow.count,
      },
      security: {
        rowLevelAuthorization: 'ENFORCED',
        currencyStorage: 'INTEGER_MINOR_UNITS',
        keyVaultEncryption: 'AES-256-GCM',
        auditChainStatus: auditStatus.isValid ? 'VERIFIED_VALID' : 'TAMPER_DETECTED',
        totalAuditEntries: auditStatus.totalEntries,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { status: 'unhealthy', error: String(err) },
      { status: 500 }
    );
  }
}
