import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { BASE } from "../constants";
import { getStoredAuth, saveAuth, clearAuth } from "../utils/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    saveAuth(nextToken, nextUser);
    axios.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearAuth();
    delete axios.defaults.headers.common.Authorization;
  }, []);

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      setLoading(false);
      return;
    }

    // --- OPTIMIZATION: Optimistic Session Restoration ---
    // We trust the local storage user data initially to allow instant app loading.
    // The background check will verify the token and logout if it's invalid.
    setUser(stored.user);
    setToken(stored.token);
    setLoading(false); 
    
    axios.defaults.headers.common.Authorization = `Bearer ${stored.token}`;
    
    axios
      .get(`${BASE}/auth/me`)
      .then((r) => {
        // Silently update user data if it changed on server
        if (JSON.stringify(r.data.user) !== JSON.stringify(stored.user)) {
          setUser(r.data.user);
          saveAuth(stored.token, r.data.user);
        }
      })
      .catch((err) => {
        // Only logout if it's a 401/403 (Unauthorized)
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout();
        }
      });
  }, [logout]);

  const signup = async ({ email, password, name }) => {
    const r = await axios.post(`${BASE}/auth/signup`, { email, password, name });
    applySession(r.data.token, r.data.user);
    return r.data.user;
  };

  const login = async ({ email, password }) => {
    console.log("[AUTH] Attempting login for:", email);
    const r = await axios.post(`${BASE}/auth/login`, { email, password });
    console.log("[AUTH] Login response:", r.data);
    applySession(r.data.token, r.data.user);
    return r.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
