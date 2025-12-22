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

function buildMimeMessage({ from, to, subject, text, html }) {
    const boundary = 'mixed_boundary_001';
    const lines = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        text || '',
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        html || '',
        '',
        `--${boundary}--`
    ];

    const message = lines.join('\r\n');
    // Gmail API expects base64url encoding
    return Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function sendMail({ to, subject, text, html }) {
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
        throw new Error('Gmail API environment variables missing. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER.');
    }

    const from = `TrustChain LTO System <${GMAIL_USER}>`;
    const raw = buildMimeMessage({ from, to, subject, text, html });

    const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
    });

    const data = response.data || {};
    console.log('✅ Gmail API sendMail success:', {
        to,
        subject,
        id: data.id,
        threadId: data.threadId
    });

    return data;
}

module.exports = {
    sendMail
};


