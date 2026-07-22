import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./pages/AppLayout";
import DashboardLayout from "./pages/DashboardLayout";

import LessonPage from "./pages/LessonPage";
import SubjectsPage from "./pages/SubjectsPage";
import CoursePage from "./pages/CoursePage";

import LogInPage from "./pages/LogInPage";
import SignupPage from "./pages/SignupPage";

import ProtectedRoute from "./Utils/ProtectedRoute";
import GuestRoute from "./Utils/GuestRoute";

import "./App.css";

export default function App() {
  return (
    <Routes>
      {/* Routes pour utilisateur non connecté */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LogInPage />
          </GuestRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <GuestRoute>
            <SignupPage />
          </GuestRoute>
        }
      />

      {/* Page des matières avec le nouveau DashboardLayout */}
      <Route
        path="/subjects"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <SubjectsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects/:id_subjects"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <CoursePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Page lesson avec ton ancien AppLayout */}
      <Route
        path="/lesson/:chapter"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LessonPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Page principale */}
      <Route
        path="/"
        element={<Navigate to="/subjects" replace />}
      />

      {/* Route inexistante */}
      <Route
        path="*"
        element={<Navigate to="/subjects" replace />}
      />
    </Routes>
  );
}