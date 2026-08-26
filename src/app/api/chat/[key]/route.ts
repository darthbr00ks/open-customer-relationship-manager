import {
  channelPublicConfig,
  publicError,
  publicJson,
  publicPreflight,
  requireChannel,
} from '@/lib/chat/public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string }> };

/**
 * What the widget needs before it can render: the channel's name, greeting,
 * and — the part that shapes the whole first screen — whether this instance
 * requires a verified email and what it collects from a guest.
 */
export async function GET(request: Request, context: Context) {
  const { key } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    return publicJson(channelPublicConfig(channel), { request, channel });
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
