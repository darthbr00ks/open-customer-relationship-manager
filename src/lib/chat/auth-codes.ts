import type { ChatChannel } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { enqueue } from '@/lib/queue';

import {
  AUTH_CODE_MAX_ATTEMPTS,
  AUTH_CODE_MAX_PER_WINDOW,
  AUTH_CODE_TTL_MINUTES,
  AUTH_CODE_WINDOW_MINUTES,
  returnsAuthCodeInResponse,
} from './config';
import { normalizeEmail } from './contacts';
import { hashAuthCode, hashesMatch, newAuthCode } from './tokens';

/**
 * Email verification for channels that require a known visitor.
 *
 * A six-digit code, hashed at rest, single use, short-lived, and rate limited
 * per address per channel. That is enough to prove control of a mailbox, which
 * is the claim being made: this is customer identity for a chat widget, not an
 * account login for the CRM itself.
 */

export type RequestCodeResult =
  | { ok: true; expires_at: Date; code: string | null }
  | { ok: false; reason: 'throttled'; retry_after_minutes: number };

export async function requestAuthCode(channel: ChatChannel, rawEmail: string): Promise<RequestCodeResult> {
  const email = normalizeEmail(rawEmail);
  const windowStart = new Date(Date.now() - AUTH_CODE_WINDOW_MINUTES * 60_000);

  const recent = await prisma.chatAuthCode.count({
    where: { channel_id: channel.id, email, created_at: { gt: windowStart } },
  });
  if (recent >= AUTH_CODE_MAX_PER_WINDOW) {
    return { ok: false, reason: 'throttled', retry_after_minutes: AUTH_CODE_WINDOW_MINUTES };
  }

  const code = newAuthCode();
  const expires_at = new Date(Date.now() + AUTH_CODE_TTL_MINUTES * 60_000);

  await prisma.chatAuthCode.create({
    data: {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      email,
      code_hash: hashAuthCode(channel.id, code),
      expires_at,
    },
  });

  // Any earlier code for this address is now moot.
  await prisma.chatAuthCode.updateMany({
    where: { channel_id: channel.id, email, consumed_at: null, expires_at: { lt: expires_at } },
    data: { consumed_at: new Date() },
  });

  // Delivery runs on the worker, through the same `EmailProvider` the CRM
  // composes with; with no mailbox connected the job logs the code instead.
  try {
    await enqueue('chat-auth-code', {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      channel_name: channel.name,
      email,
      code,
      expires_at: expires_at.toISOString(),
    });
  } catch (error) {
    // Redis being down must not stop a visitor from signing in when the code
    // is also returned in the response (development) — but it is worth seeing.
    console.error('chat: failed to queue verification code delivery', error);
  }

  return { ok: true, expires_at, code: returnsAuthCodeInResponse() ? code : null };
}

export type VerifyResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'no_code' | 'expired' | 'mismatch' | 'too_many_attempts' };

/** Check a code and burn it. Wrong guesses are counted; enough of them retire the code. */
export async function verifyAuthCode(
  channel: ChatChannel,
  rawEmail: string,
  code: string,
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);

  const record = await prisma.chatAuthCode.findFirst({
    where: { channel_id: channel.id, email, consumed_at: null },
    orderBy: { created_at: 'desc' },
  });
  if (!record) return { ok: false, reason: 'no_code' };

  if (record.expires_at.getTime() <= Date.now()) {
    await prisma.chatAuthCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
    await prisma.chatAuthCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (!hashesMatch(record.code_hash, hashAuthCode(channel.id, code.trim()))) {
    const updated = await prisma.chatAuthCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await prisma.chatAuthCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
      return { ok: false, reason: 'too_many_attempts' };
    }
    return { ok: false, reason: 'mismatch' };
  }

  await prisma.chatAuthCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
  return { ok: true, email };
}
