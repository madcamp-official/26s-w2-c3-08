// 사운드 설정 — localStorage 저장(기기별), 오디오 엔진이 재생마다 읽는다.
// 설정 화면(S2c, screen-design.md)이 붙을 때 setSfxVolume()/setMuted()만 호출하면 연결 끝.
// BGM은 아직 없지만 필드를 미리 분리해둬 나중에 bgmVolume만 추가하면 되게 함.

export interface AudioSettings {
  sfxVolume: number; // 0~1
  muted: boolean;
}

const STORAGE_KEY = "audioSettings";
const DEFAULTS: AudioSettings = { sfxVolume: 1, muted: false };

let current: AudioSettings = load();

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      sfxVolume: clamp01(typeof parsed.sfxVolume === "number" ? parsed.sfxVolume : DEFAULTS.sfxVolume),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULTS.muted,
    };
  } catch {
    return { ...DEFAULTS }; // 손상된 값이면 기본값(임시방편 아님 — 정상 폴백)
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* localStorage 불가 환경(프라이빗 모드 등) — 설정은 세션 내에서만 유지 */
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

type Listener = (s: AudioSettings) => void;
const listeners = new Set<Listener>();
function notify(): void {
  for (const l of listeners) l(current);
}

/** 설정 UI가 슬라이더/토글 값 초기화 및 실시간 반영에 사용 */
export function onAudioSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAudioSettings(): AudioSettings {
  return current;
}

export function setSfxVolume(v: number): void {
  current = { ...current, sfxVolume: clamp01(v) };
  save();
  notify();
}

export function setMuted(m: boolean): void {
  current = { ...current, muted: m };
  save();
  notify();
}

export function toggleMuted(): boolean {
  setMuted(!current.muted);
  return current.muted;
}

/** 오디오 엔진이 재생 직전에 호출 — 뮤트면 0, 아니면 sfxVolume 배율 */
export function effectiveVolume(): number {
  return current.muted ? 0 : current.sfxVolume;
}
