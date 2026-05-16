"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVariableCommands = registerVariableCommands;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const api_1 = require("../api");
function registerVariableCommands(program) {
    const vars = program.command("variables").alias("vars").description("Manage environment variables");
    vars
        .command("list")
        .description("List variables for a service")
        .requiredOption("-p, --project <projectId>", "Project ID")
        .requiredOption("-s, --service <serviceId>", "Service ID")
        .requiredOption("-e, --environment <envId>", "Environment ID")
        .action(async (opts) => {
        const spinner = (0, ora_1.default)("Fetching variables...").start();
        try {
            const data = await (0, api_1.gql)(`query($projectId: String!, $serviceId: String!, $environmentId: String!) {
            variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
          }`, { projectId: opts.project, serviceId: opts.service, environmentId: opts.environment });
            spinner.stop();
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Key"), chalk_1.default.cyan("Value")],
                colWidths: [30, 60],
            });
            const variables = data.variables || {};
            for (const [key, value] of Object.entries(variables)) {
                const display = String(value).length > 55 ? String(value).slice(0, 52) + "..." : String(value);
                table.push([chalk_1.default.bold(key), display]);
            }
            console.log(table.toString());
            console.log(chalk_1.default.gray(`\n${Object.keys(variables).length} variables`));
        }
        catch (e) {
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
        const spinner = (0, ora_1.default)(`Setting ${opts.key}...`).start();
        try {
            await (0, api_1.gql)(`mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
                input: {
                    projectId: opts.project,
                    serviceId: opts.service,
                    environmentId: opts.environment,
                    name: opts.key,
                    value: opts.value,
                },
            });
            spinner.succeed(chalk_1.default.green(`Set ${opts.key}`));
        }
        catch (e) {
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
        const spinner = (0, ora_1.default)(`Deleting ${opts.key}...`).start();
        try {
            await (0, api_1.gql)(`mutation($input: VariableDeleteInput!) { variableDelete(input: $input) }`, {
                input: {
                    projectId: opts.project,
                    serviceId: opts.service,
                    environmentId: opts.environment,
                    name: opts.key,
                },
            });
            spinner.succeed(chalk_1.default.green(`Deleted ${opts.key}`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
