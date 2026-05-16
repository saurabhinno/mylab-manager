import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import inquirer from "inquirer";
import { gql } from "../api";

export function registerProjectCommands(program: Command) {
  const projects = program.command("projects").description("Manage projects");

  projects
    .command("list")
    .description("List all projects")
    .action(async () => {
      const spinner = ora("Fetching projects...").start();
      try {
        // First get workspaces
        const wsData = await gql(`query { me { workspaces { id name } } }`);
        const workspaces = wsData.me.workspaces || [];

        const table = new Table({
          head: [chalk.cyan("Project"), chalk.cyan("ID"), chalk.cyan("Services"), chalk.cyan("Created")],
          colWidths: [30, 40, 10, 15],
        });

        for (const ws of workspaces) {
          const data = await gql(
            `query($wsId: String!) { workspace(workspaceId: $wsId) { projects { edges { node { id name createdAt services { edges { node { id name } } } } } } } }`,
            { wsId: ws.id }
          );
          for (const proj of data.workspace.projects.edges) {
            const p = proj.node;
            table.push([
              chalk.bold(p.name),
              p.id,
              String(p.services.edges.length),
              new Date(p.createdAt).toLocaleDateString(),
            ]);
          }
        }
        spinner.stop();
        console.log(table.toString());
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  projects
    .command("create")
    .description("Create a new project")
    .option("-n, --name <name>", "Project name")
    .action(async (opts) => {
      let name = opts.name;
      if (!name) {
        const answers = await inquirer.prompt([
          { type: "input", name: "name", message: "Project name:" },
        ]);
        name = answers.name;
      }

      const spinner = ora(`Creating project "${name}"...`).start();
      try {
        const data = await gql(
          `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id name } }`,
          { input: { name } }
        );
        spinner.succeed(
          chalk.green(`Created: ${data.projectCreate.name} (${data.projectCreate.id})`)
        );
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  projects
    .command("delete <projectId>")
    .description("Delete a project")
    .action(async (projectId) => {
      const { confirm } = await inquirer.prompt([
        { type: "confirm", name: "confirm", message: `Delete project ${projectId}? This cannot be undone.`, default: false },
      ]);
      if (!confirm) return;

      const spinner = ora("Deleting project...").start();
      try {
        await gql(`mutation($id: String!) { projectDelete(id: $id) }`, { id: projectId });
        spinner.succeed(chalk.green("Project deleted."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
