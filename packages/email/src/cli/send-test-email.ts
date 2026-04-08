import parseArgs from "minimist";
import { EmailService } from "../email.service";
import { EmailTemplateType } from "../types";

async function run() {
  // Some npm runners forward an initial '--' arg; filter it out for robustness
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  const argv = parseArgs(raw);
  const to = argv.to || argv.t;
  const template = (argv.template || argv._[0]) as string;
  if (!to || !template) {
    console.error(
      "Usage: send-test-email --to=you@localhost --template=welcome"
    );
    process.exit(1);
  }

  const svc = new EmailService();
  await svc.init();
  try {
    if (template === EmailTemplateType.WELCOME) {
      await svc.sendTemplate(EmailTemplateType.WELCOME, {
        to,
        name: "Test User",
      });
    } else if (template === EmailTemplateType.OVERDUE_PAYMENT) {
      await svc.sendTemplate(EmailTemplateType.OVERDUE_PAYMENT, {
        to,
        customerName: "Test User",
        amount: 100,
        dueDate: new Date().toISOString(),
      });
    } else {
      console.error(`Unknown template: ${template}`);
      process.exit(1);
    }
    console.log("Email sent (or queued) to:", to);
  } finally {
    await svc.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
