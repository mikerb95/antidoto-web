CREATE TABLE `campanas` (
	`id` text PRIMARY KEY NOT NULL,
	`asunto` text NOT NULL,
	`preheader` text,
	`cuerpo` text NOT NULL,
	`locale` text NOT NULL,
	`intereses` text DEFAULT '[]' NOT NULL,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`autor` text NOT NULL,
	`creada` integer NOT NULL,
	`actualizada` integer NOT NULL,
	`iniciada` integer,
	`terminada` integer,
	`base_url` text
);
--> statement-breakpoint
CREATE TABLE `contacto_consentimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`contacto_id` text NOT NULL,
	`version` text NOT NULL,
	`texto` text NOT NULL,
	`aceptado` integer NOT NULL,
	`confirmado` integer,
	`ip_hash` text,
	`user_agent` text,
	`revocado` integer,
	FOREIGN KEY (`contacto_id`) REFERENCES `contactos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ccons_contacto` ON `contacto_consentimientos` (`contacto_id`);--> statement-breakpoint
CREATE TABLE `contactos` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nombre` text,
	`empresa` text,
	`locale` text NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`origen` text NOT NULL,
	`intereses` text DEFAULT '[]' NOT NULL,
	`token` text NOT NULL,
	`lead_id` text,
	`creado` integer NOT NULL,
	`actualizado` integer NOT NULL,
	`confirmacion_enviada` integer,
	`confirmado` integer,
	`baja` integer,
	`motivo_baja` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contactos_email_unique` ON `contactos` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `contactos_token_unique` ON `contactos` (`token`);--> statement-breakpoint
CREATE INDEX `contactos_estado` ON `contactos` (`estado`,`locale`);--> statement-breakpoint
CREATE TABLE `envios` (
	`id` text PRIMARY KEY NOT NULL,
	`campana_id` text NOT NULL,
	`contacto_id` text NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`lote` text,
	`reclamado` integer,
	`resend_id` text,
	`enviado` integer,
	`entregado` integer,
	`abierto` integer,
	`clic` integer,
	`rebote` integer,
	`queja` integer,
	`baja` integer,
	`error` text,
	FOREIGN KEY (`campana_id`) REFERENCES `campanas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contacto_id`) REFERENCES `contactos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `envios_campana_contacto` ON `envios` (`campana_id`,`contacto_id`);--> statement-breakpoint
CREATE INDEX `envios_estado` ON `envios` (`estado`,`campana_id`);--> statement-breakpoint
CREATE INDEX `envios_resend` ON `envios` (`resend_id`);