import { VoiceContextInterpreter } from "../lib/services/voice-context-interpreter";

console.log("=== RUNNING VOICE CONTEXT INTERPRETER TESTS ===");

// Test 1: Exact screenshot phrase on New Account Setup
const phrase1 = "ki degree mein united branch mein ek achcha sa code banana hai kis tarah banaa";
const res1 = VoiceContextInterpreter.interpret(phrase1, "accounts", "ur");
console.log("\n[TEST 1] Screenshot phrase on New Account Setup:");
console.log("Transcript:", phrase1);
console.log("Context:", res1.context);
console.log("Action:", res1.interpretedAction);
console.log("Confidence:", res1.confidence);
console.log("Is Guidance:", res1.isGuidance);
console.log("Guidance Title:", res1.guidanceTitle);
console.log("Guidance Steps:", res1.guidanceSteps);
console.log("Extracted Fields:", res1.extractedFields);
console.log("Warnings:", res1.warnings);

if (res1.interpretedAction === "create_purchase_order_draft") {
  console.error("FAIL: Produced create_purchase_order_draft!");
  process.exit(1);
} else {
  console.log("PASS: Did NOT map to purchase order. Isolated to accounts!");
}

// Test 2: Creating an account by voice
const phrase2 = "new account Quetta Logistics in United Branch code 1045 category asset";
const res2 = VoiceContextInterpreter.interpret(phrase2, "accounts", "en");
console.log("\n[TEST 2] Account creation voice:");
console.log("Action:", res2.interpretedAction);
console.log("Fields:", res2.extractedFields);
if (res2.interpretedAction !== "create_account_draft") {
  console.error("FAIL: Expected create_account_draft!");
  process.exit(1);
} else {
  console.log("PASS: Successfully created account draft!");
}

// Test 3: Purchase context remains intact for purchase
const phrase3 = "purchase 100 bags walnuts from Haji Sultan for USD 5000";
const res3 = VoiceContextInterpreter.interpret(phrase3, "purchase", "en");
console.log("\n[TEST 3] Purchase voice:");
console.log("Action:", res3.interpretedAction);
console.log("Fields:", res3.extractedFields);
if (res3.interpretedAction !== "create_purchase_order_draft") {
  console.error("FAIL: Expected create_purchase_order_draft in purchase context!");
  process.exit(1);
} else {
  console.log("PASS: Purchase context correctly produces purchase order draft!");
}

console.log("\nALL CONTEXT ISOLATION TESTS PASSED!");
