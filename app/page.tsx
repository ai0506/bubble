import { ChatScreen } from "@/components/ChatScreen";
import { PhoneShell } from "@/components/PhoneShell";

export default function HomePage() {
  return (
    <PhoneShell>
      <ChatScreen />
    </PhoneShell>
  );
}
