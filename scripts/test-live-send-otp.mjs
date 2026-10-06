import fetch from "node-fetch";

async function testOtpDelivery() {
  console.log("Testing live WhatsApp 6-digit OTP delivery to +971544816664...");

  try {
    const res = await fetch("http://72.60.209.121/api/erp/whatsapp/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": "erp_session=test" // or session token
      },
      body: JSON.stringify({
        phoneNumber: "00971544816664",
        scope: "super_admin"
      })
    });

    const json = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("Test error:", e);
  }
}

testOtpDelivery();
