import axiosInstance from "./axiosInstance";

export const generateDailyPlan = async () => {
  const { data } = await axiosInstance.post("/ai/daily-planner");
  return data.data.plan;
};

export const analyzeWorkload = async () => {
  const { data } = await axiosInstance.post("/ai/workload");
  return data.data.analysis;
};

export const analyzeProjectHealth = async (projectId) => {
  const { data } = await axiosInstance.post("/ai/project-health", { projectId });
  return data.data; // { healthScore, riskLevel, recommendations }
};

export const askAssistant = async (message) => {
  const { data } = await axiosInstance.post("/ai/chat", { message });
  return data.data.answer;
};
