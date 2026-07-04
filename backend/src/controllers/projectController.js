const projectService = require("../services/projectService");

exports.createProject = async (req, res) => {
    try {
        console.log("Received POST request to /api/projects");
        console.log("Request body:", req.body);
        
        const result = await projectService.createProject(req.body);
        console.log("Project created:", result);
        
        res.status(201).json(result);
    } catch (err) {
        console.error("Error in createProject controller:", err);
        console.error("Error stack:", err.stack);
        res.status(500).json({
            message: err.message,
            details: err.sqlMessage || "No additional details"
        });
    }
};

exports.getProjects = async (req, res) => {

    try {

        const result = await projectService.getProjects();

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

exports.getProject = async (req, res) => {

    try {

        const result = await projectService.getProject(req.params.id);

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

exports.updateProject = async (req, res) => {

    try {

        const result = await projectService.updateProject(
            req.params.id,
            req.body
        );

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

exports.deleteProject = async (req, res) => {

    try {

        const result = await projectService.deleteProject(req.params.id);

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};