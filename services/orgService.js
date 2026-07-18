import axiosInstance from "./axiosInstance";

export const fetchDirectory = async () => {
  const { data } = await axiosInstance.get("/users/directory");
  return data.data.users;
};

export const fetchUsers = async () => {
  const { data } = await axiosInstance.get("/users");
  return data.data.users;
};

export const createUser = async (payload) => {
  const { data } = await axiosInstance.post("/users", payload);
  return data.data.user;
};

export const updateUser = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/users/${id}`, payload);
  return data.data.user;
};

export const deleteUser = async (id) => {
  await axiosInstance.delete(`/users/${id}`);
};

export const fetchDepartments = async () => {
  const { data } = await axiosInstance.get("/departments");
  return data.data.departments;
};

export const createDepartment = async (payload) => {
  const { data } = await axiosInstance.post("/departments", payload);
  return data.data.department;
};

export const updateDepartment = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/departments/${id}`, payload);
  return data.data.department;
};

export const deleteDepartment = async (id) => {
  await axiosInstance.delete(`/departments/${id}`);
};

export const fetchTeams = async () => {
  const { data } = await axiosInstance.get("/teams");
  return data.data.teams;
};

export const createTeam = async (payload) => {
  const { data } = await axiosInstance.post("/teams", payload);
  return data.data.team;
};

export const updateTeam = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/teams/${id}`, payload);
  return data.data.team;
};

export const deleteTeam = async (id) => {
  await axiosInstance.delete(`/teams/${id}`);
};
