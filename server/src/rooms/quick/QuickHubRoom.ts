// 간이 매칭 허브 — ?quick 접속자가 전부 여기 모인다(물리·렌더 없음, 인원 집계만).
// startstart(비공개 콘솔): 전원을 최대 4명 그룹으로 쪼개(나머지 1이면 3+2 보정) 그룹마다 RaceRoom(quick)
// 생성 + 좌석 예약 → 각 클라에 배차. 클라는 예약을 소비해 그 방으로 이동, 방은 인원 차면 자동 시작.
// 렉의 주범(한 방 인원)이 레이스 중 최대 4로 고정된다.
import { Room, type Client, matchMaker } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import { QUICK_HUB_MSG, QUICK_STOP_CHANNEL, type GoRacePayload } from "shared/race";

class HubMember extends Schema {
  @type("string") nickname = "";
}
class HubState extends Schema {
  @type({ map: HubMember }) members = new MapSchema<HubMember>();
}

/** N명 → 최대 4 그룹으로, 나머지가 1이 되지 않게 보정(5→[3,2], 9→[4,3,2]). 1명뿐이면 [1]. */
export function partitionSizes(n: number): number[] {
  const out: number[] = [];
  while (n > 0) {
    if (n === 5) { out.push(3); n -= 3; }        // 남은 2가 다음 루프에서 [2]
    else if (n <= 4) { out.push(n); n = 0; }
    else { out.push(4); n -= 4; }
  }
  return out;
}

export class QuickHubRoom extends Room {
  maxClients = 400;
  state = new HubState();
  private tokens = new Map<string, string>();   // sessionId → userToken(좌석 예약용)
  private dispatching = false;

  override onCreate(): void {
    this.setState(new HubState());
    this.autoDispose = false;   // 아무도 없어도 허브는 유지(이벤트 내내 상주)

    this.onMessage(QUICK_HUB_MSG.start, (client) => { void this.dispatch(client); });
    this.onMessage(QUICK_HUB_MSG.stop, () => { void this.presence.publish(QUICK_STOP_CHANNEL, {}); });
  }

  override async onAuth(): Promise<boolean> {
    return true;   // 허브는 누구나 입장(quick 이벤트)
  }

  override onJoin(client: Client, options: { userToken?: string; nickname?: string }): void {
    if (options?.userToken) this.tokens.set(client.sessionId, options.userToken);
    const m = new HubMember();
    m.nickname = options?.nickname ?? "";
    this.state.members.set(client.sessionId, m);
  }

  override onLeave(client: Client): void {
    this.tokens.delete(client.sessionId);
    this.state.members.delete(client.sessionId);
  }

  /** 전원을 그룹으로 나눠 각 그룹마다 quick 레이스 방 생성 + 좌석 예약 → 배차. */
  private async dispatch(_caller: Client): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      // 토큰 있는 클라만 매칭(레이스 방 onAuth가 토큰 필요). 순서는 입장 순.
      const players = this.clients.filter((c) => this.tokens.has(c.sessionId));
      if (players.length === 0) { console.log("[hub] 매칭 대상 없음"); return; }

      const sizes = partitionSizes(players.length);
      console.log(`[hub] startstart — ${players.length}명 → 그룹 ${sizes.join("+")}`);

      let idx = 0;
      for (const size of sizes) {
        const group = players.slice(idx, idx + size);
        idx += size;
        const room = await matchMaker.createRoom("race", { quick: true, autoStartSize: size });
        for (const c of group) {
          const token = this.tokens.get(c.sessionId)!;
          const seat = await matchMaker.reserveSeatFor(room, { userToken: token });
          c.send(QUICK_HUB_MSG.goRace, { reservation: seat } satisfies GoRacePayload);
        }
      }
    } catch (e) {
      console.warn("[hub] 배차 실패:", e instanceof Error ? e.message : e);
    } finally {
      this.dispatching = false;
    }
  }
}
