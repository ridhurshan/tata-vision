import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Login.css";
import logoImage from "../assets/drawai-logo.png";
import { registerUser } from "../services/authService";

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleChange = (event) => {
    const { id, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [id]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await registerUser({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      const registeredEmail =
        response.data?.email || formData.email.trim().toLowerCase();

      navigate("/verify-email", {
        state: {
          email: registeredEmail,
        },
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="brand">
            <h1>DrawAI</h1>

            <p className="tagline">
              Turn your sketches into stunning AI artworks with one click!
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
            <div className="auth-tabs">
              <Link to="/login" className="auth-tab">
                Login
              </Link>

              <Link to="/register" className="auth-tab active">
                Register
              </Link>
            </div>

            <h2 className="form-title">Create Account</h2>

            <p className="form-subtitle">
              Start creating amazing AI art today
            </p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>

                <input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>

                <input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  minLength={8}
                  required
                />

                <small>
                  Minimum 8 characters with an uppercase letter and a number.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  minLength={8}
                  required
                />
              </div>

              <div className="form-options">
                <label className="agree-terms">
                  <input type="checkbox" required />

                  <span>
                    I agree to the{" "}
                    <Link to="/terms">Terms of Service</Link>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="auth-btn"
                disabled={loading}
              >
                {loading
                  ? "Creating Account..."
                  : "Create Account"}
              </button>

              <p className="auth-footer">
                Already have an account?{" "}
                <Link to="/login">Sign in</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;