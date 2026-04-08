export function emailBase(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f3ff;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ff;padding:32px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:12px;overflow:hidden;
                     box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              
              <!-- Header com gradiente Valore -->
              <tr>
                <td style="background:linear-gradient(135deg,#4F3EF5 0%,#00C2FF 100%);
                           padding:32px 40px;text-align:center;">
                  <div style="display:inline-block;background:rgba(255,255,255,0.15);
                              border-radius:12px;padding:8px 16px;">
                    <span style="color:#ffffff;font-size:22px;font-weight:700;
                                 letter-spacing:3px;font-family:Georgia,serif;">
                      valore
                    </span>
                  </div>
                  <p style="color:rgba(255,255,255,0.8);font-size:12px;
                             margin:8px 0 0;letter-spacing:1px;text-transform:uppercase;">
                    Portal de Compras
                  </p>
                </td>
              </tr>

              <!-- Conteúdo -->
              <tr>
                <td style="padding:40px;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f8f9fa;padding:24px 40px;
                           border-top:1px solid #e9ecef;text-align:center;">
                  <p style="color:#6c757d;font-size:12px;margin:0;">
                    Este e-mail foi enviado pelo sistema Valore · 
                    <a href="https://www.axisstrategy.com.br" 
                       style="color:#4F3EF5;text-decoration:none;">
                      Axis Strategy
                    </a>
                  </p>
                  <p style="color:#adb5bd;font-size:11px;margin:8px 0 0;">
                    Você recebe este e-mail porque tem notificações ativas no sistema.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `
}

export function emailButton(text: string, url: string): string {
  return `
      <div style="text-align:center;margin:32px 0;">
        <a href="${url}"
           style="background:linear-gradient(135deg,#4F3EF5,#00C2FF);
                  color:#ffffff;text-decoration:none;padding:14px 32px;
                  border-radius:8px;font-weight:600;font-size:15px;
                  display:inline-block;letter-spacing:0.3px;">
          ${text}
        </a>
      </div>
    `
}

export function emailInfoRow(label: string, value: string): string {
  return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#6c757d;font-size:13px;">${label}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;">
          <span style="color:#1a1a2e;font-size:13px;font-weight:500;">${value}</span>
        </td>
      </tr>
    `
}
