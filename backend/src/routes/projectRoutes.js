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

const {
    protect,
    adminOnly
} = require("../middleware/authMiddleware");


// ======================================================
// CREATE PROJECT + UPLOAD IMAGE
// ======================================================

router.post(
    "/",
    protect,
    upload.single("image"),
    projectController.createProject
);


// ======================================================
// OTHER ROUTES
// ======================================================

router.get(
    "/",
    protect,
    adminOnly,
    projectController.getProjects
);


router.get(
    "/user/:userId",
    protect,
    projectController.getProjectsByUser
);


router.get(
    "/:id",
    protect,
    projectController.getProject
);


router.put(
    "/:id",
    protect,
    projectController.updateProject
);


router.delete(
    "/:id",
    protect,
    projectController.deleteProject
);


module.exports = router;
