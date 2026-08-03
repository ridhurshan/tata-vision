const transporter = require("../config/mailer");

async function sendVerificationCode(email, code) {
    await transporter.sendMail({
        from: `"Tata Vision" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify your Tata Vision account",
        html: `
            <div style="
                max-width: 520px;
                margin: auto;
                padding: 24px;
                font-family: Arial, sans-serif;
                border: 1px solid #dddddd;
                border-radius: 10px;
            ">
                <h2 style="margin-bottom: 12px;">
                    Tata Vision Email Verification
                </h2>

                <p>
                    Use the following code to verify your email address:
                </p>

                <div style="
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    margin: 24px 0;
                ">
                    ${code}
                </div>

                <p>
                    This code expires in 10 minutes.
                </p>

                <p style="color: #666666; font-size: 13px;">
                    If you did not create a Tata Vision account,
                    you can ignore this email.
                </p>
            </div>
        `
    });
}

module.exports = {
    sendVerificationCode
};