
-- Support conversations table
CREATE TABLE public.support_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General Inquiry',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own conversations
CREATE POLICY "Users manage own conversations"
  ON public.support_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Regulators can read all conversations
CREATE POLICY "Regulators read all conversations"
  ON public.support_conversations FOR SELECT
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Regulators can update conversation status
CREATE POLICY "Regulators update conversations"
  ON public.support_conversations FOR UPDATE
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages in their own conversations
CREATE POLICY "Users read own conversation messages"
  ON public.support_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.support_conversations
    WHERE id = support_messages.conversation_id AND user_id = auth.uid()
  ));

-- Users can insert messages in their own conversations
CREATE POLICY "Users insert own conversation messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_user_id AND
    EXISTS (
      SELECT 1 FROM public.support_conversations
      WHERE id = support_messages.conversation_id AND user_id = auth.uid()
    )
  );

-- Regulators can read all messages
CREATE POLICY "Regulators read all messages"
  ON public.support_messages FOR SELECT
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Regulators can insert messages (staff replies)
CREATE POLICY "Regulators insert messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_user_id AND
    has_role(auth.uid(), 'regulator'::app_role)
  );

-- Trigger for updated_at on conversations
CREATE TRIGGER update_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
