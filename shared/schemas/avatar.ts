// 아바타 attrs — player-spec.md. 크기 1×2타일 고정(수치 입력 없음), 히트박스는 생성 후 자동 산출
// (알파 bbox → Asset.hitboxHPx 컬럼). 유저가 고르는 속성이 없으므로 버전 필드만 둔다(확장 예약).
import { z } from "zod";

export const AvatarAttrs = z.object({
  v: z.literal(1),
});
export type AvatarAttrs = z.infer<typeof AvatarAttrs>;

export const defaultAvatarAttrs = (): AvatarAttrs => ({ v: 1 });
