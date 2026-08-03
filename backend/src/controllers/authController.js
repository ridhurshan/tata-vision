const authService = require("../services/authService");

function sendError(res, err, defaultStatus = 500) {
    console.error(err);

    res.status(err.statusCode || defaultStatus).json({
        message: err.message || "Something went wrong.",
        code: err.code || undefined
    });
}

exports.register = async (req, res) => {
    try {
        const result = await authService.register(req.body);

        res.status(201).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const result = await authService.verifyEmail(req.body);

        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.resendVerificationCode = async (req, res) => {
    try {
        const result =
            await authService.resendVerificationCode(req.body);

        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};

exports.login = async (req, res) => {
    try {
        const result = await authService.login(req.body);

        res.status(200).json(result);
    } catch (err) {
        sendError(res, err);
    }
};