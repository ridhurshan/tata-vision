const User = require("../models/userModel");
const Project = require("../models/projectModel");

const ALLOWED_STATUSES = ["Active", "Deactivated", "Pending"];

exports.getAllUsers = async () => {
  return await User.findAll();
};

exports.getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

// Implements SRS use case 7: User Activation & Deactivation
exports.setUserStatus = async (id, status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error("Invalid status value");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new Error("User not found");
  }

  await User.updateStatus(id, status);
  return { message: `User account status updated successfully to ${status}` };
};

// Powers the stat cards on the Admin Dashboard overview tab
exports.getDashboardStats = async () => {
  const totalUsers = await User.countAll();
  const activeUsers = await User.countByStatus("Active");
  const projects = await Project.findAll();

  return {
    totalUsers,
    activeUsers,
    totalProjects: projects.length,
  };
};
