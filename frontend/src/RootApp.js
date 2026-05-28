import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./components/auth/AuthPage";
import App from "./App";
import EDA from "./pages/EDA/EDA";

function RootContent() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <Routes>
      <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
      <Route path="/*" element={user ? <App /> : <Navigate to="/auth" />} />
    </Routes>
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
