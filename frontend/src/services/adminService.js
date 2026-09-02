import axios from 'axios';

const API_URL = 'http://localhost:5000/api/admin';

const getAuthConfig = () => {
  const token = localStorage.getItem('token');

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const getStats = () => {
  return axios.get(
    `${API_URL}/stats`,
    getAuthConfig()
  );
};

export const getUsers = () => {
  return axios.get(
    `${API_URL}/users`,
    getAuthConfig()
  );
};

export const updateUserStatus = (
  userId,
  status
) => {
  return axios.put(
    `${API_URL}/users/${userId}/status`,
    {
      status,
    },
    getAuthConfig()
  );
};