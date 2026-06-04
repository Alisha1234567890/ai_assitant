import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./components/auth/AuthPage";
import App from "./App";
import { CSS } from "./styles/appStyles";
import { AUTH_CSS } from "./styles/authStyles";
import { IC, Dots } from "./icons/Icons";

function RootContent() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <style>{CSS}{AUTH_CSS}</style>
      {loading ? (
        <div className="auth-loading">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div className="auth-brand-icon" style={{ width: "50px", height: "50px" }}><IC.Bot /></div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Loading DocChat</span>
              <Dots />
            </div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
          <Route path="/*" element={user ? <App /> : <Navigate to="/auth" />} />
        </Routes>
      )}
    </div>
  );
}

export default function RootApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <RootContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
