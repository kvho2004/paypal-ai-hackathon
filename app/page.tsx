import { redirect } from "next/navigation";

// Landing goes straight to the purchases view until /chat exists.
export default function Home() {
  redirect("/purchases");
}
