const multer = require("multer");
const path = require("path");
const fs = require("fs");


// ======================================================
// UPLOAD FOLDER
// ======================================================

const uploadFolder = path.join(
    __dirname,
    "../../uploads/input"
);

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(
        uploadFolder,
        { recursive: true }
    );
}


// ======================================================
// STORAGE
// ======================================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(
            null,
            uploadFolder
        );

    },


    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(
                Math.random() * 1E9
            );

        const extension =
            path.extname(
                file.originalname
            );

        cb(
            null,
            uniqueName + extension
        );

    }

});


// ======================================================
// FILE VALIDATION
// ======================================================

const fileFilter = (
    req,
    file,
    cb
) => {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (
        allowedTypes.includes(
            file.mimetype
        )
    ) {

        cb(
            null,
            true
        );

    } else {

        cb(
            new Error(
                "Only JPG, PNG and WebP images are allowed."
            ),
            false
        );

    }

};


// ======================================================
// MULTER CONFIG
// ======================================================

const upload = multer({

    storage,

    fileFilter,

    limits: {

        fileSize:
            5 *
            1024 *
            1024

    }

});


module.exports = upload;