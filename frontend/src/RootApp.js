import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CSS } from "./styles/appStyles";
import { AUTH_CSS } from "./styles/authStyles";
import AuthPage from "./components/auth/AuthPage";
import App from "./App";

function AppGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <style>{CSS}{AUTH_CSS}</style>
        <div className="auth-loading">Loading…</div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <style>{CSS}{AUTH_CSS}</style>
        <AuthPage />
      </>
    );
  }

  return <App />;
}

export default function RootApp() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
