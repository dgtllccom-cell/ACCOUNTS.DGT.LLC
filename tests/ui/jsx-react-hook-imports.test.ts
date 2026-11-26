import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

// .jsx files are not type-checked, so a hook used without importing it (e.g. a bare `useRef(...)`) only fails at
// runtime and takes the whole screen down ("useRef is not defined" on New Sales Booking, 26-Nov). Catch it here.
const HOOKS = ["useState", "useEffect", "useMemo", "useCallback", "useRef", "useContext", "useReducer", "useLayoutEffect", "useId", "useTransition", "useDeferredValue", "useSyncExternalStore", "useImperativeHandle"];

describe("JSX components import every React hook they call", () => {
  const files = ["features", "components", "app"].flatMap(dir => globSync(`${dir}/**/*.jsx`));
  it("finds JSX files to check", () => expect(files.length).toBeGreaterThan(10));
  it.each(files)("%s", file => {
    const source = readFileSync(file, "utf8");
    const reactImports = (source.match(/import[^;]*?from\s+["']react["']/g) ?? []).join(" ");
    const missing = HOOKS.filter(hook =>
      new RegExp(`(?<![\\w.])${hook}\\s*\\(`).test(source)
      && !new RegExp(`\\b${hook}\\b`).test(reactImports)
      && !new RegExp(`(function|const|let)\\s+${hook}\\b`).test(source));
    expect(missing).toEqual([]);
  });
});
