import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, isAccountantAdmin, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PeopleList from "@/pages/PeopleList";
import Payments from "@/pages/Payments";
import Kadan from "@/pages/Kadan";
import Sadakah from "@/pages/Sadakah";
import Expenses from "@/pages/Expenses";
import Accounts from "@/pages/Accounts";
import Reports from "@/pages/Reports";
import AdminUsers from "@/pages/AdminUsers";
import VattiyillaDashboard from "@/pages/VattiyillaDashboard";
import VattiyillaAccounts from "@/pages/VattiyillaAccounts";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-app text-[color:var(--text-muted)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!isAccountantAdmin(user)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/donors" element={<PeopleList kind="donors" title="Donors" subtitle="Those who give — the lifeblood of the community fund." />} />
            <Route path="/beneficiaries" element={<PeopleList kind="beneficiaries" title="Beneficiaries" subtitle="Those we serve — recipients of Kadan, Sadakah and support." />} />
            <Route path="/workers" element={<PeopleList kind="workers" title="Workers" subtitle="Team members who help operate the fund." />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/kadan" element={<Kadan variant="kadan" />} />
            <Route path="/vattiyilla" element={<VattiyillaDashboard />} />
            <Route path="/vattiyilla-loans" element={<Kadan variant="vattiyilla" />} />
            <Route path="/vattiyilla-accounts" element={<VattiyillaAccounts />} />
            <Route path="/sadakah" element={<Sadakah />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<AdminOnly><AdminUsers /></AdminOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
