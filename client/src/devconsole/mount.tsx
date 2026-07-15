// 개발자 콘솔을 앱과 독립된 루트에 마운트한다.
// main.tsx의 정적 가드(import.meta.env.DEV ...)가 false면 이 파일과
// 콘솔·게임·네트워크 코드 전부가 프로덕션 번들에서 제외된다.
import { createRoot } from "react-dom/client";
import { Console } from "./Console.js";
import "./raceCommands.js";   // race 명령 자기 등록 (commands.ts 비침습)
import "./lineCommands.js";   // lines 명령 자기 등록

export function mountDevConsole(): void {
  const el = document.createElement("div");
  el.id = "devconsole-root";
  document.body.appendChild(el);
  createRoot(el).render(<Console />);
  console.info("[devconsole] ` 키로 콘솔을 열 수 있습니다.");
}
