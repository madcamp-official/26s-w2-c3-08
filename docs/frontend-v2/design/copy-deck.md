# Copy Deck

작성일: 2026-07-13  
범위: Frontend V2 visible Korean UI copy source. English screen IDs and internal state names are not user-facing copy.

## 1. Global

| Purpose | Copy |
|---|---|
| app name | 멀티플레이 AI 릴레이 맵 메이커 |
| loading | 불러오는 중 |
| saving | 저장하는 중 |
| retry | 다시 시도 |
| close | 닫기 |
| cancel | 취소 |
| confirm | 확인 |
| back | 돌아가기 |
| leave | 나가기 |
| refresh | 새로고침 |
| edit | 수정하기 |
| create | 만들기 |
| submit | 제출하기 |
| reset | 초기화 |
| empty title | 아직 표시할 항목이 없어요 |
| offline badge | 오프라인 |
| reconnecting badge | 다시 연결 중 |
| stale badge | 최신 상태가 아닐 수 있어요 |
| mock badge | 로컬 모드 |

## 2. Status Copy

| State | Copy |
|---|---|
| queued | 대기 중 |
| queued estimate | 대기 중 · 예상 {range} |
| generating | 생성 중 |
| generating estimate | 생성 중 · 남은 시간 약 {minutes}분 |
| ready | 사용 가능 |
| failed | 생성 실패 |
| cooldown | {time} 후 다시 시도 가능 |
| loading rooms | 방 목록을 불러오는 중 |
| loading assets | 에셋을 불러오는 중 |
| submitting | 제출 중 |
| submitted | 제출 완료 |
| locked | 잠김 |
| dirty | 변경됨 |
| unchanged | 변경 사항 없음 |

## 3. Error Copy

| Error kind | Copy |
|---|---|
| validation | 입력값을 확인해주세요. |
| authentication | 세션이 만료되었어요. 다시 시작해주세요. |
| authorization | 권한이 없거나 비밀번호가 맞지 않아요. |
| not_found | 대상을 찾을 수 없어요. 새로고침 후 다시 시도해주세요. |
| conflict | 현재 상태에서는 진행할 수 없어요. |
| rate_limit | 잠시 후 다시 시도할 수 있어요. |
| asset_job_failure | 에셋 생성에 실패했어요. 다시 시도할 수 있어요. |
| offline | 네트워크에 연결되지 않았어요. 원격 기능을 사용할 수 없어요. |
| reconnecting | 서버와 다시 연결하고 있어요. 잠시만 기다려주세요. |
| server_unavailable | 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요. |
| malformed_response | 서버 응답 형식이 올바르지 않아요. |
| drawing_export | 그림을 내보낼 수 없어요. 다시 시도해주세요. |
| paste_blocked | 이미지 붙여넣기는 사용할 수 없어요. 직접 그려주세요. |
| drop_blocked | 이미지 파일을 가져올 수 없어요. 직접 그려주세요. |

## 4. S1 Login

| Element | Copy |
|---|---|
| title | 닉네임을 정해주세요 |
| subtitle | 같은 닉네임도 사용할 수 있어요. 기기는 세션으로 구분됩니다. |
| nickname label | 닉네임 |
| nickname placeholder | 1~12자 |
| submit | 시작하기 |
| restore loading | 저장된 세션을 확인하는 중 |
| empty error | 닉네임을 입력해주세요. |
| length error | 닉네임은 12자 이하로 입력해주세요. |
| submit error | 시작할 수 없어요. 다시 시도해주세요. |

## 5. S2 Main

| Element | Copy |
|---|---|
| title | 메인 |
| primary CTA | 게임하기 |
| asset CTA | 에셋 만들기 |
| warehouse CTA | 내 창고 |
| settings label | 설정 열기 |
| avatar panel title | 장착한 아바타 |
| default avatar | 기본 아바타 · 졸라맨 |
| avatar generating | 아바타 생성 중 · 예상 {range} |
| avatar failed | 아바타 생성 실패 |
| open avatar warehouse | 아바타 창고 열기 |

## 6. S2b Warehouse

