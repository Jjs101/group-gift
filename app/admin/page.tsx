"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

interface Contribution {
  contributorName: string;
  contributorEmail: string;
  amount: number;
  paidAt: string;
}

interface Gift {
  id: string;
  giftId: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  recipientName: string;
  babyGender: string;
  deadline: string;
  status: string;
  totalCollected: number;
  contributorCount: number;
  chooser: string;
  contributions?: Contribution[];
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleLogin() {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthed(true);
      loadGifts();
    } else {
      setError("Incorrect password.");
    }
  }

  async function loadGifts() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "gifts"));
    const giftsData: Gift[] = [];
    for (const giftDoc of snapshot.docs) {
      const gift = giftDoc.data() as Gift;
      gift.id = giftDoc.id;
      const contribSnapshot = await getDocs(
        collection(db, "gifts", giftDoc.id, "contributions")
      );
      gift.contributions = contribSnapshot.docs.map((d) => d.data() as Contribution);
      giftsData.push(gift);
    }
    giftsData.sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
    setGifts(giftsData);
    setLoading(false);
  }

  async function markFulfilled(giftId: string) {
    await updateDoc(doc(db, "gifts", giftId), { status: "fulfilled" });
    setGifts((prev) =>
      prev.map((g) => (g.id === giftId ? { ...g, status: "fulfilled" } : g))
    );
  }

  const statusColor = (status: string) => {
    if (status === "open") return "#2a9d5c";
    if (status === "closed") return "#e07b00";
    if (status === "fulfilled") return "#999";
    return "#333";
  };

  if (!authed) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: "0 auto" }}>
        <h2>Admin Login</h2>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={{ padding: 10, fontSize: 16, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button
          onClick={handleLogin}
          style={{ padding: "10px 24px", fontSize: 16, background: "#333", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1>Group Gift Admin</h1>
      {loading && <p>Loading...</p>}
      {gifts.map((gift) => (
        <div
          key={gift.id}
          style={{ border: "1px solid #ddd", borderRadius: 10, padding: 20, marginBottom: 20 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>{gift.recipientName}</h2>
              <p style={{ margin: "4px 0", color: "#666" }}>
                {gift.organizerName} — {gift.organizerEmail} — {gift.organizerPhone}
              </p>
              <p style={{ margin: "4px 0", color: "#666" }}>
                {gift.babyGender} · Deadline: {new Date(gift.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>${parseFloat(gift.totalCollected?.toString() || "0").toFixed(2)}</strong> collected from {gift.contributorCount} contributor{gift.contributorCount !== 1 ? "s" : ""}
              </p>
              <p style={{ margin: "4px 0", color: "#666", fontSize: 14 }}>
                Gift selection: {gift.chooser}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <span style={{ background: statusColor(gift.status), color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 14 }}>
                {gift.status.toUpperCase()}
              </span>
              <button
                onClick={() => setExpanded(expanded === gift.id ? null : gift.id)}
                style={{ padding: "6px 16px", fontSize: 14, background: "#eee", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                {expanded === gift.id ? "Hide" : "View"} Contributors
              </button>
              {gift.status === "closed" && (
                <button
                  onClick={() => markFulfilled(gift.id)}
                  style={{ padding: "6px 16px", fontSize: 14, background: "#333", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
                >
                  Mark Fulfilled
                </button>
              )}
            </div>
          </div>

          {expanded === gift.id && (
            <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
              {gift.contributions && gift.contributions.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: "8px 0" }}>Name</th>
                      <th style={{ padding: "8px 0" }}>Email</th>
                      <th style={{ padding: "8px 0" }}>Amount</th>
                      <th style={{ padding: "8px 0" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gift.contributions.map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "8px 0" }}>{c.contributorName}</td>
                        <td style={{ padding: "8px 0" }}>{c.contributorEmail}</td>
                        <td style={{ padding: "8px 0" }}>${parseFloat(c.amount?.toString()).toFixed(2)}</td>
                        <td style={{ padding: "8px 0" }}>{new Date(c.paidAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: "#999" }}>No contributions yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
      {!loading && gifts.length === 0 && <p>No gifts found.</p>}
    </div>
  );
}