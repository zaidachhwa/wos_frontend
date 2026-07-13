import axiosInstance from "./axiosInstance";

export const updateProfile = async (payload) => {
  const { data } = await axiosInstance.patch("/profile", payload);
  return data.data.user;
};

export const changePassword = async (payload) => {
  await axiosInstance.post("/profile/password", payload);
};

export const getIcsToken = async () => {
  const { data } = await axiosInstance.get("/profile/ics-token");
  return data.data.icsToken;
};

export const regenerateIcsToken = async () => {
  const { data } = await axiosInstance.post("/profile/ics-token");
  return data.data.icsToken;
};
