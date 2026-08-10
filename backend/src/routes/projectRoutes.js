const express = require("express");

const router = express.Router();

const projectController =
    require(
        "../controllers/projectController"
    );

const upload =
    require(
        "../middleware/uploadMiddleware"
    );


// ======================================================
// CREATE PROJECT + UPLOAD IMAGE
// ======================================================

router.post(
    "/",
    upload.single("image"),
    projectController.createProject
);


// ======================================================
// OTHER ROUTES
// ======================================================

router.get(
    "/",
    projectController.getProjects
);


router.get(
    "/user/:userId",
    projectController.getProjectsByUser
);


router.get(
    "/:id",
    projectController.getProject
);


router.put(
    "/:id",
    projectController.updateProject
);


router.delete(
    "/:id",
    projectController.deleteProject
);


module.exports = router;