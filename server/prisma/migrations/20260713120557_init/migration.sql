-- CreateTable
CREATE TABLE `User` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(20) NOT NULL,
    `token` CHAR(36) NOT NULL,
    `avatarAssetId` BIGINT NULL,
    `deviceLinkCode` VARCHAR(191) NULL,
    `deviceLinkExpiresAt` DATETIME(3) NULL,
    `equippedSkillId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `creatorId` BIGINT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `category` VARCHAR(191) NOT NULL,
    `name` VARCHAR(30) NOT NULL,
    `description` VARCHAR(191) NULL,
    `attrs` JSON NOT NULL,
    `colliderType` VARCHAR(191) NOT NULL DEFAULT 'rect',
    `slopeDir` VARCHAR(191) NULL,
    `widthCells` SMALLINT NULL,
    `heightCells` SMALLINT NULL,
    `hitboxHPx` SMALLINT NULL,
    `sourceImageUrl` VARCHAR(191) NOT NULL,
    `projectileImageUrl` VARCHAR(191) NULL,
    `remixOfId` BIGINT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Asset_creatorId_idx`(`creatorId`),
    INDEX `Asset_isSystem_idx`(`isSystem`),
    INDEX `Asset_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetSprite` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assetId` BIGINT NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `prompt` TEXT NULL,
    `sheetUrl` VARCHAR(191) NULL,
    `frameCount` SMALLINT NULL,
    `frameW` SMALLINT NULL,
    `frameH` SMALLINT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `claimedAt` DATETIME(3) NULL,
    `attempts` SMALLINT NOT NULL DEFAULT 0,
    `errorMsg` VARCHAR(191) NULL,
    `lastRegenAt` DATETIME(3) NULL,
    `priority` SMALLINT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssetSprite_status_priority_idx`(`status`, `priority`),
    UNIQUE INDEX `AssetSprite_assetId_action_key`(`assetId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_avatarAssetId_fkey` FOREIGN KEY (`avatarAssetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_remixOfId_fkey` FOREIGN KEY (`remixOfId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetSprite` ADD CONSTRAINT `AssetSprite_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
