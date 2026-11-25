import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ts_token');
    if (!token) {
      setLoading(false);
      return;
    }
    apiRequest('/auth/me')
      .then((res) => {
        setUser(res.user);
        localStorage.setItem('ts_agent_email', res.user.email);
      })
      .catch(() => {
        localStorage.removeItem('ts_token');
        localStorage.removeItem('ts_agent_email');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('ts_token', res.token);
    localStorage.setItem('ts_agent_email', res.user.email);
    setUser(res.user);
    return res.user;
  };

  const register = async (name, email, password) => {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    return login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('ts_token');
    localStorage.removeItem('ts_agent_email');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
