import api from "./api";

export const createProject = (
    formData
) => {

    return api.post(
        "/projects",
        formData
    );

};

export const getProjects = () => {
  return api.get("/projects");
};

export const getProject = (id) => {
  return api.get(`/projects/${id}`);
};

export const updateProject = (id, data) => {
  return api.put(`/projects/${id}`, data);
};

export const getProjectsByUser = (userId) => {  
  return api.get(`/projects/user/${userId}`);
};

export const deleteProject = (id) => {   
  return api.delete(`/projects/${id}`);
};
