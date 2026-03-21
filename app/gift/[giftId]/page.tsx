"use client";
import { useEffect, useState, use } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, increment } from "firebase/firestore";

interface Gift {
  giftId: string;
  organizerName: string;
  recipientName: string;
  babyGender: string;
  giftNote: string;
  deadline: string;
  status: string;
}

export default function GiftPage({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = use(params);

  const [gift, setGift] = useState<Gift | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [docId, setDocId] = useState("");

  useEffect(() => {
    async function fetchGift() {
      const q = query(collection(db, "gifts"), where("giftId", "==", giftId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        setGift(docData.data() as Gift);
        setDocId(docData.id);
      }
      setLoading(false);
    }
    fetchGift();
  }, [giftId]);

  const presetAmounts = ["$5", "$10", "$15", "$20"];

  const getFinalAmount = () => {
    if (amount === "custom") return customAmount;
    return amount.replace("$", "");
  };

  async function handlePayment() {
    setError("");
    const finalAmount = getFinalAmount();
    if (!finalAmount || isNaN(Number(finalAmount)) || Number(finalAmount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!name || !email) {
      setError("Please enter your name and email.");
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: giftId,
          docId,
          amount: finalAmount,
          contributorName: name,
          contributorEmail: email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPaid(true);
      } else {
        setError(data.error || "Payment failed. Please try again.");
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setPaying(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!gift) return <div style={{ padding: 40 }}>Gift not found.</div>;

  const isExpired = new Date() > new Date(gift.deadline);

  if (gift.status === "closed" || gift.status === "fulfilled" || isExpired) {
    return (
      <div style={{ padding: 40, maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
       &ldquo;This gift pool has closed.&rdquo;
        <p>Thank you to everyone who contributed!</p>
      </div>
    );
  }

  if (paid) {
    return (
      <div style={{ padding: 40, maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
        <h2>Thank you for your contribution!</h2>
        <p>You contributed ${getFinalAmount()} toward a gift for {gift.recipientName}.</p>
        <p>A confirmation has been sent to {email}.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "0 auto" }}>
      <h1>Group Gift for {gift.recipientName}</h1>
      {gift.babyGender && <p>👶 {gift.babyGender}</p>}
      {gift.giftNote && <><p style={{ fontStyle: "italic" }}>&ldquo;{gift.giftNote}&rdquo;</p><p>⏰ Pool closes: {new Date(gift.deadline).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p><hr style={{ margin: "24px 0" }} /><h3>Choose your contribution:</h3><div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {presetAmounts.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            style={{
              padding: "10px 20px",
              background: amount === a ? "#333" : "#eee",
              color: amount === a ? "#fff" : "#333",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {a}
          </button>
        ))}
        <button
          onClick={() => setAmount("custom")}
          style={{
            padding: "10px 20px",
            background: amount === "custom" ? "#333" : "#eee",
            color: amount === "custom" ? "#fff" : "#333",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          Custom
        </button>
      </div></>

        }amount === &ldquo;Custom&ldquo;
        <input
          type="number"
          placeholder="Enter amount in USD"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          style={{ padding: 10, fontSize: 16, width: "100%", marginBottom: 16, boxSizing: "border-box" }}
        />
      )

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: 10, fontSize: 16, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
      />
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 10, fontSize: 16, width: "100%", marginBottom: 16, boxSizing: "border-box" }}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button
        onClick={handlePayment}
        disabled={paying}
        style={{
          padding: "14px 28px",
          background: "#333",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 18,
          width: "100%",
        }}
      >
        {paying ? "Processing..." : `Contribute ${amount === "custom" ? (customAmount ? "$" + customAmount : "") : amount}`}
      </button>
    </div>
  );
}