-- 업로드 소스 지원: 소스 타입 구분 + 원본/정규화본 URL 보존.
-- 기존 행은 전부 캔버스 드로잉이므로 DEFAULT 'drawn'으로 자동 백필.
ALTER TABLE `Asset`
    ADD COLUMN `sourceType` VARCHAR(191) NOT NULL DEFAULT 'drawn',
    ADD COLUMN `rawSourceUrl` VARCHAR(191) NULL,
    ADD COLUMN `normSourceUrl` VARCHAR(191) NULL;
