"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeploymentCommands = registerDeploymentCommands;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const api_1 = require("../api");
function registerDeploymentCommands(program) {
    const deployments = program.command("deployments").alias("deploy").description("Manage deployments");
    deployments
        .command("list")
        .description("List recent deployments")
        .requiredOption("-p, --project <projectId>", "Project ID")
        .requiredOption("-s, --service <serviceId>", "Service ID")
        .requiredOption("-e, --environment <envId>", "Environment ID")
        .option("-n, --count <count>", "Number of deployments", "10")
        .action(async (opts) => {
        const spinner = (0, ora_1.default)("Fetching deployments...").start();
        try {
            const data = await (0, api_1.gql)(`query($input: DeploymentListInput!, $first: Int) {
            deployments(input: $input, first: $first) {
              edges { node { id status createdAt url } }
            }
          }`, {
                input: { projectId: opts.project, serviceId: opts.service, environmentId: opts.environment },
                first: parseInt(opts.count),
            });
            spinner.stop();
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan("ID"), chalk_1.default.cyan("Status"), chalk_1.default.cyan("Created"), chalk_1.default.cyan("URL")],
                colWidths: [38, 12, 20, 50],
            });
            for (const dep of data.deployments.edges) {
                const d = dep.node;
                const statusColor = d.status === "SUCCESS" ? chalk_1.default.green : d.status === "FAILED" ? chalk_1.default.red : chalk_1.default.yellow;
                table.push([
                    d.id.slice(0, 36),
                    statusColor(d.status),
                    new Date(d.createdAt).toLocaleString(),
                    d.url || "—",
                ]);
            }
            console.log(table.toString());
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    deployments
        .command("redeploy <deploymentId>")
        .description("Redeploy a deployment")
        .action(async (deploymentId) => {
        const spinner = (0, ora_1.default)("Redeploying...").start();
        try {
            const data = await (0, api_1.gql)(`mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }`, { id: deploymentId });
            spinner.succeed(chalk_1.default.green(`Redeployed: ${data.deploymentRedeploy.id}`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    deployments
        .command("rollback <deploymentId>")
        .description("Rollback to a previous deployment")
        .action(async (deploymentId) => {
        const { confirm } = await inquirer_1.default.prompt([
            { type: "confirm", name: "confirm", message: "Rollback to this deployment?", default: false },
        ]);
        if (!confirm)
            return;
        const spinner = (0, ora_1.default)("Rolling back...").start();
        try {
            const data = await (0, api_1.gql)(`mutation($id: String!) { deploymentRollback(id: $id) { id status } }`, { id: deploymentId });
            spinner.succeed(chalk_1.default.green(`Rolled back: ${data.deploymentRollback.id}`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    deployments
        .command("remove <deploymentId>")
        .description("Remove a deployment")
        .action(async (deploymentId) => {
        const spinner = (0, ora_1.default)("Removing deployment...").start();
        try {
            await (0, api_1.gql)(`mutation($id: String!) { deploymentRemove(id: $id) }`, { id: deploymentId });
            spinner.succeed(chalk_1.default.green("Deployment removed."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
