"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEnvironmentCommands = registerEnvironmentCommands;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const api_1 = require("../api");
function registerEnvironmentCommands(program) {
    const envs = program.command("environments").alias("envs").description("Manage environments");
    envs
        .command("list <projectId>")
        .description("List environments in a project")
        .action(async (projectId) => {
        const spinner = (0, ora_1.default)("Fetching environments...").start();
        try {
            const data = await (0, api_1.gql)(`query($id: String!) { project(id: $id) { name environments { edges { node { id name createdAt } } } } }`, { id: projectId });
            spinner.stop();
            console.log(chalk_1.default.bold(`Project: ${data.project.name}\n`));
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Environment"), chalk_1.default.cyan("ID"), chalk_1.default.cyan("Created")],
                colWidths: [20, 40, 15],
            });
            for (const env of data.project.environments.edges) {
                const e = env.node;
                table.push([chalk_1.default.bold(e.name), e.id, new Date(e.createdAt).toLocaleDateString()]);
            }
            console.log(table.toString());
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    envs
        .command("create")
        .description("Create a new environment")
        .requiredOption("-p, --project <projectId>", "Project ID")
        .requiredOption("-n, --name <name>", "Environment name")
        .action(async (opts) => {
        const spinner = (0, ora_1.default)(`Creating environment "${opts.name}"...`).start();
        try {
            const data = await (0, api_1.gql)(`mutation($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name } }`, { input: { projectId: opts.project, name: opts.name } });
            spinner.succeed(chalk_1.default.green(`Created: ${data.environmentCreate.name} (${data.environmentCreate.id})`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    envs
        .command("delete <environmentId>")
        .description("Delete an environment")
        .action(async (environmentId) => {
        const spinner = (0, ora_1.default)("Deleting environment...").start();
        try {
            await (0, api_1.gql)(`mutation($id: String!) { environmentDelete(id: $id) }`, { id: environmentId });
            spinner.succeed(chalk_1.default.green("Environment deleted."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
