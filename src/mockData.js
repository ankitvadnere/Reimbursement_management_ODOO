export const COMPANY = { name: "Acme Corp", country: "India", base_currency: "INR" };

export const INITIAL_USERS = [
  { id: 1, name: "Raj Admin", email: "raj@acme.com", password: "admin123", role: "admin" },
  { id: 2, name: "Sara Manager", email: "sara@acme.com", password: "pass123", role: "manager" },
  { id: 3, name: "Finance Team", email: "finance@acme.com", password: "pass123", role: "manager" },
  { id: 4, name: "Alice", email: "alice@acme.com", password: "pass123", role: "employee", manager_id: 2, is_manager_approver: true },
  { id: 5, name: "Bob", email: "bob@acme.com", password: "pass123", role: "employee", manager_id: 2, is_manager_approver: false },
];

export const INITIAL_EXPENSES = [
  { id: 1, employee_id: 4, description: "Client dinner", category: "Food", date: "2025-10-04", amount_original: 120, currency: "USD", amount_converted: 10104, status: "approved", paid_by: "Alice" },
  { id: 2, employee_id: 4, description: "Flight to Delhi", category: "Travel", date: "2025-10-10", amount_original: 5000, currency: "INR", amount_converted: 5000, status: "waiting_approval", paid_by: "Alice", current_approver_id: 2 },
  { id: 3, employee_id: 5, description: "Office supplies", category: "Misc", date: "2025-10-12", amount_original: 50, currency: "USD", amount_converted: 4210, status: "draft", paid_by: "Bob" },
];

export const INITIAL_APPROVAL_ACTIONS = [
  { id: 1, expense_id: 1, approver_id: 2, action: "approved", comment: "Looks good", acted_at: "2025-10-05 10:30" },
  { id: 2, expense_id: 1, approver_id: 3, action: "approved", comment: "Finance approved", acted_at: "2025-10-05 14:00" },
];

export const EXCHANGE_RATES = { INR: 1, USD: 84.2, EUR: 91.5, GBP: 106.8, AED: 22.9, SGD: 62.5, AUD: 55.3, JPY: 0.56 };

export const COUNTRIES = [
  { name: "India", currency: "INR" },
  { name: "United States", currency: "USD" },
  { name: "United Kingdom", currency: "GBP" },
  { name: "Germany", currency: "EUR" },
  { name: "UAE", currency: "AED" },
  { name: "Singapore", currency: "SGD" },
  { name: "Australia", currency: "AUD" },
  { name: "Japan", currency: "JPY" },
];

export const CATEGORIES = ["Food", "Travel", "Accommodation", "Misc", "Entertainment"];
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "JPY"];

export const STATUS_META = {
  draft:            { label: "Draft",            color: "bg-gray-100 text-gray-600",   dot: "bg-gray-400" },
  waiting_approval: { label: "Waiting Approval", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  approved:         { label: "Approved",          color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  rejected:         { label: "Rejected",          color: "bg-red-100 text-red-700",    dot: "bg-red-500"   },
};
