import React, {
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    forgotPassword,
    verifyResetCode,
    resetPassword
} from "../services/authService";
import "../styles/ForgotPassword.css";

const ForgotPassword = () => {

    const navigate =
        useNavigate();


    const [step, setStep] =
        useState(1);

    const [email, setEmail] =
        useState("");

    const [code, setCode] =
        useState("");

    const [
        newPassword,
        setNewPassword
    ] = useState("");

    const [
        confirmPassword,
        setConfirmPassword
    ] = useState("");

    const [error, setError] =
        useState("");

    const [message, setMessage] =
        useState("");

    const [loading, setLoading] =
        useState(false);


    const sendCode =
        async (event) => {

            event.preventDefault();

            setError("");
            setMessage("");
            setLoading(true);

            try {

                const response =
                    await forgotPassword(
                        email
                    );

                setMessage(
                    response.data.message
                );

                setStep(2);

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                    "Could not send reset code."
                );

            } finally {

                setLoading(false);

            }

        };


    const verifyCode =
        async (event) => {

            event.preventDefault();

            setError("");
            setLoading(true);

            try {

                await verifyResetCode(
                    email,
                    code
                );

                setStep(3);

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                    "Invalid reset code."
                );

            } finally {

                setLoading(false);

            }

        };


    const changePassword =
        async (event) => {

            event.preventDefault();

            setError("");


            if (
                newPassword
                !==
                confirmPassword
            ) {

                setError(
                    "Passwords do not match."
                );

                return;

            }


            setLoading(true);


            try {

                await resetPassword(
                    email,
                    code,
                    newPassword
                );


                alert(
                    "Password reset successfully."
                );


                navigate(
                    "/login"
                );

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                    "Could not reset password."
                );

            } finally {

                setLoading(false);

            }

        };


    return (
  <div className="auth-page">

    <div className="auth-card">

      <div className="auth-header">
        <h2>Forgot Password</h2>

        <p>
          Reset your password using the verification code
          sent to your email.
        </p>
      </div>


      {error && (
        <div className="auth-error-message">
          {error}
        </div>
      )}


      {message && (
        <div className="auth-success-message">
          {message}
        </div>
      )}


      {/* ========================================= */}
      {/* STEP 1 - EMAIL */}
      {/* ========================================= */}

      {step === 1 && (

        <form
          className="auth-form"
          onSubmit={sendCode}
        >

          <div className="auth-form-group">

            <label htmlFor="reset-email">
              Email Address
            </label>

            <input
              id="reset-email"
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />

          </div>


          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : "Send Reset Code"}
          </button>

        </form>

      )}


      {/* ========================================= */}
      {/* STEP 2 - RESET CODE */}
      {/* ========================================= */}

      {step === 2 && (

        <form
          className="auth-form"
          onSubmit={verifyCode}
        >

          <div className="auth-step-info">
            <span className="auth-step-number">
              2
            </span>

            <p>
              Enter the 6-digit code sent to
              <strong> {email}</strong>
            </p>
          </div>


          <div className="auth-form-group">

            <label htmlFor="reset-code">
              Verification Code
            </label>

            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              maxLength="6"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
              required
            />

          </div>


          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading
              ? "Verifying..."
              : "Verify Code"}
          </button>


          <button
            type="button"
            className="auth-secondary-button"
            onClick={() => {
              setStep(1);
              setCode("");
              setError("");
              setMessage("");
            }}
          >
            Change Email
          </button>

        </form>

      )}


      {/* ========================================= */}
      {/* STEP 3 - NEW PASSWORD */}
      {/* ========================================= */}

      {step === 3 && (

        <form
          className="auth-form"
          onSubmit={changePassword}
        >

          <div className="auth-form-group">

            <label htmlFor="new-password">
              New Password
            </label>

            <input
              id="new-password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value
                )
              }
              required
            />

          </div>


          <div className="auth-form-group">

            <label htmlFor="confirm-password">
              Confirm Password
            </label>

            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              required
            />

          </div>


          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading
              ? "Resetting..."
              : "Reset Password"}
          </button>

        </form>

      )}


      <div className="auth-footer">

        <button
          type="button"
          className="auth-back-link"
          onClick={() =>
            navigate("/login")
          }
        >
          ← Back to Login
        </button>

      </div>

    </div>

  </div>
);

}


export default ForgotPassword;