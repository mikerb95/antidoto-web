ALTER TABLE `usuarios` ADD `github_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_github` ON `usuarios` (`github_id`);