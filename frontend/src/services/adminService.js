import api from "./api";

// api.js already sets baseURL to http://localhost:5000/api
// We attach the JWT token (saved at login) to every admin request.

const authHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const getStats = () => api.get("/admin/stats", authHeader());

export const getUsers = () => api.get("/admin/users", authHeader());

export const getUser = (id) => api.get(`/admin/users/${id}`, authHeader());

export const updateUserStatus = (id, status) =>
  api.patch(`/admin/users/${id}/status`, { status }, authHeader());
