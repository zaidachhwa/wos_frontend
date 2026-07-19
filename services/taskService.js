import axiosInstance from "./axiosInstance";

export const fetchTasks = async (filters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const { data } = await axiosInstance.get("/tasks", { params });
  return data.data.tasks;
};

export const fetchTask = async (id) => {
  const { data } = await axiosInstance.get(`/tasks/${id}`);
  return data.data.task;
};

export const createTask = async (payload) => {
  const { data } = await axiosInstance.post("/tasks", payload);
  return data.data.task;
};

export const updateTask = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/tasks/${id}`, payload);
  return data.data.task;
};

export const addComment = async ({ id, text }) => {
  const { data } = await axiosInstance.post(`/tasks/${id}/comments`, { text });
  return data.data.task;
};

export const updateComment = async ({ id, commentId, text }) => {
  const { data } = await axiosInstance.patch(`/tasks/${id}/comments/${commentId}`, { text });
  return data.data.task;
};

export const deleteComment = async ({ id, commentId }) => {
  const { data } = await axiosInstance.delete(`/tasks/${id}/comments/${commentId}`);
  return data.data.task;
};

export const bulkUpdateTasks = async ({ ids, status, assignees }) => {
  const payload = { ids };
  if (status !== undefined) payload.status = status;
  if (assignees !== undefined) payload.assignees = assignees;
  const { data } = await axiosInstance.patch("/tasks/bulk", payload);
  return data.data;
};

export const deleteTask = async (id) => {
  await axiosInstance.delete(`/tasks/${id}`);
};

export const approveTask = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/tasks/${id}/approve`, payload);
  return data.data.task;
};

export const rejectTask = async ({ id, approvalComment }) => {
  const { data } = await axiosInstance.patch(`/tasks/${id}/reject`, { approvalComment });
  return data.data.task;
};
