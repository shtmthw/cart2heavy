import nodemailer from 'nodemailer';
import type { AppConfig } from '../config/env';
import type { Logger } from '../logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Sends through SMTP (Mailpit in docker compose). Without SMTP_HOST emails are only logged. */
export function createMailer(config: AppConfig, logger: Logger): Mailer {
  if (!config.mail.host) {
    return {
      send(message) {
        logger.info(
          { to: message.to, subject: message.subject },
          'email not sent (SMTP_HOST is not set)',
        );
        return Promise.resolve();
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: false,
    ignoreTLS: true, // local catcher (Mailpit); point SMTP_HOST at a real relay for production
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: config.mail.from, ...message });
    },
  };
}

/** An email must never break the request that triggered it: failures are only logged. */
export function sendInBackground(mailer: Mailer, logger: Logger, message: MailMessage): void {
  mailer.send(message).catch((err: unknown) => {
    logger.warn({ err, to: message.to, subject: message.subject }, 'could not send email');
  });
}
