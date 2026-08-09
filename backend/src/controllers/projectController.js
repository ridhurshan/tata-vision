exports.createProject = async (
    req,
    res
) => {

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


        // ==============================================
        // IMAGE REQUIRED
        // ==============================================

        if (!req.file) {

            return res
                .status(400)
                .json({
                    message:
                        "Reference image is required."
                });

        }


        // ==============================================
        // BUILD PROJECT DATA
        // ==============================================

        const projectData = {

            user_id:
                req.body.user_id,

            title:
                req.body.title,

            description:
                req.body.description,

            input_image:
                req.file.path,

            input_filename:
                req.file.filename

        };


        // ==============================================
        // CREATE DATABASE PROJECT
        // ==============================================

        const result =
            await projectService
                .createProject(
                    projectData
                );


        console.log(
            "Project created:",
            result
        );


        console.log(
            "Input image path:",
            req.file.path
        );


        res
            .status(201)
            .json({

                ...result,

                inputImage:
                    req.file.filename

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


        res
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

exports.getProjectsByUser = async (req, res) => {  
    try {
        const result = await projectService.getProjectsByUser(req.params.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
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