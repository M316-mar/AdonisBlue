import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getAuthToken(request: Request): string | null {
  return request.headers.get("authorization")?.replace("Bearer ", "").trim() || null;
}

async function getAuthUser(token: string) {
  const supabaseAuth = createClient(NEXT_PUBLIC_SUPABASE_URL!, NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser(token);
  return user;
}

interface PlatformInstruction {
  title: string;
  steps: string[];
}

interface Instructions {
  vagaro: PlatformInstruction;
  jane: PlatformInstruction;
  square: PlatformInstruction;
  acuity: PlatformInstruction;
  mindbody: PlatformInstruction;
  generic: PlatformInstruction;
}

function buildInstructions(webhookUrl: string | null): Instructions {
  const url = webhookUrl ?? "(generate your URL first)";
  return {
    vagaro: {
      title: "Vagaro Setup",
      steps: [
        "Log in to your Vagaro business account.",
        "Go to Settings → Online Booking → Webhooks.",
        "Click Add Webhook.",
        `Paste your webhook URL: ${url.replace("source=vagaro", "source=vagaro") || url + "&source=vagaro"}`,
        'Select the "Appointment Booked" event.',
        "Click Save. Test with a sample booking.",
      ],
    },
    jane: {
      title: "Jane App Setup",
      steps: [
        "Log in to your Jane App account.",
        "Go to Settings → Integrations → Webhooks.",
        "Click New Webhook.",
        `Paste your webhook URL with ?source=jane appended.`,
        'Select the "appointment.created" event.',
        "Click Save. Jane will send a test payload automatically.",
      ],
    },
    square: {
      title: "Square Appointments Setup",
      steps: [
        "Log in to your Square Dashboard.",
        "Navigate to Appointments → Settings → Notifications.",
        "Find the Webhook URL field.",
        `Paste your webhook URL: ${url}`,
        'Select the "booking.created" event.',
        "Click Save and verify with a test booking.",
      ],
    },
    acuity: {
      title: "Acuity Scheduling Setup",
      steps: [
        "Note: Acuity does not support native webhooks. Use Zapier instead.",
        "Create a free Zapier account at zapier.com.",
        'Create a new Zap: Trigger = "Acuity Scheduling → New Appointment".',
        'Action = "Webhooks by Zapier → POST".',
        `Paste your webhook URL with ?source=acuity: ${url}&source=acuity`,
        "Map the fields: client name, email, phone, appointment type, date.",
        "Test and publish your Zap.",
      ],
    },
    mindbody: {
      title: "Mindbody Setup",
      steps: [
        "Note: Mindbody webhooks require API access (Developer API plan).",
        "Log in to the Mindbody Developer Portal.",
        "Navigate to Services → Webhooks → Add Endpoint.",
        `Paste your webhook URL: ${url}&source=mindbody`,
        'Subscribe to the "appointmentBookingCompleted" event.',
        "Save and verify your endpoint is confirmed.",
      ],
    },
    generic: {
      title: "Generic / Any Software",
      steps: [
        "Use this option for any booking software that supports webhooks.",
        `Paste your webhook URL with ?source=generic appended.`,
        "Configure the webhook to fire on new appointment / booking created events.",
        "Map fields in your software to: client name (or first_name + last_name), email, phone, service (or service_name / type), date (or appointment_date / start_at).",
        "Send a test webhook and verify it appears in AdonisBlue.",
      ],
    },
  };
}

export async function GET(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: bot } = await supabase
      .from("bots")
      .select("webhook_secret")
      .eq("nurse_id", user.id)
      .single();

    const secret: string | null = bot?.webhook_secret ?? null;
    const hasSecret = !!secret;
    const webhookUrl = secret
      ? `${SITE_URL}/api/booking-webhook?secret=${secret}&source=`
      : null;

    return NextResponse.json({
      webhook_url: webhookUrl,
      has_secret: hasSecret,
      instructions: buildInstructions(webhookUrl),
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as { action?: string };
    const action = typeof body.action === "string" ? body.action : "";

    if (action !== "generate" && action !== "regenerate") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: bot } = await supabase
      .from("bots")
      .select("webhook_secret")
      .eq("nurse_id", user.id)
      .single();

    const existingSecret: string | null = bot?.webhook_secret ?? null;

    // If action=generate and secret already exists, return existing URL
    if (action === "generate" && existingSecret) {
      const webhookUrl = `${SITE_URL}/api/booking-webhook?secret=${existingSecret}&source=`;
      return NextResponse.json({ webhook_url: webhookUrl, regenerated: false });
    }

    // Generate new secret
    const newSecret = crypto.randomUUID();

    await supabase
      .from("bots")
      .update({ webhook_secret: newSecret })
      .eq("nurse_id", user.id);

    const webhookUrl = `${SITE_URL}/api/booking-webhook?secret=${newSecret}&source=`;
    return NextResponse.json({ webhook_url: webhookUrl, regenerated: action === "regenerate" });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
