import axiosInstance from "./axiosInstance";

export const fetchDepartmentViolations = async () => {
  const { data } = await axiosInstance.get("/department-violations");
  return data.data.violations;
};
