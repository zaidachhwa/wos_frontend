import axiosInstance from "./axiosInstance";

export const fetchDashboardSummary = async (params) => {
  const { data } = await axiosInstance.get("/analytics/dashboard", { params });
  return data.data;
};

export const fetchProjectAnalytics = async (params) => {
  const { data } = await axiosInstance.get("/analytics/projects", { params });
  return data.data;
};

export const fetchUserAnalytics = async (params) => {
  const { data } = await axiosInstance.get("/analytics/users", { params });
  return data.data;
};

export const fetchProjectDetails = async (id, params) => {
  const { data } = await axiosInstance.get(`/analytics/projects/${id}`, { params });
  return data.data;
};

export const fetchUserDetails = async (id, params) => {
  const { data } = await axiosInstance.get(`/analytics/users/${id}`, { params });
  return data.data;
};
