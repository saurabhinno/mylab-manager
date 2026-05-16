"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProjectCommands = registerProjectCommands;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const api_1 = require("../api");
function registerProjectCommands(program) {
    const projects = program.command("projects").description("Manage projects");
    projects
        .command("list")
        .description("List all projects")
        .action(async () => {
        const spinner = (0, ora_1.default)("Fetching projects...").start();
        try {
            // First get workspaces
            const wsData = await (0, api_1.gql)(`query { me { workspaces { id name } } }`);
            const workspaces = wsData.me.workspaces || [];
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Project"), chalk_1.default.cyan("ID"), chalk_1.default.cyan("Services"), chalk_1.default.cyan("Created")],
                colWidths: [30, 40, 10, 15],
            });
            for (const ws of workspaces) {
                const data = await (0, api_1.gql)(`query($wsId: String!) { workspace(workspaceId: $wsId) { projects { edges { node { id name createdAt services { edges { node { id name } } } } } } } }`, { wsId: ws.id });
                for (const proj of data.workspace.projects.edges) {
                    const p = proj.node;
                    table.push([
                        chalk_1.default.bold(p.name),
                        p.id,
                        String(p.services.edges.length),
                        new Date(p.createdAt).toLocaleDateString(),
                    ]);
                }
            }
            spinner.stop();
            console.log(table.toString());
        }
        catch (e) {
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
            const answers = await inquirer_1.default.prompt([
                { type: "input", name: "name", message: "Project name:" },
            ]);
            name = answers.name;
        }
        const spinner = (0, ora_1.default)(`Creating project "${name}"...`).start();
        try {
            const data = await (0, api_1.gql)(`mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id name } }`, { input: { name } });
            spinner.succeed(chalk_1.default.green(`Created: ${data.projectCreate.name} (${data.projectCreate.id})`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    projects
        .command("delete <projectId>")
        .description("Delete a project")
        .action(async (projectId) => {
        const { confirm } = await inquirer_1.default.prompt([
            { type: "confirm", name: "confirm", message: `Delete project ${projectId}? This cannot be undone.`, default: false },
        ]);
        if (!confirm)
            return;
        const spinner = (0, ora_1.default)("Deleting project...").start();
        try {
            await (0, api_1.gql)(`mutation($id: String!) { projectDelete(id: $id) }`, { id: projectId });
            spinner.succeed(chalk_1.default.green("Project deleted."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
