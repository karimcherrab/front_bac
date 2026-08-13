import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./pages/AppLayout";
import DashboardLayout from "./pages/DashboardLayout";

import LessonPage from "./pages/LessonPage";
import SubjectsPage from "./pages/SubjectsPage";
import CoursePage from "./pages/CoursePage";

import DashboardHomePage from "./pages/DashboardHomePage";



import LogInPage from "./pages/LogInPage";
import SignupPage from "./pages/SignupPage";
import CheckEmailPage from "./pages/CheckEmailPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

import SettingsPage from "./pages/SettingsPage";
import TutorChatPage from "./pages/TutorChatPage";


import ProtectedRoute from "./Utils/ProtectedRoute";
import GuestRoute from "./Utils/GuestRoute";

import "./App.css";

export default function App() {

  return (
    <Routes>
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

      <Route
        path="/check-email"
        element={
          <GuestRoute>
            <CheckEmailPage />
          </GuestRoute>
        }
      />

      <Route
        path="/verify-email"
        element={
          <GuestRoute>
            <VerifyEmailPage />
          </GuestRoute>
        }
      />
      <Route
  path="/settings"
  element={
    <DashboardLayout>
      <SettingsPage />
    </DashboardLayout>
  }
/>

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

      <Route
        path="/subjects/:id_subjects/lesson/:id_chapter"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LessonPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

     <Route
        path="/tutor"
          element={
            <DashboardLayout>
              <TutorChatPage />
            </DashboardLayout>
          }
      
      />

   <Route
        path="/home"
          element={
            <DashboardLayout>
              <DashboardHomePage />
            </DashboardLayout>
          }
      
      />


      <Route
        path="/"
        element={<Navigate to="/subjects" replace />}
      />

      <Route
        path="*"
        element={<Navigate to="/subjects" replace />}
      />
    </Routes>
  );
}
