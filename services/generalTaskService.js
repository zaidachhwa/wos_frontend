import axiosInstance from "./axiosInstance";

const clean = (params) => Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// scope: "assigned" (my tasks) | "created" (tasks I assigned — director/admin)
export const fetchGeneralTasks = async (params) => {
  const { data } = await axiosInstance.get("/general-tasks", { params: clean(params) });
  return data.data;
};

export const createGeneralTask = async (payload) => {
  const { data } = await axiosInstance.post("/general-tasks", payload);
  return data.data.task;
};

export const updateGeneralTask = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/general-tasks/${id}`, payload);
  return data.data.task;
};

export const deleteGeneralTask = async (id) => {
  await axiosInstance.delete(`/general-tasks/${id}`);
};

export const setGeneralTaskDone = async ({ id, done }) => {
  const { data } = await axiosInstance.post(`/general-tasks/${id}/done`, { done });
  return data.data.task;
};
