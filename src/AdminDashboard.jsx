import { useState } from "react";
import { useApp } from "./AppContext";

// ─── Users Tab ───────────────────────────────────────────────────────────────
function UsersTab() {
  const { users, updateUser, addUser, resetUserPassword, showToast } = useApp();
  const managers = users.filter(u => u.role === "manager");
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  const handleAddUser = () => {
    addUser({ 
      name: "New User", 
      email: `user${Date.now()}@acme.com`, 
      role: "employee", 
      manager_id: null,
      country: "IN"
    });
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setEditForm({ name: user.name, email: user.email });
  };

  const saveEdit = (userId) => {
    updateUser(userId, editForm);
    setEditingUserId(null);
    showToast("User updated successfully");
  };

  const handleRoleChange = (userId, role) => {
    updateUser(userId, { role });
    showToast(`User role updated to ${role}`);
  };

  const handleManagerChange = (userId, managerId) => {
    updateUser(userId, { manager_id: managerId ? parseInt(managerId) : null });
    showToast("Manager assigned successfully");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{users.length} total users</p>
        <button onClick={handleAddUser}
          className="flex items-center gap-2 bg-[#1E3A5F] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#2d5a8e] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add User
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Name","Email","Role","Manager","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/50" : "bg-white"}`}>
                  <td className="px-4 py-3">
                    {editingUserId === user.id ? (
                      <input 
                        value={editForm.name} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" 
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {user.name?.[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{user.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {editingUserId === user.id ? (
                      <input 
                        value={editForm.email} 
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" 
                      />
                    ) : user.email}
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      value={user.role} 
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]">
                      {["admin","manager","employee"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      value={user.manager_id || ""} 
                      onChange={e => handleManagerChange(user.id, e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]">
                      <option value="">— None —</option>
                      {managers.filter(m => m.id !== user.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {editingUserId === user.id ? (
                        <>
                          <button onClick={() => saveEdit(user.id)} className="bg-[#1E3A5F] text-white px-3 py-1 rounded text-xs hover:bg-[#2d5a8e]">Save</button>
                          <button onClick={() => setEditingUserId(null)} className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-50">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditing(user)} className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-50">Edit</button>
                          <button 
                            onClick={() => resetUserPassword(user.id)}
                            className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-50">
                            Reset Password
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Rules Tab ───────────────────────────────────────────────────────
function ApprovalRulesTab() {
  const { users, approvalRules, addApprovalRule, deleteApprovalRule, showToast } = useApp();
  const employees = users.filter(u => u.role === "employee");
  const managers = users.filter(u => u.role === "manager");
  const allUsers = users;

  const emptyForm = {
    employee_id: "", description: "", manager_id: "", approvers: [],
    enforce_sequence: false, condition_type: "None",
    condition_percentage: "", condition_approver_id: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(prev => {
      const next = { ...prev, [k]: val };
      if (k === "employee_id") {
        const emp = users.find(u => u.id === parseInt(val));
        if (emp?.manager_id) next.manager_id = emp.manager_id;
      }
      return next;
    });
  };

  const addApprover = () => setForm(prev => ({ ...prev, approvers: [...prev.approvers, { user_id: "" }] }));
  const removeApprover = (i) => setForm(prev => ({ ...prev, approvers: prev.approvers.filter((_, idx) => idx !== i) }));
  const setApprover = (i, val) => setForm(prev => {
    const a = [...prev.approvers]; a[i] = { user_id: val }; return { ...prev, approvers: a };
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.employee_id) {
      showToast("Please select an employee", "error");
      return;
    }
    if (form.approvers.length === 0) {
      showToast("Please add at least one approver", "error");
      return;
    }
    addApprovalRule(form);
    setForm(emptyForm);
  };

  const handleDelete = (id) => {
    deleteApprovalRule(id);
    setShowDeleteConfirm(null);
  };

  const showPct = ["Percentage","Hybrid"].includes(form.condition_type);
  const showApr = ["Specific Approver","Hybrid"].includes(form.condition_type);

  return (
    <div className="grid grid-cols-5 gap-6">
      <div className="col-span-3">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-5">New Approval Rule</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select required value={form.employee_id} onChange={set("employee_id")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Manager (auto-filled)</label>
                <select value={form.manager_id} onChange={set("manager_id")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                  <option value="">— None —</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input type="text" value={form.description} onChange={set("description")} placeholder="Rule description"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Approvers *</label>
                <button type="button" onClick={addApprover}
                  className="text-xs text-[#1E3A5F] hover:underline flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Approver
                </button>
              </div>
              {form.approvers.length === 0 && <p className="text-xs text-gray-400 italic">No approvers added yet</p>}
              {form.approvers.map((a, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                  <select value={a.user_id} onChange={e => setApprover(i, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                    <option value="">Select user</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                  <button type="button" onClick={() => removeApprover(i)} className="text-red-400 hover:text-red-600 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.enforce_sequence} onChange={set("enforce_sequence")}
                className="w-4 h-4 rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F]" />
              <span className="text-sm text-gray-700">Enforce sequence (approvers must approve in order)</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Condition Type</label>
                <select value={form.condition_type} onChange={set("condition_type")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                  {["None","Percentage","Specific Approver","Hybrid"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {showPct && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Condition % (1–100)</label>
                  <input type="number" min="1" max="100" value={form.condition_percentage} onChange={set("condition_percentage")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                    placeholder="e.g. 50" />
                </div>
              )}
            </div>
            {showApr && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Condition Approver</label>
                <select value={form.condition_approver_id} onChange={set("condition_approver_id")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                  <option value="">Select user</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            )}

            <button type="submit" className="w-full bg-[#1E3A5F] text-white rounded-lg py-2.5 font-medium text-sm hover:bg-[#2d5a8e] transition-colors">
              Save Rule
            </button>
          </form>
        </div>
      </div>

      <div className="col-span-2">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Saved Rules ({approvalRules.length})</h3>
          {approvalRules.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No rules created yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {approvalRules.map(rule => {
                const emp = allUsers.find(u => u.id === parseInt(rule.employee_id));
                const approverNames = rule.approvers?.map(a => {
                  const user = allUsers.find(u => u.id === parseInt(a.user_id));
                  return user?.name;
                }).filter(Boolean).join(rule.enforce_sequence ? " → " : ", ") || "None";
                
                return (
                  <div key={rule.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{rule.description || "Unnamed Rule"}</p>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <p>Employee: <span className="text-gray-700">{emp?.name || "—"}</span></p>
                          <p>Approvers: <span className="text-gray-700">{approverNames}</span></p>
                          <p>Condition: <span className="text-gray-700">{rule.condition_type}</span></p>
                          {rule.condition_percentage && <p>Threshold: <span className="text-gray-700">{rule.condition_percentage}%</span></p>}
                          {rule.enforce_sequence && <p className="text-[#1E3A5F]">✓ Sequential approval</p>}
                          {rule.condition_approver_id && (
                            <p>Special Approver: <span className="text-gray-700">{allUsers.find(u => u.id === parseInt(rule.condition_approver_id))?.name}</span></p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm(rule.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    {showDeleteConfirm === rule.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-500">Delete this rule?</span>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="border border-gray-300 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
export function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const tabs = [{ id: "users", label: "Users" }, { id: "rules", label: "Approval Rules" }];

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage users and configure approval workflows</p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-white text-[#1E3A5F] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "rules" && <ApprovalRulesTab />}
    </div>
  );
}