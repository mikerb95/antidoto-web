CREATE TABLE `conversaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`creada` integer NOT NULL,
	`actualizada` integer NOT NULL,
	`locale` text NOT NULL,
	`pagina_inicial` text,
	`pagina_ultima` text,
	`origen` text,
	`servicio` text,
	`preguntas` integer DEFAULT 0 NOT NULL,
	`whatsapp` integer,
	`cotizador` integer,
	`guardia` integer DEFAULT 0 NOT NULL,
	`negativa` integer DEFAULT 0 NOT NULL,
	`vueltas` integer DEFAULT 0 NOT NULL,
	`tokens_entrada` integer DEFAULT 0 NOT NULL,
	`tokens_salida` integer DEFAULT 0 NOT NULL,
	`cache_lectura` integer DEFAULT 0 NOT NULL,
	`cache_escritura` integer DEFAULT 0 NOT NULL,
	`costo_usd` real DEFAULT 0 NOT NULL,
	`ip_hash` text,
	`lead_id` text,
	`expira` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conv_actualizada` ON `conversaciones` (`actualizada`);--> statement-breakpoint
CREATE INDEX `conv_expira` ON `conversaciones` (`expira`);--> statement-breakpoint
CREATE INDEX `conv_servicio` ON `conversaciones` (`servicio`,`actualizada`);--> statement-breakpoint
CREATE TABLE `conversacion_mensajes` (
	`id` text PRIMARY KEY NOT NULL,
	`conversacion_id` text NOT NULL,
	`n` integer NOT NULL,
	`rol` text NOT NULL,
	`texto` text NOT NULL,
	`creado` integer NOT NULL,
	`herramientas` text,
	`whatsapp` text,
	`respaldo` text,
	`tema` text,
	`tokens_entrada` integer,
	`tokens_salida` integer,
	`costo_usd` real,
	FOREIGN KEY (`conversacion_id`) REFERENCES `conversaciones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `convmsg_n` ON `conversacion_mensajes` (`conversacion_id`,`n`);--> statement-breakpoint
ALTER TABLE `gasto_asesor` ADD `conversaciones` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gasto_asesor` ADD `preguntas` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gasto_asesor` ADD `derivaciones` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gasto_asesor` ADD `guardia` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `conversacion_id` text;