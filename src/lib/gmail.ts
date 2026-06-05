/**
 * Gmail Send API Integration Utility
 */

interface SendEmailArguments {
  accessToken: string;
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}

/**
 * Encodes string to UTF-8 Base64URL
 */
function toBase64UrlSafe(str: string): string {
  // First, we convert the UTF-8 string into raw bytes string
  const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  });
  
  // Convert standard base64 to base64url safe string
  const base64 = btoa(utf8Bytes);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email using Gmail REST API with the provided accessToken
 */
export async function sendApprovalRequestEmail({
  accessToken,
  to,
  fromName,
  fromEmail,
  subject,
  body,
}: SendEmailArguments): Promise<boolean> {
  try {
    const emailParts = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${btoa(encodeURIComponent(subject).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ];

    const emailContent = emailParts.join('\r\n');
    const base64Message = toBase64UrlSafe(emailContent);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64Message,
      }),
    });

    if (!response.ok) {
      const textResponse = await response.text();
      console.error('Gmail API Error response:', textResponse);
      return false;
    }

    const data = await response.json();
    console.log('Gmail sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Failed to send email via Gmail API:', error);
    return false;
  }
}
