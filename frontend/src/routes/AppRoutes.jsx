import { Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import Projects from "../pages/Projects";
import Upload from "../pages/Upload";
import Profile from "../pages/Profile";
import Admin from "../pages/Admin";
import NotFound from "../pages/NotFound";
import Landing from "../pages/Landing";
import ViewProject from "../pages/ViewProject";
import VerifyEmail from "../pages/VerifyEmail";
import ForgotPassword from "../pages/ForgotPassword";
import ProtectedRoute from "../common/ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/landing" element={<Landing />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/projects/:projectId" element={<ViewProject />} />
      </Route>
      <Route element={<ProtectedRoute adminOnly />}>
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<NotFound />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
}
