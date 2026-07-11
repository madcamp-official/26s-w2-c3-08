// 개발자 콘솔 UI. ` (백틱) 으로 열고 닫는다.
// 프로덕션 빌드에서는 mount.ts의 정적 가드로 이 파일 전체가 번들에서 제외된다.
import { useEffect, useRef, useState } from "react";
import { execute } from "./commands.js";

const S = {
  wrap: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000,
    background: "rgba(10,10,16,0.92)", color: "#d8d8e0",
    fontFamily: "Consolas, monospace", fontSize: 13,
    borderBottom: "1px solid #444", padding: "8px 12px",
    maxHeight: "45vh", display: "flex", flexDirection: "column",
  } as React.CSSProperties,
  log: { overflowY: "auto", whiteSpace: "pre-wrap", flex: 1 } as React.CSSProperties,
  inputRow: { display: "flex", gap: 6, marginTop: 6 } as React.CSSProperties,
  prompt: { color: "#7fbf7f" } as React.CSSProperties,
  input: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#fff", fontFamily: "inherit", fontSize: "inherit",
  } as React.CSSProperties,
};

export function Console() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>(["baseworld 개발자 콘솔 — help 로 명령 확인"]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [lines]);

  const print = (line: string) => setLines((ls) => [...ls, line]);

  const onSubmit = async () => {
    const raw = value.trim();
    setValue("");
    if (!raw) return;
    print(`> ${raw}`);
    setHistory((h) => [raw, ...h]);
    setHistIdx(-1);
    const result = await execute(raw, { print });
    if (result === "clear") setLines([]);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // 게임 씬으로 키 전파 방지
    if (e.key === "`") {
      // 입력창에 ` 가 찍히지 않게 하고 콘솔을 닫는다
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Enter") void onSubmit();
    else if (e.key === "ArrowUp") {
      const i = Math.min(histIdx + 1, history.length - 1);
      if (history[i] !== undefined) { setHistIdx(i); setValue(history[i]); }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      const i = histIdx - 1;
      setHistIdx(i);
      setValue(i < 0 ? "" : history[i]);
      e.preventDefault();
    }
  };

  if (!open) return null;
  return (
    <div style={S.wrap}>
      <div ref={logRef} style={S.log}>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={S.inputRow}>
        <span style={S.prompt}>&gt;</span>
        <input
          ref={inputRef}
          style={S.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onInputKey}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
