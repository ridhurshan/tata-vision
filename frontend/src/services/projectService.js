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

export const getProjectsByUser = (userId) => {  
  return api.get(`/projects/user/${userId}`);
};

export const deleteProject = (id) => {   
  return api.delete(`/projects/${id}`);
};