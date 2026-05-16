"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServiceCommands = registerServiceCommands;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const api_1 = require("../api");
function registerServiceCommands(program) {
    const services = program.command("services").description("Manage services");
    services
        .command("list <projectId>")
        .description("List services in a project")
        .action(async (projectId) => {
        const spinner = (0, ora_1.default)("Fetching services...").start();
        try {
            const data = await (0, api_1.gql)(`query($id: String!) { project(id: $id) { name services { edges { node { id name createdAt } } } } }`, { id: projectId });
            spinner.stop();
            console.log(chalk_1.default.bold(`Project: ${data.project.name}\n`));
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Service"), chalk_1.default.cyan("ID"), chalk_1.default.cyan("Created")],
                colWidths: [30, 40, 15],
            });
            for (const svc of data.project.services.edges) {
                const s = svc.node;
                table.push([chalk_1.default.bold(s.name), s.id, new Date(s.createdAt).toLocaleDateString()]);
            }
            console.log(table.toString());
        }
        catch (e) {
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
        const spinner = (0, ora_1.default)(`Creating service "${opts.name}"...`).start();
        try {
            const input = { projectId: opts.project, name: opts.name };
            if (opts.image)
                input.source = { image: opts.image };
            else if (opts.repo)
                input.source = { repo: opts.repo };
            const data = await (0, api_1.gql)(`mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }`, { input });
            spinner.succeed(chalk_1.default.green(`Created: ${data.serviceCreate.name} (${data.serviceCreate.id})`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    services
        .command("delete <serviceId>")
        .description("Delete a service")
        .action(async (serviceId) => {
        const { confirm } = await inquirer_1.default.prompt([
            { type: "confirm", name: "confirm", message: `Delete service ${serviceId}?`, default: false },
        ]);
        if (!confirm)
            return;
        const spinner = (0, ora_1.default)("Deleting service...").start();
        try {
            await (0, api_1.gql)(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: serviceId });
            spinner.succeed(chalk_1.default.green("Service deleted."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    services
        .command("restart <serviceId>")
        .description("Restart a service")
        .requiredOption("-e, --environment <envId>", "Environment ID")
        .action(async (serviceId, opts) => {
        const spinner = (0, ora_1.default)("Restarting service...").start();
        try {
            await (0, api_1.gql)(`mutation($input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(input: $input) }`, { input: { serviceId, environmentId: opts.environment } });
            spinner.succeed(chalk_1.default.green("Service restarted."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
