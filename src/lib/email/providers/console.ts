import { buildMimeMessage, formatAddressList } from '../mime';
import type {
  EmailProvider,
  MailboxCredentials,
  OutboundEmail,
  SendResult,
} from '../types';

/**
 * The provider a checkout runs on.
 *
 * It logs the message and reports success, which is enough to develop against
 * the whole path — compose, the outbound row, the timeline entry — with no
 * Google project and no credentials. It is also the second implementation that
 * keeps `EmailProvider` honest: if the interface leaked anything Gmail-shaped,
 * this file could not satisfy it.
 *
 * `EMAIL_PROVIDER=console` selects it explicitly; it is also the fallback when
 * nothing else is configured. It refuses to be the fallback in production —
 * silently swallowing a customer's mail is worse than failing to send it.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly id = 'console';
  readonly label = 'Console (development)';
  /** No mailbox to connect: it sends as whatever address it is handed. */
  readonly requiresConnectedAccount = false;

  isConfigured(): boolean {
    return true;
  }

  async send(message: OutboundEmail, mailbox: MailboxCredentials): Promise<SendResult> {
    const from = mailbox.email || message.from.email;
    const { raw, message_id } = buildMimeMessage({ ...message, from: { ...message.from, email: from } });

    console.log(
      `[email] ${from} → ${formatAddressList(message.to)}: ${message.subject}\n` +
        `${raw.replace(/^/gm, '  ')}`,
    );

    return { provider_message_id: message_id, provider_thread_id: message.thread_id ?? null };
  }
}
