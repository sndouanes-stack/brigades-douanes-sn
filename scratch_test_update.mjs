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

async function testUpdate() {
  const uid = "f08c2dcd-c9c6-4e2c-bc04-1ae84bdc192a"; // Magaye Dione
  console.log("Testing update for Magaye Dione...");

  const { error: dbErr } = await admin
    .from("users")
    .update({ telephone: "770000000", prenom: "Magaye Dione" })
    .eq("id", uid);

  if (dbErr) {
    console.error("DB Update Error:", dbErr.message);
  } else {
    console.log("DB Update successful!");
  }

  const { data: user, error: fetchErr } = await admin.from("users").select("*").eq("id", uid).single();
  console.log("Updated user:", user);
}

testUpdate();
