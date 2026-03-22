import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, increment } from "firebase/firestore";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { giftId, docId, amount, contributorName, contributorEmail, opaqueData } = await req.json();

  try {
    const APIContrId = process.env.AUTHORIZENET_API_LOGIN_ID!;
    const TransKey = process.env.AUTHORIZENET_TRANSACTION_KEY!;
    const isProduction = process.env.AUTHORIZENET_ENV === "production";

    const endpoint = isProduction
      ? "https://api.authorize.net/xml/v1/request.api"
      : "https://apitest.authorize.net/xml/v1/request.api";

    // First charge the card
    const payload = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: APIContrId,
          transactionKey: TransKey,
        },
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: parseFloat(amount).toFixed(2),
          payment: {
            opaqueData: {
              dataDescriptor: opaqueData.dataDescriptor,
              dataValue: opaqueData.dataValue,
            },
          },
        },
      },
    };

    const authResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const authResult = await authResponse.json();
    console.log("Authorize.net response:", JSON.stringify(authResult));

    const transResult = authResult.transactionResponse;

    if (!transResult || transResult.responseCode !== "1") {
      const errMsg = transResult?.errors?.[0]?.errorText || "Payment declined.";
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    // Payment succeeded — now record in Firestore
    const giftRef = doc(db, "gifts", docId);
    await addDoc(collection(db, "gifts", docId, "contributions"), {
      contributorName,
      contributorEmail,
      amount: parseFloat(amount),
      transactionId: transResult.transId,
      paidAt: new Date().toISOString(),
    });

    await updateDoc(giftRef, {
      totalCollected: increment(parseFloat(amount)),
      contributorCount: increment(1),
    });

    // Send confirmation email
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Baby Boutique Israel <gifts@babyboutiqueisrael.com>",
      to: contributorEmail,
      subject: "Thank you for your contribution!",
      html: `
        <h2>Hi ${contributorName},</h2>
        <p>Thank you for your contribution of <strong>$${parseFloat(amount).toFixed(2)}</strong>!</p>
        <p>Your gift contribution has been received and will go toward a special baby gift.</p>
        <br/>
        <p>Baby Boutique Israel</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Payment processing failed." }, { status: 500 });
  }
}