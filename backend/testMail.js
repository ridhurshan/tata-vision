require("dotenv").config();

const transporter = require("./src/config/mailer");

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log(
    "PASSWORD LENGTH:",
    process.env.EMAIL_APP_PASSWORD?.length
);

async function sendMail() {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: "Test Mail",
            text: "Hello! Nodemailer is working."
        });

        console.log("✅ Email sent successfully");
    } catch (err) {
        console.error(err);
    }
}

sendMail();