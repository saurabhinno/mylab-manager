"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql, setToken } from "@/lib/railway";

export default function LoginPage() {
  const [token, setTkn] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true); setError("");
    try {
      const d = await gql(token, `query { me { name email } }`);
      setToken(token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid token");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f1117, #1a1f2e)" }}>
      <div style={{ width: 400, background: "#1e2330", border: "1px solid #2d3548", borderRadius: 16, padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Railway Manager</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Full infrastructure control panel</p>
        </div>
        {error && <div style={{ background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={token}
            onChange={(e) => setTkn(e.target.value)}
            placeholder="Paste your Railway API token"
            style={{ width: "100%", padding: "12px 14px", background: "#0f1117", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 14, outline: "none", marginBottom: 16 }}
          />
          <button
            type="submit"
            disabled={loading || !token.trim()}
            style={{ width: "100%", padding: "12px", background: loading ? "#4c1d95" : "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
        <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 16 }}>
          Get your token at <a href="https://railway.com/account/tokens" target="_blank" style={{ color: "#a78bfa" }}>railway.com/account/tokens</a>
        </p>
      </div>
    </div>
  );
}
