import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, Bot, User, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const suggestedQuestions = [
  "What is the maximum advance rent allowed?",
  "Can my landlord evict me without notice?",
  "How do I file a complaint with Rent Control?",
  "What is an illegal rent increase?",
  "What are my rights as a tenant in Ghana?",
];

const dummyResponses: Record<string, string> = {
  "What is the maximum advance rent allowed?":
    "Under Ghanaian law, landlords can demand a maximum of 6 months' advance rent for residential properties. Any demand exceeding this limit is a violation and can be reported to Rent Control.",
  "Can my landlord evict me without notice?":
    "No. A landlord must provide proper notice before eviction. The notice period depends on your rental agreement, but typically ranges from 1 to 3 months. Unlawful eviction can be reported to the police and Rent Control.",
  "How do I file a complaint with Rent Control?":
    "You can file a complaint directly through this app by clicking 'File Complaint' in the menu. You'll need your landlord's details, property address, and a description of the issue. You can also visit your nearest Rent Control office.",
  "What is an illegal rent increase?":
    "An illegal rent increase is any increase that exceeds the agreed terms without proper notice or justification. Landlords must give reasonable notice and cannot increase rent during an active agreement period.",
  "What are my rights as a tenant in Ghana?":
    "As a tenant in Ghana, you have the right to: a registered tenancy agreement, protection from unlawful eviction, fair rent pricing, proper receipts for payments, and the ability to file complaints with Rent Control.",
};

const LegalAssistant = () => {
  const [messages, setMessages] = useState<{ role: "bot" | "user"; text: string }[]>([
    { role: "bot", text: "Hello! I'm your legal assistant. I can help you understand your tenant rights in Ghana. Ask me anything or pick a suggested question below." },
  ]);
  const [input, setInput] = useState("");

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    // Simulate response
    setTimeout(() => {
      const response =
        dummyResponses[userMsg] ||
        "That's a great question! In a full implementation, I would provide detailed legal guidance based on Ghana's Rent Act (Act 220). For now, please visit your nearest Rent Control office or call the hotline for specific legal advice.";
      setMessages((prev) => [...prev, { role: "bot", text: response }]);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-foreground">Legal Assistant</h1>
        <p className="text-muted-foreground mt-1">AI-powered guidance on tenant rights</p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-warning/5 p-3 rounded-lg border border-warning/20 mb-4">
        <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>This is an educational tool and does not constitute legal advice. For official legal guidance, consult a lawyer or contact your Rent Control office.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "bot" && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl p-4 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-card-foreground"
              }`}
            >
              {msg.text}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="text-xs bg-card border border-border rounded-full px-3 py-1.5 text-card-foreground hover:bg-muted transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          placeholder="Ask about your tenant rights..."
          className="flex-1"
        />
        <Button onClick={() => handleSend(input)} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default LegalAssistant;
