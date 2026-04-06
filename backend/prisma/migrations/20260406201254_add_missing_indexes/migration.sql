/*
  Warnings:

  - You are about to drop the column `secondaryFilePath` on the `Video` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "matchDate" DATETIME NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "dvwPath" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'own',
    "videoOffset" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "uploadedById" TEXT NOT NULL,
    "teamId" INTEGER,
    "seasonId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Video_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Video_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("createdAt", "deletedAt", "deletedById", "description", "dvwPath", "fileName", "filePath", "fileSize", "id", "matchDate", "matchType", "mimeType", "opponent", "seasonId", "teamId", "thumbnailPath", "title", "updatedAt", "uploadedById", "videoOffset") SELECT "createdAt", "deletedAt", "deletedById", "description", "dvwPath", "fileName", "filePath", "fileSize", "id", "matchDate", "matchType", "mimeType", "opponent", "seasonId", "teamId", "thumbnailPath", "title", "updatedAt", "uploadedById", "videoOffset" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_matchDate_idx" ON "Video"("matchDate");
CREATE INDEX "Video_opponent_idx" ON "Video"("opponent");
CREATE INDEX "Video_teamId_idx" ON "Video"("teamId");
CREATE INDEX "Video_seasonId_idx" ON "Video"("seasonId");
CREATE INDEX "Video_filePath_idx" ON "Video"("filePath");
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
CREATE INDEX "Video_uploadedById_idx" ON "Video"("uploadedById");
CREATE INDEX "Video_deletedAt_matchDate_idx" ON "Video"("deletedAt", "matchDate");
CREATE INDEX "Video_teamId_deletedAt_idx" ON "Video"("teamId", "deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CoachReview_videoId_playerId_idx" ON "CoachReview"("videoId", "playerId");
