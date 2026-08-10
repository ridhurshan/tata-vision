const Project = require("../models/projectModel");

exports.createProject = async (project) => {
    const result = await Project.create(project);
    return {
        message: "Project created successfully",
        projectId: result.insertId
    };
};

exports.getProjects = async () => {
    return await Project.findAll();
};

exports.getProject = async (id) => {
    const results = await Project.findById(id);
    return results[0];
};

exports.getProjectsByUser = async (userId) => {   // ← new
    return await Project.findByUserId(userId);
};

exports.updateProject = async (id, project) => {
    await Project.update(id, project);
    return { message: "Project updated successfully" };
};

exports.deleteProject = async (id) => {
    await Project.delete(id);
    return { message: "Project deleted successfully" };
};

exports.updateAIOutputs = async (projectId, outputs) => {
  return await Project.updateAIOutputs(
    projectId,
    outputs
  );
};

exports.updateAIOutputs = async (projectId, outputs) => {
  return await Project.updateAIOutputs(
    projectId,
    outputs
  );
};

exports.updateStatus = async (projectId, status) => {
  return await Project.updateStatus(
    projectId,
    status
  );
};