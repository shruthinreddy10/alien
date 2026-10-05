import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAuth, getClientIp } from '@/lib/auth-helper';
import { getDb } from '@/lib/db';
import { AiChatSchema } from '@/lib/schemas';
import { processAiQuery } from '@/lib/ai-assistant';
import { logAuditEvent } from '@/lib/security';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('errorResponse' in auth) return auth.errorResponse;
  const userId = auth.session.userId;

  try {
    const body = await req.json();
    const parsed = AiChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { prompt, provider } = parsed.data;
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Record user message in ai_messages
    const userMsgId = `aim_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO ai_messages (id, user_id, role, content, tool_calls, created_at)
      VALUES (?, ?, 'user', ?, NULL, ?)
    `).run(userMsgId, userId, prompt, now);

    // 2. Process query via financial assistant layer
    const result = await processAiQuery({
      userId,
      prompt,
      preferredProvider: provider,
    });

    // 3. Record assistant response
    const assistantMsgId = `aim_${crypto.randomUUID()}`;
    const afterNow = new Date().toISOString();
    db.prepare(`
      INSERT INTO ai_messages (id, user_id, role, content, tool_calls, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?)
    `).run(assistantMsgId, userId, result.content, JSON.stringify(result.toolCalls), afterNow);

    logAuditEvent({
      userId,
      action: 'AI_PROMPT_EXECUTE',
      entityType: 'ai_assistant',
      entityId: assistantMsgId,
      details: {
        providerUsed: result.providerUsed,
        isFallback: result.isFallback,
        toolCount: result.toolCalls.length,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      message: {
        id: assistantMsgId,
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls,
        createdAt: afterNow,
      },
      providerUsed: result.providerUsed,
      isFallback: result.isFallback,
    });
  } catch (err: unknown) {
    console.error('AI Chat Error:', err);
    return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
  }
}