| Element | Copy |
|---|---|
| title | 내 창고 |
| avatar tab | 아바타 |
| component tab | 컴포넌트 에셋 |
| all filter | 전체 |
| platform filter | 플랫폼 |
| obstacle filter | 장애물 |
| monster filter | 몬스터 |
| background filter | 배경 |
| summary total | 내가 만든 에셋 {count}개 |
| summary ready | 사용 가능 {count}개 |
| summary working | 작업 중 {count}개 |
| summary failed | 실패 {count}개 |
| empty avatar | 아직 만든 아바타가 없어요. |
| empty component | 아직 만든 컴포넌트 에셋이 없어요. |
| create avatar | 아바타 만들기 |
| create component | 에셋 만들기 |
| equip avatar | 장착 |
| equipped | 장착 중 |
| regenerate action | 재생성 |
| edit source | 그림·속성 수정하기 |
| retry failed | 다시 시도 |
| asset unavailable | 생성이 끝난 뒤 사용할 수 있어요. |

## 7. S2c Settings

| Element | Copy |
|---|---|
| title | 설정 |
| sound section | 소리 |
| bgm volume | BGM 볼륨 |
| sfx volume | 효과음 볼륨 |
| mute | 음소거 |
| nickname section | 닉네임 변경 |
| nickname save | 닉네임 저장 |
| device section | 기기 연동 |
| issue code | 연동 코드 발급 |
| issued code label | 연동 코드 |
| issued code helper | 5분 안에 다른 기기에서 입력해주세요. |
| consume placeholder | 예: TIGER-3392 |
| consume code | 코드로 불러오기 |
| invalid code | 사용할 수 없는 코드예요. |
| expired code | 만료된 코드예요. 새 코드를 발급해주세요. |
| local only disabled | 오프라인 상태에서는 기기 연동을 사용할 수 없어요. |

## 8. A Avatar Studio

| Element | Copy |
|---|---|
| title | 아바타 만들기 |
| tool pen | 펜 |
| tool eraser | 지우개 |
| tool eyedropper | 스포이드 |
| tool move | 전체 이동 |
| undo | 실행취소 |
| redo | 다시실행 |
| clear | 전체지우기 |
| brush size | 굵기 |
| opacity | 불투명도 |
| checker light | 밝은 체커 |
| checker dark | 어두운 체커 |
| grid toggle | 격자 표시 |
| description label | 설명 |
| description placeholder | 어떤 캐릭터인지 적어주세요 |
| submit | 생성하기 |
| my avatars | 내 아바타 |
| load avatar | 불러와서 수정 |
| unchanged blocked | 변경한 뒤 생성할 수 있어요. |
| submit success | 아바타 생성을 요청했어요. |
| submit route note | 진행 상태는 메인에서 확인할 수 있어요. |

## 9. B Asset Studio

| Element | Copy |
|---|---|
| title | 에셋 스튜디오 |
| load asset | 에셋 불러오기 |
| load mine | 내가 만든 |
| load others | 남이 만든 |
| name label | 이름 |
| name placeholder | 에셋 이름 |
| description label | 설명 |
| description placeholder | 어떤 에셋인지 적어주세요 |
| category label | 카테고리 |
| size label | 크기 |
| width label | 가로 |
| height label | 세로 |
| attrs label | 속성 |
| submit | 만들기 |
| new asset | 새 에셋 만들기 |
| success toast title | 에셋 생성을 요청했어요. |
| success toast action | 창고에서 진행 상황 보기 |
| missing name | 이름을 입력해주세요. |
| unchanged blocked | 그림이나 속성을 수정한 뒤 저장할 수 있어요. |
| item hidden | 아이템은 시스템 제공 에셋으로만 사용할 수 있어요. |

## 10. S3 Lobby

| Element | Copy |
|---|---|
| title | 로비 |
| refresh rooms | 방 목록 새로고침 |
| quick join | 공개방 빠른 입장 |
| create room title | 방 만들기 |
| room name label | 방 이름 |
| room name placeholder | 방 이름 |
| public room | 공개방 |
| private room | 비공개방 |
| password label | 비밀번호 |
| password placeholder | 비밀번호 |
| create room | 방 만들기 |
| creating room | 방 만드는 중 |
| no rooms | 입장 가능한 방이 없어요. |
| no public room | 입장 가능한 공개방이 없습니다. |
| full room | 정원이 찼어요. |
| playing room | 게임 중 · {elapsed} |
| password modal title | 비공개방 입장 |
| join room | 입장하기 |
| password error | 비밀번호를 확인해주세요. |

