import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Apple guideline 4.2: the iOS shell must really ship the native plugins the ERP calls through
// lib/mobile/native-bridge.ts. Without them every native call silently no-ops (as it did until 2026-11-26).
const read = (p: string) => readFileSync(p, "utf8");

describe("iOS shell (App Store readiness)", () => {
  const pkg = JSON.parse(read("package.json"));
  const packageSwift = read("ios/App/CapApp-SPM/Package.swift");
  const bridge = read("lib/mobile/native-bridge.ts");

  const plugins: Record<string, string> = {
    Camera: "@capacitor/camera",
    PushNotifications: "@capacitor/push-notifications",
    Network: "@capacitor/network",
    StatusBar: "@capacitor/status-bar",
    App: "@capacitor/app",
  };

  it.each(Object.entries(plugins))("%s plugin is a dependency and linked into the Xcode project", (name, npm) => {
    expect(bridge).toContain(`registerPlugin<`);
    expect(bridge).toContain(`("${name}")`);
    expect(pkg.dependencies[npm]).toBeTruthy();
    expect(packageSwift).toContain(`node_modules/${npm}"`);
  });

  it("forwards APNs registration and has the push entitlement", () => {
    expect(read("ios/App/App/AppDelegate.swift")).toContain("capacitorDidRegisterForRemoteNotifications");
    expect(read("ios/App/App/App.entitlements")).toContain("aps-environment");
    expect(read("ios/App/App.xcodeproj/project.pbxproj").match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)).toHaveLength(2);
  });

  it("uses the swipe-back view controller", () => {
    expect(read("ios/App/App/Base.lproj/Main.storyboard")).toContain('customClass="MainViewController" customModule="App"');
    expect(read("ios/App/App/AppDelegate.swift")).toContain("allowsBackForwardNavigationGestures = true");
  });

  it("TestFlight workflow checks every secret before building and targets Production only", () => {
    const wf = read(".github/workflows/ios-testflight.yml");
    for (const s of ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8", "APPLE_TEAM_ID"]) expect(wf).toContain(`secrets.${s}`);
    expect(wf.indexOf("Check required secrets")).toBeLessThan(wf.indexOf("actions/checkout"));
    expect(wf).toContain("mobile-env.mjs production --release");
    expect(wf).toContain("workflow_dispatch");
  });
});

describe("App Store submit workflow", () => {
  it("uses the API key, never stores reviewer credentials and only submits on request", () => {
    const wf = readFileSync(".github/workflows/ios-appstore-submit.yml", "utf8");
    const fastfile = readFileSync("fastlane/Fastfile", "utf8");
    for (const s of ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8", "ASC_REVIEW_EMAIL", "ASC_REVIEW_PASSWORD", "ASC_REVIEW_CODE"]) {
      expect(wf).toContain(`secrets.${s}`);
    }
    expect(wf).toContain("default: false");
    expect(fastfile).toContain('submit = ENV["SUBMIT"] == "true"');
    expect(fastfile).toContain("skip_binary_upload: true");
    expect(readFileSync("fastlane/metadata/en-US/name.txt", "utf8").trim()).toBe("DGT.llc B");
    expect(readFileSync("fastlane/metadata/copyright.txt", "utf8")).toContain("DAMAAN GENERAL TRADING L.L.C");
  });
});
