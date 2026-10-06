CREATE TABLE `contenido` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`clave` text NOT NULL,
	`datos` text NOT NULL,
	`textos` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`publicada` text,
	`publicada_en` integer,
	`archivada` integer,
	`creado` integer NOT NULL,
	`actualizado` integer NOT NULL,
	`autor` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contenido_tipo_clave` ON `contenido` (`tipo`,`clave`);--> statement-breakpoint
CREATE INDEX `contenido_tipo_act` ON `contenido` (`tipo`,`actualizado`);--> statement-breakpoint
CREATE TABLE `medios` (
	`id` text PRIMARY KEY NOT NULL,
	`clave_r2` text NOT NULL,
	`nombre` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`ancho` integer NOT NULL,
	`alto` integer NOT NULL,
	`creado` integer NOT NULL,
	`autor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `medios_creado` ON `medios` (`creado`);--> statement-breakpoint
CREATE TABLE `publicaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`solicitada` integer NOT NULL,
	`autor` text NOT NULL,
	`destino` text NOT NULL,
	`estado` text NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`disparada` integer,
	`run_url` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `publicaciones_estado` ON `publicaciones` (`estado`,`solicitada`);--> statement-breakpoint
CREATE TABLE `contenido_versiones` (
	`id` text PRIMARY KEY NOT NULL,
	`contenido_id` text NOT NULL,
	`version` integer NOT NULL,
	`datos` text NOT NULL,
	`textos` text NOT NULL,
	`creado` integer NOT NULL,
	`autor` text NOT NULL,
	FOREIGN KEY (`contenido_id`) REFERENCES `contenido`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `versiones_contenido` ON `contenido_versiones` (`contenido_id`,`version`);