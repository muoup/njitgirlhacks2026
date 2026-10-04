# Gemini through Google Cloud

The BFF uses Vertex AI (now Gemini Enterprise Agent Platform) so inference is
billed to the Cloud project selected in `server/.env`. Google Cloud welcome
credits can cover eligible Cloud usage; new welcome credits don't cover the
AI Studio Gemini Developer API. See the [Cloud offer](https://cloud.google.com/products/gemini-enterprise-agent-platform),
[Gemini billing rules](https://ai.google.dev/gemini-api/docs/billing/), and
[trial terms](https://docs.cloud.google.com/free/docs/free-cloud-features).

## In the Google Cloud website

1. Select your project using the project selector at the top of the console.
   Use its **project ID**, not display name or project number.
2. Open **Billing** for the project and verify it is linked to the billing account
   containing your $300 welcome credit. In that account's Billing Overview,
   check the remaining credit and expiration date. If this is the wrong account,
   change the project's billing account before making requests.
3. Open **APIs & Services > Library**, search for **Vertex AI API** (or Agent
   Platform API), and enable service **aiplatform.googleapis.com**.
   The [API library page](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)
   opens in the selected project.
4. Open **IAM & Admin > IAM**. The Google account you will use for local login
   needs `roles/aiplatform.user` (Vertex AI User / Agent Platform User), or a
   role that already includes the required permissions. Ask the project admin
   for that role if needed. Project billing and API enablement also require
   permissions for those specific setup operations.
5. Optionally send a short prompt to Gemini 3.8 Flash in the Cloud console's
   Studio to confirm model access. That verifies your browser account, not
   credentials on the machine running the BFF.

The [Cloud quickstart](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start)
documents the required API, billing, IAM, and authentication setup. If the
console requires activating a paid billing account, remaining welcome credits
keep their original 90-day expiry. A paid account can charge for uncovered usage
or usage after credits are consumed; the credit is not a permanent spending cap.

## On the machine running the BFF

Install the [Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk),
then run these commands in your own terminal. The login opens a browser; use
the same Google account that has access to your selected project.

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

`gcloud auth login` alone does not establish the ADC used by the BFF. The quota
project command requires `serviceusage.services.use`; if it reports missing
permission, ask your admin for **Service Usage Consumer** on this project.
See [local ADC setup](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)
and [quota project permissions](https://docs.cloud.google.com/docs/quotas/set-quota-project).

Configure the existing `server/.env` without overwriting its auth settings:

```dotenv
GOOGLE_VERTEX_PROJECT=YOUR_PROJECT_ID
GOOGLE_VERTEX_LOCATION=global
```

Local ADC stays in the Google CLI's credentials directory, outside this repository.
An existing credential file can instead be selected with
`GOOGLE_APPLICATION_CREDENTIALS`; that setting takes precedence over local ADC.
The old Gemini/express-mode API keys are ignored. Google login for app users
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) is separate from agent credentials.

Run the manual access check:

```sh
cd server
bun run agent:check
```

This sends one small, billable prompt with the same project, model, and medium
thinking used by the harness. It prints `connected: true` and token usage on
success. It doesn't send garden context or exercise tools. Then restart
`./dev.sh` from the repo root, sign in, and try chat or **Refresh garden insights**.
The scheduled worker still refreshes eligible accounts every 30 minutes;
`AGENT_SCHEDULE_ENABLED=false` disables only that worker.

## If the check fails

- `GOOGLE_ADC_MISSING`: perform the ADC login on this machine.
- `SERVICE_DISABLED`: enable `aiplatform.googleapis.com` in the configured project.
- HTTP 401: refresh ADC and check whether a different credential file overrides it.
- HTTP 403: verify the signed-in principal's IAM permissions and project billing;
  inspect the safe Google reason code in the terminal.
- HTTP 404: check model access and use the configured `global` location.
- HTTP 429: check Cloud quotas and rate limits.

After a successful request, open **Billing > Reports**, select the project and
AI service, and check credit/savings application when billing data appears.
Successful inference proves API access, not credit eligibility. The BFF cannot
inspect your Cloud billing account or change its permissions.
