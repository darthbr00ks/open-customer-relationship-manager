import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

import { parseAllowedOrigins } from './config';
import { channelKeySchema } from './keys';

/**
 * Shared plumbing for `/api/chat/*` — the endpoints the customer's browser
 * talks to.
 *
 * Unlike `/api/v1/*` these are unauthenticated at the workspace level: the
 * channel key in the path is what identifies the workspace, so nothing here
 * ever reads a `workspace_id` from the caller.
 */

export type PublicChannel = Awaited<ReturnType<typeof findChannelByKey>>;

export function findChannelByKey(key: string) {
  return prisma.chatChannel.findFirst({ where: { key, archived_at: null } });
}

/**
 * CORS for a channel: with no `allowed_origins` configured the widget may be
 * embedded anywhere, otherwise only the listed origins get the header back.
 * There are no cookies in play — the visitor's session is a bearer token — so
 * a wildcard origin is safe here.
 */
export function corsHeaders(
  request: Request,
  channel: { allowed_origins: string | null } | null,
): Record<string, string> {
  const allowed = parseAllowedOrigins(channel?.allowed_origins);
  const origin = request.headers.get('origin');

  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
  };

  if (allowed.length === 0) {
    return { ...base, 'Access-Control-Allow-Origin': '*' };
  }
  if (origin && allowed.includes(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  }
  // Not an allowed embedder: answer without the header and let the browser stop it.
  return { ...base, Vary: 'Origin' };
}

export function publicJson(
  body: unknown,
  { status = 200, request, channel }: { status?: number; request: Request; channel: { allowed_origins: string | null } | null },
) {
  return NextResponse.json(body, { status, headers: corsHeaders(request, channel) });
}

export function publicFail(
  status: number,
  detail: unknown,
  context: { request: Request; channel: { allowed_origins: string | null } | null },
) {
  return publicJson({ detail }, { status, ...context });
}

/** Preflight, answered before any channel lookup can fail. */
export async function publicPreflight(request: Request, key: string) {
  const parsed = channelKeySchema.safeParse(key);
  const channel = parsed.success ? await findChannelByKey(parsed.data) : null;
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, channel) });
}

/** Translate a thrown error into the same `{ detail }` shape the v1 API uses. */
export function publicError(
  error: unknown,
  context: { request: Request; channel: { allowed_origins: string | null } | null },
) {
  if (error instanceof z.ZodError) {
    return publicFail(422, error.issues, context);
  }
  console.error(error);
  return publicFail(500, 'Internal server error', context);
}

/**
 * Resolve the channel named by the path, or the response to return instead.
 *
 * A key that does not exist and a key belonging to an archived channel are
 * both a plain 404: the public API never confirms that a channel exists but is
 * off-limits.
 */
export async function requireChannel(request: Request, key: string) {
  const parsed = channelKeySchema.safeParse(key);
  if (!parsed.success) {
    return { channel: null, response: publicFail(404, 'Chat channel not found', { request, channel: null }) };
  }
  const channel = await findChannelByKey(parsed.data);
  if (!channel) {
    return { channel: null, response: publicFail(404, 'Chat channel not found', { request, channel: null }) };
  }
  return { channel, response: null };
}

/** The subset of a channel a visitor's browser is allowed to see. */
export function channelPublicConfig(channel: NonNullable<PublicChannel>) {
  return {
    key: channel.key,
    name: channel.name,
    description: channel.description,
    greeting: channel.greeting,
    offline_message: channel.offline_message,
    is_enabled: channel.is_enabled,
    intake_mode: channel.intake_mode,
    auth_mode: channel.auth_mode,
    /** Convenience for the widget: whether it must show the sign-in step first. */
    requires_authentication: channel.auth_mode === 'required',
    /** Whether verifying an email is offered at all. */
    supports_authentication: channel.auth_mode !== 'none',
    collect_name: channel.collect_name,
    collect_email: channel.collect_email,
  };
}
