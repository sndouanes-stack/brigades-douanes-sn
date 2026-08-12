import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey);

async function addTelephoneColumn() {
  console.log("Attempting SQL execution via Supabase RPC...");
  const { data, error } = await admin.rpc("exec_sql", {
    sql_query: "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telephone text;"
  });

  if (error) {
    console.log("RPC exec_sql error (normal if function not defined):", error.message);
  } else {
    console.log("RPC exec_sql success:", data);
  }
}

addTelephoneColumn();
