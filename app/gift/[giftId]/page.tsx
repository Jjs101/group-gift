"use client";
import { useEffect, useState, use } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Image from "next/image";

interface Gift {
  giftId: string;
  organizerName: string;
  recipientName: string;
  babyGender: string;
  giftNote: string;
  deadline: string;
  status: string;
}

declare global {
  interface Window {
    Accept: {
      dispatchData: (data: object, callback: (response: AcceptResponse) => void) => void;
    };
  }
}

interface AcceptResponse {
  messages: {
    resultCode: string;
    message: Array<{ code: string; text: string }>;
  };
  opaqueData?: {
    dataDescriptor: string;
    dataValue: string;
  };
}

export default function GiftPage({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = use(params);
  const [gift, setGift] = useState<Gift | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
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

    const script = document.createElement("script");
    script.src = "https://js.authorize.net/v1/Accept.js";
    script.async = false;
    document.body.appendChild(script);
  }, [giftId]);

  const presetAmounts = ["$18", "$36", "$54", "$100"];

  const getFinalAmount = () => {
    if (amount === "custom") return customAmount;
    return amount.replace("$", "");
  };

  async function handlePayment() {
    setError("");
    const finalAmount = getFinalAmount();
    if (!finalAmount || isNaN(Number(finalAmount)) || Number(finalAmount) <= 0) {
      setError("Please select or enter a valid amount.");
      return;
    }
    if (!name || !email) {
      setError("Please enter your name and email.");
      return;
    }
    if (!cardNumber || !expMonth || !expYear || !cvv) {
      setError("Please enter your card details.");
      return;
    }
    setPaying(true);

    const authData = {
      clientKey: process.env.NEXT_PUBLIC_AUTHORIZENET_PUBLIC_KEY!,
      apiLoginID: process.env.NEXT_PUBLIC_AUTHORIZENET_LOGIN_ID!,
    };

    const cardData = {
      cardNumber: cardNumber.replace(/\s/g, ""),
      month: expMonth,
      year: expYear,
      cardCode: cvv,
    };

    window.Accept.dispatchData({ authData, cardData }, async (response: AcceptResponse) => {
      if (response.messages.resultCode === "Error") {
        setError(response.messages.message[0].text);
        setPaying(false);
        return;
      }

      const opaqueData = response.opaqueData;

      try {
        const res = await fetch("/api/contribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            giftId,
            docId,
            amount: finalAmount,
            contributorName: name,
            contributorEmail: email,
            opaqueData,
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
    });
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#faf9f7",
    fontFamily: "'Georgia', serif",
  };

  const headerStyle: React.CSSProperties = {
    background: "#ffffff",
    borderBottom: "1px solid #e8e0f0",
    padding: "20px 0",
    textAlign: "center",
    marginBottom: 0,
  };

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 2px 20px rgba(123, 107, 168, 0.08)",
    padding: "36px 40px",
    maxWidth: 520,
    margin: "40px auto",
    border: "1px solid #ede8f5",
  };

  const inputStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: 15,
    width: "100%",
    marginBottom: 12,
    boxSizing: "border-box",
    border: "1px solid #ddd6ef",
    borderRadius: 10,
    fontFamily: "'Georgia', serif",
    color: "#333",
    background: "#fdfcff",
    outline: "none",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#9b8bbf",
    marginBottom: 14,
    marginTop: 24,
  };

  const dividerStyle: React.CSSProperties = {
    border: "none",
    borderTop: "1px solid #ede8f5",
    margin: "24px 0",
  };

  if (loading) return (
    <div style={pageStyle}>
      <div style={{ textAlign: "center", paddingTop: 100, color: "#9b8bbf" }}>Loading...</div>
    </div>
  );

  if (!gift) return (
    <div style={pageStyle}>
      <div style={{ textAlign: "center", paddingTop: 100, color: "#9b8bbf" }}>Gift not found.</div>
    </div>
  );

  const isExpired = new Date() > new Date(gift.deadline);

  if (gift.status === "closed" || gift.status === "fulfilled" || isExpired) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <Image src="/logo.png" alt="Baby Boutique Israel" width={160} height={80} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
          <h2 style={{ color: "#7B6BA8", marginBottom: 8 }}>This gift link has expired.</h2>
          <p style={{ color: "#888" }}>Thank you to everyone who contributed!</p>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <Image src="/logo.png" alt="Baby Boutique Israel" width={160} height={80} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💜</div>
          <h2 style={{ color: "#7B6BA8", marginBottom: 8 }}>Thank you for your contribution!</h2>
          <p style={{ color: "#555" }}>You contributed <strong>${getFinalAmount()}</strong> toward a gift for <strong>{gift.recipientName}</strong>.</p>
          <p style={{ color: "#888", fontSize: 14 }}>A confirmation has been sent to {email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <Image src="/logo.png" alt="Baby Boutique Israel" width={160} height={80} style={{ objectFit: "contain" }} />
      </div>

      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, color: "#3d3456", marginBottom: 6, fontWeight: 600 }}>
          Group Gift for {gift.recipientName}
        </h1>
        <p style={{ color: "#9b8bbf", fontSize: 14, marginBottom: 0 }}>
          🕐 This link will expire on: <strong>{new Date(gift.deadline).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>
        </p>

        <hr style={dividerStyle} />

        <p style={sectionLabel}>Choose your contribution</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          {presetAmounts.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              style={{
                padding: "10px 20px",
                background: amount === a ? "#7B6BA8" : "#f3f0f9",
                color: amount === a ? "#fff" : "#7B6BA8",
                border: "2px solid",
                borderColor: amount === a ? "#7B6BA8" : "#ddd6ef",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 15,
                fontFamily: "'Georgia', serif",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {a}
            </button>
          ))}
          <button
            onClick={() => setAmount("custom")}
            style={{
              padding: "10px 20px",
              background: amount === "custom" ? "#7B6BA8" : "#f3f0f9",
              color: amount === "custom" ? "#fff" : "#7B6BA8",
              border: "2px solid",
              borderColor: amount === "custom" ? "#7B6BA8" : "#ddd6ef",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 15,
              fontFamily: "'Georgia', serif",
              fontWeight: 600,
            }}
          >
            Custom
          </button>
        </div>

        {amount === "custom" && (
          <input
            type="number"
            placeholder="Enter amount in USD"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            style={{ ...inputStyle, marginTop: 12 }}
          />
        )}

        <hr style={dividerStyle} />
        <p style={sectionLabel}>Your details</p>

        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <hr style={dividerStyle} />
        <p style={sectionLabel}>Payment details</p>

        <input
          type="text"
          placeholder="Card number"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          style={inputStyle}
          maxLength={19}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            placeholder="MM"
            value={expMonth}
            onChange={(e) => setExpMonth(e.target.value)}
            style={{ ...inputStyle, width: "30%" }}
            maxLength={2}
          />
          <input
            type="text"
            placeholder="YYYY"
            value={expYear}
            onChange={(e) => setExpYear(e.target.value)}
            style={{ ...inputStyle, width: "40%" }}
            maxLength={4}
          />
          <input
            type="text"
            placeholder="CVV"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            style={{ ...inputStyle, width: "30%" }}
            maxLength={4}
          />
        </div>

        {error && (
          <p style={{ color: "#c0392b", fontSize: 14, marginTop: 4, background: "#fdf0ef", padding: "10px 14px", borderRadius: 8 }}>
            {error}
          </p>
        )}

        <button
          onClick={handlePayment}
          disabled={paying}
          style={{
            padding: "15px 28px",
            background: paying ? "#b8acd8" : "#7B6BA8",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: paying ? "not-allowed" : "pointer",
            fontSize: 17,
            width: "100%",
            marginTop: 16,
            fontFamily: "'Georgia', serif",
            fontWeight: 600,
            letterSpacing: "0.02em",
            transition: "background 0.2s",
          }}
        >
          {paying ? "Processing..." : `Contribute ${amount === "custom" ? (customAmount ? "$" + customAmount : "") : amount}`}
        </button>

        <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginTop: 14 }}>
          🔒 Payments are processed securely. Your card details are never stored.
        </p>
      </div>

      <p style={{ textAlign: "center", color: "#bbb", fontSize: 12, paddingBottom: 40 }}>
        © Baby Boutique Israel
      </p>
    </div>
  );
}