import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { setToken, clearToken, getToken } from "../config";
import { gql } from "../api";

export function registerAuthCommands(program: Command) {
  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("login")
    .description("Set your Railway API token")
    .option("-t, --token <token>", "API token")
    .action(async (opts) => {
      let token = opts.token;
      if (!token) {
        const answers = await inquirer.prompt([
          {
            type: "password",
            name: "token",
            message: "Enter your Railway API token:",
            mask: "*",
          },
        ]);
        token = answers.token;
      }

      const spinner = ora("Verifying token...").start();
      try {
        setToken(token);
        const data = await gql(`query { me { name email } }`);
        spinner.succeed(
          chalk.green(`Authenticated as ${data.me.name} (${data.me.email})`)
        );
      } catch (e: any) {
        clearToken();
        spinner.fail(chalk.red(`Invalid token: ${e.message}`));
      }
    });

  auth
    .command("logout")
    .description("Remove stored token")
    .action(() => {
      clearToken();
      console.log(chalk.yellow("Token removed."));
    });

  auth
    .command("whoami")
    .description("Show current user")
    .action(async () => {
      const spinner = ora("Fetching user info...").start();
      try {
        const data = await gql(`query { me { name email } }`);
        spinner.stop();
        console.log(`${chalk.bold(data.me.name)} (${data.me.email})`);
      } catch (e: any) {
        spinner.fail(e.message);
      }
    });
}
