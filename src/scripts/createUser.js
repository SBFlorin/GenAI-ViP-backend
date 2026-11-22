#!/usr/bin/env node
/**
 * Create a user with an explicit role (e.g. the first admin, evaluator or study5 lab accounts).
 *
 * Usage:
 *   node src/scripts/createUser.js --email lab1@example.com --username lab1 --role study5 [--first Lab --last One]
 * The password is read from the PAVIAGEN_NEW_USER_PASSWORD env var, or prompted for when unset.
 */
require('dotenv').config();
const readline = require('readline');
const { sequelize, User, Settings } = require('../db');
const { ASSIGNABLE_ROLES, createUserAccount } = require('../services/userAccountService');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = function writeMasked(text) {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email || !args.username || !args.role) {
    console.error(`Usage: node src/scripts/createUser.js --email <email> --username <username> --role <${ASSIGNABLE_ROLES.join('|')}> [--first <name>] [--last <name>]`);
    process.exit(2);
  }
  const password = process.env.PAVIAGEN_NEW_USER_PASSWORD || (await promptHidden('Password (min 8 chars): '));
  await sequelize.sync();
  const user = await createUserAccount(
    { User, Settings },
    { email: args.email, username: args.username, password, firstName: args.first, lastName: args.last, role: args.role }
  );
  console.log(`Created user #${user.id} ${user.email} with role ${user.role}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
