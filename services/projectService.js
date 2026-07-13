import axiosInstance from "./axiosInstance";

export const fetchProjects = async () => {
  const { data } = await axiosInstance.get("/projects");
  return data.data.projects;
};

export const fetchProject = async (id) => {
  const { data } = await axiosInstance.get(`/projects/${id}`);
  return data.data.project;
};

export const createProject = async (payload) => {
  const { data } = await axiosInstance.post("/projects", payload);
  return data.data.project;
};

export const updateProject = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/projects/${id}`, payload);
  return data.data.project;
};

export const createModule = async ({ projectId, ...payload }) => {
  const { data } = await axiosInstance.post(`/projects/${projectId}/modules`, payload);
  return data.data.module;
};

export const updateModule = async ({ projectId, moduleId, ...payload }) => {
  const { data } = await axiosInstance.patch(`/projects/${projectId}/modules/${moduleId}`, payload);
  return data.data.module;
};

export const fetchModules = async (projectId) => {
  const { data } = await axiosInstance.get(`/projects/${projectId}/modules`);
  return data.data.modules;
};
