const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  const password = await question(
    "Enter the admin password to hash: "
  );

  rl.close();

  if (password.length < 10) {
    throw new Error(
      "Use an admin password with at least 10 characters"
    );
  }

  const hash = await bcrypt.hash(password, 12);

  console.log("\nCopy this value into ADMIN_PASSWORD_HASH:\n");
  console.log(hash);
  console.log(
    "\nDo not put the original password or this hash in GitHub."
  );
}

main().catch((error) => {
  rl.close();
  console.error(error.message);
  process.exit(1);
});
