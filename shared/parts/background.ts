// 배경 파츠 (§62): 충돌·상호작용 없음. 반복 연결 옵션만.
export interface BackgroundSpec {
  asset: string;
  mirrorX: boolean;                       // 가로 반복 시 좌우반전 연결
  verticalMode: "mirrorY" | "extendEdge"; // 세로: 상하반전 / 끝부분 연장
}
