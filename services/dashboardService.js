import axiosInstance from "./axiosInstance";

export const fetchDashboard = async () => {
  const { data } = await axiosInstance.get("/dashboard");
  return data.data;
};
