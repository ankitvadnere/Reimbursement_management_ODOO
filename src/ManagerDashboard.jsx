import { useState } from "react";
import { useApp } from "./AppContext";
import { StatusBadge } from "./Shared";

const fmt = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");

export function ManagerDashboard() {
  const { currentUser, expenses, users, addApprovalAction, updateExpense, showToast } = useApp();
  const [expanded, setExpanded] = useState({}); // expenseId -> { comment, confirming }

  const queue = expenses.filter(
    e => e.current_approver_id === currentUser.id && e.status === "waiting_approval"
  );

  const getEmployee = (id) => users.find(u => u.id === id);

  const startAction = (expId, action) => {
    setExpanded(prev => ({ ...prev, [expId]: { comment: "", action } }));
  };

  const cancel = (expId) => setExpanded(prev => { const n = { ...prev }; delete n[expId]; return n; });

  const confirm = (expense) => {
    const entry = expanded[expense.id];
    if (!entry) return;
    updateExpense(expense.id, { status: entry.action === "approve" ? "approved" : "rejected", current_approver_id: null });
    addApprovalAction({
      expense_id: expense.id,
      approver_id: currentUser.id,
      action: entry.action === "approve" ? "approved" : "rejected",
      comment: entry.comment || "—",
    });
    cancel(expense.id);
    showToast(`Expense ${entry.action === "approve" ? "approved" : "rejected"} successfully`);
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Approvals to Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {queue.length} expense{queue.length !== 1 ? "s" : ""} waiting for your approval
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">All caught up!</p>
          <p className="text-gray-400 text-sm mt-1">No expenses waiting for your approval.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full sticky-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Approval Subject","Request Owner","Category","Total Amount","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map((exp, i) => {
                const emp = getEmployee(exp.employee_id);
                const isExpanded = !!expanded[exp.id];
                return (
                  <>
                    <tr key={exp.id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/50" : "bg-white"}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{exp.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold">
                            {emp?.name?.[0] || "?"}
                          </div>
                          <span className="text-sm text-gray-700">{emp?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{exp.category}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{fmt(exp.amount_converted)}</p>
                        {exp.currency !== "INR" && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {exp.currency === "USD" ? "$" : exp.currency === "EUR" ? "€" : exp.currency === "GBP" ? "£" : ""}
                            {exp.amount_original.toLocaleString()} {exp.currency}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={exp.status} /></td>
                      <td className="px-4 py-3">
                        {!isExpanded ? (
                          <div className="flex gap-2">
                            <button onClick={() => startAction(exp.id, "approve")}
                              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Approve
                            </button>
                            <button onClick={() => startAction(exp.id, "reject")}
                              className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">See below</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${exp.id}-expand`} className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-sm font-medium ${expanded[exp.id].action === "approve" ? "text-green-700" : "text-red-700"}`}>
                              {expanded[exp.id].action === "approve" ? "✓ Approving" : "✗ Rejecting"}: <span className="font-semibold">{exp.description}</span>
                            </span>
                            <input
                              value={expanded[exp.id].comment}
                              onChange={e => setExpanded(prev => ({ ...prev, [exp.id]: { ...prev[exp.id], comment: e.target.value } }))}
                              placeholder="Add a comment (optional)..."
                              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                            />
                            <button onClick={() => confirm(exp)}
                              className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors ${expanded[exp.id].action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                              Confirm
                            </button>
                            <button onClick={() => cancel(exp.id)}
                              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
