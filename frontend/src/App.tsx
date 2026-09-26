import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/services/auth";
import { Spinner } from "@/components/ui";
import AuthLayout from "@/layouts/AuthLayout";
import UserLayout from "@/layouts/UserLayout";
import AdminLayout from "@/layouts/AdminLayout";
import PublicLayout from "@/layouts/PublicLayout";
import Landing from "@/pages/public/Landing";
import Docs from "@/pages/public/Docs";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Dashboard from "@/pages/user/Dashboard";
import Assistant from "@/pages/user/Assistant";
import Schemes from "@/pages/user/Schemes";
import SchemeDetail from "@/pages/user/SchemeDetail";
import Applications from "@/pages/user/Applications";
import ApplicationDetail from "@/pages/user/ApplicationDetail";
import FormPage from "@/pages/user/FormPage";
import Forms from "@/pages/user/Forms";
import FormWorkspace from "@/pages/user/FormWorkspace";
import Review from "@/pages/user/Review";
import Documents from "@/pages/user/Documents";
import Notes from "@/pages/user/Notes";
import Profile from "@/pages/user/Profile";
import AdminOverview from "@/pages/admin/Overview";
import AdminKnowledge from "@/pages/admin/KnowledgeBase";
import AdminDocuments from "@/pages/admin/Documents";
import AdminSources from "@/pages/admin/Sources";
import AdminUsers from "@/pages/admin/Users";
import AdminSchemes from "@/pages/admin/Schemes";
import AdminIngestion from "@/pages/admin/Ingestion";

function FullPageSpinner() {
  return <div className="flex h-screen items-center justify-center"><Spinner className="h-7 w-7 text-ink-500" /></div>;
}

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/"} replace />;
  return <>{children}</>;
}

/* "/" is the public landing page for visitors and the citizen app for signed-in users. */
function CitizenShell() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user && loc.pathname === "/") return <PublicLayout />;
  return <Protected><UserLayout /></Protected>;
}

function Home() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly><AuthLayout /></GuestOnly>}>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="/welcome" element={<Landing />} />
        <Route path="/guide" element={<Navigate to="/welcome#guide" replace />} />
        <Route path="/docs" element={<Docs />} />
      </Route>

      <Route path="/applications/:id/form" element={<Protected><FormPage /></Protected>} />
      <Route path="/forms/:id" element={<Protected><FormWorkspace /></Protected>} />

      <Route element={<CitizenShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/schemes" element={<Schemes />} />
        <Route path="/schemes/:code" element={<SchemeDetail />} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/applications/:id/review" element={<Review />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="/admin" element={<Protected admin><AdminLayout /></Protected>}>
        <Route index element={<AdminOverview />} />
        <Route path="knowledge" element={<AdminKnowledge />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="sources" element={<AdminSources />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="schemes" element={<AdminSchemes />} />
        <Route path="ingestion" element={<AdminIngestion />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
