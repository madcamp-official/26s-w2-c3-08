-- 로비 방 목록(REST) 지원: Colyseus room id 보존 + 접속 인원 best-effort 캐시.
ALTER TABLE `Room`
    ADD COLUMN `colyseusRoomId` VARCHAR(191) NULL,
    ADD COLUMN `memberCount` INTEGER NOT NULL DEFAULT 0;
