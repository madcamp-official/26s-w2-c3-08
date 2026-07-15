-- CreateTable
CREATE TABLE `MapLine` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `creatorId` BIGINT NULL,
    `name` VARCHAR(191) NULL,
    `tileLength` SMALLINT NOT NULL,
    `startFlagX` SMALLINT NOT NULL,
    `startFlagY` SMALLINT NOT NULL,
    `endFlagX` SMALLINT NOT NULL,
    `endFlagY` SMALLINT NOT NULL,
    `testPassedAt` DATETIME(3) NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `sourceRoomId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MapLine_creatorId_idx`(`creatorId`),
    INDEX `MapLine_isPublic_testPassedAt_idx`(`isPublic`, `testPassedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MapLinePlacement` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `lineId` BIGINT NOT NULL,
    `assetId` BIGINT NOT NULL,
    `x` SMALLINT NOT NULL,
    `y` SMALLINT NOT NULL,
    `flipX` BOOLEAN NOT NULL DEFAULT false,
    `endX` SMALLINT NULL,
    `endY` SMALLINT NULL,

    INDEX `MapLinePlacement_lineId_idx`(`lineId`),
    INDEX `MapLinePlacement_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Room` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `hostId` BIGINT NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `passwordHash` VARCHAR(191) NULL,
    `maxPlayers` SMALLINT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'lobby',
    `lineCount` SMALLINT NULL,
    `phaseStartedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Room_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomMember` (
    `roomId` BIGINT NOT NULL,
    `userId` BIGINT NOT NULL,
    `finalOrder` SMALLINT NULL,
    `canBuild` BOOLEAN NOT NULL DEFAULT true,
    `lineId` BIGINT NULL,

    PRIMARY KEY (`roomId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RaceResult` (
    `roomId` BIGINT NOT NULL,
    `userId` BIGINT NOT NULL,
    `finishMs` INTEGER NULL,
    `finalX` INTEGER NULL,
    `rank` SMALLINT NOT NULL,

    PRIMARY KEY (`roomId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MapLine` ADD CONSTRAINT `MapLine_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MapLinePlacement` ADD CONSTRAINT `MapLinePlacement_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `MapLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MapLinePlacement` ADD CONSTRAINT `MapLinePlacement_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomMember` ADD CONSTRAINT `RoomMember_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RaceResult` ADD CONSTRAINT `RaceResult_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
