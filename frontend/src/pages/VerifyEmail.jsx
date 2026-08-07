import React, { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "../styles/Login.css";
import logoImage from "../../assets/drawai-logo.png";
import {
  resendVerificationCode,
  verifyEmail,
} from "../services/authService";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const emailFromRegistration = location.state?.email || "";

  const [email, setEmail] = useState(emailFromRegistration);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((previousCount) => previousCount - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleCodeChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, "");

    setCode(digitsOnly.slice(0, 6));
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const response = await verifyEmail({
        email: email.trim().toLowerCase(),
        code,
      });

      setSuccess(
        response.data?.message ||
          "Email verified successfully."
      );

      setTimeout(() => {
        navigate("/login", {
          state: {
            message:
              "Email verified successfully. You can now log in.",
          },
        });
      }, 1200);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Email verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    setResending(true);

    try {
      const response = await resendVerificationCode({
        email: email.trim().toLowerCase(),
      });

      setSuccess(
        response.data?.message ||
          "A new verification code was sent."
      );

      setCountdown(60);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Could not resend verification code."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="brand">
            <h1>DrawAI</h1>

            <p className="tagline">
              Verify your email to activate your account.
            </p>

            <img
              src={logoImage}
              alt="DrawAI Logo"
              className="brand-logo"
              style={{
                width: "300px",
                height: "300px",
                objectFit: "contain",
              }}
            />
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-form-wrapper">
            <h2 className="form-title">Verify Your Email</h2>

            <p className="form-subtitle">
              Enter the 6-digit code sent to your email.
            </p>

            {error && (
              <div className="error-message">{error}</div>
            )}

            {success && (
              <div className="success-message">{success}</div>
            )}

            <form onSubmit={handleVerify} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="code">Verification Code</label>

                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={handleCodeChange}
                  maxLength={6}
                  required
                  style={{
                    textAlign: "center",
                    letterSpacing: "10px",
                    fontSize: "24px",
                    fontWeight: "bold",
                  }}
                />
              </div>

              <button
                type="submit"
                className="auth-btn"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify Email"}
              </button>

              <button
                type="button"
                className="secondary-auth-btn"
                onClick={handleResend}
                disabled={resending || countdown > 0}
              >
                {resending
                  ? "Sending..."
                  : countdown > 0
                    ? `Resend code in ${countdown}s`
                    : "Resend verification code"}
              </button>

              <p className="auth-footer">
                Already verified?{" "}
                <Link to="/login">Go to login</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;