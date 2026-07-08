const express=require("express");
const cors=require("cors");

const authRoutes=require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const app=express();

app.use(cors());

app.use(express.json());

app.use("/api/auth",authRoutes);
app.use("/api/admin", adminRoutes);
const projectRoutes = require("./routes/projectRoutes");
app.use("/api/projects", projectRoutes);

module.exports=app;