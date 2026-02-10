const { sendMail } = require('./gmailApiService');

const INSURANCE_EMAIL = 'insurance.lipaph@gmail.com';

/**
 * Send insurance issue notification to buyer/owner and insurance email.
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.recipientName - Name of the recipient
 * @param {string} params.vehicleLabel - Plate number or VIN
 * @param {string|string[]} params.reasons - List of issues detected
 * @param {string} params.applicationType - 'registration' or 'transfer'
 */
async function sendInsuranceIssueEmail({ to, recipientName, vehicleLabel, reasons, applicationType = 'registration' }) {
    const subject = `TrustChain LTO - Insurance Document Issue Detected (${vehicleLabel})`;

    // Format reasons for HTML and text
    const reasonsHtml = Array.isArray(reasons)
        ? `<ul style="margin: 0; padding-left: 20px;">${reasons.map(r => `<li>${r}</li>`).join('')}</ul>`
        : `<p style="margin: 0;">${reasons}</p>`;

    const reasonsText = Array.isArray(reasons)
        ? reasons.join('\n- ')
        : reasons;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
        .container { background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { border-bottom: 2px solid #f97316; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
        .header h1 { color: #ea580c; margin: 0; font-size: 24px; font-weight: 700; }
        .content { margin-bottom: 32px; font-size: 16px; }
        .issue-box { background-color: #fff7ed; border-left: 4px solid #f97316; padding: 20px; margin: 24px 0; border-radius: 8px; }
        .issue-title { font-weight: 700; color: #9a3412; margin-bottom: 12px; display: block; }
        .vehicle-tag { background-color: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-weight: 600; }
        .footer { font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center; }
        .button { display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Insurance Verification Issue</h1>
        </div>
        <div class="content">
            <p>Dear ${recipientName || 'Valued User'},</p>
            <p>During the automated verification of your <strong>${applicationType}</strong> application for vehicle <span class="vehicle-tag">${vehicleLabel}</span>, some issues were detected with the submitted insurance document.</p>
            
            <div class="issue-box">
                <span class="issue-title">⚠️ Detected Issues:</span>
                ${reasonsHtml}
            </div>
            
            <p>As a result, your application status has been set to <strong>PENDING</strong> for insurance verification. Our team will review this manually, or you may be contacted for further information.</p>
            
            <p><strong>Next Steps:</strong> If you believe there was an error, please ensure you uploaded the correct CTPL/Insurance policy with a clear COI (Certificate of Insurance). No further action is required unless requested by LTO.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br><strong>TrustChain LTO System</strong></p>
            <p style="font-size: 11px; margin-top: 16px;">This copy was also sent to: ${INSURANCE_EMAIL}</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    const text = `
TrustChain LTO - Insurance Verification Issue

Dear ${recipientName || 'Valued User'},

During the automated verification of your ${applicationType} application for vehicle ${vehicleLabel}, some issues were detected with the submitted insurance document.

Detected Issues:
${reasonsText}

Your application status has been set to PENDING for insurance verification. Our team will review this manually, or you may be contacted for further information.

Next Steps: If you believe there was an error, please ensure you uploaded the correct CTPL/Insurance policy with a clear COI (Certificate of Insurance). No further action is required unless requested by LTO.

Best regards,
TrustChain LTO System
CC: ${INSURANCE_EMAIL}
    `.trim();

    try {
        // Send to primary recipient
        const primaryResult = await sendMail({ to, subject, text, html });
        console.log(`✅ Insurance issue notification sent to primary: ${to}`);

        // Also send to insurance email
        await sendMail({
            to: INSURANCE_EMAIL,
            subject: `[LTO ISSUE] ${vehicleLabel} - ${subject}`,
            text,
            html
        });
        console.log(`✅ Insurance issue notification sent to insurance group: ${INSURANCE_EMAIL}`);

        return { success: true, messageId: primaryResult.id };
    } catch (error) {
        console.error('❌ Failed to send insurance issue notification:', error.message);
        throw error;
    }
}

module.exports = {
    sendInsuranceIssueEmail,
    INSURANCE_EMAIL
};
