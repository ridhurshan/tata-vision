import api from "./api";

export const registerUser = (data) => {
  return api.post("/auth/register", data);
};

export const verifyEmail = (data) => {
  return api.post("/auth/verify-email", data);
};

export const resendVerificationCode = (data) => {
  return api.post("/auth/resend-verification-code", data);
};

export const loginUser = (data) => {
  return api.post("/auth/login", data);
};