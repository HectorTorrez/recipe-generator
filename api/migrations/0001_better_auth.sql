CREATE TABLE `user` (
  `id` text NOT NULL PRIMARY KEY,
  `name` text NOT NULL,
  `email` text NOT NULL UNIQUE,
  `emailVerified` integer NOT NULL,
  `image` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE TABLE `session` (
  `id` text NOT NULL PRIMARY KEY,
  `expiresAt` integer NOT NULL,
  `token` text NOT NULL UNIQUE,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `userId` text NOT NULL REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE `account` (
  `id` text NOT NULL PRIMARY KEY,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `userId` text NOT NULL REFERENCES `user` (`id`) ON DELETE CASCADE,
  `accessToken` text,
  `refreshToken` text,
  `idToken` text,
  `accessTokenExpiresAt` integer,
  `refreshTokenExpiresAt` integer,
  `scope` text,
  `password` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE TABLE `verification` (
  `id` text NOT NULL PRIMARY KEY,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `createdAt` integer,
  `updatedAt` integer
);

CREATE INDEX `session_userId_idx` ON `session` (`userId`);
CREATE INDEX `account_userId_idx` ON `account` (`userId`);
