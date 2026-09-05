"use client";
import { useState } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export default function VoiceTextEntryPage() {
  const s = useErpScreen("ait");
  const [sourceType, setSourceType] = useState<"voice" | "text">("voice");
  const [domain, setDomain] = useState<"business" | "shipping">("business");
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVoiceSubmit = async () => {
    if (!transcript) {
      alert(s.t("error_enter_text", "Please enter transcript or record audio"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/erp/voice-messages/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          originalLanguage: s.lang,
          operationalDomain: domain,
          transcript,
          durationSeconds: duration,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.jobId) alert(`✓ ${s.t("submitted_ok", "Submitted Successfully")}. Job: ${data.jobNo}`);
    } catch (error) {
      alert(`${s.t("error_msg", "Error:")}: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6" dir={s.dir}>
      <h1 className="text-2xl font-bold">{s.t("title", "Voice or Text Entry")}</h1>

      <div className="bg-white p-6 rounded-lg shadow">
        {/* Domain Selection - MANDATORY */}
        <div className="mb-4">
          <label className="block font-semibold mb-2">
            {s.t("domain_required", "Operational Domain (Required)")}
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="business"
                checked={domain === "business"}
                onChange={(e) => setDomain(e.target.value as any)}
                className="mr-2"
              />
              {s.t("domain_business", "Business")}
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="shipping"
                checked={domain === "shipping"}
                onChange={(e) => setDomain(e.target.value as any)}
                className="mr-2"
              />
              {s.t("domain_shipping", "Shipping")}
            </label>
          </div>
        </div>

        {/* Source Type */}
        <div className="mb-4">
          <label className="block font-semibold mb-2">{s.t("source_type", "Type")}</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="voice"
                checked={sourceType === "voice"}
                onChange={(e) => setSourceType(e.target.value as any)}
                className="mr-2"
              />
              🎤 {s.t("type_voice", "Voice")}
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="text"
                checked={sourceType === "text"}
                onChange={(e) => setSourceType(e.target.value as any)}
                className="mr-2"
              />
              ⌨️ {s.t("type_text", "Text")}
            </label>
          </div>
        </div>

        {/* Voice Recording */}
        {sourceType === "voice" && (
          <div className="mb-4 p-4 bg-blue-50 rounded">
            <p className="text-sm text-gray-600 mb-2">
              {isRecording ? `🔴 ${s.t("recording", "Recording...")}` : s.t("click_record", "Click Record to start")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsRecording(!isRecording)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {isRecording ? `⏹️ ${s.t("stop", "Stop")}` : `🎤 ${s.t("stop", "Record")}`}
              </button>
              <span className="py-2 text-sm text-gray-600">
                {s.t("duration", "Duration:")}: {duration}s
              </span>
            </div>
          </div>
        )}

        {/* Transcript */}
        <div className="mb-4">
          <label className="block font-semibold mb-2">
            {sourceType === "voice"
              ? s.t("transcription", "Transcription")
              : s.t("text_instruction", "Text Instruction")}
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              sourceType === "voice"
                ? s.t("placeholder_voice", "Transcription will appear here after recording")
                : s.t("placeholder_text", "Enter your instruction here")
            }
            className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleVoiceSubmit}
          disabled={loading}
          className="w-full px-4 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? s.t("processing", "Processing...") : s.t("submit", "Submit for AI Processing")}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-green-50 p-4 rounded border-l-4 border-green-600">
          <p className="font-semibold">✓ {s.t("submitted_ok", "Submitted Successfully")}</p>
          <p className="text-sm">{s.t("job_no", "Job:")}: {result.jobNo}</p>
          <p className="text-sm">{s.t("status", "Status:")}: {result.nextStep}</p>
        </div>
      )}
    </div>
  );
}
