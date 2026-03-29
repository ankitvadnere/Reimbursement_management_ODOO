import { useApp } from "./AppContext";
import { COMPANY, STATUS_META } from "./mockData";

function RoleBadge({ role }) {
  const colors = { admin: "bg-purple-100 text-purple-700", manager: "bg-blue-100 text-blue-700", employee: "bg-gray-100 text-gray-600" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role] || colors.employee}`}>{role}</span>;
}

const NAV_ITEMS = {
  admin:    [{ label: "Users & Rules", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", view: "admin" }],
  manager:  [{ label: "Approval Queue", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", view: "manager" }],
  employee: [{ label: "My Expenses", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z", view: "employee" }],
};

export function Sidebar({ activeView, onChangeView }) {
  const { currentUser, logout } = useApp();
  const items = NAV_ITEMS[currentUser?.role] || [];

  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-[#1E3A5F] flex flex-col z-30 shadow-xl">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{COMPANY.name}</p>
            <p className="text-blue-300 text-xs">Reimbursements</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {items.map(item => (
          <button key={item.view} onClick={() => onChangeView(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
              ${activeView === item.view ? "bg-white/20 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="mb-3">
          <p className="text-white font-medium text-sm truncate">{currentUser?.name}</p>
          <div className="mt-1">
            <RoleBadge role={currentUser?.role} />
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
      {meta.label}
    </span>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  const colors = { success: "bg-green-50 border-green-200 text-green-800", error: "bg-red-50 border-red-200 text-red-800" };
  return (
    <div className={`fixed bottom-6 right-6 z-50 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium fade-in ${colors[toast.type] || colors.success}`}>
      {toast.message}
    </div>
  );
}
