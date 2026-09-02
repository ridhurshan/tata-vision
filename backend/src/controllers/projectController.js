const path = require("path");

const projectService =
    require("../services/projectService");

const aiService =
    require("../services/aiService");


// ======================================================
// CREATE PROJECT
// ======================================================

exports.createProject = async (req, res) => {

    try {

        console.log(
            "Received POST request to /api/projects"
        );

        console.log(
            "Request body:",
            req.body
        );

        console.log(
            "Uploaded file:",
            req.file
        );


        // ==================================================
        // 1. CHECK IMAGE
        // ==================================================

        if (!req.file) {

            return res
                .status(400)
                .json({
                    message:
                        "Reference image is required."
                });
        }


        // ==================================================
        // 2. BUILD PROJECT DATA
        // ==================================================

        const projectData = {
        user_id: req.user.id,
        title: req.body.title,
        description: req.body.description,

        input_image:
            `/uploads/input/${req.file.filename}`,

        input_filename:
            req.file.filename
        };


        // ==================================================
        // 3. CREATE PROJECT IN DATABASE
        // ==================================================

        const result =
            await projectService.createProject(
                projectData
            );


        console.log(
            "Project created:",
            result
        );


        const projectId =
            result.projectId;


        console.log(
            "Created project ID:",
            projectId
        );


        // ==================================================
        // 4. CHANGE STATUS -> PROCESSING
        // ==================================================

        await projectService.updateStatus(
            projectId,
            "Processing"
        );


        // ==================================================
        // 5. GET ABSOLUTE INPUT IMAGE PATH
        // ==================================================

        const absoluteInputPath =
            path.resolve(
                req.file.path
            );


        console.log(
            "Starting AI processing..."
        );

        console.log(
            "Absolute input path:",
            absoluteInputPath
        );


        // ==================================================
        // 6. CALL PYTHON AI SERVICE
        // ==================================================

        const aiResult =
            await aiService.processImage(
                projectId,
                absoluteInputPath
            );


        console.log(
            "AI processing completed:",
            aiResult
        );


        // ==================================================
        // 7. SAVE GENERATED IMAGE PATHS
        // ==================================================

        await projectService.updateAIOutputs(
            projectId,
            aiResult.outputs
        );


        // ==================================================
        // 8. SEND RESPONSE TO FRONTEND
        // ==================================================

        return res
            .status(201)
            .json({

                message:
                    "Project created and processed successfully",

                projectId:

                    projectId,

                inputImage:
                    req.file.filename,

                outputs:
                    aiResult.outputs

            });


    } catch (err) {

        console.error(
            "Error in createProject controller:",
            err
        );

        console.error(
            "Error stack:",
            err.stack
        );


        return res
            .status(500)
            .json({

                message:
                    err.message,

                details:
                    err.sqlMessage ||
                    "No additional details"

            });
    }

};


// ======================================================
// GET ALL PROJECTS
// ======================================================

exports.getProjects = async (req, res) => {

    try {

        const result =
            await projectService.getProjects();

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });
    }
};


// ======================================================
// GET ONE PROJECT
// ======================================================

exports.getProject = async (req, res) => {

    try {

        const result =
            await projectService.getProject(
                req.params.id
            );

        if (!result) {
            return res.status(404).json({
                message: "Project not found."
            });
        }

        const isAdmin =
            String(req.user.role).toLowerCase()
            === "admin";

        if (
            !isAdmin
            && Number(result.user_id) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                message: "You do not have access to this project."
            });
        }

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });
    }
};


// ======================================================
// GET PROJECTS BY USER
// ======================================================

exports.getProjectsByUser = async (req, res) => {

    try {

        const requestedUserId = Number(
            req.params.userId
        );
        const isAdmin =
            String(req.user.role).toLowerCase()
            === "admin";

        if (
            !isAdmin
            && requestedUserId !== Number(req.user.id)
        ) {
            return res.status(403).json({
                message: "You can only view your own projects."
            });
        }

        const result =
            await projectService.getProjectsByUser(
                requestedUserId
            );

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });
    }
};


// ======================================================
// UPDATE PROJECT
// ======================================================

exports.updateProject = async (req, res) => {

    try {

        const project =
            await projectService.getProject(
                req.params.id
            );

        if (!project) {
            return res.status(404).json({
                message: "Project not found."
            });
        }

        const isAdmin =
            String(req.user.role).toLowerCase()
            === "admin";

        if (
            !isAdmin
            && Number(project.user_id) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                message: "You cannot update this project."
            });
        }

        const result =
            await projectService.updateProject(
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


// ======================================================
// DELETE PROJECT
// ======================================================

exports.deleteProject = async (req, res) => {

    try {

        const project =
            await projectService.getProject(
                req.params.id
            );

        if (!project) {
            return res.status(404).json({
                message: "Project not found."
            });
        }

        const isAdmin =
            String(req.user.role).toLowerCase()
            === "admin";

        if (
            !isAdmin
            && Number(project.user_id) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                message: "You cannot delete this project."
            });
        }

        const result =
            await projectService.deleteProject(
                req.params.id
            );

        res.json(result);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });
    }
};
