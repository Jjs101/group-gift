import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import crypto from "crypto";
import { Resend } from "resend";
import { nanoid } from "nanoid";



function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
  const hash = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return hash === hmacHeader;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = JSON.parse(rawBody);
  const properties: Record<string, string> = {};
 
  const lineItem = order.line_items?.[0];
  // Only process Group Gift orders
if (lineItem?.product_id?.toString() !== "9989388534061") {
  return NextResponse.json({ message: "Not a group gift order, skipping." });
}
  if (lineItem?.properties) {
    for (const prop of lineItem.properties) {
      properties[prop.name] = prop.value;
    }
  }

  const giftId = nanoid(10);
  const cutoffValue = properties["Cut-off Date - When the link will stop accepting contributions and the gift will be prepared."] || "";
const deadline = cutoffValue ? new Date(cutoffValue) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

  const gift = {
    giftId,
    organizerName: `${order.billing_address?.first_name || order.customer?.first_name || ""} ${order.billing_address?.last_name || order.customer?.last_name || ""}`.trim(),
    organizerEmail: properties["Email where the link should be sent"] || "",
    organizerPhone: properties["Your contact number"] || "",
    recipientName: properties["Name of Gift Recipient"] || "",
    babyGender: properties["Gender"] || "",
    giftNote: properties["Gift note (The names of all contributors will be written on the note.)"] || "",
    chooser: properties["Choose The Gift"] || "",
    deadline: deadline.toISOString(),
    status: "open",
    totalCollected: 0,
    contributorCount: 0,
    createdAt: new Date().toISOString(),
    shopifyOrderId: order.id?.toString() || "",
  };

  await addDoc(collection(db, "gifts"), gift);
 console.log("Gift created, sending email to:", gift.organizerEmail);
  const giftUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/gift/${giftId}`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log("Attempting to send email...");
  await resend.emails.send({
    from: "Baby Boutique Israel <gifts@babyboutiqueisrael.com>",
    to: gift.organizerEmail,
    subject: "Your Group Gift Link is Ready!",
    html: `
      <h2>Hi ${gift.organizerName},</h2>
      <p>Your group gift pool for <strong>${gift.recipientName}</strong> is now open!</p>
      <p>Share this link with your group so they can contribute:</p>
      <p><a href="${giftUrl}">${giftUrl}</a></p>
      <p>The pool closes on <strong>${deadline.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>.</p>
      <p>Once the pool closes we will be in touch to arrange the gift.</p>
      <br/>
      <p>Baby Boutique Israel</p>
    `,
  });

  return NextResponse.json({ success: true, giftId });
}
