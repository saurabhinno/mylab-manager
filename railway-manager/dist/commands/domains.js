"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDomainCommands = registerDomainCommands;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const api_1 = require("../api");
function registerDomainCommands(program) {
    const domains = program.command("domains").description("Manage domains");
    domains
        .command("list")
        .description("List domains for a service")
        .requiredOption("-s, --service <serviceId>", "Service ID")
        .requiredOption("-e, --environment <envId>", "Environment ID")
        .action(async (opts) => {
        const spinner = (0, ora_1.default)("Fetching domains...").start();
        try {
            const data = await (0, api_1.gql)(`query($serviceId: String!, $environmentId: String!) {
            domains(serviceId: $serviceId, environmentId: $environmentId) {
              serviceDomains { id domain }
              customDomains { id domain status { dnsRecords { type hostlabel value } } }
            }
          }`, { serviceId: opts.service, environmentId: opts.environment });
            spinner.stop();
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Domain"), chalk_1.default.cyan("Type"), chalk_1.default.cyan("ID")],
                colWidths: [50, 15, 40],
            });
            for (const d of data.domains.serviceDomains || []) {
                table.push([chalk_1.default.green(d.domain), "Railway", d.id]);
            }
            for (const d of data.domains.customDomains || []) {
                table.push([chalk_1.default.blue(d.domain), "Custom", d.id]);
            }
            console.log(table.toString());
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    domains
        .command("create")
        .description("Generate a Railway domain for a service")
        .requiredOption("-s, --service <serviceId>", "Service ID")
        .requiredOption("-e, --environment <envId>", "Environment ID")
        .action(async (opts) => {
        const spinner = (0, ora_1.default)("Creating domain...").start();
        try {
            const data = await (0, api_1.gql)(`mutation($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { id domain } }`, { input: { serviceId: opts.service, environmentId: opts.environment } });
            spinner.succeed(chalk_1.default.green(`Domain created: https://${data.serviceDomainCreate.domain}`));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    domains
        .command("add-custom")
        .description("Add a custom domain")
        .requiredOption("-s, --service <serviceId>", "Service ID")
        .requiredOption("-e, --environment <envId>", "Environment ID")
        .requiredOption("-d, --domain <domain>", "Custom domain (e.g. api.example.com)")
        .action(async (opts) => {
        const spinner = (0, ora_1.default)(`Adding ${opts.domain}...`).start();
        try {
            const data = await (0, api_1.gql)(`mutation($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { id domain } }`, { input: { serviceId: opts.service, environmentId: opts.environment, domain: opts.domain } });
            spinner.succeed(chalk_1.default.green(`Added: ${data.customDomainCreate.domain}`));
            console.log(chalk_1.default.yellow("Configure your DNS to point to Railway. Check domain status for records."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
    domains
        .command("delete <domainId>")
        .description("Delete a domain")
        .action(async (domainId) => {
        const spinner = (0, ora_1.default)("Deleting domain...").start();
        try {
            await (0, api_1.gql)(`mutation($id: String!) { serviceDomainDelete(id: $id) }`, { id: domainId });
            spinner.succeed(chalk_1.default.green("Domain deleted."));
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
