import { useState } from "react";
import { AppProvider, useApp } from "./AppContext";
import { LoginPage, SignupPage } from "./AuthPages";
import { Sidebar, Toast } from "./Shared";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { ManagerDashboard } from "./ManagerDashboard";
import { AdminDashboard } from "./AdminDashboard";

function AppShell() {
  const { currentUser, toast } = useApp();
  const [authPage, setAuthPage] = useState("login");
  const [activeView, setActiveView] = useState(null);

  // Determine default view when user changes
  const getDefaultView = (role) => {
    if (role === "admin") return "admin";
    if (role === "manager") return "manager";
    return "employee";
  };

  if (!currentUser) {
    if (authPage === "login") return <LoginPage onGoSignup={() => setAuthPage("signup")} />;
    return <SignupPage onGoLogin={() => setAuthPage("login")} />;
  }

  const view = activeView || getDefaultView(currentUser.role);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeView={view} onChangeView={setActiveView} />
      <main className="flex-1 ml-56 overflow-hidden">
        {view === "employee" && <EmployeeDashboard />}
        {view === "manager" && <ManagerDashboard />}
        {view === "admin" && <AdminDashboard />}
      </main>
      <Toast toast={toast} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
