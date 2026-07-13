import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

function LoginPage({ onLogin, initialError = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your admin email and password");
      return;
    }

    try {
      setLoading(true);
      await onLogin(email.trim(), password);
    } catch (loginError) {
      setError(
        loginError.message || "Unable to sign in"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual-panel">
        <div className="login-brand-mark">
          <span className="login-brand-logo">
            <img src="/geojit-logo.png" alt="Geojit" />
          </span>
          <div>
            <strong>Geojit</strong>
            <small>Voice Bot</small>
          </div>
        </div>

        <div className="login-visual-copy">
          <p>Secure operations workspace</p>
          <h1>Investor communication, managed responsibly.</h1>
          <span>
            Launch approved call campaigns, capture IVR responses
            and manage customer follow-ups from one protected
            dashboard.
          </span>
        </div>

        <div className="login-trust-card">
          <ShieldCheck size={21} />
          <div>
            <strong>Authorized staff only</strong>
            <span>
              Access is protected by a time-limited administrator
              session.
            </span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="login-lock-icon">
              <LockKeyhole size={22} />
            </span>
            <div>
              <p>Administrator access</p>
              <h2>Sign in to continue</h2>
              <span>
                Use the credentials configured by your system
                administrator.
              </span>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="admin-email">Email address</label>
            <div className="login-input-wrap">
              <Mail size={18} />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@company.com"
                autoComplete="username"
                autoFocus
                disabled={loading}
                required
              />
            </div>

            <label htmlFor="admin-password">Password</label>
            <div className="login-input-wrap">
              <LockKeyhole size={18} />
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                className="password-visibility-button"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>

            <button
              className="login-submit-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in securely"}
            </button>
          </form>

          <p className="login-session-note">
            Your login is stored only for this browser session and
            expires automatically.
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
