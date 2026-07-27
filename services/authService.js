import axiosInstance from "./axiosInstance";

export const login = async (credentials) => {
  const { data } = await axiosInstance.post("/auth/login", credentials);
  return data.data;
};

export const loginWithGoogle = async (credential) => {
  const { data } = await axiosInstance.post("/auth/google", { credential });
  return data.data;
};

export const logout = async () => {
  await axiosInstance.post("/auth/logout");
};

export const fetchMe = async () => {
  const { data } = await axiosInstance.get("/auth/me");
  return data.data.user;
};
