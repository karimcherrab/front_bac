import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./pages/AppLayout";
import DashboardLayout from "./pages/DashboardLayout";
import LoadingPage from "./pages/LoadingPage";

import LessonPage from "./pages/LessonPage";
import SubjectsPage from "./pages/SubjectsPage";
import CoursePage from "./pages/CoursePage";
import DashboardHomePage from "./pages/DashboardHomePage";
import PricingPage from "./pages/PricingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentFailedPage from "./pages/PaymentFailedPage";

import LogInPage from "./pages/LogInPage";
import SignupPage from "./pages/SignupPage";
import CheckEmailPage from "./pages/CheckEmailPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

import SettingsPage from "./pages/SettingsPage";
import TutorChatPage from "./pages/TutorChatPage";

import ProtectedRoute from "./Utils/ProtectedRoute";
import PaidChapterRoute from "./Utils/PaidChapterRoute";
import GuestRoute from "./Utils/GuestRoute";

import "./App.css";

function ProtectedDashboard({
  children,
}) {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

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
        path="/loading"
        element={
          <GuestRoute>
            <LoadingPage />
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
          <ProtectedDashboard>
            <SettingsPage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/subjects"
        element={
          <ProtectedDashboard>
            <SubjectsPage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/subjects/:id_subjects"
        element={
          <ProtectedDashboard>
            <CoursePage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/subjects/:id_subjects/lesson/:id_chapter"
        element={
          <ProtectedRoute>
            <PaidChapterRoute>
              <AppLayout>
                <LessonPage />
              </AppLayout>
            </PaidChapterRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects/:id_subjects/lesson/:id_chapter/*"
        element={
          <ProtectedRoute>
            <PaidChapterRoute>
              <AppLayout>
                <LessonPage />
              </AppLayout>
            </PaidChapterRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pricing"
        element={
          <ProtectedDashboard>
            <PricingPage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/offers"
        element={
          <Navigate
            to="/pricing"
            replace
          />
        }
      />

      <Route
        path="/payment/success"
        element={
          <ProtectedDashboard>
            <PaymentSuccessPage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/payment/failed"
        element={
          <ProtectedDashboard>
            <PaymentFailedPage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/tutor"
        element={
          <ProtectedDashboard>
            <TutorChatPage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/home"
        element={
          <ProtectedDashboard>
            <DashboardHomePage />
          </ProtectedDashboard>
        }
      />

      <Route
        path="/"
        element={
          <Navigate
            to="/subjects"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/subjects"
            replace
          />
        }
      />
    </Routes>
  );
}
