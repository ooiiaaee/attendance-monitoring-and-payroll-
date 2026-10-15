import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateEmail } from "../utils/validators";
import logoImg from "../assets/kajalogo.png";
import "../styles/shared.css";
import "./Auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const errors = {
      email: validateEmail(email),
      password: password ? "" : "Password is required",
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setServerError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glass-card">
        
        {/* Left panel */}
        <div className="auth-sidebar-panel">
          <div className="sidebar-content">
            <h2>Welcome Back!</h2>
            <p>To keep connected with us please login with your personal info</p>
            <Link to="/register">
              <button type="button" className="btn-toggle-switch">
                SIGN UP
              </button>
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="auth-form-content">
          <div className="auth-logo-container">
            <img src={logoImg} alt="KAJA Logo" className="auth-logo-img" />
            <span className="auth-brand-name">KAJA</span>
          </div>

          <h1>LOGIN</h1>

          {serverError && <div className="banner banner-error">{serverError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="field-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setFieldErrors((f) => ({ ...f, email: validateEmail(email) }))}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            <div className="auth-field">
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="field-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldErrors.password && (
                <span className="field-error">{fieldErrors.password}</span>
              )}
            </div>


            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "LOGIN"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}