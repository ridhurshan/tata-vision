const express=require("express");
const cors=require("cors");

const authRoutes=require("./routes/authRoutes");

const app=express();

app.use(cors());

app.use(express.json());

app.use("/api/auth",authRoutes);

const projectRoutes = require("./routes/projectRoutes");
app.use("/api/projects", projectRoutes);

module.exports=app;