const express = require("express");

const router = express.Router();

const projectController = require("../controllers/projectController");

router.post("/", projectController.createProject);

router.get("/", projectController.getProjects);

router.get("/:id", projectController.getProject);

router.get("/user/:userId", projectController.getProjectsByUser); 

router.put("/:id", projectController.updateProject);

router.delete("/:id", projectController.deleteProject);

module.exports = router;