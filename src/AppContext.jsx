import { createContext, useContext, useState } from "react";
import {
  INITIAL_USERS, INITIAL_EXPENSES, INITIAL_APPROVAL_ACTIONS, EXCHANGE_RATES
} from "./mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [expenses, setExpenses] = useState(INITIAL_EXPENSES);
  const [approvalActions, setApprovalActions] = useState(INITIAL_APPROVAL_ACTIONS);
  const [approvalRules, setApprovalRules] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const login = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) { setCurrentUser(user); return { ok: true, user }; }
    return { ok: false, error: "Invalid email or password" };
  };

  const logout = () => setCurrentUser(null);

  const signup = (name, email, password, country) => {
    if (users.find(u => u.email === email)) return { ok: false, error: "Email already exists" };
    const newUser = { id: users.length + 1, name, email, password, role: "employee", country, manager_id: null };
    setUsers(prev => [...prev, newUser]);
    return { ok: true };
  };

  const addExpense = (expense) => {
    const newId = Math.max(...expenses.map(e => e.id), 0) + 1;
    const converted = Math.round(expense.amount_original * (EXCHANGE_RATES[expense.currency] || 1));
    const mgr = users.find(u => u.id === currentUser?.manager_id);
    const newExp = {
      ...expense, id: newId, employee_id: currentUser.id,
      amount_converted: converted,
      status: "waiting_approval",
      current_approver_id: mgr ? mgr.id : null,
    };
    setExpenses(prev => [...prev, newExp]);
    return newExp;
  };

  const updateExpense = (id, patch) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const addApprovalAction = (action) => {
    const newId = Math.max(...approvalActions.map(a => a.id), 0) + 1;
    const now = new Date().toISOString().replace("T", " ").slice(0, 16);
    setApprovalActions(prev => [...prev, { ...action, id: newId, acted_at: now }]);
  };

  const updateUser = (id, patch) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    if (currentUser?.id === id) setCurrentUser(prev => ({ ...prev, ...patch }));
  };

  const addUser = (user) => {
    const newId = Math.max(...users.map(u => u.id), 0) + 1;
    setUsers(prev => [...prev, { ...user, id: newId }]);
  };

  const addApprovalRule = (rule) => {
    const newId = Math.max(...approvalRules.map(r => r.id), 0) + 1;
    setApprovalRules(prev => [...prev, { ...rule, id: newId }]);
  };

  return (
    <AppContext.Provider value={{
      currentUser, users, expenses, approvalActions, approvalRules,
      login, logout, signup, addExpense, updateExpense,
      addApprovalAction, updateUser, addUser, addApprovalRule,
      showToast, toast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
