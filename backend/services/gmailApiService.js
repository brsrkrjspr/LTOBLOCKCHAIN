const { google } = require('googleapis');

const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    GMAIL_USER
} = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
    console.warn('⚠️ Gmail API not fully configured. Emails may fail.', {
        hasClientId: !!GMAIL_CLIENT_ID,
        hasClientSecret: !!GMAIL_CLIENT_SECRET,
        hasRefreshToken: !!GMAIL_REFRESH_TOKEN,
        hasUser: !!GMAIL_USER
    });
}

const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET
);

if (GMAIL_REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
}

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

function buildMimeMessage({ from, to, subject, text, html, attachments }) {
    const boundary = 'mixed_boundary_' + Date.now();
    const altBoundary = 'alt_boundary_' + Date.now();
    
    // If no attachments, use simple multipart/alternative
    if (!attachments || attachments.length === 0) {
        const lines = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
            '',
            `--${altBoundary}`,
            'Content-Type: text/plain; charset="UTF-8"',
            '',
            text || '',
            '',
            `--${altBoundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            '',
            html || '',
            '',
            `--${altBoundary}--`
        ];
        return encodeMessage(lines.join('\r\n'));
    }
    
    // With attachments, use multipart/mixed with nested multipart/alternative
    const lines = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        text || '',
        '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        html || '',
        '',
        `--${altBoundary}--`
    ];

    // Add attachments
    for (const attachment of attachments) {
        lines.push('');
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}; name="${attachment.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        lines.push('');
        
        // Convert buffer to base64 and split into 76-char lines (RFC 2045)
        const base64Data = attachment.content.toString('base64');
        const lines76 = base64Data.match(/.{1,76}/g) || [];
        lines.push(lines76.join('\r\n'));
    }
    
    lines.push('');
    lines.push(`--${boundary}--`);
    
    return encodeMessage(lines.join('\r\n'));
}

function encodeMessage(message) {
    return Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function sendMail({ to, subject, text, html, attachments }) {
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
        throw new Error('Gmail API environment variables missing. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER.');
    }

    const from = `TrustChain LTO System <${GMAIL_USER}>`;
    const raw = buildMimeMessage({ from, to, subject, text, html, attachments });

    const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
    });

    const data = response.data || {};
    console.log('✅ Gmail API sendMail success:', {
        to,
        subject,
        id: data.id,
        threadId: data.threadId,
        hasAttachments: attachments && attachments.length > 0
    });

    return data;
}

module.exports = {
    sendMail
};


