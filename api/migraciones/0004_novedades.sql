CREATE TABLE `automaticos` (
	`clave` text PRIMARY KEY NOT NULL,
	`asunto` text NOT NULL,
	`preheader` text,
	`cuerpo` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`actualizado` integer NOT NULL,
	`autor` text
);
--> statement-breakpoint
CREATE TABLE `plantillas` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`asunto` text NOT NULL,
	`preheader` text,
	`cuerpo` text NOT NULL,
	`locale` text NOT NULL,
	`autor` text NOT NULL,
	`creada` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `campanas` ADD `programada` integer;--> statement-breakpoint
ALTER TABLE `campanas` ADD `publica` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campanas` ADD `asunto_b` text;--> statement-breakpoint
ALTER TABLE `campanas` ADD `ab_muestra` integer;--> statement-breakpoint
ALTER TABLE `campanas` ADD `ab_horas` integer;--> statement-breakpoint
ALTER TABLE `campanas` ADD `ab_decision` integer;--> statement-breakpoint
ALTER TABLE `campanas` ADD `ab_ganador` text;--> statement-breakpoint
ALTER TABLE `contactos` ADD `recordatorio` integer;--> statement-breakpoint
ALTER TABLE `contactos` ADD `bienvenida` integer;--> statement-breakpoint
ALTER TABLE `contactos` ADD `pausa_hasta` integer;--> statement-breakpoint
ALTER TABLE `envios` ADD `variante` text;