## 11. C Room Lobby

| Element | Copy |
|---|---|
| title | 방 대기실 |
| ready | 준비 |
| cancel ready | 준비 취소 |
| start | 제작 시작 |
| host | 방장 |
| local player | 나 |
| empty slot | 빈 자리 |
| not enough players | 최소 2명이 필요해요. |
| mock override | 로컬 보조 플레이어로 시연할 수 있어요. |
| waiting host | 방장이 시작할 때까지 기다려주세요. |
| leave room | 로비로 나가기 |

## 12. S4 Map Build

| Element | Copy |
|---|---|
| title | 맵 제작 |
| timer | 남은 시간 |
| budget | 비용 |
| asset shelf | 에셋 창고 |
| frequent assets | 자주 쓴 에셋 |
| tool select | 선택 |
| tool move | 이동 |
| tool erase | 삭제 |
| test map | 테스트 하기 |
| submit segment | 제작 완료 |
| add time | +15초 |
| reduce time | -15초 |
| vote pending | 투표 중 |
| placement overlap | 다른 에셋과 겹쳐요. |
| placement budget | 배치 비용을 초과했어요. |
| endpoint invalid | 시작점과 끝점 높이 차이가 너무 커요. |
| locked | 제출한 맵은 수정할 수 없어요. |
| build test title | 맵 테스트 |

## 13. D Validation

| Element | Copy |
|---|---|
| title | 검증 |
| no segment | 검증할 맵이 없어요. |
| playing | 직접 클리어해보세요. |
| cleared | 클리어 성공 |
| failed | 검증 실패 |
| timeout | 시간이 끝났어요. |
| retry playtest | 다시 도전 |
| proceed | 다음 단계로 |
| waiting players | 다른 플레이어를 기다리는 중 |

## 14. M Merging

| Element | Copy |
|---|---|
| title | 맵 병합 |
| merging | 검증된 맵을 이어 붙이는 중 |
| segment count | 검증된 구간 {count}개 |
| fallback | 검증된 구간이 없어 기본 구간을 사용해요. |
| merge error | 맵을 병합할 수 없어요. |

## 15. E Race

| Element | Copy |
|---|---|
| title | 레이스 |
| rank | 순위 |
| progress | 진행도 |
| freeze | 검증 실패 패널티 · {seconds}초 대기 |
| overtime | 연장전 |
| finished | 완주 |
| unfinished | 미완주 |
| remote stale | 다른 플레이어 위치가 최신이 아닐 수 있어요. |
| missing map | 레이스 맵을 불러올 수 없어요. |
| view results | 결과 보기 |

## 16. F Results

| Element | Copy |
|---|---|
| title | 결과 |
| winner | 우승 |
| ranking | 최종 순위 |
| your result | 내 결과 |
| finished time | {time} 완주 |
| unfinished distance | 목표까지 {distance} |
| penalty | 검증 실패 패널티 |
| waiting final | 최종 결과를 기다리는 중 |
| malformed results | 결과 정보를 표시할 수 없어요. |
| leave room | 로비로 나가기 |

## 17. Attribute Copy

| Category | Copy |
|---|---|
| platform | 플랫폼 |
| obstacle | 장애물 |
| monster | 몬스터 |
| background | 배경 |
| collision mode | 충돌 방식 |
| solid collision | 완전 충돌 |
| top only collision | 윗면만 충돌 |
| one way collision | 특정 면만 충돌 |
| activation | 실체화 조건 |
| movement | 이동 방식 |
| shape | 모양 |
| contact reaction | 접촉 반응 |
| contact effect | 접촉 효과 |
| trigger | 발동 트리거 |
| movement behavior | 이동·동작 방식 |
| tracking | 추적 방식 |
| stomp reaction | 밟기 반응 |
| health | 생명력 |

## 18. Placeholders

| Field | Placeholder |
|---|---|
| nickname | 1~12자 |
| device code | 예: TIGER-3392 |
| room name | 방 이름 |
| room password | 비밀번호 |
| asset name | 에셋 이름 |
| asset description | 어떤 에셋인지 적어주세요 |
| avatar description | 어떤 캐릭터인지 적어주세요 |
