import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import inquirer from "inquirer";
import { gql } from "../api";

export function registerServiceCommands(program: Command) {
  const services = program.command("services").description("Manage services");

  services
    .command("list <projectId>")
    .description("List services in a project")
    .action(async (projectId) => {
      const spinner = ora("Fetching services...").start();
      try {
        const data = await gql(
          `query($id: String!) { project(id: $id) { name services { edges { node { id name createdAt } } } } }`,
          { id: projectId }
        );
        spinner.stop();

        console.log(chalk.bold(`Project: ${data.project.name}\n`));
        const table = new Table({
          head: [chalk.cyan("Service"), chalk.cyan("ID"), chalk.cyan("Created")],
          colWidths: [30, 40, 15],
        });

        for (const svc of data.project.services.edges) {
          const s = svc.node;
          table.push([chalk.bold(s.name), s.id, new Date(s.createdAt).toLocaleDateString()]);
        }
        console.log(table.toString());
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  services
    .command("create")
    .description("Create a new service")
    .requiredOption("-p, --project <projectId>", "Project ID")
    .requiredOption("-n, --name <name>", "Service name")
    .option("--image <image>", "Docker image (e.g. redis:7-alpine)")
    .option("--repo <repo>", "GitHub repo (e.g. user/repo)")
    .action(async (opts) => {
      const spinner = ora(`Creating service "${opts.name}"...`).start();
      try {
        const input: any = { projectId: opts.project, name: opts.name };
        if (opts.image) input.source = { image: opts.image };
        else if (opts.repo) input.source = { repo: opts.repo };

        const data = await gql(
          `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }`,
          { input }
        );
        spinner.succeed(chalk.green(`Created: ${data.serviceCreate.name} (${data.serviceCreate.id})`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  services
    .command("delete <serviceId>")
    .description("Delete a service")
    .action(async (serviceId) => {
      const { confirm } = await inquirer.prompt([
        { type: "confirm", name: "confirm", message: `Delete service ${serviceId}?`, default: false },
      ]);
      if (!confirm) return;

      const spinner = ora("Deleting service...").start();
      try {
        await gql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: serviceId });
        spinner.succeed(chalk.green("Service deleted."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  services
    .command("restart <serviceId>")
    .description("Restart a service")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .action(async (serviceId, opts) => {
      const spinner = ora("Restarting service...").start();
      try {
        await gql(
          `mutation($input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(input: $input) }`,
          { input: { serviceId, environmentId: opts.environment } }
        );
        spinner.succeed(chalk.green("Service restarted."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
