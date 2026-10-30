"use client";

import React, { useState, useEffect } from "react";

interface Order {
  id: string;
  topic: string;
  amountInr: number;
  status: string;
  utr?: string;
  screenshotUrl?: string;
  rejectionReason?: string;
  createdAt: string;
  deckId?: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending_review" | "all">("pending_review");
  const [rejectReason, setRejectReason] = useState<{ [id: string]: string }>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        fetchOrders();
      } else {
        setError(data.error || "Galat password (Invalid password)");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (orderId: string, action: "approve" | "reject") => {
    const reason = rejectReason[orderId] || "UTR mismatch";
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const d = await res.json();
        alert(`Action failed: ${d.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg">
              ₹
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Portal</h1>
              <p className="text-xs text-slate-400">Manual Payment & Review Desk</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-950/50 p-3 rounded-lg border border-rose-900">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition text-sm"
            >
              {loading ? "Verifying..." : "Login to Admin"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const filteredOrders =
    activeTab === "pending_review" ? orders.filter((o) => o.status === "pending_review") : orders;

  const pendingCount = orders.filter((o) => o.status === "pending_review").length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-2xl font-black tracking-tight">Admin Payment & Orders Control</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              ₹20 manual UPI verification desk & capacity manager
            </p>
          </div>

          <button
            onClick={fetchOrders}
            className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg transition"
          >
            ↻ Refresh Orders
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("pending_review")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "pending_review"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Pending Review
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
              activeTab === "all"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
            Koi pending orders nahi hain (No orders matching this view).
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 transition hover:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                        order.status === "pending_review"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : order.status === "paid" || order.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : order.status === "generating"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ID: {order.id.slice(0, 8)}...</span>
                    <span className="text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-100">{order.topic}</h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                    <div>
                      Amount: <span className="font-semibold text-emerald-400">₹{order.amountInr}</span>
                    </div>
                    {order.utr && (
                      <div className="font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        UTR: <span className="font-bold text-indigo-300">{order.utr}</span>
                      </div>
                    )}
                    {order.screenshotUrl && (
                      <a
                        href={order.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 underline"
                      >
                        View Screenshot
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {order.status === "pending_review" && (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      placeholder="Reason if rejecting..."
                      value={rejectReason[order.id] || ""}
                      onChange={(e) =>
                        setRejectReason({ ...rejectReason, [order.id]: e.target.value })
                      }
                      className="bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-lg text-slate-300 focus:outline-none focus:border-slate-700 w-full sm:w-44"
                    />

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleAction(order.id, "approve")}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                      >
                        ✓ Approve (₹20 Paid)
                      </button>
                      <button
                        onClick={() => handleAction(order.id, "reject")}
                        className="flex-1 sm:flex-none px-3 py-2 bg-rose-900/40 hover:bg-rose-900 text-rose-300 text-xs font-medium rounded-lg border border-rose-800 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

