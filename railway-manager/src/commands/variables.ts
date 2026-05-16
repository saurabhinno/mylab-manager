import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import inquirer from "inquirer";
import { gql } from "../api";

export function registerVariableCommands(program: Command) {
  const vars = program.command("variables").alias("vars").description("Manage environment variables");

  vars
    .command("list")
    .description("List variables for a service")
    .requiredOption("-p, --project <projectId>", "Project ID")
    .requiredOption("-s, --service <serviceId>", "Service ID")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .action(async (opts) => {
      const spinner = ora("Fetching variables...").start();
      try {
        const data = await gql(
          `query($projectId: String!, $serviceId: String!, $environmentId: String!) {
            variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
          }`,
          { projectId: opts.project, serviceId: opts.service, environmentId: opts.environment }
        );
        spinner.stop();

        const table = new Table({
          head: [chalk.cyan("Key"), chalk.cyan("Value")],
          colWidths: [30, 60],
        });

        const variables = data.variables || {};
        for (const [key, value] of Object.entries(variables)) {
          const display = String(value).length > 55 ? String(value).slice(0, 52) + "..." : String(value);
          table.push([chalk.bold(key), display]);
        }
        console.log(table.toString());
        console.log(chalk.gray(`\n${Object.keys(variables).length} variables`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  vars
    .command("set")
    .description("Set a variable")
    .requiredOption("-p, --project <projectId>", "Project ID")
    .requiredOption("-s, --service <serviceId>", "Service ID")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .requiredOption("-k, --key <key>", "Variable name")
    .requiredOption("-v, --value <value>", "Variable value")
    .action(async (opts) => {
      const spinner = ora(`Setting ${opts.key}...`).start();
      try {
        await gql(
          `mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
          {
            input: {
              projectId: opts.project,
              serviceId: opts.service,
              environmentId: opts.environment,
              name: opts.key,
              value: opts.value,
            },
          }
        );
        spinner.succeed(chalk.green(`Set ${opts.key}`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  vars
    .command("delete")
    .description("Delete a variable")
    .requiredOption("-p, --project <projectId>", "Project ID")
    .requiredOption("-s, --service <serviceId>", "Service ID")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .requiredOption("-k, --key <key>", "Variable name")
    .action(async (opts) => {
      const spinner = ora(`Deleting ${opts.key}...`).start();
      try {
        await gql(
          `mutation($input: VariableDeleteInput!) { variableDelete(input: $input) }`,
          {
            input: {
              projectId: opts.project,
              serviceId: opts.service,
              environmentId: opts.environment,
              name: opts.key,
            },
          }
        );
        spinner.succeed(chalk.green(`Deleted ${opts.key}`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
