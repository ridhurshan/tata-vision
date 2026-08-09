const axios = require("axios");

const AI_SERVICE_URL = "http://127.0.0.1:5001";

const processImage = async (projectId, inputPath) => {
  try {
    console.log("Sending image to AI service...");
    console.log("Project ID:", projectId);
    console.log("Input path:", inputPath);

    const response = await axios.post(
      `${AI_SERVICE_URL}/process`,
      {
        project_id: projectId,
        input_path: inputPath,
      },
      {
        timeout: 10 * 60 * 1000,
      }
    );

    console.log("AI response:", response.data);

    return response.data;
  } catch (error) {
    console.error(
      "AI service error:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.message ||
      "AI service processing failed."
    );
  }
};

module.exports = {
  processImage,
};