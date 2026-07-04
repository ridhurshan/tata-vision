import api from "./api";

export const createProject = (data) => {
  return api.post("/projects", data);
};

export const getProjects = () => {
  return api.get("/projects");
};

export const getProject = (id) => {
  return api.get(`/projects/${id}`);
};

