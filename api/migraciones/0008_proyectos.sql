CREATE TABLE `entregable_archivos` (
	`id` text PRIMARY KEY NOT NULL,
	`entregable_id` text NOT NULL,
	`version` integer NOT NULL,
	`clave_r2` text NOT NULL,
	`nombre` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`subido` integer NOT NULL,
	`autor` text NOT NULL,
	FOREIGN KEY (`entregable_id`) REFERENCES `entregables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `archivos_entregable` ON `entregable_archivos` (`entregable_id`);--> statement-breakpoint
CREATE TABLE `proyecto_bitacora` (
	`id` text PRIMARY KEY NOT NULL,
	`proyecto_id` text NOT NULL,
	`creado` integer NOT NULL,
	`autor_tipo` text NOT NULL,
	`autor` text,
	`tipo` text NOT NULL,
	`texto` text,
	`visible_cliente` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bitacora_proy` ON `proyecto_bitacora` (`proyecto_id`,`creado`);--> statement-breakpoint
CREATE TABLE `contactos_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacion_id` text NOT NULL,
	`nombre` text,
	`email` text,
	`telefono` text,
	`cargo` text,
	`creado` integer NOT NULL,
	`anonimizado` integer,
	FOREIGN KEY (`organizacion_id`) REFERENCES `organizaciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ccli_org` ON `contactos_cliente` (`organizacion_id`);--> statement-breakpoint
CREATE INDEX `ccli_email` ON `contactos_cliente` (`email`);--> statement-breakpoint
CREATE TABLE `entregables` (
	`id` text PRIMARY KEY NOT NULL,
	`proyecto_id` text NOT NULL,
	`etapa_id` text,
	`titulo` text NOT NULL,
	`descripcion` text,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`vence` text,
	`visible_cliente` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`aprobado_por` text,
	`aprobado_en` integer,
	`creado` integer NOT NULL,
	`actualizado` integer NOT NULL,
	FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entregables_proy` ON `entregables` (`proyecto_id`);--> statement-breakpoint
CREATE TABLE `proyecto_etapas` (
	`id` text PRIMARY KEY NOT NULL,
	`proyecto_id` text NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`fecha` text,
	FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `etapas_proy` ON `proyecto_etapas` (`proyecto_id`,`orden`);--> statement-breakpoint
CREATE TABLE `organizaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nit` text,
	`sector` text,
	`sitio` text,
	`notas` text,
	`creado` integer NOT NULL,
	`actualizado` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `org_nombre` ON `organizaciones` (`nombre`);--> statement-breakpoint
CREATE TABLE `proyectos` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`organizacion_id` text NOT NULL,
	`lead_id` text,
	`nombre` text NOT NULL,
	`linea` text NOT NULL,
	`estado` text DEFAULT 'planeado' NOT NULL,
	`responsable_id` text,
	`inicio` text,
	`entrega` text,
	`valor` integer,
	`notas` text,
	`mision_url` text,
	`creado` integer NOT NULL,
	`actualizado` integer NOT NULL,
	FOREIGN KEY (`organizacion_id`) REFERENCES `organizaciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proyectos_codigo_unique` ON `proyectos` (`codigo`);--> statement-breakpoint
CREATE INDEX `proy_estado` ON `proyectos` (`estado`,`actualizado`);--> statement-breakpoint
CREATE INDEX `proy_org` ON `proyectos` (`organizacion_id`);--> statement-breakpoint
CREATE TABLE `proyecto_tareas` (
	`id` text PRIMARY KEY NOT NULL,
	`proyecto_id` text NOT NULL,
	`etapa_id` text,
	`titulo` text NOT NULL,
	`responsable_id` text,
	`vence` text,
	`hecha` integer,
	`orden` integer DEFAULT 0 NOT NULL,
	`visible_cliente` integer DEFAULT false NOT NULL,
	`creado` integer NOT NULL,
	FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tareas_proy` ON `proyecto_tareas` (`proyecto_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `organizacion_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `proyecto_id` text;