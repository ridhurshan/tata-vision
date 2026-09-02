import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

const tokenIsValid = (token) => {
  try {
    const encodedPayload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(
      Math.ceil(encodedPayload.length / 4) * 4,
      "="
    );
    const payload = JSON.parse(
      atob(paddedPayload)
    );

    return (
      typeof payload.exp === "number"
      && payload.exp * 1000 > Date.now()
    );
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token && tokenIsValid(token)) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    if (!tokenIsValid(token)) {
      throw new Error("The server returned an invalid session token.");
    }
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
