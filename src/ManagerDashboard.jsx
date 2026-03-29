import { useState, useMemo } from "react";
import { useApp } from "./AppContext";
import { StatusBadge } from "./Shared";

const fmt = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");

const CURRENCY_SYMBOL = { USD: "$", EUR: "€", GBP: "£" };

// How many days ago was this expense submitted?
function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function UrgencyBadge({ date }) {
  const days = daysAgo(date);
  if (days === null) return null;
  if (days >= 7)
    return (
      <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        {days}d ago
      </span>
    );
  if (days >= 3)
    return (
      <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        {days}d ago
      </span>
    );
  return (
    <span className="ml-2 text-xs text-gray-400">{days === 0 ? "Today" : `${days}d ago`}</span>
  );
}

// Detail side panel for a single expense
function ExpenseDetailPanel({ expense, employee, onClose, onApprove, onReject }) {
  const [comment, setComment] = useState("");
  const [action, setAction] = useState(null); // 'approve' | 'reject'
  const [commentError, setCommentError] = useState(false);

  const handleConfirm = () => {
    if (action === "reject" && !comment.trim()) {
      setCommentError(true);
      return;
    }
    if (action === "approve") onApprove(expense, comment);
    else onReject(expense, comment);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">Expense Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Employee info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-10 h-10 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {employee?.name?.[0] || "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{employee?.name}</p>
            <p className="text-xs text-gray-500">{employee?.email}</p>
          </div>
        </div>

        {/* Expense fields */}
        <div className="space-y-2.5">
          {[
            ["Description", expense.description],
            ["Category", expense.category],
            ["Date", expense.date],
            ["Amount", `${CURRENCY_SYMBOL[expense.currency] || ""}${expense.amount_original?.toLocaleString()} ${expense.currency}`],
            ["Converted", fmt(expense.amount_converted)],
            ["Remarks", expense.remarks || "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-gray-800 font-medium flex-1">{value}</span>
            </div>
          ))}
        </div>

        {/* Urgency */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Submitted <UrgencyBadge date={expense.date} />
        </div>

        {/* Action section */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Decision</p>

          {/* Action toggle */}
          {!action && (
            <div className="flex gap-2">
              <button
                onClick={() => { setAction("approve"); setCommentError(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
              <button
                onClick={() => { setAction("reject"); setCommentError(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
            </div>
          )}

          {action && (
            <div className={`rounded-xl border p-3 space-y-3 ${action === "approve" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${action === "approve" ? "text-green-700" : "text-red-700"}`}>
                  {action === "approve" ? "✓ Approving expense" : "✗ Rejecting expense"}
                </span>
                <button onClick={() => { setAction(null); setComment(""); setCommentError(false); }} className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Change
                </button>
              </div>
              <div>
                <textarea
                  value={comment}
                  onChange={e => { setComment(e.target.value); setCommentError(false); }}
                  placeholder={action === "reject" ? "Reason for rejection (required)..." : "Add a comment (optional)..."}
                  rows={3}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none bg-white
                    ${commentError ? "border-red-400" : "border-gray-300"}`}
                />
                {commentError && (
                  <p className="text-xs text-red-500 mt-1">⚠ A reason is required when rejecting</p>
                )}
              </div>
              <button
                onClick={handleConfirm}
                className={`w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors
                  ${action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                Confirm {action === "approve" ? "Approval" : "Rejection"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ManagerDashboard() {
  const { currentUser, expenses, users, addApprovalAction, updateExpense, showToast } = useApp();

  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'history'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkComment, setBulkComment] = useState("");
  const [showBulkBar, setShowBulkBar] = useState(false);

  const getEmployee = (id) => users.find(u => u.id === id);

  const queue = expenses.filter(
    e => e.current_approver_id === currentUser.id && e.status === "waiting_approval"
  );

  const history = expenses.filter(
    e => e.current_approver_id === null &&
      (e.status === "approved" || e.status === "rejected") &&
      users.find(u => u.id === e.employee_id)?.manager_id === currentUser.id
  );

  // Single approve/reject
  const doAction = (expense, action, comment) => {
    updateExpense(expense.id, {
      status: action === "approve" ? "approved" : "rejected",
      current_approver_id: null,
    });
    addApprovalAction({
      expense_id: expense.id,
      approver_id: currentUser.id,
      action: action === "approve" ? "approved" : "rejected",
      comment: comment || "—",
    });
    if (selectedExpense?.id === expense.id) setSelectedExpense(null);
    showToast(`Expense ${action === "approve" ? "approved" : "rejected"} successfully`);
  };

  // Bulk approve
  const doBulkApprove = () => {
    selectedIds.forEach(id => {
      const exp = queue.find(e => e.id === id);
      if (exp) doAction(exp, "approve", bulkComment || "Bulk approved");
    });
    setSelectedIds(new Set());
    setBulkComment("");
    setShowBulkBar(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === queue.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(queue.map(e => e.id)));
  };

  // Keep bulk bar in sync
  const handleSelectToggle = (id) => {
    toggleSelect(id);
    setShowBulkBar(true);
  };

  return (
    <div className={`flex h-full`}>
      <div className={`flex-1 p-6 overflow-y-auto transition-all ${selectedExpense ? "mr-96" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Approvals</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {queue.length} expense{queue.length !== 1 ? "s" : ""} waiting for your review
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: "pending", label: "Pending", count: queue.length },
              { key: "history", label: "History", count: history.length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
                  ${activeTab === t.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold
                  ${activeTab === t.key
                    ? t.key === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                    : "bg-gray-200 text-gray-400"}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {activeTab === "pending" && showBulkBar && selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-[#1E3A5F] text-white rounded-xl">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <input
              value={bulkComment}
              onChange={e => setBulkComment(e.target.value)}
              placeholder="Optional comment for bulk approval..."
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-white"
            />
            <button
              onClick={doBulkApprove}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve All
            </button>
            <button
              onClick={() => { setSelectedIds(new Set()); setShowBulkBar(false); }}
              className="text-white/60 hover:text-white text-sm underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Pending tab */}
        {activeTab === "pending" && (
          queue.length === 0 ? (
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
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === queue.length && queue.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                      />
                    </th>
                    {["Description", "Employee", "Category", "Date", "Amount", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queue.map((exp, i) => {
                    const emp = getEmployee(exp.employee_id);
                    const days = daysAgo(exp.date);
                    const isUrgent = days !== null && days >= 7;
                    const isSelected = selectedIds.has(exp.id);
                    const isActive = selectedExpense?.id === exp.id;

                    return (
                      <tr
                        key={exp.id}
                        onClick={() => setSelectedExpense(isActive ? null : exp)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors
                          ${isActive ? "bg-blue-50 border-blue-200" : isSelected ? "bg-amber-50" : i % 2 === 1 ? "bg-gray-50/50 hover:bg-blue-50" : "bg-white hover:bg-blue-50"}`}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectToggle(exp.id)}
                            className="rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-800">{exp.description}</p>
                            {isUrgent && (
                              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" title="Overdue" />
                            )}
                          </div>
                          {exp.remarks && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{exp.remarks}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {emp?.name?.[0] || "?"}
                            </div>
                            <span className="text-sm text-gray-700">{emp?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exp.category}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-600 whitespace-nowrap">{exp.date}</span>
                            <UrgencyBadge date={exp.date} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-800">{fmt(exp.amount_converted)}</p>
                          {exp.currency !== "INR" && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {CURRENCY_SYMBOL[exp.currency] || ""}{exp.amount_original?.toLocaleString()} {exp.currency}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => doAction(exp, "approve", "")}
                              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </button>
                            <button
                              onClick={() => { setSelectedExpense(exp); }}
                              className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                {selectedIds.size > 0
                  ? `${selectedIds.size} of ${queue.length} selected`
                  : `${queue.length} expense${queue.length !== 1 ? "s" : ""} pending`}
              </div>
            </div>
          )
        )}

        {/* History tab */}
        {activeTab === "history" && (
          history.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">No history yet</p>
              <p className="text-gray-400 text-sm mt-1">Approved and rejected expenses will appear here.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Description", "Employee", "Category", "Date", "Amount", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((exp, i) => {
                    const emp = getEmployee(exp.employee_id);
                    return (
                      <tr
                        key={exp.id}
                        onClick={() => setSelectedExpense(selectedExpense?.id === exp.id ? null : exp)}
                        className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors
                          ${selectedExpense?.id === exp.id ? "bg-blue-50" : i % 2 === 1 ? "bg-gray-50/50" : "bg-white"}`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{exp.description}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {emp?.name?.[0] || "?"}
                            </div>
                            <span className="text-sm text-gray-700">{emp?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exp.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.date}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-800">{fmt(exp.amount_converted)}</p>
                          {exp.currency !== "INR" && (
                            <p className="text-xs text-gray-400">{CURRENCY_SYMBOL[exp.currency] || ""}{exp.amount_original?.toLocaleString()} {exp.currency}</p>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={exp.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                {history.length} expense{history.length !== 1 ? "s" : ""} reviewed
              </div>
            </div>
          )
        )}
      </div>

      {/* Detail side panel */}
      {selectedExpense && (
        <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-2xl z-20 slide-in">
          <ExpenseDetailPanel
            expense={selectedExpense}
            employee={getEmployee(selectedExpense.employee_id)}
            onClose={() => setSelectedExpense(null)}
            onApprove={(exp, comment) => doAction(exp, "approve", comment)}
            onReject={(exp, comment) => doAction(exp, "reject", comment)}
          />
        </div>
      )}
    </div>
  );
}