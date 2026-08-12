import { supabase } from "@/lib/supabase";

export async function logout() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore signout errors if network fails
  }
  // Clear cookies with exact path & sameSite attributes
  document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "role=; path=/; max-age=0; SameSite=Lax";
  // Force a clean hard redirect to /login to teardown all React state
  window.location.href = "/login";
}
