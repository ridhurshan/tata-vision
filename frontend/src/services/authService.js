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

export const forgotPassword = (
    email
) => {

    return api.post(
        "/auth/forgot-password",
        {
            email
        }
    );

};


export const verifyResetCode = (
    email,
    code
) => {

    return api.post(
        "/auth/verify-reset-code",
        {
            email,
            code
        }
    );

};


export const resetPassword = (
    email,
    code,
    newPassword
) => {

    return api.post(
        "/auth/reset-password",
        {
            email,
            code,
            newPassword
        }
    );

};