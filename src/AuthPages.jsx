import { useState } from "react";
import { useApp } from "./AppContext";
import { COUNTRIES } from "./mockData";

export function LoginPage({ onGoSignup }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const result = login(email, password);
      if (!result.ok) setError(result.error);
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E3A5F] to-[#2d5a8e]">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-[#1E3A5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Acme Corp</h1>
          <p className="text-blue-300 text-sm mt-1">Reimbursement Management</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
                placeholder="you@acme.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
                placeholder="Enter password" />
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#1E3A5F] text-white rounded-lg py-2.5 font-medium hover:bg-[#2d5a8e] transition-colors disabled:opacity-60">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{" "}
            <button onClick={onGoSignup} className="text-[#1E3A5F] font-medium hover:underline">Sign up</button>
          </p>
          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600 mb-1">Demo credentials:</p>
            <p>Admin: raj@acme.com / admin123</p>
            <p>Manager: sara@acme.com / pass123</p>
            <p>Employee: alice@acme.com / pass123</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignupPage({ onGoLogin }) {
  const { signup } = useApp();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", country: "India" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    const result = signup(form.name, form.email, form.password, form.country);
    if (!result.ok) { setError(result.error); return; }
    setSuccess(true);
    setTimeout(onGoLogin, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E3A5F] to-[#2d5a8e]">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-[#1E3A5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Acme Corp</h1>
          <p className="text-blue-300 text-sm mt-1">Reimbursement Management</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Create your account</h2>
          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-700 font-medium">Account created! Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {[["name","Full Name","text","Your full name"],["email","Email","email","you@acme.com"],
                ["password","Password","password","Min 6 characters"],["confirm","Confirm Password","password","Repeat password"]
              ].map(([key, label, type, placeholder]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} required value={form[key]} onChange={set(key)} placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select value={form.country} onChange={set("country")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                  {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" className="w-full bg-[#1E3A5F] text-white rounded-lg py-2.5 font-medium hover:bg-[#2d5a8e] transition-colors">
                Create Account
              </button>
            </form>
          )}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <button onClick={onGoLogin} className="text-[#1E3A5F] font-medium hover:underline">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
