import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EnviarEmailParams {
  to: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

/**
 * Envía correos reales vía Resend (plan free: 3000/mes, 100/día). Mientras
 * no haya un dominio propio verificado en Resend, `EMAIL_FROM` debe quedar en
 * el remitente de pruebas `onboarding@resend.dev` -- con ese remitente Resend
 * solo entrega al correo de la cuenta dueña del API key, no a cualquier
 * destinatario (limitación de su modo sandbox, no de este código).
 *
 * Si `RESEND_API_KEY` no está configurada, se SIMULA el envío con un
 * `console.log` en vez de intentar una llamada real que fallaría -- mismo
 * criterio de logging que tenía la versión anterior (SMTP simulado).
 */
@Injectable()
export class EmailService {
  private resend: Resend | null = null;

  private getClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    if (!this.resend) this.resend = new Resend(apiKey);
    return this.resend;
  }

  /**
   * Envía un email con adjuntos opcionales. Devuelve `true` si se envió (o
   * simuló) correctamente, `false` si falló el envío real.
   */
  async enviarEmail(params: EnviarEmailParams): Promise<boolean> {
    const { to, subject, body, attachments } = params;
    const client = this.getClient();

    if (!client) {
      console.log(
        `[EMAIL] RESEND_API_KEY no configurada. Se simula envío a: ${to.join(', ')}\n` +
          `  Asunto: ${subject}\n` +
          `  Cuerpo: ${body.slice(0, 200)}...\n` +
          `  Adjuntos: ${attachments && attachments.length > 0 ? attachments.map((a) => a.filename).join(', ') : '[]'}`,
      );
      return true;
    }

    try {
      const from = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';
      const { error } = await client.emails.send({
        from,
        to,
        subject,
        text: body,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      if (error) {
        console.error(`Error enviando email vía Resend: ${error.message}`);
        return false;
      }

      console.log(`Email enviado exitosamente a: ${to.join(', ')}`);
      return true;
    } catch (err) {
      console.error(`Error enviando email: ${(err as Error).message}`);
      return false;
    }
  }
}
