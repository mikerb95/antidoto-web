CREATE TABLE `consentimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`version` text NOT NULL,
	`texto` text NOT NULL,
	`aceptado` integer NOT NULL,
	`ip_hash` text,
	`user_agent` text,
	`revocado` integer,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `enlaces_acceso` (
	`hash` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`creado` integer NOT NULL,
	`expira` integer NOT NULL,
	`usado` integer,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lead_eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`creado` integer NOT NULL,
	`tipo` text NOT NULL,
	`detalle` text,
	`autor` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `eventos_lead` ON `lead_eventos` (`lead_id`,`creado`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`creado` integer NOT NULL,
	`actualizado` integer NOT NULL,
	`estado` text DEFAULT 'nuevo' NOT NULL,
	`servicio` text NOT NULL,
	`tipo_organizacion` text,
	`fecha` text,
	`personas` integer,
	`ciudad` text,
	`mensaje` text,
	`nombre` text,
	`empresa` text,
	`email` text,
	`telefono` text,
	`locale` text NOT NULL,
	`pagina` text,
	`referente` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`valor_estimado` integer,
	`motivo_perdida` text,
	`notas` text,
	`primera_respuesta` integer,
	`aviso_seguimiento` integer,
	`anonimizado` integer,
	`ip_hash` text
);
--> statement-breakpoint
CREATE INDEX `leads_estado_creado` ON `leads` (`estado`,`creado`);--> statement-breakpoint
CREATE INDEX `leads_ip_creado` ON `leads` (`ip_hash`,`creado`);--> statement-breakpoint
CREATE TABLE `sesiones` (
	`hash` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`creada` integer NOT NULL,
	`expira` integer NOT NULL,
	`ultimo_uso` integer NOT NULL,
	`user_agent` text,
	`revocada` integer,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sesiones_usuario` ON `sesiones` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nombre` text NOT NULL,
	`rol` text DEFAULT 'equipo' NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);