import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ adminOnly = false }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="view-project-loading">Checking session...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (
        adminOnly
        && String(user.role).toLowerCase() !== "admin"
    ) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
