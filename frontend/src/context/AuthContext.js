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
    axios.defaults.headers.common.Authorization = `Bearer ${stored.token}`;
    axios
      .get(`${BASE}/auth/me`)
      .then((r) => {
        applySession(stored.token, r.data.user);
      })
      .catch(() => {
        logout();
      })
      .finally(() => setLoading(false));
  }, [applySession, logout]);

  const signup = async ({ email, password, name }) => {
    const r = await axios.post(`${BASE}/auth/signup`, { email, password, name });
    applySession(r.data.token, r.data.user);
    return r.data.user;
  };

  const login = async ({ email, password }) => {
    const r = await axios.post(`${BASE}/auth/login`, { email, password });
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
