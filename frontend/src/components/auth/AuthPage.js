import React, { useState } from "react";
import { IC } from "../../icons/Icons";
import { useAuth } from "../../context/AuthContext";
import Dots from "../common/Dots";

export default function AuthPage() {
  const { signup, login } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (tab === "signup") {
        await signup({ email, password, name: name.trim() || undefined });
      } else {
        await login({ email, password });
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        (typeof err.response?.data === "string" ? err.response.data : null) ||
        "Something went wrong. Please try again.";
      setError(Array.isArray(msg) ? msg.map((m) => m.msg || m).join(", ") : msg);
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><IC.Bot /></div>
          <span className="auth-brand-name">DocChat</span>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "login" ? "auth-tab-active" : ""}`}
            onClick={() => { setTab("login"); setError(""); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "signup" ? "auth-tab-active" : ""}`}
            onClick={() => { setTab("signup"); setError(""); }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === "signup" && (
            <div className="auth-field">
              <label className="auth-label">Name</label>
              <input
                className="auth-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === "signup" ? "At least 6 characters" : "Your password"}
              required
              minLength={tab === "signup" ? 6 : 1}
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? <Dots /> : (tab === "signup" ? "Create account" : "Sign in")}
          </button>
        </form>

        <p className="auth-foot">
          {tab === "login" ? (
            <>New here? <button type="button" onClick={() => setTab("signup")}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => setTab("login")}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}
