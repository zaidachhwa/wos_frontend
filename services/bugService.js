import axiosInstance from "./axiosInstance";

const clean = (params) => Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const fetchBugs = async (params) => {
  const { data } = await axiosInstance.get("/bugs", { params: clean(params) });
  return data.data;
};

export const fetchReportableEmployees = async () => {
  const { data } = await axiosInstance.get("/bugs/reportable-employees");
  return data.data.users;
};

export const createBug = async (payload) => {
  const { data } = await axiosInstance.post("/bugs", payload);
  return data;
};

export const updateBug = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/bugs/${id}`, payload);
  return data;
};

export const addBugComment = async ({ id, text }) => {
  const { data } = await axiosInstance.post(`/bugs/${id}/comments`, { text });
  return data.data.bug;
};
