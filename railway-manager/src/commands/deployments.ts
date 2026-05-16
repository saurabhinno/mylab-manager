import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import inquirer from "inquirer";
import { gql } from "../api";

export function registerDeploymentCommands(program: Command) {
  const deployments = program.command("deployments").alias("deploy").description("Manage deployments");

  deployments
    .command("list")
    .description("List recent deployments")
    .requiredOption("-p, --project <projectId>", "Project ID")
    .requiredOption("-s, --service <serviceId>", "Service ID")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .option("-n, --count <count>", "Number of deployments", "10")
    .action(async (opts) => {
      const spinner = ora("Fetching deployments...").start();
      try {
        const data = await gql(
          `query($input: DeploymentListInput!, $first: Int) {
            deployments(input: $input, first: $first) {
              edges { node { id status createdAt url } }
            }
          }`,
          {
            input: { projectId: opts.project, serviceId: opts.service, environmentId: opts.environment },
            first: parseInt(opts.count),
          }
        );
        spinner.stop();

        const table = new Table({
          head: [chalk.cyan("ID"), chalk.cyan("Status"), chalk.cyan("Created"), chalk.cyan("URL")],
          colWidths: [38, 12, 20, 50],
        });

        for (const dep of data.deployments.edges) {
          const d = dep.node;
          const statusColor = d.status === "SUCCESS" ? chalk.green : d.status === "FAILED" ? chalk.red : chalk.yellow;
          table.push([
            d.id.slice(0, 36),
            statusColor(d.status),
            new Date(d.createdAt).toLocaleString(),
            d.url || "—",
          ]);
        }
        console.log(table.toString());
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  deployments
    .command("redeploy <deploymentId>")
    .description("Redeploy a deployment")
    .action(async (deploymentId) => {
      const spinner = ora("Redeploying...").start();
      try {
        const data = await gql(
          `mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }`,
          { id: deploymentId }
        );
        spinner.succeed(chalk.green(`Redeployed: ${data.deploymentRedeploy.id}`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  deployments
    .command("rollback <deploymentId>")
    .description("Rollback to a previous deployment")
    .action(async (deploymentId) => {
      const { confirm } = await inquirer.prompt([
        { type: "confirm", name: "confirm", message: "Rollback to this deployment?", default: false },
      ]);
      if (!confirm) return;

      const spinner = ora("Rolling back...").start();
      try {
        const data = await gql(
          `mutation($id: String!) { deploymentRollback(id: $id) { id status } }`,
          { id: deploymentId }
        );
        spinner.succeed(chalk.green(`Rolled back: ${data.deploymentRollback.id}`));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  deployments
    .command("remove <deploymentId>")
    .description("Remove a deployment")
    .action(async (deploymentId) => {
      const spinner = ora("Removing deployment...").start();
      try {
        await gql(`mutation($id: String!) { deploymentRemove(id: $id) }`, { id: deploymentId });
        spinner.succeed(chalk.green("Deployment removed."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
