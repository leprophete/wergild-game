import { redirect } from "next/navigation";

// The home page (closed grimoire, onboarding) comes in step 8. Until then, go to the map.
export default function Home() {
  redirect("/map");
}
