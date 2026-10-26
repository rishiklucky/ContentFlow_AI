import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('cf_auth_token'));
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true;
    const storedToken = localStorage.getItem('cf_auth_token');

    if (storedToken) {
      authService.getProfile()
        .then((userData) => {
          if (isMounted) {
            setUser(userData);
            setToken(storedToken);
          }
        })
        .catch(() => {
          // Token expired or invalid
          if (isMounted) {
            localStorage.removeItem('cf_auth_token');
            setUser(null);
            setToken(null);
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, []);

  const loginWithToken = async (authToken) => {
    localStorage.setItem('cf_auth_token', authToken);
    setToken(authToken);
    try {
      const userData = await authService.getProfile();
      setUser(userData);
      return userData;
    } catch {
      return null;
    }
  };

  const login = async (emailOrToken, password) => {
    // If called with an OAuth JWT token directly
    if (!password && typeof emailOrToken === 'string' && emailOrToken.includes('.')) {
      return await loginWithToken(emailOrToken);
    }
    const data = await authService.login({ email: emailOrToken, password });
    localStorage.setItem('cf_auth_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const register = async (email, password, fullName) => {
    const data = await authService.register({
      email,
      password,
      full_name: fullName,
    });
    localStorage.setItem('cf_auth_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await authService.logout();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithToken,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
