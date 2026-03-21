import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { Resend } from "resend";



export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const q = query(
    collection(db, "gifts"),
    where("status", "==", "open"),
    where("deadline", "<=", now)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return NextResponse.json({ message: "No expired gifts found." });
  }

  for (const giftDoc of snapshot.docs) {
    const gift = giftDoc.data();

    // Get all contributions
    const contribSnapshot = await getDocs(
      collection(db, "gifts", giftDoc.id, "contributions")
    );

    const contributions = contribSnapshot.docs.map((d) => d.data());

    const breakdown = contributions
      .map((c) => `${c.contributorName} — ${c.contributorEmail} — $${parseFloat(c.amount).toFixed(2)}`)
      .join("<br/>");

    const chooserText =
      gift.chooser?.toLowerCase().includes("contact")
        ? `⚠️ <strong>Contact organizer to select gift</strong>`
        : `Store selects gift`;
     const resend = new Resend(process.env.RESEND_API_KEY);
    // Email to you
    await resend.emails.send({
      from: "Baby Boutique Israel <gifts@babyboutiqueisrael.com>",
      to: process.env.MY_EMAIL!,
      subject: `Gift Pool Closed — ${gift.recipientName}`,
      html: `
        <h2>Gift Pool Closed — Action Required</h2>
        <table>
          <tr><td><strong>Recipient:</strong></td><td>${gift.recipientName}</td></tr>
          <tr><td><strong>Gender:</strong></td><td>${gift.babyGender}</td></tr>
          <tr><td><strong>Organizer:</strong></td><td>${gift.organizerName}</td></tr>
          <tr><td><strong>Organizer Email:</strong></td><td>${gift.organizerEmail}</td></tr>
          <tr><td><strong>Organizer Phone:</strong></td><td>${gift.organizerPhone}</td></tr>
          <tr><td><strong>Gift Selection:</strong></td><td>${chooserText}</td></tr>
          <tr><td><strong>Total Collected:</strong></td><td>$${parseFloat(gift.totalCollected).toFixed(2)}</td></tr>
          <tr><td><strong>Contributors:</strong></td><td>${gift.contributorCount}</td></tr>
        </table>
        <h3>Breakdown:</h3>
        <p>${breakdown || "No contributions recorded."}</p>
        <br/>
        <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin">Go to Admin</a></p>
      `,
    });

    // Email to organizer
    await resend.emails.send({
      from: "Baby Boutique Israel <gifts@babyboutiqueisrael.com>",
      to: gift.organizerEmail,
      subject: `Your Group Gift Pool for ${gift.recipientName} Has Closed`,
      html: `
        <h2>Hi ${gift.organizerName},</h2>
        <p>Your group gift pool for <strong>${gift.recipientName}</strong> has now closed.</p>
        <p>The group contributed a total of <strong>$${parseFloat(gift.totalCollected).toFixed(2)}</strong>.</p>
        <p>Baby Boutique Israel will be in touch shortly to arrange the gift.</p>
        <br/>
        <p>Thank you for using Baby Boutique Israel!</p>
      `,
    });

    // Update gift status to closed
    await updateDoc(doc(db, "gifts", giftDoc.id), {
      status: "closed",
    });
  }

  return NextResponse.json({ message: `Processed ${snapshot.size} expired gifts.` });
}