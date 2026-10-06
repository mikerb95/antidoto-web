CREATE TABLE `enlaces_cliente` (
	`hash` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`creado` integer NOT NULL,
	`expira` integer NOT NULL,
	`usado` integer,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_cliente`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sesiones_cliente` (
	`hash` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`creada` integer NOT NULL,
	`expira` integer NOT NULL,
	`ultimo_uso` integer NOT NULL,
	`user_agent` text,
	`revocada` integer,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios_cliente`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sesiones_cliente_usuario` ON `sesiones_cliente` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `usuarios_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacion_id` text NOT NULL,
	`contacto_id` text,
	`email` text NOT NULL,
	`nombre` text,
	`activo` integer DEFAULT true NOT NULL,
	`creado` integer NOT NULL,
	`ultimo_acceso` integer,
	FOREIGN KEY (`organizacion_id`) REFERENCES `organizaciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_cliente_email_unique` ON `usuarios_cliente` (`email`);--> statement-breakpoint
CREATE INDEX `ucli_org` ON `usuarios_cliente` (`organizacion_id`);