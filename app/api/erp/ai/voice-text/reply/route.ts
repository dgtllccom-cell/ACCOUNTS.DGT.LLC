import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { userMessage, language } = await request.json();

    if (!userMessage || !language) {
      return NextResponse.json(
        { ok: false, error: "Missing userMessage or language" },
        { status: 400 }
      );
    }

    // Simple AI reply logic - can be extended with more sophisticated responses
    const reply = generateAIReply(userMessage, language);

    return NextResponse.json({
      ok: true,
      reply,
      timestamp: new Date().toISOString(),
      userId: session.userId
    });
  } catch (error) {
    console.error("AI reply error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate reply" },
      { status: 400 }
    );
  }
}

function generateAIReply(message: string, language: string): string {
  // Simple AI response logic
  // In production, this would call an LLM API

  const lowerMessage = message.toLowerCase();

  const replies: Record<string, Record<string, string>> = {
    en: {
      help: "I can help you with account management, voice entries, document processing, and more. What would you like to do?",
      account: "To create a new account, go to Accounts > New Account. You can enter details manually or upload a bulk document.",
      purchase: "For purchase orders, navigate to Purchase > New Entry. I can help analyze documents and extract key information.",
      report: "I can help generate various reports. Which report would you like - Ledger, Balance Sheet, Profit & Loss, or Cash Flow?",
      voice: "Voice entry converts your audio into structured business data. Record your message and I'll analyze it.",
      default: "I understand you're asking about {msg}. Could you provide more details so I can assist better?"
    },
    ur: {
      help: "میں آپ کو اکاؤنٹ مینجمنٹ، آواز کی ترجمہ، اور دستاویز کی کارروائی میں مدد کر سکتا ہوں۔ آپ کیا کرنا چاہتے ہیں؟",
      account: "نیا اکاؤنٹ بنانے کے لیے، اکاؤنٹس > نیا اکاؤنٹ پر جائیں۔",
      purchase: "خریداری کے آرڈرز کے لیے، خریداری > نیا داخلہ پر جائیں۔",
      default: "میں سمجھتا ہوں کہ آپ {msg} کے بارے میں پوچھ رہے ہیں۔"
    },
    ar: {
      help: "يمكنني مساعدتك في إدارة الحسابات ومعالجة المستندات. ماذا تريد أن تفعل؟",
      account: "لإنشاء حساب جديد، انتقل إلى الحسابات > حساب جديد.",
      default: "أفهم أنك تسأل عن {msg}. هل يمكنك تقديم المزيد من التفاصيل؟"
    },
    fa: {
      help: "من می‌توانم به شما در مدیریت حساب‌ها و پردازش اسناد کمک کنم. چه کاری می‌خواهید انجام دهید؟",
      account: "برای ایجاد یک حساب جدید، به حساب‌ها > حساب جدید بروید.",
      default: "من می‌فهمم که شما درباره {msg} سؤال می‌کنید."
    },
    ps: {
      help: "زه کولی مرسته د حساب اداره، د دوکومنتو پروسیسنگ او نورو کارونو کې.",
      account: "نوي حساب رغولو لپاره، حسابونه > نوي حساب ته لاړ شئ.",
      default: "زه پوهیږم چې تاسو {msg} په اړه پوښتنه کوئ۔"
    }
  };

  const langReplies = replies[language] || replies["en"];

  if (lowerMessage.includes("help") || lowerMessage.includes("assist")) {
    return langReplies["help"];
  } else if (lowerMessage.includes("account")) {
    return langReplies["account"];
  } else if (lowerMessage.includes("purchase")) {
    return langReplies["purchase"];
  } else if (lowerMessage.includes("report")) {
    return langReplies["report"];
  } else if (lowerMessage.includes("voice")) {
    return langReplies["voice"];
  }

  return langReplies["default"].replace("{msg}", message.substring(0, 30));
}
