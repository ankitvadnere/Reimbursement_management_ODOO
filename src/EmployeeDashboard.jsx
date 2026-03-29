import { useState } from "react";
import { useApp } from "./AppContext";
import { CATEGORIES, CURRENCIES, EXCHANGE_RATES, STATUS_META } from "./mockData";
import { StatusBadge } from "./Shared";

const fmt = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");

function SummaryCard({ label, amount, color, icon }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-800 mt-0.5">{fmt(amount)}</p>
      </div>
    </div>
  );
}

function ApprovalBreadcrumb({ status }) {
  const steps = ["draft", "waiting_approval", "approved"];
  const idx = steps.indexOf(status);
  const labels = ["Draft", "Waiting Approval", "Approved"];
  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
            ${i === idx ? "bg-[#1E3A5F] text-white" : i < idx ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
            {i < idx && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            {labels[i]}
          </div>
          {i < steps.length - 1 && <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
        </div>
      ))}
    </div>
  );
}

function ExpensePanel({ expense, onClose }) {
  const { approvalActions, users } = useApp();
  const logs = approvalActions.filter(a => a.expense_id === expense?.id);
  const isDraft = expense?.status === "draft";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">Expense Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <ApprovalBreadcrumb status={expense.status} />
        <div className="space-y-3">
          {[
            ["Description", expense.description],
            ["Category", expense.category],
            ["Date", expense.date],
            ["Paid By", expense.paid_by],
            ["Amount", `${expense.amount_original} ${expense.currency}`],
            ["Converted", fmt(expense.amount_converted)],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-xs text-gray-500 w-24 flex-shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-gray-800 font-medium">{value}</span>
            </div>
          ))}
        </div>

        {logs.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Approval Log</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>{["Approver","Action","Comment","Time"].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const approver = users.find(u => u.id === log.approver_id);
                    return (
                      <tr key={log.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 font-medium text-gray-700">{approver?.name || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${log.action === "approved" ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{log.comment}</td>
                        <td className="px-3 py-2 text-gray-400">{log.acted_at}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewExpensePanel({ onClose, onSubmit }) {
  const { currentUser } = useApp();
  const [form, setForm] = useState({
    description: "", date: "", category: "Food", paid_by: currentUser?.name || "",
    amount_original: "", currency: "INR", remarks: "", receipt: null,
  });
  const [submitted, setSubmitted] = useState(false);
  const [savedExpense, setSavedExpense] = useState(null);

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const converted = form.amount_original ? Math.round(parseFloat(form.amount_original) * (EXCHANGE_RATES[form.currency] || 1)) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const exp = onSubmit({ ...form, amount_original: parseFloat(form.amount_original) });
    setSavedExpense(exp);
    setSubmitted(true);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">New Expense</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {submitted && savedExpense && <ApprovalBreadcrumb status={savedExpense.status} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <input required type="text" value={form.description} onChange={set("description")} disabled={submitted}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="E.g. Client dinner" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expense Date *</label>
              <input required type="date" value={form.date} onChange={set("date")} disabled={submitted}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select required value={form.category} onChange={set("category")} disabled={submitted}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Paid By</label>
            <input type="text" value={form.paid_by} onChange={set("paid_by")} disabled={submitted}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
            <div className="flex gap-2">
              <input required type="number" min="0" step="0.01" value={form.amount_original} onChange={set("amount_original")} disabled={submitted}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50"
                placeholder="0.00" />
              <select value={form.currency} onChange={set("currency")} disabled={submitted}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {form.amount_original > 0 && (
              <p className="text-xs text-[#1E3A5F] mt-1 font-medium">= {fmt(converted)}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
            <textarea value={form.remarks} onChange={set("remarks")} disabled={submitted} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50 resize-none"
              placeholder="Additional notes..." />
          </div>
          {!submitted && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Attach Receipt</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2.5 hover:border-[#1E3A5F] hover:bg-blue-50 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm text-gray-500">{form.receipt ? form.receipt : "Click to attach file"}</span>
                <input type="file" className="hidden" onChange={e => setForm(prev => ({ ...prev, receipt: e.target.files[0]?.name || null }))} />
              </label>
            </div>
          )}
          {!submitted && (
            <button type="submit" className="w-full bg-[#1E3A5F] text-white rounded-lg py-2.5 font-medium text-sm hover:bg-[#2d5a8e] transition-colors">
              Submit Expense
            </button>
          )}
          {submitted && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Expense submitted for approval
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export function EmployeeDashboard() {
  const { currentUser, expenses, addExpense } = useApp();
  const [panel, setPanel] = useState(null); // { type: 'detail'|'new', expense? }

  const myExpenses = expenses.filter(e => e.employee_id === currentUser.id);
  const totals = { draft: 0, waiting_approval: 0, approved: 0 };
  myExpenses.forEach(e => { if (totals[e.status] !== undefined) totals[e.status] += e.amount_converted; });

  const handleNewExpense = (form) => {
    const exp = addExpense(form);
    setPanel({ type: "detail", expense: exp });
    return exp;
  };

  const openPanel = (type, expense = null) => setPanel({ type, expense });
  const closePanel = () => setPanel(null);

  return (
    <div className="flex h-full">
      <div className={`flex-1 p-6 overflow-y-auto transition-all ${panel ? "mr-96" : ""}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Expenses</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage your reimbursements</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => alert("Receipt upload: attach file in New Expense form")}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              Upload Receipt
            </button>
            <button onClick={() => openPanel("new")}
              className="flex items-center gap-2 bg-[#1E3A5F] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#2d5a8e] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Expense
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Draft" amount={totals.draft} color="bg-gray-400"
            icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          <SummaryCard label="Waiting Approval" amount={totals.waiting_approval} color="bg-amber-500"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <SummaryCard label="Approved" amount={totals.approved} color="bg-green-600"
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full sticky-table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Description","Date","Category","Paid By","Amount","Currency","Converted (INR)","Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myExpenses.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No expenses yet. Click "New Expense" to add one.</td></tr>
                ) : myExpenses.map((exp, i) => (
                  <tr key={exp.id} onClick={() => openPanel("detail", exp)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/50" : "bg-white"}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{exp.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{exp.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{exp.paid_by}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{exp.amount_original.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{exp.currency}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium whitespace-nowrap">{fmt(exp.amount_converted)}</td>
                    <td className="px-4 py-3"><StatusBadge status={exp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {panel && (
        <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-2xl z-20 slide-in">
          {panel.type === "detail" && <ExpensePanel expense={panel.expense} onClose={closePanel} />}
          {panel.type === "new" && <NewExpensePanel onClose={closePanel} onSubmit={handleNewExpense} />}
        </div>
      )}
    </div>
  );
}
