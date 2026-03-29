import { createContext, useContext, useState } from "react";
import {
  INITIAL_USERS, INITIAL_EXPENSES, INITIAL_APPROVAL_ACTIONS, EXCHANGE_RATES
} from "./mockData";

const AppContext = createContext(null);

function usePersistedState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  const setPersistedState = (value) => {
    setState(prev => {
      const next = typeof value === "function" ? value(prev) : value;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  return [state, setPersistedState];
}

// Helper function to evaluate condition
const evaluateCondition = (rule, expenseAmount, employeeSalary = 50000) => {
  const { condition_type, condition_percentage, condition_approver_id } = rule;
  
  switch (condition_type) {
    case "Percentage":
      const percentage = parseFloat(condition_percentage) || 0;
      const userLimit = employeeSalary * (percentage / 100);
      return expenseAmount > userLimit;
      
    case "Specific Approver":
      return { needsSpecial: true, approverId: parseInt(condition_approver_id) };
      
    case "Hybrid":
      const hybridPercentage = parseFloat(condition_percentage) || 0;
      const hybridLimit = employeeSalary * (hybridPercentage / 100);
      if (expenseAmount > hybridLimit) {
        return { needsSpecial: true, approverId: parseInt(condition_approver_id) };
      }
      return false;
      
    default:
      return false;
  }
};

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = usePersistedState("app_current_user", null);
  const [users, setUsers] = usePersistedState("app_users", INITIAL_USERS);
  const [expenses, setExpenses] = usePersistedState("app_expenses", INITIAL_EXPENSES);
  const [approvalActions, setApprovalActions] = usePersistedState("app_approval_actions", INITIAL_APPROVAL_ACTIONS);
  const [approvalRules, setApprovalRules] = usePersistedState("app_approval_rules", []);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const login = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) { 
      setCurrentUser(user); 
      return { ok: true, user }; 
    }
    return { ok: false, error: "Invalid email or password" };
  };

  const logout = () => setCurrentUser(null);

  const signup = (name, email, password, country) => {
    if (users.find(u => u.email === email)) return { ok: false, error: "Email already exists" };
    const newUser = { 
      id: users.length + 1, 
      name, 
      email, 
      password, 
      role: "employee", 
      country, 
      manager_id: null,
      salary: 50000
    };
    setUsers(prev => [...prev, newUser]);
    return { ok: true };
  };

  // FIXED: Proper approval rules implementation
  const addExpense = (expense) => {
    const newId = Math.max(...expenses.map(e => e.id), 0) + 1;
    const converted = Math.round(expense.amount_original * (EXCHANGE_RATES[expense.currency] || 1));
    
    // Find approval rule for this employee
    const employeeRule = approvalRules.find(rule => parseInt(rule.employee_id) === currentUser?.id);
    
    let currentApproverId = null;
    let approvalFlow = [];
    let conditionApplied = null;
    
    if (employeeRule && employeeRule.approvers && employeeRule.approvers.length > 0) {
      // Get employee salary for percentage calculations
      const employeeSalary = currentUser?.salary || 50000;
      
      // Check conditions
      const conditionResult = evaluateCondition(employeeRule, expense.amount_original, employeeSalary);
      conditionApplied = conditionResult;
      
      if (conditionResult?.needsSpecial) {
        // Route to specific approver from condition
        currentApproverId = conditionResult.approverId;
        approvalFlow = [conditionResult.approverId];
      } else if (conditionResult === true) {
        // Percentage threshold exceeded - use rule approvers
        currentApproverId = parseInt(employeeRule.approvers[0].user_id);
        approvalFlow = employeeRule.approvers.map(a => parseInt(a.user_id));
      } else {
        // Normal flow - use rule approvers
        currentApproverId = parseInt(employeeRule.approvers[0].user_id);
        approvalFlow = employeeRule.approvers.map(a => parseInt(a.user_id));
      }
    } else {
      // Fallback to direct manager
      const manager = users.find(u => u.id === currentUser?.manager_id);
      currentApproverId = manager ? manager.id : null;
      approvalFlow = currentApproverId ? [currentApproverId] : [];
    }
    
    const newExp = {
      ...expense,
      id: newId,
      employee_id: currentUser.id,
      amount_converted: converted,
      status: expense.status || "waiting_approval",
      current_approver_id: currentApproverId,
      approval_flow: approvalFlow,
      current_step: 0,
      condition_applied: conditionApplied,
      rule_applied: employeeRule?.id || null,
      created_at: new Date().toISOString()
    };
    
    setExpenses(prev => [...prev, newExp]);
    
    // Show feedback about routing
    if (employeeRule && conditionApplied?.needsSpecial) {
      const specialApprover = users.find(u => u.id === conditionApplied.approverId);
      showToast(`Expense routed to ${specialApprover?.name} due to condition`, "info");
    } else if (employeeRule && conditionApplied === true) {
      showToast(`Expense exceeds threshold - routed for approval`, "info");
    } else if (employeeRule) {
      showToast(`Expense sent to approval chain`, "success");
    }
    
    return newExp;
  };

  // Get next approver in sequence
  const getNextApprover = (expense) => {
    const rule = approvalRules.find(r => r.id === expense.rule_applied);
    
    if (rule && rule.enforce_sequence && rule.approvers && expense.approval_flow) {
      const nextStep = expense.current_step + 1;
      if (nextStep < expense.approval_flow.length) {
        return {
          approverId: expense.approval_flow[nextStep],
          nextStep: nextStep
        };
      }
    }
    return null;
  };

  const updateExpense = (id, patch) => {
    setExpenses(prev => prev.map(e => {
      if (e.id === id) {
        let updated = { ...e, ...patch };
        
        // If approved and has more approvers in sequence
        if (patch.status === 'approved' && e.approval_flow && e.approval_flow.length > 0) {
          const nextApprover = getNextApprover(e);
          if (nextApprover) {
            updated = {
              ...updated,
              current_approver_id: nextApprover.approverId,
              current_step: nextApprover.nextStep,
              status: 'waiting_approval'
            };
          } else {
            updated = {
              ...updated,
              current_approver_id: null,
              status: 'approved'
            };
          }
        }
        
        return updated;
      }
      return e;
    }));
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
    setUsers(prev => [...prev, { 
      ...user, 
      id: newId, 
      password: "pass123",
      salary: 50000
    }]);
    showToast("User added successfully");
  };

  const resetUserPassword = (userId) => {
    const newPassword = "pass123";
    updateUser(userId, { password: newPassword });
    showToast(`Password reset to: ${newPassword}`, "info");
  };

  const addApprovalRule = (rule) => {
    const newId = Math.max(...approvalRules.map(r => r.id), 0) + 1;
    const newRule = { 
      ...rule, 
      id: newId,
      created_at: new Date().toISOString()
    };
    setApprovalRules(prev => [...prev, newRule]);
    showToast("Approval rule saved successfully!");
  };

  const deleteApprovalRule = (id) => {
    setApprovalRules(prev => prev.filter(r => r.id !== id));
    showToast("Approval rule deleted");
  };

  const updateApprovalRule = (id, patch) => {
    setApprovalRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  return (
    <AppContext.Provider value={{
      currentUser, users, expenses, approvalActions, approvalRules,
      login, logout, signup, addExpense, updateExpense,
      addApprovalAction, updateUser, addUser, resetUserPassword,
      addApprovalRule, deleteApprovalRule, updateApprovalRule,
      showToast, toast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);