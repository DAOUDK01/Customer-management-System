import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("rms_token"));
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("rms_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem("rms_token", token);
    } else {
      localStorage.removeItem("rms_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("rms_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("rms_user");
    }
  }, [user]);

  const value = useMemo(
    () => ({
      token,
      user,
      setToken,
      setUser,
      logout: () => {
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
