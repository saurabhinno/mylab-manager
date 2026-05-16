import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { gql } from "../api";

export function registerDomainCommands(program: Command) {
  const domains = program.command("domains").description("Manage domains");

  domains
    .command("list")
    .description("List domains for a service")
    .requiredOption("-s, --service <serviceId>", "Service ID")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .action(async (opts) => {
      const spinner = ora("Fetching domains...").start();
      try {
        const data = await gql(
          `query($serviceId: String!, $environmentId: String!) {
            domains(serviceId: $serviceId, environmentId: $environmentId) {
              serviceDomains { id domain }
              customDomains { id domain status { dnsRecords { type hostlabel value } } }
            }
          }`,
          { serviceId: opts.service, environmentId: opts.environment }
        );
        spinner.stop();

        const table = new Table({
          head: [chalk.cyan("Domain"), chalk.cyan("Type"), chalk.cyan("ID")],
          colWidths: [50, 15, 40],
        });

        for (const d of data.domains.serviceDomains || []) {
          table.push([chalk.green(d.domain), "Railway", d.id]);
        }
        for (const d of data.domains.customDomains || []) {
          table.push([chalk.blue(d.domain), "Custom", d.id]);
        }
        console.log(table.toString());
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  domains
    .command("create")
    .description("Generate a Railway domain for a service")
    .requiredOption("-s, --service <serviceId>", "Service ID")
    .requiredOption("-e, --environment <envId>", "Environment ID")
    .action(async (opts) => {
      const spinner = ora("Creating domain...").start();
      try {
        const data = await gql(
          `mutation($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { id domain } }`,
          { input: { serviceId: opts.service, environmentId: opts.environment } }
        );
        spinner.succeed(chalk.green(`Domain created: https://${data.serviceDomainCreate.domain}`));
      } catch (e: any) {
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
      const spinner = ora(`Adding ${opts.domain}...`).start();
      try {
        const data = await gql(
          `mutation($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { id domain } }`,
          { input: { serviceId: opts.service, environmentId: opts.environment, domain: opts.domain } }
        );
        spinner.succeed(chalk.green(`Added: ${data.customDomainCreate.domain}`));
        console.log(chalk.yellow("Configure your DNS to point to Railway. Check domain status for records."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });

  domains
    .command("delete <domainId>")
    .description("Delete a domain")
    .action(async (domainId) => {
      const spinner = ora("Deleting domain...").start();
      try {
        await gql(`mutation($id: String!) { serviceDomainDelete(id: $id) }`, { id: domainId });
        spinner.succeed(chalk.green("Domain deleted."));
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
