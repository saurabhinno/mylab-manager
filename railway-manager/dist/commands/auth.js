"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthCommands = registerAuthCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const config_1 = require("../config");
const api_1 = require("../api");
function registerAuthCommands(program) {
    const auth = program.command("auth").description("Manage authentication");
    auth
        .command("login")
        .description("Set your Railway API token")
        .option("-t, --token <token>", "API token")
        .action(async (opts) => {
        let token = opts.token;
        if (!token) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: "password",
                    name: "token",
                    message: "Enter your Railway API token:",
                    mask: "*",
                },
            ]);
            token = answers.token;
        }
        const spinner = (0, ora_1.default)("Verifying token...").start();
        try {
            (0, config_1.setToken)(token);
            const data = await (0, api_1.gql)(`query { me { name email } }`);
            spinner.succeed(chalk_1.default.green(`Authenticated as ${data.me.name} (${data.me.email})`));
        }
        catch (e) {
            (0, config_1.clearToken)();
            spinner.fail(chalk_1.default.red(`Invalid token: ${e.message}`));
        }
    });
    auth
        .command("logout")
        .description("Remove stored token")
        .action(() => {
        (0, config_1.clearToken)();
        console.log(chalk_1.default.yellow("Token removed."));
    });
    auth
        .command("whoami")
        .description("Show current user")
        .action(async () => {
        const spinner = (0, ora_1.default)("Fetching user info...").start();
        try {
            const data = await (0, api_1.gql)(`query { me { name email } }`);
            spinner.stop();
            console.log(`${chalk_1.default.bold(data.me.name)} (${data.me.email})`);
        }
        catch (e) {
            spinner.fail(e.message);
        }
    });
}
