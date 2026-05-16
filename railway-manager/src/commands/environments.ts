import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { gql } from "../api";

export function registerEnvironmentCommands(program: Command) {
  const envs = program.command("environments").alias("envs").description("Manage environments");

  envs
    .command("list <projectId>")
    .description("List environments in a project")
    .action(async (projectId) => {
      const spinner = ora("Fetching environments...").start();
      try {
        const data = await gql(
          `query($id: String!) { project(id: $id) { name environments { edges { node { id name createdAt } } } } }`,
          { id: projectId }
        );
        spinner.stop();

        console.log(chalk.bold(`Project: ${data.project.name}\n`));
        const table = new Table({
          head: [chalk.cyan("Environment"), chalk.cyan("ID"), chalk.cyan("Created")],
          colWidths: [20, 40, 15],
        });

        for (const env of data.project.environments.edges) {
          const e = env.node;
          table.push([chalk.bold(e.name), e.id, new Date(e.createdAt).toLocaleDateString()]);
        }
        console.log(table.toString());
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  envs
    .command("create")
    .description("Create a new environment")
    .requiredOption("-p, --project <projectId>", "Project ID")
    .requiredOption("-n, --name <name>", "Environment name")
    .action(async (opts) => {
      const spinner = ora(`Creating environment "${opts.name}"...`).start();
      try {
        const data = await gql(
          `mutation($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name } }`,
          { input: { projectId: opts.project, name: opts.name } }
        );
        spinner.succeed(chalk.green(`Created: ${data.environmentCreate.name} (${data.environmentCreate.id})`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  envs
    .command("delete <environmentId>")
    .description("Delete an environment")
    .action(async (environmentId) => {
      const spinner = ora("Deleting environment...").start();
      try {
        await gql(`mutation($id: String!) { environmentDelete(id: $id) }`, { id: environmentId });
        spinner.succeed(chalk.green("Environment deleted."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
