CREATE TABLE `auditoria` (
	`id` text PRIMARY KEY NOT NULL,
	`creado` integer NOT NULL,
	`usuario_id` text,
	`usuario_email` text,
	`accion` text NOT NULL,
	`entidad` text,
	`entidad_id` text,
	`detalle` text,
	`ip_hash` text
);
--> statement-breakpoint
CREATE INDEX `auditoria_creado` ON `auditoria` (`creado`);--> statement-breakpoint
CREATE INDEX `auditoria_entidad` ON `auditoria` (`entidad`,`entidad_id`);--> statement-breakpoint
CREATE TABLE `configuracion` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`actualizado` integer NOT NULL,
	`autor` text
);
--> statement-breakpoint
-- Roles finos: el rol "equipo" de antes pasa a "comercial". La tabla usuarios no se recrea (tiene
-- llaves foráneas desde enlaces y sesiones), así que su DEFAULT sigue en 'equipo'; el código
-- siempre envía el rol.
UPDATE `usuarios` SET `rol` = 'comercial' WHERE `rol` = 'equipo';--> statement-breakpoint
ALTER TABLE `sesiones` ADD `id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sesiones_id` ON `sesiones` (`id`);--> statement-breakpoint
UPDATE `sesiones` SET `id` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `id` IS NULL;
