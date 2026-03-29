import { useState, useRef, useCallback } from "react";
import { useApp } from "./AppContext";
import { CATEGORIES, CURRENCIES, EXCHANGE_RATES, STATUS_META } from "./mockData";
import { StatusBadge } from "./Shared";

const fmt = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");

// Normalize strings for comparison: lowercase, strip punctuation, collapse spaces
function normalizeStr(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Proportional amount tolerance: 2% or ₹10, whichever is larger
function amountMismatch(formVal, ocrVal) {
  const a = parseFloat(formVal || 0);
  const b = parseFloat(ocrVal || 0);
  if (!b) return false;
  const tolerance = Math.max(10, b * 0.02);
  return Math.abs(a - b) > tolerance;
}

function dateMismatch(formDate, ocrDate) {
  if (!ocrDate || !formDate) return false;
  const normalizeDate = (d) => {
    if (!d) return "";
    const parsed = new Date(d);
    if (isNaN(parsed)) return d.trim();
    return parsed.toISOString().split("T")[0];
  };
  return normalizeDate(formDate) !== normalizeDate(ocrDate);
}

function descriptionMismatch(formDesc, ocrMerchant) {
  if (!ocrMerchant || !formDesc) return false;
  return normalizeStr(formDesc) !== normalizeStr(ocrMerchant);
}

function SummaryCard({ label, amount, color, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
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
    <div className="flex items-center gap-1 mb-4 flex-wrap">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
            ${i === idx ? "bg-[#1E3A5F] text-white" : i < idx ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
            {i < idx && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {labels[i]}
          </div>
          {i < steps.length - 1 && (
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function ExpensePanel({ expense, onClose }) {
  const { approvalActions, users } = useApp();
  const logs = approvalActions.filter(a => a.expense_id === expense?.id);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">Expense Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
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
                  <tr>
                    {["Approver", "Action", "Comment", "Time"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
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

// Unsaved changes confirmation dialog
function ConfirmCloseDialog({ onConfirm, onCancel }) {
  return (
    <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-xs">
        <h4 className="font-semibold text-gray-800 text-sm mb-1">Discard changes?</h4>
        <p className="text-xs text-gray-500 mb-4">You have unsaved data. Closing will lose your progress.</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Keep editing
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

function NewExpensePanel({ onClose, onSubmit, focusReceipt }) {
  const { currentUser } = useApp();
  const fileInputRef = useRef(null);

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    description: "",
    date: "",
    category: "Food",
    paid_by: currentUser?.name || "",
    amount_original: "",
    currency: "INR",
    remarks: "",
    receipt: null,
  });

  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedExpense, setSavedExpense] = useState(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [receiptIsPdf, setReceiptIsPdf] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Track which fields were autofilled by OCR
  const autofilled = useRef(new Set());

  // Check if form has any user-entered data (for unsaved changes warning)
  const isDirty = form.description || form.date || form.amount_original || form.remarks || form.receipt;

  const handleClose = () => {
    if (isDirty && !submitted) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const set = (k) => (e) => {
    autofilled.current.delete(k);
    setForm(prev => ({ ...prev, [k]: e.target.value }));
  };

  const converted = form.amount_original
    ? Math.round(parseFloat(form.amount_original) * (EXCHANGE_RATES[form.currency] || 1))
    : 0;

  function checkMismatches(form, ocrData) {
    if (!ocrData) return {};
    const mismatches = {};
    if (!autofilled.current.has("amount_original") && amountMismatch(form.amount_original, ocrData.amount)) {
      mismatches.amount = true;
    }
    if (!autofilled.current.has("date") && dateMismatch(form.date, ocrData.expenseDate)) {
      mismatches.date = true;
    }
    if (!autofilled.current.has("description") && descriptionMismatch(form.description, ocrData.merchantName)) {
      mismatches.description = true;
    }
    return mismatches;
  }

  const mismatches = checkMismatches(form, ocrData);
  const hasMismatches = Object.keys(mismatches).length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasMismatches) return;
    const exp = onSubmit({
      ...form,
      amount_original: parseFloat(form.amount_original),
      status: "waiting_approval",
      receiptUrl: receiptPreviewUrl,
      receiptIsPdf, 
    });
    setSavedExpense(exp);
    setSubmitted(true);
  };

  const handleSaveDraft = () => {
    if (!form.description && !form.amount_original) return;
    const exp = onSubmit({
      ...form,
      amount_original: parseFloat(form.amount_original) || 0,
      status: "draft",
      receiptUrl: receiptPreviewUrl,  
      receiptIsPdf, 
    });
    setSavedExpense(exp);
    setSubmitted(true);
  };

  const handleRemoveReceipt = () => {
    setForm(prev => ({ ...prev, receipt: null }));
    setOcrData(null);
    setOcrError(null);
    setReceiptPreviewUrl(null);
    setReceiptIsPdf(false);
    autofilled.current = new Set();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setForm(prev => ({ ...prev, receipt: file.name }));
    setOcrError(null);
    setOcrLoading(true);
    setOcrData(null);
    autofilled.current = new Set();

    // Generate preview URL
    const isPdf = file.type === "application/pdf";
    setReceiptIsPdf(isPdf);
    setReceiptPreviewUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:5000/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const result = await res.json();
      const parsed = result.parsed;
      setOcrData(parsed);

      const categoryMap = {
        "Meals & Entertainment": "Food",
        "Travel": "Travel",
        "Accommodation": "Travel",
        "Office Supplies": "Office",
        "Software & Subscriptions": "Software",
      };

      const newAutofilled = new Set();
      const updates = {};

      if (parsed.merchantName) {
        updates.description = parsed.merchantName.replace(/[,\.\!\?;:]/g, "").trim();
        newAutofilled.add("description");
      }
      if (parsed.amount) {
        updates.amount_original = String(parsed.amount);
        newAutofilled.add("amount_original");
      }
      if (parsed.expenseDate) {
        updates.date = parsed.expenseDate;
        newAutofilled.add("date");
      }
      if (parsed.inferredCategory && categoryMap[parsed.inferredCategory]) {
        updates.category = categoryMap[parsed.inferredCategory];
        newAutofilled.add("category");
      }
      if (parsed.currencyCode) {
        updates.currency = parsed.currencyCode;
        newAutofilled.add("currency");
      }

      autofilled.current = newAutofilled;
      setForm(prev => ({ ...prev, ...updates }));

    } catch (err) {
      console.error("OCR failed:", err);
      setOcrError("Could not read receipt. Please fill in details manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Focus file input if opened via "Upload Receipt" button
  useRef(() => {
    if (focusReceipt && fileInputRef.current) {
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  });

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {showConfirmClose && (
        <ConfirmCloseDialog
          onConfirm={onClose}
          onCancel={() => setShowConfirmClose(false)}
        />
      )}

      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">New Expense</h3>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {submitted && savedExpense && <ApprovalBreadcrumb status={savedExpense.status} />}

        {/* OCR confidence badge */}
        {ocrData && !submitted && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Receipt scanned — fields auto-filled
              {ocrData.confidence > 0 && (
                <span className="ml-1 font-medium">({ocrData.confidence}% confidence)</span>
              )}. Review and correct if needed.
            </span>
          </div>
        )}

        {ocrError && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
            </svg>
            {ocrError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Receipt upload — moved to TOP so user sees it first */}
          {!submitted && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600">Attach Receipt</label>
                {!ocrData && !ocrLoading && (
                  <span className="flex items-center gap-1 text-xs text-[#1E3A5F] font-medium bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Auto-fills form
                  </span>
                )}
              </div>
              {!ocrData && !ocrLoading && (
                <p className="text-xs text-gray-400 mb-1.5">
                  Upload your receipt first — we'll automatically fill in the details below.
                </p>
              )}

              {/* Show attached file pill if receipt uploaded */}
              {form.receipt && !ocrLoading ? (
                <div>
                  <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5">
                    <svg className="w-4 h-4 flex-shrink-0 text-[#1E3A5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate min-w-0 flex-1">{form.receipt}</span>
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                      title="Remove receipt"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Receipt thumbnail preview */}
                  {receiptPreviewUrl && (
                    <div className="mt-2">
                      {receiptIsPdf ? (
                        <a
                          href={receiptPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium hover:bg-red-100 transition-colors"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          View PDF Receipt ↗
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLightboxOpen(true)}
                          className="block w-full rounded-lg overflow-hidden border border-gray-200 hover:border-[#1E3A5F] transition-colors group relative"
                        >
                          <img
                            src={receiptPreviewUrl}
                            alt="Receipt preview"
                            className="w-full h-28 object-cover object-top"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                              Click to expand
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-3 py-2.5 transition-colors min-w-0
                  ${ocrLoading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-[#1E3A5F] hover:bg-blue-50"}`}>
                  {ocrLoading ? (
                    <svg className="w-4 h-4 flex-shrink-0 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                  <span className="text-sm text-gray-500 truncate min-w-0 flex-1">
                    {ocrLoading ? "Scanning receipt…" : "Click to attach file"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    disabled={ocrLoading}
                  />
                </label>
              )}
            </div>
          )}

          {/* Divider */}
          {!submitted && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">or fill in manually</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <input
              required
              type="text"
              maxLength={120}
              value={form.description}
              onChange={set("description")}
              disabled={submitted}
              className={`w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50
                ${mismatches.description ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              placeholder="E.g. Client dinner"
            />
            {mismatches.description && (
              <p className="text-xs text-red-500 mt-1">
                ⚠ Merchant name on receipt is "{ocrData?.merchantName}" — please verify
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expense Date *</label>
              <input
                required
                type="date"
                max={today}
                value={form.date}
                onChange={set("date")}
                disabled={submitted}
                className={`w-full h-9 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50
                  ${mismatches.date ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {mismatches.date && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠ Receipt date is {ocrData?.expenseDate}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select
                required
                value={form.category}
                onChange={set("category")}
                disabled={submitted}
                className="w-full h-9 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Paid By — read-only display, not editable */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Paid By</label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {form.paid_by}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
            <div className="flex gap-2">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount_original}
                onChange={set("amount_original")}
                disabled={submitted}
                className={`flex-1 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50
                  ${mismatches.amount ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                placeholder="0.00"
              />
              <select
                value={form.currency}
                onChange={set("currency")}
                disabled={submitted}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50"
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {mismatches.amount && (
              <p className="text-xs text-red-500 mt-1">
                ⚠ Receipt shows {ocrData?.currencyCode} {ocrData?.amount} — please verify
              </p>
            )}
            {form.amount_original > 0 && (
              <p className="text-xs text-[#1E3A5F] mt-1 font-medium">= {fmt(converted)}</p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
            <textarea
              value={form.remarks}
              onChange={set("remarks")}
              disabled={submitted}
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:bg-gray-50 resize-none"
              placeholder="Additional notes..."
            />
            {form.remarks && (
              <p className="text-xs text-gray-400 mt-0.5 text-right">{form.remarks.length}/500</p>
            )}
          </div>

          {/* Global mismatch warning */}
          {hasMismatches && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
              <span>Some fields don't match the receipt. Please fix the highlighted fields or update the receipt before submitting.</span>
            </div>
          )}

          {/* Submit + Save Draft */}
          {!submitted && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={ocrLoading || (!form.description && !form.amount_original)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={hasMismatches || ocrLoading}
                className="flex-1 bg-[#1E3A5F] text-white rounded-lg py-2.5 font-medium text-sm hover:bg-[#2d5a8e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Expense
              </button>
            </div>
          )}

          {submitted && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border
              ${savedExpense?.status === "draft"
                ? "bg-gray-50 border-gray-200 text-gray-600"
                : "bg-green-50 border-green-200 text-green-700"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {savedExpense?.status === "draft"
                ? "Saved as draft — you can submit it later"
                : "Expense submitted for approval"}
            </div>
          )}
        </form>
      </div>

      {/* Lightbox */}
      {lightboxOpen && receiptPreviewUrl && (
        <div
          className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-600 hover:text-gray-900 z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={receiptPreviewUrl}
              alt="Receipt full view"
              className="max-w-[340px] max-h-[80vh] rounded-lg shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function EmployeeDashboard() {
  const { currentUser, expenses, addExpense } = useApp();
  const [panel, setPanel] = useState(null); // { type: 'detail'|'new', expense?, focusReceipt? }
  const [sortConfig, setSortConfig] = useState({ key: "date", dir: "desc" });
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Always read fresh expense from context by id to avoid stale data
  const myExpenses = expenses.filter(e => e.employee_id === currentUser.id);

  const totals = { draft: 0, waiting_approval: 0, approved: 0 };
  myExpenses.forEach(e => {
    if (totals[e.status] !== undefined) totals[e.status] += e.amount_converted;
  });

  // Filtering
  const filtered = myExpenses.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.description?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.paid_by?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortConfig.key], bv = b[sortConfig.key];
    if (sortConfig.key === "amount_converted") { av = +av; bv = +bv; }
    if (av < bv) return sortConfig.dir === "asc" ? -1 : 1;
    if (av > bv) return sortConfig.dir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return (
      <svg className="w-3 h-3 text-gray-300 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
    return (
      <svg className="w-3 h-3 text-[#1E3A5F] ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortConfig.dir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
    );
  };

  const handleNewExpense = (form) => {
    const exp = addExpense(form);
    setPanel({ type: "detail", expense: exp });
    return exp;
  };

  // Get live expense from context (avoid stale panel data)
  const panelExpense = panel?.type === "detail"
    ? (expenses.find(e => e.id === panel.expense?.id) || panel.expense)
    : null;

  const openPanel = (type, expense = null, focusReceipt = false) =>
    setPanel({ type, expense, focusReceipt });
  const closePanel = () => setPanel(null);

  const STATUSES = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "waiting_approval", label: "Pending" },
    { value: "approved", label: "Approved" },
  ];

  return (
    <div className="flex h-full">
      <div className={`flex-1 p-6 overflow-y-auto transition-all ${panel ? "mr-96" : ""}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Expenses</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage your reimbursements</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => openPanel("new", null, true)}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Upload Receipt
            </button>
            <button
              onClick={() => openPanel("new")}
              className="flex items-center gap-2 bg-[#1E3A5F] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#2d5a8e] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Expense
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="Draft"
            amount={totals.draft}
            color="bg-gray-400"
            icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
          <SummaryCard
            label="Waiting Approval"
            amount={totals.waiting_approval}
            color="bg-amber-500"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <SummaryCard
            label="Approved"
            amount={totals.approved}
            color="bg-green-600"
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </div>

        {/* Search + Filter bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setFilterStatus(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filterStatus === s.value
                    ? "bg-[#1E3A5F] text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { label: "Description", key: "description" },
                    { label: "Date", key: "date" },
                    { label: "Category", key: "category" },
                    { label: "Paid By", key: "paid_by" },
                    { label: "Amount", key: "amount_original" },
                    { label: "Currency", key: "currency" },
                    { label: "Converted (INR)", key: "amount_converted" },
                    { label: "Status", key: "status" },
                  ].map(({ label, key }) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
                    >
                      <span className="flex items-center">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-4m-4 4v-4m0 4H7m2 0h4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            {searchQuery || filterStatus !== "all" ? "No matching expenses" : "No expenses yet"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {searchQuery || filterStatus !== "all"
                              ? "Try adjusting your search or filter"
                              : 'Click "New Expense" to add one'}
                          </p>
                        </div>
                        {(searchQuery || filterStatus !== "all") && (
                          <button
                            onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}
                            className="text-xs text-[#1E3A5F] underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : sorted.map((exp, i) => (
                  <tr
                    key={exp.id}
                    onClick={() => openPanel("detail", exp)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/50" : "bg-white"}`}
                  >
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

          {/* Row count footer */}
          {sorted.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              Showing {sorted.length} of {myExpenses.length} expense{myExpenses.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      {panel && (
        <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-2xl z-20 slide-in">
          {panel.type === "detail" && (
            <ExpensePanel expense={panelExpense} onClose={closePanel} />
          )}
          {panel.type === "new" && (
            <NewExpensePanel
              onClose={closePanel}
              onSubmit={handleNewExpense}
              focusReceipt={panel.focusReceipt}
            />
          )}
        </div>
      )}
    </div>
  );
}