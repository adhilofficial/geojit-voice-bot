import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import App from "../App.jsx";
import {
  clearAuthSession,
  getAuthToken,
  getCurrentAdmin,
  getStoredSessionExpiry,
  loginAdmin,
  logoutAdmin,
  saveAuthSession,
} from "../api.js";
import LoginPage from "./LoginPage.jsx";

function AuthenticatedRoot() {
  const expiryTimerRef = useRef(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [loginMessage, setLoginMessage] = useState("");

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(
    (message = "") => {
      clearExpiryTimer();
      clearAuthSession();
      setAdmin(null);
      setLoginMessage(message);
    },
    [clearExpiryTimer]
  );

  const scheduleExpiry = useCallback(
    (expiresAt) => {
      clearExpiryTimer();

      if (!expiresAt) {
        return;
      }

      const delay = new Date(expiresAt).getTime() - Date.now();

      if (!Number.isFinite(delay) || delay <= 0) {
        logout("Your session expired. Please sign in again.");
        return;
      }

      expiryTimerRef.current = window.setTimeout(() => {
        logout("Your session expired. Please sign in again.");
      }, Math.min(delay, 2147483647));
    },
    [clearExpiryTimer, logout]
  );

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const token = getAuthToken();

      if (!token) {
        if (mounted) {
          setCheckingSession(false);
        }
        return;
      }

      try {
        const response = await getCurrentAdmin();

        if (!mounted) {
          return;
        }

        setAdmin(response.admin || null);
        scheduleExpiry(
          response.expiresAt || getStoredSessionExpiry()
        );
      } catch (error) {
        if (mounted) {
          logout(
            error.message ||
              "Your previous session is no longer valid."
          );
        }
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      mounted = false;
      clearExpiryTimer();
    };
  }, [clearExpiryTimer, logout, scheduleExpiry]);

  useEffect(() => {
    function handleUnauthorized() {
      logout("Your session expired. Please sign in again.");
    }

    window.addEventListener(
      "geojit:unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "geojit:unauthorized",
        handleUnauthorized
      );
    };
  }, [logout]);

  async function handleLogin(email, password) {
    const response = await loginAdmin(email, password);

    if (!response.token || !response.admin) {
      throw new Error("The server returned an invalid login response");
    }

    saveAuthSession(response.token, response.expiresAt);
    setAdmin(response.admin);
    setLoginMessage("");
    scheduleExpiry(response.expiresAt);
  }

  const handleLogoutRequest = useCallback(async () => {
    const adminEmail = admin?.email || "this administrator account";

    const confirmed = window.confirm(
      `Are you sure you want to log out from ${adminEmail}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await logoutAdmin();
    } catch {
      // Local logout must still complete if the audit request fails.
    }

    logout("");
  }, [admin?.email, logout]);

  if (checkingSession) {
    return (
      <main className="auth-loading-screen">
        <div className="auth-loading-card">
          <span className="auth-loading-spinner" />
          Checking secure session...
        </div>
      </main>
    );
  }

  if (!admin) {
    return (
      <LoginPage
        onLogin={handleLogin}
        initialError={loginMessage}
      />
    );
  }

  return (
    <App
      admin={admin}
      onLogout={handleLogoutRequest}
    />
  );
}

export default AuthenticatedRoot;
